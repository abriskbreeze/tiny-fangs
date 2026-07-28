import { PRESENTATION_FACE_INVENTORY } from '../../../shared/face-registry.js';

export const ASSET_MANIFEST_SCHEMA_VERSION = 1;

export const ASSET_VALIDATION_PHASES = Object.freeze({
  DRAFT: 'draft',
  RELEASE: 'release'
});

const CARD_ART_VARIANTS = Object.freeze([
  Object.freeze({
    role: 'source',
    extension: 'png',
    mediaType: 'image',
    minWidth: 2048,
    minHeight: 1536,
    aspectRatio: 4 / 3,
    aspectTolerance: 0.01,
    maxBytes: 8_000_000
  }),
  Object.freeze({
    role: 'detail',
    extension: 'webp',
    mediaType: 'image',
    minWidth: 1600,
    minHeight: 1200,
    aspectRatio: 4 / 3,
    aspectTolerance: 0.01,
    maxBytes: 1_500_000
  }),
  Object.freeze({
    role: 'thumbnail',
    extension: 'webp',
    mediaType: 'image',
    minWidth: 800,
    minHeight: 600,
    aspectRatio: 4 / 3,
    aspectTolerance: 0.01,
    maxBytes: 320_000
  }),
  Object.freeze({
    role: 'fallback',
    extension: 'jpg',
    mediaType: 'image',
    minWidth: 800,
    minHeight: 600,
    aspectRatio: 4 / 3,
    aspectTolerance: 0.01,
    maxBytes: 420_000
  })
]);

function imageSpec(assetId, family, relativePath, {
  width,
  height,
  maxBytes,
  focalPoint = { x: 0.5, y: 0.5 }
}) {
  return {
    assetId,
    family,
    mediaType: 'image',
    focalPoint,
    files: [{
      role: 'runtime',
      path: relativePath,
      mediaType: 'image',
      minWidth: width,
      minHeight: height,
      aspectRatio: width / height,
      aspectTolerance: 0.01,
      maxBytes
    }]
  };
}

function audioSpec(assetId, relativePath, maxBytes = 4_000_000) {
  return {
    assetId,
    family: 'audio',
    mediaType: 'audio',
    focalPoint: null,
    files: [{
      role: 'runtime',
      path: relativePath,
      mediaType: 'audio',
      maxBytes
    }]
  };
}

/**
 * Non-card assets are explicit on purpose. Adding a new runtime dependency
 * requires adding it here, making the release validator fail closed.
 */
