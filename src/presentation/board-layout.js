// Canonical 1672 × 941 desktop board layout, transcribed from the accepted
// art bible §2.2 anchor map (hash 84b89838…). Centers and envelopes are locked
// two-dimensional composition targets; world-space placement and per-anchor
// projected corner geometry belong to the camera bake-off.

export const CANONICAL_FRAME = Object.freeze({ width: 1672, height: 941, dpr: 1 });

// center: screen px; envelope: axis-aligned allocation box (w × h screen px).
// kind drives graybox card treatment: stack (visible thickness), card (single
// resting card), slot (empty engraved slot), back (face-down), hand (raised fan
// card), region (non-card allocation only — never rendered as a card).
export const BOARD_ANCHORS = Object.freeze([
  { id: 'opp.deck',   center: [361, 264],  envelope: [144, 180], kind: 'stack' },
  { id: 'opp.bench.a', center: [655, 264], envelope: [136, 180], kind: 'slot',  r2Quad: 'R2-Q1' },
  { id: 'opp.bench.b', center: [833, 264], envelope: [126, 180], kind: 'card',  r2Quad: 'R2-Q2' },
  { id: 'opp.active', center: [1065, 252], envelope: [180, 228], kind: 'card',  r2Quad: 'R2-Q3' },
  { id: 'opp.set',    center: [1278, 270], envelope: [108, 154], kind: 'back' },
  { id: 'opp.grave',  center: [1420, 270], envelope: [84, 146],  kind: 'stack' },
  { id: 'me.deck',    center: [344, 576],  envelope: [150, 188], kind: 'stack' },
  { id: 'me.active',  center: [520, 572],  envelope: [176, 238], kind: 'card',  r2Quad: 'R2-Q4' },
  { id: 'me.bench.a', center: [729, 570],  envelope: [136, 184], kind: 'card' },
  { id: 'me.bench.b', center: [912, 568],  envelope: [128, 184], kind: 'card',  r2Quad: 'R2-Q5' },
  { id: 'me.set',     center: [1092, 568], envelope: [130, 184], kind: 'slot',  r2Quad: 'R2-Q6' },
  { id: 'me.grave',   center: [1306, 580], envelope: [104, 160], kind: 'stack' },
]);

export const HAND_LAYOUT = Object.freeze({
  envelope: Object.freeze({ center: [840, 797], size: [624, 228] }),
  cardCenters: Object.freeze([612, 764, 916, 1068]),
  centerY: 797,
  // Bible §9.5: nominal resting hand card at the four-across spacing.
  cardSize: Object.freeze([150, 227]),
  rotationsDeg: Object.freeze([-4, -1.5, 1.5, 4]),
});

export const DIVIDER = Object.freeze({
  centerY: 414,
  diamondCenterX: 836,
  // §4.1: band spans 68–80% of frame width under the §2.1 method.
  bandSpanPx: [1137, 1338],
  coreThicknessPx: [6, 12],
});

// §3.1.1 immutable independent R2 quadrilateral targets. Ordered TL,TR,BR,BL
// at original 1672 × 941 resolution. These are measured from the reference and
// may never be regenerated from a camera candidate.
export const R2_QUAD_TARGETS = Object.freeze({
  'R2-Q1': { corners: [[602, 175], [726, 176], [719, 350], [589, 349]], uncertaintyPx: 4 },
  'R2-Q2': { corners: [[777, 179], [887, 180], [893, 352], [773, 352]], uncertaintyPx: 3 },
  'R2-Q3': { corners: [[985, 141], [1143, 143], [1153, 353], [977, 351]], uncertaintyPx: 4 },
  'R2-Q4': { corners: [[448, 456], [606, 458], [595, 692], [428, 690]], uncertaintyPx: 4 },
  'R2-Q5': { corners: [[862, 479], [974, 481], [978, 658], [852, 657]], uncertaintyPx: 3 },
  'R2-Q6': { corners: [[1030, 476], [1150, 477], [1158, 657], [1024, 655]], uncertaintyPx: 4 },
});

// §3.1.1 derived-geometry helpers. Angles are degrees clockwise from screen +x
// (screen y grows downward); lean is degrees from screen +y; convergence is
// |leftLean − rightLean|; foreshortening is mean(left,right)/mean(top,bottom).
export function quadMetrics(corners) {
  const [tl, tr, br, bl] = corners;
  const edge = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const top = edge(tl, tr);
  const bottom = edge(bl, br);
  const left = edge(tl, bl);
  const right = edge(tr, br);
  const angleDeg = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const leanDeg = (a, b) => (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  const topAngle = angleDeg(tl, tr);
  const bottomAngle = angleDeg(bl, br);
  const leftLean = leanDeg(tl, bl);
  const rightLean = leanDeg(tr, br);
  return {
    topAngle,
    bottomAngle,
    topBottomRatio: top / bottom,
    leftRightRatio: left / right,
    convergenceDeg: Math.abs(leftLean - rightLean),
    foreshortening: ((left + right) / 2) / ((top + bottom) / 2),
  };
}

export function residualReport(candidateQuads) {
  const perAnchor = {};
  for (const [quadId, target] of Object.entries(R2_QUAD_TARGETS)) {
    const candidate = candidateQuads[quadId];
    if (!candidate) {
      perAnchor[quadId] = { missing: true };
      continue;
    }
    const cornerResiduals = target.corners.map((tc, i) => {
      const cc = candidate[i];
      return {
        dx: cc[0] - tc[0],
        dy: cc[1] - tc[1],
        euclidean: Math.hypot(cc[0] - tc[0], cc[1] - tc[1]),
      };
    });
    const euclideans = cornerResiduals.map((r) => r.euclidean);
    const tm = quadMetrics(target.corners);
    const cm = quadMetrics(candidate);
    perAnchor[quadId] = {
      cornerResiduals,
      rmsCornerResidual: Math.sqrt(euclideans.reduce((s, e) => s + e * e, 0) / 4),
      maxCornerResidual: Math.max(...euclideans),
      topAngleResidual: cm.topAngle - tm.topAngle,
      bottomAngleResidual: cm.bottomAngle - tm.bottomAngle,
      topBottomRatioResidual: cm.topBottomRatio - tm.topBottomRatio,
      leftRightRatioResidual: cm.leftRightRatio - tm.leftRightRatio,
      convergenceResidual: cm.convergenceDeg - tm.convergenceDeg,
      foreshorteningResidual: cm.foreshortening - tm.foreshortening,
      uncertaintyPx: target.uncertaintyPx,
      outsideUncertainty: Math.max(...euclideans) > target.uncertaintyPx * Math.SQRT2,
    };
  }
  const all = Object.values(perAnchor).filter((r) => !r.missing);
  return {
    perAnchor,
    aggregate: {
      meanRms: all.reduce((s, r) => s + r.rmsCornerResidual, 0) / all.length,
      maxCorner: Math.max(...all.map((r) => r.maxCornerResidual)),
      countOutsideUncertainty: all.filter((r) => r.outsideUncertainty).length,
    },
  };
}
