import { describe, expect, it } from 'vitest';
import { CREATURES } from '../../shared/cards.js';
import {
  PRESENTATION_FACE_INVENTORY,
  resolvePresentationFaceId
} from '../../shared/face-registry.js';
import {
  ASSET_VALIDATION_PHASES,
  PRESENTATION_ASSET_MANIFEST,
  REQUIRED_ASSET_FAMILIES,
  REQUIRED_NON_CARD_ASSET_SPECS,
  buildPresentationAssetManifest
} from '../../src/presentation/assets/manifest.js';
import { validatePresentationAssetManifest } from '../../src/presentation/assets/manifest-validation.js';
import { createRepresentativeRuntimeFaces } from '../../src/presentation/assets/runtime-face-samples.js';

function completeReleaseFixture(manifest = PRESENTATION_ASSET_MANIFEST) {
  const releaseManifest = structuredClone(manifest);
  const fileIndex = new Map();
  let serial = 1;

  for (const asset of releaseManifest.assets) {
    asset.provenance = {
      creator: 'Synthetic validator fixture',
      origin: 'tests/presentation/asset-manifest.test.js',
      license: 'Test-only',
      licenseUrl: null,
      rightsConfirmed: true
    };

    for (const file of asset.files) {
      fileIndex.set(file.path, {
        bytes: Math.min(file.maxBytes, 100_000),
        sha256: serial.toString(16).padStart(64, '0'),
        ...(file.mediaType === 'image'
          ? { width: file.minWidth, height: file.minHeight }
          : {})
      });
      serial += 1;
    }
  }

  return { releaseManifest, fileIndex };
}

function codes(report) {
  return [...report.errors, ...report.warnings].map(item => item.code);
}

describe('presentation asset manifest inventory', () => {
  it('generates one card-face entry for all 56 stable canonical identities', () => {
    const cardFaces = PRESENTATION_ASSET_MANIFEST.assets
      .filter(asset => asset.family === 'cardFaces');

    expect(cardFaces).toHaveLength(56);
    expect(cardFaces.map(asset => asset.canonicalFaceId)).toStrictEqual(
      PRESENTATION_FACE_INVENTORY.map(face => face.presentationFaceId)
    );
    expect(new Set(cardFaces.map(asset => asset.assetId)).size).toBe(56);

    const antling = cardFaces.find(asset => asset.canonicalFaceId === 'antling');
    expect(antling).toMatchObject({
      assetId: 'card-face/antling',
      faceKind: 'token',
      faceSource: 'derived'
    });
    expect(antling.files.map(file => file.role)).toStrictEqual([
      'source',
      'detail',
      'thumbnail',
      'fallback'
    ]);
  });

  it('contains every explicit non-card family and required asset ID', () => {
    const families = new Set(
      PRESENTATION_ASSET_MANIFEST.assets.map(asset => asset.family)
    );
    for (const family of REQUIRED_ASSET_FAMILIES) {
      expect(families.has(family)).toBe(true);
    }

    const assetIds = new Set(
      PRESENTATION_ASSET_MANIFEST.assets.map(asset => asset.assetId)
    );
    for (const spec of REQUIRED_NON_CARD_ASSET_SPECS) {
      expect(assetIds.has(spec.assetId)).toBe(true);
    }
  });

  it('derives card paths from stable IDs, never display copy or rules text', () => {
    const emberfang = PRESENTATION_ASSET_MANIFEST.assets.find(
      asset => asset.canonicalFaceId === 'emberfang'
    );
    expect(emberfang.assetId).toBe('card-face/emberfang');
    expect(emberfang.files.every(file =>
      file.path.includes('/emberfang/')
    )).toBe(true);

    const serialized = JSON.stringify(emberfang);
    expect(serialized).not.toContain(CREATURES.emberfang.name);
    expect(serialized).not.toContain(CREATURES.emberfang.subtitle);
    expect(serialized).not.toContain(CREATURES.emberfang.ability.text);
    expect(serialized).not.toContain(CREATURES.emberfang.art);
  });
});

describe('presentation asset manifest phases', () => {
  it('keeps absent production art as draft warnings and strict release blockers', () => {
    const runtimeFaces = createRepresentativeRuntimeFaces();
    const draft = validatePresentationAssetManifest(PRESENTATION_ASSET_MANIFEST, {
      phase: ASSET_VALIDATION_PHASES.DRAFT,
      runtimeFaces
    });
    const release = validatePresentationAssetManifest(PRESENTATION_ASSET_MANIFEST, {
      phase: ASSET_VALIDATION_PHASES.RELEASE,
      runtimeFaces
    });

    expect(draft.ok).toBe(true);
    expect(draft.errors).toHaveLength(0);
    expect(draft.warnings.length).toBeGreaterThan(0);
    expect(codes(draft)).toContain('MISSING_FILE');
    expect(codes(draft)).toContain('MISSING_PROVENANCE');

    expect(release.ok).toBe(false);
    expect(release.warnings).toHaveLength(0);
    expect(codes(release)).toContain('MISSING_FILE');
    expect(codes(release)).toContain('MISSING_PROVENANCE');
  });

  it('can pass release mechanics only with complete synthetic test metadata', () => {
    const { releaseManifest, fileIndex } = completeReleaseFixture();
    const report = validatePresentationAssetManifest(releaseManifest, {
      phase: ASSET_VALIDATION_PHASES.RELEASE,
      fileIndex,
      runtimeFaces: createRepresentativeRuntimeFaces()
    });

    expect(report).toMatchObject({
      phase: 'release',
      ok: true,
      errors: [],
      warnings: []
    });
    expect(report.summary.canonicalFaceCount).toBe(56);
    expect(report.summary.requiredFileCount).toBeGreaterThan(56);
  });
});

