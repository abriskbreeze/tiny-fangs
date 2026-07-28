import {
  ASSET_MANIFEST_SCHEMA_VERSION,
  ASSET_VALIDATION_PHASES,
  REQUIRED_ASSET_FAMILIES,
  REQUIRED_NON_CARD_ASSET_SPECS
} from './manifest.js';
import {
  PRESENTATION_FACE_INVENTORY,
  resolvePresentationFaceId
} from '../../../shared/face-registry.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeFileIndex(fileIndex) {
  if (fileIndex instanceof Map) {
    return fileIndex;
  }

  return new Map(Object.entries(fileIndex ?? {}));
}

function issue(severity, code, message, context = {}) {
  return { severity, code, message, ...context };
}

function readinessSeverity(phase) {
  return phase === ASSET_VALIDATION_PHASES.RELEASE ? 'error' : 'warning';
}

function validateProvenance(asset, phase, issues) {
  const provenance = asset.provenance;
  const complete = isObject(provenance) &&
    isNonEmptyString(provenance.creator) &&
    isNonEmptyString(provenance.origin) &&
    isNonEmptyString(provenance.license) &&
    provenance.rightsConfirmed === true;

  if (!complete) {
    issues.push(issue(
      readinessSeverity(phase),
      'MISSING_PROVENANCE',
      `Asset ${asset.assetId} lacks complete creator, origin, license, and rights metadata.`,
      { assetId: asset.assetId }
    ));
  }
}

function validateFocalPoint(asset, issues) {
  if (asset.mediaType !== 'image') {
    return;
  }

  const focalPoint = asset.focalPoint;
  if (!isObject(focalPoint) ||
      !Number.isFinite(focalPoint.x) ||
      !Number.isFinite(focalPoint.y) ||
      focalPoint.x < 0 ||
      focalPoint.x > 1 ||
      focalPoint.y < 0 ||
      focalPoint.y > 1) {
    issues.push(issue(
      'error',
      'INVALID_FOCAL_POINT',
      `Image asset ${asset.assetId} requires a normalized focal point.`,
      { assetId: asset.assetId }
    ));
  }
}

function validatePresentFile(asset, file, record, issues) {
  const context = {
    assetId: asset.assetId,
    fileRole: file.role,
    path: file.path
  };

  if (!Number.isInteger(record.bytes) || record.bytes <= 0) {
    issues.push(issue('error', 'INVALID_FILE_SIZE',
      `File metadata for ${file.path} requires a positive byte count.`, context));
  } else if (Number.isFinite(file.maxBytes) && record.bytes > file.maxBytes) {
    issues.push(issue('error', 'OVERSIZED_SOURCE',
      `File ${file.path} exceeds its ${file.maxBytes}-byte budget.`, context));
  }

  if (!isNonEmptyString(record.sha256) || !SHA256_PATTERN.test(record.sha256)) {
    issues.push(issue('error', 'INVALID_CONTENT_HASH',
      `File metadata for ${file.path} requires a SHA-256 hash.`, context));
  }

  if (file.mediaType !== 'image') {
    return;
  }

  if (!Number.isInteger(record.width) || !Number.isInteger(record.height) ||
      record.width <= 0 || record.height <= 0) {
    issues.push(issue('error', 'MISSING_IMAGE_DIMENSIONS',
      `Image metadata for ${file.path} requires positive pixel dimensions.`, context));
    return;
  }

  if (record.width < file.minWidth || record.height < file.minHeight) {
    issues.push(issue('error', 'BELOW_MIN_DIMENSIONS',
      `Image ${file.path} is below its ${file.minWidth}x${file.minHeight} intent.`,
      context));
  }

  const actualRatio = record.width / record.height;
  const relativeError = Math.abs(actualRatio - file.aspectRatio) / file.aspectRatio;
  if (relativeError > file.aspectTolerance) {
    issues.push(issue('error', 'ASPECT_RATIO_MISMATCH',
      `Image ${file.path} does not match its aspect-ratio intent.`, context));
  }
}

