// Meadow harness (Phase 7): renders the meadow under the locked camera and
// computes the §12 field rows in-page with the same measurement operators
// applied to the render and to R2, then exposes them for the visual spec.

import * as THREE from 'three';
import { buildMeadowScene } from './meadow-scene.js';

const R2_PATH = '/docs/exec-cb613d03-7a77-4266-bd6b-e0d83428f067.png';

function relLuminance(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function srgbToLab(rgb) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb.map(lin);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  return labFromXyz(x, y, z);
}

function labFromXyz(x, y, z) {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function ciede2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2p = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;
  const rad = (d) => (d * Math.PI) / 180;
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp))
    + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
    + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

function medianRegion(imageData, width, rect) {
  const [left, top, right, bottom] = rect;
  const rs = [];
  const gs = [];
  const bs = [];
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * width + x) * 4;
      rs.push(imageData[i]);
      gs.push(imageData[i + 1]);
      bs.push(imageData[i + 2]);
    }
  }
  const median = (arr) => arr.sort((m, n) => m - n)[arr.length >> 1];
  return [median(rs), median(gs), median(bs)];
}

// §2.1-style divider band metrics on the rendered frame.
function dividerMetrics(imageData, width, height) {
  const coreThreshold = 0.55;
  const columns = [];
  for (let x = 0; x < width; x += 1) {
    let top = -1;
    let bottom = -1;
    for (let y = 380; y < 450; y += 1) {
      const i = (y * width + x) * 4;
      const lum = relLuminance(imageData[i], imageData[i + 1], imageData[i + 2]);
      if (lum > coreThreshold) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    columns.push(top < 0 ? null : { top, bottom, center: (top + bottom) / 2, thickness: bottom - top + 1 });
  }

  // Runs ≥16 px seeded from the central third, gaps ≤130 px bridged.
  const present = columns.map((c) => c !== null);
  let start = -1;
  let end = -1;
  const centralSeed = Math.floor(width / 2);
  if (present[centralSeed] || present[centralSeed - 20] || present[centralSeed + 20]) {
    start = centralSeed;
    end = centralSeed;
    let gap = 0;
    for (let x = centralSeed; x >= 0; x -= 1) {
      if (present[x]) { start = x; gap = 0; } else if (++gap > 130) break;
    }
    gap = 0;
    for (let x = centralSeed; x < width; x += 1) {
      if (present[x]) { end = x; gap = 0; } else if (++gap > 130) break;
    }
  }
  const bandColumns = columns.slice(Math.max(0, start), end + 1).filter(Boolean);
  const centers = bandColumns.map((c) => c.center);
  const thicknesses = bandColumns.map((c) => c.thickness).sort((a, b) => a - b);
  const centerY = centers.length
    ? centers.reduce((sum, v) => sum + v, 0) / centers.length
    : null;
  // Slope: least-squares fit of center vs x over the band.
  let slope = null;
  if (bandColumns.length > 32) {
    const xs = [];
    for (let x = start; x <= end; x += 1) if (columns[x]) xs.push(x);
    const meanX = xs.reduce((s, v) => s + v, 0) / xs.length;
    const meanY = centerY;
    let num = 0;
    let den = 0;
    xs.forEach((x, i) => {
      num += (x - meanX) * (centers[i] - meanY);
      den += (x - meanX) ** 2;
    });
    slope = Math.abs((num / den) * (end - start));
  }

  // Diamond core (§2.1 vertical-thickness-profile): columns whose core
  // thickness exceeds 1.6x the band's median thickness around center x.
  const medianThickness = thicknesses.length
    ? thicknesses[thicknesses.length >> 1]
    : 0;
  let diamondLeft = -1;
  let diamondRight = -1;
  let diamondMaxThickness = 0;
  for (let x = 836 - 80; x < 836 + 80; x += 1) {
    const c = columns[x];
    if (c && c.thickness > Math.max(medianThickness * 1.6, medianThickness + 6)) {
      if (diamondLeft < 0) diamondLeft = x;
      diamondRight = x;
      diamondMaxThickness = Math.max(diamondMaxThickness, c.thickness);
    }
  }
  return {
    bandStart: start,
    bandEnd: end,
    bandSpanFraction: (end - start) / width,
    centerY,
    slope,
    coreThicknessMedian: medianThickness,
    diamond: diamondLeft < 0 ? null : {
      centerX: (diamondLeft + diamondRight) / 2,
      width: diamondRight - diamondLeft + 1,
      height: diamondMaxThickness,
    },
  };
}

async function loadImageData(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return {
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  };
}

const REGIONS = {
  quietUpperMeadow: [690, 70, 950, 135],
  lowerMeadow: [680, 650, 840, 685],
  deepLeftFoliage: [20, 550, 130, 720],
};

async function main() {
  const canvas = document.getElementById('scene-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(1672, 941, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Scene decision (Phase 7 chunk 1): NoToneMapping. A flat-quad bisect
  // proved NeutralToneMapping moves the authored section 5 roles (e.g.
  // #B3A74F -> 172,159,55, blue crushed) while identity output preserves
  // them exactly; the baked cel pipeline authors final colors directly and
  // the section 5 rule-1 LUT constraint is satisfied trivially.
  renderer.toneMapping = THREE.NoToneMapping;

  const mode = new URLSearchParams(window.location.search).get('mode');
  const meadow = buildMeadowScene(renderer, { propsOnly: mode === 'prop-mask' });
  meadow.render();

  // Read back the rendered frame through 2d canvas for symmetric operators.
  const shot = document.createElement('canvas');
  shot.width = 1672;
  shot.height = 941;
  shot.getContext('2d').drawImage(canvas, 0, 0);
  const frame = shot.getContext('2d').getImageData(0, 0, 1672, 941).data;

  const r2 = await loadImageData(R2_PATH);

  const palette = {};
  for (const [name, rect] of Object.entries(REGIONS)) {
    const rendered = medianRegion(frame, 1672, rect);
    const reference = medianRegion(r2.data, r2.width, rect);
    palette[name] = {
      rendered,
      reference,
      deltaE00: Number(
        ciede2000(srgbToLab(rendered), srgbToLab(reference)).toFixed(2),
      ),
    };
  }

  const upperLum = relLuminance(...palette.quietUpperMeadow.rendered);
  const foliageLum = relLuminance(...palette.deepLeftFoliage.rendered);

  // Prop ID mask: second renderer pass with props alone on white.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = 1672;
  maskCanvas.height = 941;
  const maskRenderer = new THREE.WebGLRenderer({
    canvas: maskCanvas, antialias: true, preserveDrawingBuffer: true,
  });
  maskRenderer.setPixelRatio(1);
  maskRenderer.setSize(1672, 941, false);
  maskRenderer.outputColorSpace = THREE.SRGBColorSpace;
  maskRenderer.toneMapping = THREE.NoToneMapping;
  const maskScene = buildMeadowScene(maskRenderer, { propsOnly: true });
  maskScene.render();
  const maskShot = document.createElement('canvas');
  maskShot.width = 1672;
  maskShot.height = 941;
  maskShot.getContext('2d').drawImage(maskCanvas, 0, 0);
  const mask = maskShot.getContext('2d').getImageData(0, 0, 1672, 941).data;
  const isProp = (x, y) => {
    const i = (y * 1672 + x) * 4;
    // White ground vs colored prop; small tolerance for AA edges.
    return mask[i] < 240 || mask[i + 1] < 240 || mask[i + 2] < 240;
  };

  // Environment-frame band: mean inward prop extent per side as a fraction
  // of the frame dimension (documented reading of the §12 row).
  const inwardExtent = (side) => {
    const samples = [];
    if (side === 'left' || side === 'right') {
      for (let y = 40; y < 901; y += 8) {
        let extent = 0;
        for (let d = 0; d < 400; d += 1) {
          const x = side === 'left' ? d : 1671 - d;
          if (isProp(x, y)) extent = d + 1;
        }
        samples.push(extent / 1672);
      }
    } else {
      for (let x = 40; x < 1632; x += 8) {
        let extent = 0;
        for (let d = 0; d < 300; d += 1) {
          const y = side === 'top' ? d : 940 - d;
          if (isProp(x, y)) extent = d + 1;
        }
        samples.push(extent / 941);
      }
    }
    return Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(4));
  };

  // Quiet zone: central D2 region prop occupancy (grass share = 1 - props).
  let central = 0;
  let centralProp = 0;
  for (let y = Math.round(0.12 * 941); y < Math.round(0.81 * 941); y += 2) {
    for (let x = Math.round(0.14 * 1672); x < Math.round(0.86 * 1672); x += 2) {
      central += 1;
      if (isProp(x, y)) centralProp += 1;
    }
  }

  // Prop intrusion into resting card envelopes (camera-lock golden quads).
  const golden = await (await fetch('/tests/visual/baselines/camera-lock-v1/golden-quadrilaterals.json')).json();
  const quads = golden.anchors ?? golden;
  let worstIntrusion = 0;
  let worstAnchor = null;
  for (const [anchor, quad] of Object.entries(quads)) {
    const points = quad.corners ?? quad;
    if (!Array.isArray(points)) continue;
    const xs = points.map((c) => c[0]);
    const ys = points.map((c) => c[1]);
    const [l, t, r, b] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    let intrusion = 0;
    for (let y = Math.max(0, Math.round(t)); y < Math.min(941, Math.round(b)); y += 2) {
      for (let x = Math.max(0, Math.round(l)); x < Math.min(1672, Math.round(r)); x += 2) {
        if (isProp(x, y)) {
          const depth = Math.min(x - l, r - x, y - t, b - y);
          if (depth > intrusion) intrusion = depth;
        }
      }
    }
    if (intrusion > worstIntrusion) {
      worstIntrusion = intrusion;
      worstAnchor = anchor;
    }
  }

  window.__TF_MEADOW_METRICS__ = {
    divider: dividerMetrics(frame, 1672, 941),
    palette,
    perimeterCenterRatio: Number((foliageLum / upperLum).toFixed(3)),
    environment: {
      frameExtent: {
        left: inwardExtent('left'),
        right: inwardExtent('right'),
        top: inwardExtent('top'),
        bottom: inwardExtent('bottom'),
      },
      quietZonePropShare: Number((centralProp / central).toFixed(4)),
      propIntrusion: { worstPx: worstIntrusion, anchor: worstAnchor },
    },
  };
  window.__TF_MEADOW_READY__ = true;
}

main().catch((error) => {
  window.__TF_MEADOW_ERROR__ = String(error?.message ?? error);
  throw error;
});