describe('presentation asset manifest validation', () => {
  it('fails when canonical or explicit non-card entries are absent', () => {
    const missingFace = structuredClone(PRESENTATION_ASSET_MANIFEST);
    missingFace.assets = missingFace.assets.filter(
      asset => asset.canonicalFaceId !== 'antling'
    );
    const faceReport = validatePresentationAssetManifest(missingFace);
    expect(faceReport.ok).toBe(false);
    expect(faceReport.errors).toContainEqual(expect.objectContaining({
      code: 'MISSING_CANONICAL_FACE',
      canonicalFaceId: 'antling'
    }));

    const missingBack = structuredClone(PRESENTATION_ASSET_MANIFEST);
    missingBack.assets = missingBack.assets.filter(
      asset => asset.assetId !== 'back/standard'
    );
    const backReport = validatePresentationAssetManifest(missingBack);
    expect(backReport.ok).toBe(false);
    expect(backReport.errors).toContainEqual(expect.objectContaining({
      code: 'MISSING_REQUIRED_ENTRY',
      assetId: 'back/standard'
    }));
  });

  it('rejects duplicate hashes, invalid geometry, oversized files, and focal points', () => {
    const { releaseManifest, fileIndex } = completeReleaseFixture();
    const first = releaseManifest.assets[0];
    const second = releaseManifest.assets[1];
    const firstFile = first.files[0];
    const secondFile = second.files[0];
    const firstRecord = fileIndex.get(firstFile.path);
    const secondRecord = fileIndex.get(secondFile.path);

    secondRecord.sha256 = firstRecord.sha256;
    firstRecord.width = 100;
    firstRecord.height = 100;
    firstRecord.bytes = firstFile.maxBytes + 1;
    first.focalPoint = { x: 1.1, y: -0.1 };

    const report = validatePresentationAssetManifest(releaseManifest, {
      phase: ASSET_VALIDATION_PHASES.RELEASE,
      fileIndex
    });

    expect(report.ok).toBe(false);
    expect(codes(report)).toEqual(expect.arrayContaining([
      'DUPLICATE_CONTENT_HASH',
      'BELOW_MIN_DIMENSIONS',
      'ASPECT_RATIO_MISMATCH',
      'OVERSIZED_SOURCE',
      'INVALID_FOCAL_POINT'
    ]));
  });

  it('requires complete provenance in release phase', () => {
    const { releaseManifest, fileIndex } = completeReleaseFixture();
    releaseManifest.assets[0].provenance.rightsConfirmed = false;

    const report = validatePresentationAssetManifest(releaseManifest, {
      phase: ASSET_VALIDATION_PHASES.RELEASE,
      fileIndex
    });

    expect(report.ok).toBe(false);
    expect(report.errors).toContainEqual(expect.objectContaining({
      code: 'MISSING_PROVENANCE',
      assetId: releaseManifest.assets[0].assetId
    }));
  });
});

describe('runtime-derived presentation faces', () => {
  it('resolves representative Antling produced by the real engine', () => {
    const runtimeFaces = createRepresentativeRuntimeFaces();

    expect(runtimeFaces).toHaveLength(1);
    expect(runtimeFaces[0].name).toBe('Antling');
    expect(resolvePresentationFaceId(runtimeFaces[0])).toBe('antling');

    const report = validatePresentationAssetManifest(PRESENTATION_ASSET_MANIFEST, {
      runtimeFaces
    });
    expect(report.errors).toHaveLength(0);
  });

  it('fails closed for a future runtime-derived face without registration', () => {
    const futureToken = {
      id: 'hiveling',
      name: 'Future Token Display Name',
      presentationFaceId: 'future-token'
    };

    expect(resolvePresentationFaceId(futureToken)).toBeNull();
    const report = validatePresentationAssetManifest(PRESENTATION_ASSET_MANIFEST, {
      runtimeFaces: [futureToken]
    });

    expect(report.ok).toBe(false);
    expect(report.errors).toContainEqual(expect.objectContaining({
      code: 'UNREGISTERED_RUNTIME_FACE'
    }));
  });

  it('fails when a newly registered inventory face is not manifested', () => {
    const futureInventory = [
      ...PRESENTATION_FACE_INVENTORY,
      {
        source: 'derived',
        sourceId: 'future-token',
        kind: 'token',
        presentationFaceId: 'future-token'
      }
    ];

    const report = validatePresentationAssetManifest(PRESENTATION_ASSET_MANIFEST, {
      faceInventory: futureInventory,
      runtimeFaces: [{ presentationFaceId: 'future-token' }],
      resolveFaceId: card => card.presentationFaceId
    });

    expect(report.ok).toBe(false);
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'MISSING_CANONICAL_FACE',
        canonicalFaceId: 'future-token'
      }),
      expect.objectContaining({
        code: 'MISSING_RUNTIME_FACE_ASSET',
        canonicalFaceId: 'future-token'
      })
    ]));
  });

  it('generates a future registered face entry when the inventory is updated', () => {
    const manifest = buildPresentationAssetManifest({
      faceInventory: [{
        source: 'derived',
        sourceId: 'future-token',
        kind: 'token',
        presentationFaceId: 'future-token'
      }]
    });

    expect(manifest.assets.find(asset =>
      asset.canonicalFaceId === 'future-token'
    )).toMatchObject({
      assetId: 'card-face/future-token',
      faceKind: 'token',
      faceSource: 'derived'
    });
  });
});

