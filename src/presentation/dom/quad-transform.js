// Maps a unit rectangle onto an arbitrary screen quadrilateral with a CSS
// matrix3d (2D projective homography). This is the world-to-screen CSS
// transform contract from plan Phase 3: DOM card faces land exactly on the
// locked camera's golden quadrilaterals, so DOM text/controls and Three
// decals/shadows share one geometry.

// Solves the 8-DOF homography sending (0,0),(w,0),(w,h),(0,h) to the ordered
// [TL,TR,BR,BL] destination corners via the adjugate method.
function homographyFromRect(width, height, [tl, tr, br, bl]) {
  // Basis mapping for destination quad: unit square -> quad.
  const basis = (p0, p1, p2, p3) => {
    const dx1 = p1[0] - p2[0];
    const dx2 = p3[0] - p2[0];
    const dy1 = p1[1] - p2[1];
    const dy2 = p3[1] - p2[1];
    const sx = p0[0] - p1[0] + p2[0] - p3[0];
    const sy = p0[1] - p1[1] + p2[1] - p3[1];
    const det = dx1 * dy2 - dx2 * dy1;
    const g = (sx * dy2 - sy * dx2) / det;
    const h = (dx1 * sy - dy1 * sx) / det;
    return [
      p1[0] - p0[0] + g * p1[0], p3[0] - p0[0] + h * p3[0], p0[0],
      p1[1] - p0[1] + g * p1[1], p3[1] - p0[1] + h * p3[1], p0[1],
      g, h, 1,
    ];
  };
  const m = basis(tl, tr, br, bl);
  // Pre-scale the unit square from the element's pixel box.
  return [
    m[0] / width, m[1] / height, m[2],
    m[3] / width, m[4] / height, m[5],
    m[6] / width, m[7] / height, m[8],
  ];
}

export function matrix3dForQuad(width, height, corners) {
  const h = homographyFromRect(width, height, corners);
  // CSS matrix3d is column-major 4x4; embed the 3x3 homography.
  const m = [
    h[0], h[3], 0, h[6],
    h[1], h[4], 0, h[7],
    0, 0, 1, 0,
    h[2], h[5], 0, h[8],
  ];
  return `matrix3d(${m.map((v) => Number(v.toFixed(8))).join(',')})`;
}

export function applyQuadTransform(element, width, height, corners) {
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.transformOrigin = '0 0';
  element.style.transform = matrix3dForQuad(width, height, corners);
}

// Projects the element's own corners through the same homography for drift
// verification without reading layout.
export function projectRectCorners(width, height, corners) {
  const h = homographyFromRect(width, height, corners);
  const apply = (x, y) => {
    const w = h[6] * x + h[7] * y + h[8];
    return [
      (h[0] * x + h[1] * y + h[2]) / w,
      (h[3] * x + h[4] * y + h[5]) / w,
    ];
  };
  return [apply(0, 0), apply(width, 0), apply(width, height), apply(0, height)];
}