function validateAssetFiles(asset, phase, fileIndex, issues, hashOwners, pathOwners) {
  if (!Array.isArray(asset.files) || asset.files.length === 0) {
    issues.push(issue('error', 'MISSING_FILE_CONTRACT',
      `Asset ${asset.assetId} has no required file contract.`,
      { assetId: asset.assetId }));
    return;
  }

  const roles = new Set();
  for (const file of asset.files) {
    const context = { assetId: asset.assetId, fileRole: file?.role };
    if (!isObject(file) ||
        !isNonEmptyString(file.role) ||
        !isNonEmptyString(file.path) ||
        !isNonEmptyString(file.mediaType) ||
        !Number.isFinite(file.maxBytes) ||
        file.maxBytes <= 0) {
      issues.push(issue('error', 'INVALID_FILE_CONTRACT',
        `Asset ${asset.assetId} has an invalid required file contract.`, context));
      continue;
    }

    if (roles.has(file.role)) {
      issues.push(issue('error', 'DUPLICATE_FILE_ROLE',
        `Asset ${asset.assetId} repeats file role ${file.role}.`, context));
    }
    roles.add(file.role);

    const priorPathOwner = pathOwners.get(file.path);
    if (priorPathOwner && priorPathOwner !== asset.assetId) {
      issues.push(issue('error', 'DUPLICATE_FILE_PATH',
        `File path ${file.path} is claimed by multiple assets.`,
        { ...context, path: file.path }));
    } else {
      pathOwners.set(file.path, asset.assetId);
    }

    const record = fileIndex.get(file.path);
    if (!record) {
      issues.push(issue(
        readinessSeverity(phase),
        'MISSING_FILE',
        `Required file ${file.path} is not present.`,
        { ...context, path: file.path }
      ));
      continue;
    }

    validatePresentFile(asset, file, record, issues);
    if (isNonEmptyString(record.sha256) && SHA256_PATTERN.test(record.sha256)) {
      const owner = hashOwners.get(record.sha256);
      if (owner && owner.path !== file.path) {
        issues.push(issue('error', 'DUPLICATE_CONTENT_HASH',
          `Files ${owner.path} and ${file.path} have identical content.`,
          { ...context, path: file.path, duplicateOf: owner.path }));
      } else {
        hashOwners.set(record.sha256, {
          assetId: asset.assetId,
          path: file.path
        });
      }
    }
  }
}

function validateCanonicalFaceCoverage(assets, faceInventory, issues) {
  const expectedFaceIds = new Set(
    faceInventory.map(face => face.presentationFaceId)
  );
  const manifestedFaceIds = new Set();

  for (const asset of assets) {
    if (asset.family !== 'cardFaces') {
      continue;
    }

    if (!isNonEmptyString(asset.canonicalFaceId)) {
      issues.push(issue('error', 'MISSING_CANONICAL_FACE_ID',
        `Card-face asset ${asset.assetId} has no canonical face ID.`,
        { assetId: asset.assetId }));
      continue;
    }

    if (manifestedFaceIds.has(asset.canonicalFaceId)) {
      issues.push(issue('error', 'DUPLICATE_CANONICAL_FACE',
        `Canonical face ${asset.canonicalFaceId} has multiple manifest entries.`,
        { assetId: asset.assetId, canonicalFaceId: asset.canonicalFaceId }));
    }
    manifestedFaceIds.add(asset.canonicalFaceId);

    if (!expectedFaceIds.has(asset.canonicalFaceId)) {
      issues.push(issue('error', 'UNREGISTERED_MANIFEST_FACE',
        `Manifest face ${asset.canonicalFaceId} is not in the canonical registry.`,
        { assetId: asset.assetId, canonicalFaceId: asset.canonicalFaceId }));
    }
  }

  for (const faceId of expectedFaceIds) {
    if (!manifestedFaceIds.has(faceId)) {
      issues.push(issue('error', 'MISSING_CANONICAL_FACE',
        `Canonical face ${faceId} has no manifest entry.`,
        { canonicalFaceId: faceId }));
    }
  }
}

