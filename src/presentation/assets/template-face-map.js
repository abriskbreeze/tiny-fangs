// Phase 6 TEMPLATE MODE (user decision 2026-07-28): every renderable face
// maps to one of six reusable faction template art pieces. These are
// placeholder-tier assets — art-pending, no provenance claim — and the
// strict-release validator stays honestly red on their duplicate hashes and
// missing provenance until the user's real per-card art replaces them.

import { DECKS } from '../../../shared/cards.js';

export const TEMPLATE_KEYS = Object.freeze([
  'shadow', 'fang', 'venom', 'swarm', 'shell', 'token',
]);

// Focal point of each template's motif in normalized 4:3 frame coordinates,
// used as the manifest focal point for every face on that template.
export const TEMPLATE_FOCAL_POINTS = Object.freeze({
  shadow: Object.freeze({ x: 0.33, y: 0.42 }), // wisp cluster
  fang: Object.freeze({ x: 0.42, y: 0.46 }),   // howling silhouette
  venom: Object.freeze({ x: 0.66, y: 0.38 }),  // venom droplet
  swarm: Object.freeze({ x: 0.5, y: 0.39 }),   // swarm spiral center
  shell: Object.freeze({ x: 0.5, y: 0.55 }),   // shell spiral
  token: Object.freeze({ x: 0.5, y: 0.45 }),   // fang-ring watermark
});

export const TEMPLATE_ART_TIER = 'template-placeholder';

const deckByCard = (() => {
  const map = new Map();
  for (const [deckId, deck] of Object.entries(DECKS)) {
    for (const cardId of [...deck.creatures, ...deck.verses]) {
      if (!map.has(cardId)) map.set(cardId, deckId);
    }
  }
  return map;
})();

// Faces outside every deck (currently piranix, reflector, manaSurge) and all
// derived faces (antling) use the token/generic template.
export function templateKeyForFace(faceId) {
  return deckByCard.get(faceId) ?? 'token';
}

export function templateFilesForFace() {
  return ['source.png', 'detail.webp', 'thumbnail.webp', 'fallback.jpg'];
}
