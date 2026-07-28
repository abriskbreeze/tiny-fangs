import { CREATURES, VERSES } from './cards.js';

export const DERIVED_FACE_REGISTRY = Object.freeze({
  antling: Object.freeze({
    kind: 'token',
    presentationFaceId: 'antling'
  })
});

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function collectSummonTokenReferences(value, references = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSummonTokenReferences(item, references);
    }
    return references;
  }

  if (!value || typeof value !== 'object') {
    return references;
  }

  if (value.type === 'summonToken') {
    references.push(value.token);
  }

  for (const nested of Object.values(value)) {
    collectSummonTokenReferences(nested, references);
  }

  return references;
}

export function buildPresentationFaceInventory({
  creatures = CREATURES,
  verses = VERSES,
  derivedFaces = DERIVED_FACE_REGISTRY
} = {}) {
  const inventory = [];
  const registeredIds = new Map();

  function addCatalogFaces(catalog, kind) {
    for (const [sourceId, card] of Object.entries(catalog)) {
      if (!card || typeof card !== 'object' || !isNonEmptyString(card.id)) {
        throw new Error(`Invalid ${kind} catalog face: ${sourceId}`);
      }
      if (sourceId !== card.id) {
        throw new Error(`Catalog face key/id mismatch: ${sourceId}/${card.id}`);
      }
      if (registeredIds.has(card.id)) {
        throw new Error(`Duplicate catalog presentation face ID: ${card.id}`);
      }

      registeredIds.set(card.id, 'catalog');
      inventory.push(Object.freeze({
        source: 'catalog',
        sourceId,
        kind,
        presentationFaceId: card.id
      }));
    }
  }

  addCatalogFaces(creatures, 'creature');
  addCatalogFaces(verses, 'verse');

  for (const [sourceId, face] of Object.entries(derivedFaces)) {
    if (!face || typeof face !== 'object' ||
        !isNonEmptyString(face.kind) ||
        !isNonEmptyString(face.presentationFaceId)) {
      throw new Error(`Invalid derived presentation face: ${sourceId}`);
    }

    const faceId = face.presentationFaceId;
    if (registeredIds.has(faceId)) {
      const existingSource = registeredIds.get(faceId);
      if (existingSource === 'catalog') {
        throw new Error(`Derived/catalog presentation face collision: ${faceId}`);
      }
      throw new Error(`Duplicate derived presentation face ID: ${faceId}`);
    }

    registeredIds.set(faceId, 'derived');
    inventory.push(Object.freeze({
      source: 'derived',
      sourceId,
      kind: face.kind,
      presentationFaceId: faceId
    }));
  }

  const tokenReferences = collectSummonTokenReferences([
    ...Object.values(creatures),
    ...Object.values(verses)
  ]);
  for (const token of tokenReferences) {
    if (!isNonEmptyString(token) ||
        !Object.prototype.hasOwnProperty.call(derivedFaces, token)) {
      throw new Error(`Unregistered summonToken reference: ${String(token)}`);
    }
  }

  return Object.freeze(inventory);
}

export const PRESENTATION_FACE_INVENTORY = buildPresentationFaceInventory();

const CATALOG_FACE_IDS = new Set(
  PRESENTATION_FACE_INVENTORY
    .filter(face => face.source === 'catalog')
    .map(face => face.presentationFaceId)
);

const DERIVED_FACE_IDS = new Set(
  PRESENTATION_FACE_INVENTORY
    .filter(face => face.source === 'derived')
    .map(face => face.presentationFaceId)
);

export function resolvePresentationFaceId(card) {
  if (!card || typeof card !== 'object') {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(card, 'presentationFaceId')) {
    return DERIVED_FACE_IDS.has(card.presentationFaceId)
      ? card.presentationFaceId
      : null;
  }

  return CATALOG_FACE_IDS.has(card.id) ? card.id : null;
}

export function stampDerivedPresentationFace(card, registryKey) {
  if (!card || typeof card !== 'object') {
    throw new TypeError('A card object is required');
  }

  if (!Object.prototype.hasOwnProperty.call(DERIVED_FACE_REGISTRY, registryKey)) {
    throw new Error(`Unregistered derived face: ${String(registryKey)}`);
  }

  card.presentationFaceId = DERIVED_FACE_REGISTRY[registryKey].presentationFaceId;
  return card;
}
