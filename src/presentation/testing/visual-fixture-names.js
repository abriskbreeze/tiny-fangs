export const VISUAL_FIXTURE_NAMES = Object.freeze([
  'damage-reduction',
  'deck-out',
  'defeat',
  'dense-board-statuses',
  'healing',
  'inspection-overlays',
  'ko-promotion',
  'multi-hit',
  'multiplayer-hidden',
  'normal-attack',
  'opening-empty-board',
  'opening-hand-triad',
  'optional-trigger-pending',
  'retaliation',
  'skitter-response-pending',
  'target-selection',
  'victory',
]);

export function listVisualFixtureNames() {
  return [...VISUAL_FIXTURE_NAMES];
}
