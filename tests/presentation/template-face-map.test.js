import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_FACE_INVENTORY } from '../../shared/face-registry.js';
import { PRESENTATION_ASSET_MANIFEST } from '../../src/presentation/assets/manifest.js';
import {
  TEMPLATE_ART_TIER,
  TEMPLATE_FOCAL_POINTS,
  TEMPLATE_KEYS,
  templateFilesForFace,
  templateKeyForFace,
} from '../../src/presentation/assets/template-face-map.js';

// Phase 6 TEMPLATE MODE exit contracts (user decision 2026-07-28): every
// renderable face resolves to a faction template through the registry, the
// template files exist at every canonical manifest path, and the manifest
// records the placeholder tier without any provenance claim.

describe('template face mapping', () => {
  it('resolves every canonical face to a known template key', () => {
    for (const face of PRESENTATION_FACE_INVENTORY) {
      const key = templateKeyForFace(face.presentationFaceId);
      expect(TEMPLATE_KEYS, face.presentationFaceId).toContain(key);
      expect(TEMPLATE_FOCAL_POINTS[key]).toBeDefined();
    }
  });

  it('maps deckless catalog faces and derived antling to the token template', () => {
    for (const faceId of ['piranix', 'reflector', 'manaSurge', 'antling']) {
      expect(templateKeyForFace(faceId), faceId).toBe('token');
    }
  });

  it('has all four variant files on disk for all six templates', () => {
    for (const key of TEMPLATE_KEYS) {
      for (const file of templateFilesForFace()) {
        expect(
          existsSync(`src/assets/cards/templates/${key}/${file}`),
          `${key}/${file}`,
        ).toBe(true);
      }
    }
  });

  it('has every canonical per-face manifest path populated on disk', () => {
    const cardFaces = PRESENTATION_ASSET_MANIFEST.assets.filter(
      (asset) => asset.family === 'cardFaces',
    );
    expect(cardFaces).toHaveLength(56);
    for (const asset of cardFaces) {
      for (const file of asset.files) {
        expect(existsSync(file.path), file.path).toBe(true);
      }
    }
  });

  it('marks every card face placeholder-tier with template focal point and no provenance claim', () => {
    const cardFaces = PRESENTATION_ASSET_MANIFEST.assets.filter(
      (asset) => asset.family === 'cardFaces',
    );
    for (const asset of cardFaces) {
      expect(asset.artTier, asset.assetId).toBe(TEMPLATE_ART_TIER);
      expect(TEMPLATE_KEYS, asset.assetId).toContain(asset.templateKey);
      expect(asset.focalPoint).toStrictEqual(
        TEMPLATE_FOCAL_POINTS[asset.templateKey],
      );
      expect(asset.provenance.rightsConfirmed, asset.assetId).toBe(false);
      expect(asset.provenance.creator, asset.assetId).toBe(null);
    }
  });
});