export const REQUIRED_NON_CARD_ASSET_SPECS = Object.freeze([
  imageSpec('frame/creature', 'frames', 'src/assets/frames/creature.webp',
    { width: 1536, height: 2304, maxBytes: 1_500_000 }),
  imageSpec('frame/verse-cast', 'frames', 'src/assets/frames/verse-cast.webp',
    { width: 1536, height: 2304, maxBytes: 1_500_000 }),
  imageSpec('frame/verse-set', 'frames', 'src/assets/frames/verse-set.webp',
    { width: 1536, height: 2304, maxBytes: 1_500_000 }),
  imageSpec('frame/token', 'frames', 'src/assets/frames/token.webp',
    { width: 1536, height: 2304, maxBytes: 1_500_000 }),

  imageSpec('back/standard', 'backs', 'src/assets/backs/standard.webp',
    { width: 1536, height: 2304, maxBytes: 1_500_000 }),
  imageSpec('back/set-hidden', 'backs', 'src/assets/backs/set-hidden.webp',
    { width: 1536, height: 2304, maxBytes: 1_500_000 }),

  imageSpec('status/poison', 'statusIcons', 'src/assets/status/poison.webp',
    { width: 512, height: 512, maxBytes: 220_000 }),
  imageSpec('status/trapped', 'statusIcons', 'src/assets/status/trapped.webp',
    { width: 512, height: 512, maxBytes: 220_000 }),
  imageSpec('status/fortified', 'statusIcons', 'src/assets/status/fortified.webp',
    { width: 512, height: 512, maxBytes: 220_000 }),
  imageSpec('status/unbreakable', 'statusIcons', 'src/assets/status/unbreakable.webp',
    { width: 512, height: 512, maxBytes: 220_000 }),

  imageSpec('ui/life-token', 'ui', 'src/assets/ui/life-token.webp',
    { width: 512, height: 512, maxBytes: 280_000 }),
  imageSpec('ui/mana-token', 'ui', 'src/assets/ui/mana-token.webp',
    { width: 512, height: 512, maxBytes: 280_000 }),
  imageSpec('ui/turn-marker', 'ui', 'src/assets/ui/turn-marker.webp',
    { width: 512, height: 512, maxBytes: 280_000 }),
  imageSpec('ui/selection-ring', 'ui', 'src/assets/ui/selection-ring.webp',
    { width: 1024, height: 1024, maxBytes: 500_000 }),
  imageSpec('ui/legal-target-ring', 'ui', 'src/assets/ui/legal-target-ring.webp',
    { width: 1024, height: 1024, maxBytes: 500_000 }),
  imageSpec('ui/divider-rune', 'ui', 'src/assets/ui/divider-rune.webp',
    { width: 512, height: 512, maxBytes: 280_000 }),
  imageSpec('ui/coin-heads', 'ui', 'src/assets/ui/coin-heads.webp',
    { width: 1024, height: 1024, maxBytes: 500_000 }),
  imageSpec('ui/coin-tails', 'ui', 'src/assets/ui/coin-tails.webp',
    { width: 1024, height: 1024, maxBytes: 500_000 }),

  imageSpec('environment/meadow-backdrop', 'environment',
    'src/assets/environment/meadow-backdrop.webp',
    { width: 3840, height: 2160, maxBytes: 8_000_000 }),
  imageSpec('environment/terrain-color', 'environment',
    'src/assets/environment/terrain-color.webp',
    { width: 2048, height: 2048, maxBytes: 4_000_000 }),
  imageSpec('environment/terrain-normal', 'environment',
    'src/assets/environment/terrain-normal.webp',
    { width: 2048, height: 2048, maxBytes: 4_000_000 }),
  imageSpec('environment/water-normal', 'environment',
    'src/assets/environment/water-normal.webp',
    { width: 1024, height: 1024, maxBytes: 2_000_000 }),
  imageSpec('environment/props-atlas', 'environment',
    'src/assets/environment/props-atlas.webp',
    { width: 2048, height: 2048, maxBytes: 4_000_000 }),
  imageSpec('environment/contact-shadow', 'environment',
    'src/assets/environment/contact-shadow.webp',
    { width: 1024, height: 1024, maxBytes: 1_000_000 }),

  audioSpec('audio/ambience-meadow', 'src/assets/audio/ambience-meadow.ogg', 8_000_000),
  audioSpec('audio/card-draw', 'src/assets/audio/card-draw.ogg'),
  audioSpec('audio/card-place', 'src/assets/audio/card-place.ogg'),
  audioSpec('audio/card-flip', 'src/assets/audio/card-flip.ogg'),
  audioSpec('audio/ui-confirm', 'src/assets/audio/ui-confirm.ogg'),
  audioSpec('audio/ui-cancel', 'src/assets/audio/ui-cancel.ogg'),
  audioSpec('audio/summon', 'src/assets/audio/summon.ogg'),
  audioSpec('audio/attack', 'src/assets/audio/attack.ogg'),
  audioSpec('audio/damage', 'src/assets/audio/damage.ogg'),
  audioSpec('audio/heal', 'src/assets/audio/heal.ogg'),
  audioSpec('audio/cast', 'src/assets/audio/cast.ogg'),
  audioSpec('audio/trigger', 'src/assets/audio/trigger.ogg'),
  audioSpec('audio/coin', 'src/assets/audio/coin.ogg'),
  audioSpec('audio/victory', 'src/assets/audio/victory.ogg'),
  audioSpec('audio/defeat', 'src/assets/audio/defeat.ogg')
]);

export const REQUIRED_ASSET_FAMILIES = Object.freeze([
  'cardFaces',
  'frames',
  'backs',
  'statusIcons',
  'ui',
  'environment',
  'audio'
]);

function emptyProvenance() {
  return {
    creator: null,
    origin: null,
    license: null,
    licenseUrl: null,
    rightsConfirmed: false
  };
}

function buildCardFaceAsset(face) {
  const faceId = face.presentationFaceId;
  return {
    assetId: `card-face/${faceId}`,
    family: 'cardFaces',
    mediaType: 'image',
    canonicalFaceId: faceId,
    faceKind: face.kind,
    faceSource: face.source,
    focalPoint: { x: 0.5, y: 0.42 },
    provenance: emptyProvenance(),
    files: CARD_ART_VARIANTS.map(variant => ({
      role: variant.role,
      path: `src/assets/cards/faces/${faceId}/${variant.role}.${variant.extension}`,
      mediaType: variant.mediaType,
      minWidth: variant.minWidth,
      minHeight: variant.minHeight,
      aspectRatio: variant.aspectRatio,
      aspectTolerance: variant.aspectTolerance,
      maxBytes: variant.maxBytes
    }))
  };
}

function buildNonCardAsset(spec) {
  return {
    ...spec,
    focalPoint: spec.focalPoint ? { ...spec.focalPoint } : null,
    provenance: emptyProvenance(),
    files: spec.files.map(file => ({ ...file }))
  };
}

export function buildPresentationAssetManifest({
  faceInventory = PRESENTATION_FACE_INVENTORY
} = {}) {
  const cardFaces = faceInventory.map(buildCardFaceAsset);
  const nonCardAssets = REQUIRED_NON_CARD_ASSET_SPECS.map(buildNonCardAsset);

  return {
    schemaVersion: ASSET_MANIFEST_SCHEMA_VERSION,
    lifecycle: 'planning',
    generatedFrom: {
      contract: 'PRESENTATION_FACE_INVENTORY',
      canonicalFaceCount: faceInventory.length
    },
    assets: [...cardFaces, ...nonCardAssets]
  };
}

/**
 * The checked-in manifest is intentionally a planning manifest. Its paths are
 * required production destinations, not claims that production files exist.
 */
export const PRESENTATION_ASSET_MANIFEST = buildPresentationAssetManifest();

