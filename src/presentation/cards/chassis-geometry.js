// Card chassis geometry — art bible §7 (accepted hash 84b89838…) as revised by
// the approved 2026-07-29 inset-window layout. Exact half-open (left, top,
// right, bottom) safe rectangles authored at the 333 × 505 unprojected
// chassis. This module is the single source for card layout; the browser
// chassis spec measures the rendered DOM against it and the unit suite
// enforces the sibling non-overlap contract.
//
// Layout revision (approved): the art window is a 7:5 landscape window inset
// inside an opaque frame — 280 × 200 at 39.6% of chassis height, up from the
// old 250 × 124 letterbox at 24.6% — and the nameplate moved from a mid-card
// banner to a top band running beside the cost medallion.

export const CHASSIS_WIDTH = 333;
export const CHASSIS_HEIGHT = 505;

// Nominal unprojected ratio and authored acceptance range (§7.1).
export const CHASSIS_RATIO = { nominal: 0.660, min: 0.645, max: 0.670 };

// Cumulative left/right physical-edge-to-parchment-field inset per side
// (§7.2): lip 6 + keyline 2 + family rail 10 + inner keyline 2 = 20 px at 333
// width = 6.006%. The art window is a further inset *inside* that field, so
// the frame reads as an opaque border all the way around the illustration.
export const FRAME_INSET_RANGE = { min: 0.055, max: 0.070 };

// §7.4 rectangles per face family. Absent key means N/A for that family.
const R = (left, top, right, bottom) => ({ left, top, right, bottom });

// Shared front-face furniture. Every front family carries the identical
// approved chassis; only the stat medallions are creature-only.
const FRONT = () => ({
  cost: R(6, 6, 74, 74),
  nameplateOuter: R(80, 22, 307, 68),
  titleText: R(88, 27, 299, 63),
  artFocalSafe: R(26, 78, 306, 278), // 280 × 200, exactly 7:5
  familySeal: R(145, 257, 188, 300), // straddles the art window's bottom edge
  typeSubtitle: R(60, 308, 273, 328),
  rulesText: R(34, 334, 299, 432),
  footer: R(84, 438, 249, 462),
  // Reserved, not rendered — see RESERVED_RECTS below.
  statusStack: R(309, 84, 331, 240),
  inspectGlyph: R(285, 282, 327, 324),
});

export const SAFE_RECTS = {
  creature: {
    ...FRONT(),
    attack: R(6, 437, 74, 499),
    health: R(259, 437, 327, 499),
  },
  cast: FRONT(),
  set: FRONT(),
  back: {
    artFocalSafe: R(24, 24, 309, 481),
  },
};

// Rectangles that are authored and reserved but that `buildCardFace` does not
// currently emit any DOM for. Verified against card-face.js: the builder
// appends art, type, nameplate/title, seal, rules, footer, cost and (creature
// only) attack/health — nothing reads these two. They are held here so the
// frame artwork and the non-overlap contract keep room for them.
export const RESERVED_RECTS = ['statusStack', 'inspectGlyph'];

// Nested-by-design pairs excluded from the sibling non-overlap check (§7.4):
// a text box inside its declared container.
export const NESTED_PAIRS = [
  ['titleText', 'nameplateOuter'],
];

// Overlapping-by-design pairs: the family seal is a stamp deliberately set on
// the art window's lower edge, half on the illustration and half on the
// parchment shelf below it.
export const STRADDLE_PAIRS = [
  ['familySeal', 'artFocalSafe'],
];

export const SIBLING_MIN_GAP_PX = 2;
export const FOOTER_TO_STAT_MIN_GAP_PX = 6;

// The art window's authored aspect. Card illustrations are authored at
// 2100 × 1500 and every derivative keeps this ratio (see ART-SPEC.md §3).
export const ART_WINDOW_RATIO = 7 / 5;

// Nameplate contract (approved top band): 227 × 46 outer, 211 × 36 text box,
// 22 px type at fixed 24.5 px line height, 8/5 px padding, one line.
export const NAMEPLATE = {
  outerWidth: 227,
  outerHeight: 46,
  textWidth: 211,
  textHeight: 36,
  fontSizePx: 22,
  lineHeightPx: 24.5,
  paddingX: 8,
  paddingY: 5,
  maxLines: 1,
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