function validateRuntimeFaces(assets, runtimeFaces, resolver, issues) {
  const manifestedFaceIds = new Set(
    assets
      .filter(asset => asset.family === 'cardFaces')
      .map(asset => asset.canonicalFaceId)
  );

  for (const runtimeFace of runtimeFaces) {
    const faceId = resolver(runtimeFace);
    if (!faceId) {
      issues.push(issue('error', 'UNREGISTERED_RUNTIME_FACE',
        'A runtime-produced face has no registered presentation identity.'));
      continue;
    }

    if (!manifestedFaceIds.has(faceId)) {
      issues.push(issue('error', 'MISSING_RUNTIME_FACE_ASSET',
        `Runtime face ${faceId} has no manifest asset.`,
        { canonicalFaceId: faceId }));
    }
  }
}

export function validatePresentationAssetManifest(manifest, {
  phase = ASSET_VALIDATION_PHASES.DRAFT,
  fileIndex = new Map(),
  faceInventory = PRESENTATION_FACE_INVENTORY,
  runtimeFaces = [],
  resolveFaceId = resolvePresentationFaceId
} = {}) {
  if (!Object.values(ASSET_VALIDATION_PHASES).includes(phase)) {
    throw new Error(`Unknown asset validation phase: ${String(phase)}`);
  }

  const issues = [];
  if (!isObject(manifest) ||
      manifest.schemaVersion !== ASSET_MANIFEST_SCHEMA_VERSION ||
      !Array.isArray(manifest.assets)) {
    return {
      phase,
      ok: false,
      errors: [issue('error', 'INVALID_MANIFEST',
        'Manifest shape or schema version is invalid.')],
      warnings: []
    };
  }

  const assets = manifest.assets;
  const assetIds = new Set();
  const families = new Set();
  for (const asset of assets) {
    if (!isObject(asset) || !isNonEmptyString(asset.assetId) ||
        !isNonEmptyString(asset.family) || !isNonEmptyString(asset.mediaType)) {
      issues.push(issue('error', 'INVALID_ASSET_ENTRY',
        'Every manifest asset requires an asset ID, family, and media type.'));
      continue;
    }

    if (assetIds.has(asset.assetId)) {
      issues.push(issue('error', 'DUPLICATE_ASSET_ID',
        `Asset ID ${asset.assetId} appears more than once.`,
        { assetId: asset.assetId }));
    }
    assetIds.add(asset.assetId);
    families.add(asset.family);
  }

  for (const family of REQUIRED_ASSET_FAMILIES) {
    if (!families.has(family)) {
      issues.push(issue('error', 'MISSING_REQUIRED_FAMILY',
        `Required asset family ${family} is missing.`, { family }));
    }
  }

  for (const spec of REQUIRED_NON_CARD_ASSET_SPECS) {
    if (!assetIds.has(spec.assetId)) {
      issues.push(issue('error', 'MISSING_REQUIRED_ENTRY',
        `Required non-card asset ${spec.assetId} is missing.`,
        { assetId: spec.assetId, family: spec.family }));
    }
  }

  validateCanonicalFaceCoverage(assets, faceInventory, issues);
  validateRuntimeFaces(assets, runtimeFaces, resolveFaceId, issues);

  const normalizedFiles = normalizeFileIndex(fileIndex);
  const hashOwners = new Map();
  const pathOwners = new Map();
  for (const asset of assets) {
    if (!isObject(asset) || !isNonEmptyString(asset.assetId)) {
      continue;
    }
    validateProvenance(asset, phase, issues);
    validateFocalPoint(asset, issues);
    validateAssetFiles(
      asset,
      phase,
      normalizedFiles,
      issues,
      hashOwners,
      pathOwners
    );
  }

  const errors = issues.filter(item => item.severity === 'error');
  const warnings = issues.filter(item => item.severity === 'warning');
  return {
    phase,
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      assetCount: assets.length,
      canonicalFaceCount: assets.filter(asset => asset.family === 'cardFaces').length,
      requiredFileCount: assets.reduce(
        (count, asset) => count + (Array.isArray(asset.files) ? asset.files.length : 0),
        0
      )
    }
  };
}

