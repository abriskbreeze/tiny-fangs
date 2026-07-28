// Card chassis geometry — art bible §7 (accepted hash 84b89838…), exact
// §7.4 half-open (left, top, right, bottom) safe rectangles authored at the
// 333 × 505 unprojected chassis. This module is the single source for card
// layout; the browser chassis spec measures the rendered DOM against it and
// the unit suite enforces the bible's own sibling non-overlap contract.

export const CHASSIS_WIDTH = 333;
export const CHASSIS_HEIGHT = 505;

// Nominal unprojected ratio and authored acceptance range (§7.1).
export const CHASSIS_RATIO = { nominal: 0.660, min: 0.645, max: 0.670 };

// Cumulative left/right physical-edge-to-aperture inset per side (§7.2).
export const APERTURE_INSET_RANGE = { min: 0.105, max: 0.125 };

// §7.4 rectangles per face family. null means N/A for that family.
const R = (left, top, right, bottom) => ({ left, top, right, bottom });

export const SAFE_RECTS = {
  creature: {
    cost: R(8, 8, 76, 76),
    nameplateOuter: R(42, 228, 292, 288),
    titleText: R(52, 233, 282, 283),
    typeSubtitle: R(82, 204, 292, 226),
    artFocalSafe: R(42, 78, 292, 202),
    familySeal: R(145, 290, 188, 327),
    rulesText: R(42, 329, 292, 435),
    footer: R(84, 457, 249, 495),
    attack: R(8, 437, 78, 501),
    health: R(255, 437, 325, 501),
    statusStack: R(295, 84, 325, 220),
    inspectGlyph: R(281, 10, 325, 54),
  },
  cast: {
    cost: R(8, 8, 76, 76),
    nameplateOuter: R(42, 228, 292, 288),
    titleText: R(52, 233, 282, 283),
    typeSubtitle: R(82, 204, 292, 226),
    artFocalSafe: R(42, 78, 292, 202),
    familySeal: R(145, 290, 188, 327),
    rulesText: R(42, 329, 292, 455),
    footer: R(42, 457, 292, 495),
    statusStack: R(295, 84, 325, 220),
    inspectGlyph: R(281, 10, 325, 54),
  },
  set: {
    cost: R(8, 8, 76, 76),
    nameplateOuter: R(42, 228, 292, 288),
    titleText: R(52, 233, 282, 283),
    typeSubtitle: R(82, 204, 292, 226),
    artFocalSafe: R(42, 78, 292, 202),
    familySeal: R(145, 290, 188, 327),
    rulesText: R(42, 329, 292, 455),
    footer: R(42, 457, 292, 495),
    statusStack: R(295, 84, 325, 220),
    inspectGlyph: R(281, 10, 325, 54), // owner-visible only (§7.4)
  },
  back: {
    artFocalSafe: R(24, 24, 309, 481),
  },
};

// Nested-by-design pairs excluded from the sibling non-overlap check (§7.4):
// a text box inside its declared container.
export const NESTED_PAIRS = [
  ['titleText', 'nameplateOuter'],
];

export const SIBLING_MIN_GAP_PX = 2;
export const FOOTER_TO_STAT_MIN_GAP_PX = 6;

// §7.4 nameplate contract: 250 × 60 outer, 230 × 50 text box, 22 px type at
// fixed 24.5 px line height, 10/5 px padding, at most two lines.
export const NAMEPLATE = {
  outerWidth: 250,
  outerHeight: 60,
  textWidth: 230,
  textHeight: 50,
  fontSizePx: 22,
  lineHeightPx: 24.5,
  paddingX: 10,
  paddingY: 5,
  maxLines: 2,
  minClearancePx: 2,
};

// §7.4 font/nameplate catalog fixtures — all three must render with zero
// clipping, zero ellipsis, and ≥2 px clearance, or the font candidate fails.
export const NAMEPLATE_FIXTURES = [
  { id: 'callOfTheWild', name: 'Call of the Wild' },
  { id: 'predatorsMark', name: "Predator's Mark" },
  { id: 'bladewhisker', name: 'Bladewhisker' },
];

// §5 sampled palette roles used by the chassis.
export const PALETTE = {
  creatureAmber: '#B47015',
  castTeal: '#277A79',
  setPlum: '#6A5A66',
  cardBackNavy: '#372F3F',
  parchment: '#DCBA96',
  ink: '#3B2317',
  filigreeHighlight: '#EEC34E',
  ivoryLip: '#DEBB91',
};

export function rectWidth(rect) {
  return rect.right - rect.left;
}

export function rectHeight(rect) {
  return rect.bottom - rect.top;
}

function horizontalGap(a, b) {
  if (a.right <= b.left) return b.left - a.right;
  if (b.right <= a.left) return a.left - b.right;
  return -1; // horizontal overlap
}

function verticalGap(a, b) {
  if (a.bottom <= b.top) return b.top - a.bottom;
  if (b.bottom <= a.top) return a.top - b.bottom;
  return -1; // vertical overlap
}

// Half-open rectangles overlap when they intersect on both axes.
export function rectsOverlap(a, b) {
  return horizontalGap(a, b) < 0 && verticalGap(a, b) < 0;
}

// Minimum axis gap between two non-overlapping rectangles.
export function rectGap(a, b) {
  const h = horizontalGap(a, b);
  const v = verticalGap(a, b);
  if (h < 0 && v < 0) return -1;
  if (h < 0) return v;
  if (v < 0) return h;
  return Math.min(h, v);
}
