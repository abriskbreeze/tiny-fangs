// Phase 7 — the Tiny Fangs meadow under the locked camera (art bible §4/§5/§6,
// camera lock: perspective FOV 30°, pitch 24.5°, distance 1950).
//
// Chunk 1: terrain + divider + center diamond, colors BAKED into a seeded
// canvas texture so the §12 palette rows measure the §5 hexes directly
// (MeshBasicMaterial; the warm key is painted, real lights arrive with props
// and card shadows). Every random element derives from one seeded PRNG —
// repeated builds are pixel-identical.

import * as THREE from 'three';
import { createCameraCandidate } from './graybox-scene.js';
import {
  buildMeadowProps, FENCE_RUN, ROCK_ANCHORS, SHRUB_ANCHORS, TREE_ANCHORS,
} from './meadow-props.js';

export const MEADOW_SEED = 0x7f4a11;

// §5 palette roles.
const UPPER_MEADOW = '#C2AB4D';
const LOWER_MEADOW = '#B3A74F';
const COOL_FOLIAGE = '#334B42';
const SUNLIT_FOLIAGE = '#918751';
const DIVIDER_CORE = '#F5D783';
const SUN_CORE = '#EDC674';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function screenToGround(camera, x, y) {
  const ndc = new THREE.Vector2(
    (x / 1672) * 2 - 1,
    -((y / 941) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(ground, hit);
  return hit;
}

// Deterministic painted meadow, anchored in SCREEN space: every feature is
// placed by projecting screen positions onto the ground plane and mapping to
// texture UV, so the §12 region rows measure what was authored. Gradients
// always fade to zero-alpha of their own color (transparent-black stops
// darken midtones — a real defect the first metric pass caught).
function paintMeadowTexture(rng, camera, span, slotQuads) {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // screen px -> texture px through the ground plane. Plane is centered at
  // origin, rotated -90 deg about X: world x -> u, world z -> v.
  const toTexture = (sx, sy) => {
    const hit = screenToGround(camera, sx, sy);
    return {
      x: (hit.x / span.x + 0.5) * size,
      y: (hit.z / span.z + 0.5) * size,
    };
  };
  const texturePerScreenPx = (() => {
    const a = toTexture(836, 470);
    const b = toTexture(936, 470);
    return Math.hypot(b.x - a.x, b.y - a.y) / 100;
  })();

  // Base: lower meadow everywhere.
  ctx.fillStyle = LOWER_MEADOW;
  ctx.fillRect(0, 0, size, size);

  // Sunlit upper field: radial wash centered on the upper meadow region,
  // sized to fully cover the quiet-upper rectangle at full opacity.
  const sunCenter = toTexture(820, 100);
  const sunEdge = toTexture(820, 560);
  const sunRadius = Math.hypot(sunEdge.x - sunCenter.x, sunEdge.y - sunCenter.y);
  const sun = ctx.createRadialGradient(
    sunCenter.x, sunCenter.y, sunRadius * 0.35,
    sunCenter.x, sunCenter.y, sunRadius,
  );
  sun.addColorStop(0, UPPER_MEADOW);
  sun.addColorStop(0.6, UPPER_MEADOW);
  sun.addColorStop(1, 'rgba(194, 171, 77, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, size, size);

  // Low-frequency painted variation: seeded blotches inside the visible
  // footprint, kept out of the two measured quiet rectangles.
  const measured = [
    [690, 70, 950, 135],
    [680, 650, 840, 685],
  ];
  for (let i = 0; i < 70; i++) {
    const sx = 120 + rng() * (1672 - 240);
    const sy = 120 + rng() * (941 - 200);
    if (measured.some(([l, t, r, b]) =>
      sx > l - 60 && sx < r + 60 && sy > t - 60 && sy < b + 60)) continue;
    if (sy > 340 && sy < 490) continue; // divider detection window stays clean
    const at = toTexture(sx, sy);
    const radius = (110 + rng() * 190) * texturePerScreenPx * 0.5;
    const toward = rng() < 0.5
      ? 'rgba(145, 135, 81, 0.16)'
      : 'rgba(194, 171, 77, 0.16)';
    const zero = toward.replace(/0\.16\)$/, '0)');
    const blotch = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius);
    blotch.addColorStop(0, toward);
    blotch.addColorStop(1, zero);
    ctx.fillStyle = blotch;
    ctx.fillRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
  }

  // Cool foliage frame: soft bands anchored to the screen frame edges
  // (left/right beyond ~13%, top beyond ~16%, corners), painted as blurred
  // strokes along the projected edge lines.
  ctx.filter = 'blur(34px)';
  ctx.globalAlpha = 0.66;
  ctx.fillStyle = '#3A5449'; /* toward R2's measured foliage median */
  const edgeQuad = (cornerA, cornerB, innerA, innerB) => {
    const a = toTexture(...cornerA);
    const b = toTexture(...cornerB);
    const c = toTexture(...innerB);
    const d = toTexture(...innerA);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  };
  // Left band covers the deep-left foliage rectangle (20,550)-(130,720).
  edgeQuad([-350, -200], [-350, 1100], [176, 1020], [150, -60]);
  // Right band mirrors it.
  edgeQuad([2022, -200], [2022, 1100], [1496, 1020], [1522, -60]);
  // Top band (distant canopy/haze frame).
  edgeQuad([-300, -300], [1972, -300], [1810, 52], [-140, 52]);
  // Bottom corners only (bottom center stays open meadow for the hand).
  edgeQuad([-260, 1180], [420, 1180], [300, 806], [-180, 820]);
  edgeQuad([1252, 1180], [1932, 1180], [1852, 820], [1372, 806]);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';

  // Field r3: every prop casts a grounded shadow under the single warm key
  // (light from upper-left => shadows fall down-right, dx:dy = 0.78:0.55).
  // Positions come from the exported authored anchors; a separate seeded rng
  // keeps the shared scene stream untouched.
  {
    const shadowRng = mulberry32(0x51ade7);
    const softEllipse = (sx, sy, rx, ry, alpha, tint = '44, 56, 40') => {
      const at = toTexture(sx, sy);
      const rtx = rx * texturePerScreenPx;
      const rty = ry * texturePerScreenPx;
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.scale(1, rty / rtx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rtx);
      g.addColorStop(0, `rgba(${tint}, ${alpha})`);
      g.addColorStop(0.62, `rgba(${tint}, ${alpha * 0.55})`);
      g.addColorStop(1, `rgba(${tint}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-rtx, -rtx, rtx * 2, rtx * 2);
      ctx.restore();
    };
    // r4: offsets must clear the canopy silhouette — under this camera a
    // canopy of radius ~35s screen px hides any shadow closer than that
    // (the r3 critics never saw the shadows the texture contained).
    for (const [sx, sy, s] of TREE_ANCHORS) {
      const wobble = 0.9 + shadowRng() * 0.2;
      softEllipse(sx + 44 * s, sy + 30 * s, 38 * s * wobble, 16 * s, 0.3);
      softEllipse(sx + 78 * s, sy + 52 * s, 46 * s * wobble, 17 * s, 0.17);
      softEllipse(sx + 110 * s, sy + 74 * s, 40 * s * wobble, 14 * s, 0.08);
    }
    for (const [sx, sy, s] of SHRUB_ANCHORS) {
      const distantTopBand = sy < 90;
      const reach = distantTopBand ? 0.55 : 1;
      softEllipse(
        sx + 30 * s * reach, sy + 20 * s * reach,
        26 * s * (0.85 + shadowRng() * 0.3), 12 * s, 0.26,
      );
      if (!distantTopBand) {
        softEllipse(sx + 54 * s, sy + 36 * s, 30 * s, 12 * s, 0.12);
      }
    }
    for (const [sx, sy, s] of ROCK_ANCHORS) {
      softEllipse(sx + 22 * s, sy + 15 * s, 20 * s, 9 * s, 0.24);
      softEllipse(sx + 38 * s, sy + 26 * s, 18 * s, 8 * s, 0.1);
    }
    {
      const [from, to] = FENCE_RUN;
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const sx = from[0] + (to[0] - from[0]) * t;
        const sy = from[1] + (to[1] - from[1]) * t;
        softEllipse(sx + 16, sy + 11, 14, 5, 0.24);
        softEllipse(sx + 30, sy + 21, 12, 4.5, 0.12);
      }
    }

    // r4 painted organic water: curved streams with banks, depth, and foam
    // painted INTO the terrain (the r3 plane-strip river read as "angular
    // UI panels" to both critics). Screen-space quadratic paths.
    const paintStream = (pathPoints, widthPx) => {
      const texturePoints = pathPoints.map(([sx, sy]) => toTexture(sx, sy));
      const stroke = (lineWidth, color, blur = 0) => {
        ctx.save();
        if (blur) ctx.filter = `blur(${blur}px)`;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth * texturePerScreenPx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(texturePoints[0].x, texturePoints[0].y);
        for (let i = 1; i < texturePoints.length - 1; i++) {
          const xc = (texturePoints[i].x + texturePoints[i + 1].x) / 2;
          const yc = (texturePoints[i].y + texturePoints[i + 1].y) / 2;
          ctx.quadraticCurveTo(texturePoints[i].x, texturePoints[i].y, xc, yc);
        }
        const last = texturePoints[texturePoints.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
        ctx.restore();
      };
      stroke(widthPx * 1.9, 'rgba(84, 73, 47, 0.85)', 6);      // mud bank
      stroke(widthPx * 1.45, 'rgba(174, 161, 142, 0.9)', 3);   // sand edge
      stroke(widthPx * 1.05, '#3f6668', 2);                    // depth
      stroke(widthPx * 0.72, '#5b8a8a');                       // water
      stroke(widthPx * 0.3, 'rgba(143, 216, 203, 0.65)', 1);   // sheen line
      // Foam flecks along the banks.
      for (let i = 0; i < 26; i++) {
        const t = i / 25;
        const seg = Math.min(texturePoints.length - 2, Math.floor(t * (texturePoints.length - 1)));
        const local = t * (texturePoints.length - 1) - seg;
        const fx = texturePoints[seg].x + (texturePoints[seg + 1].x - texturePoints[seg].x) * local;
        const fy = texturePoints[seg].y + (texturePoints[seg + 1].y - texturePoints[seg].y) * local;
        const side = shadowRng() < 0.5 ? -1 : 1;
        ctx.fillStyle = `rgba(246, 241, 220, ${0.35 + shadowRng() * 0.4})`;
        ctx.beginPath();
        ctx.arc(
          fx + side * widthPx * 0.42 * texturePerScreenPx * (0.8 + shadowRng() * 0.4),
          fy + (shadowRng() - 0.5) * 3 * texturePerScreenPx,
          (0.7 + shadowRng() * 1.1) * texturePerScreenPx, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    };
    paintStream([[14, -30], [58, 18], [108, 58], [185, 96]], 30);
    paintStream([[1586, 862], [1636, 900], [1676, 946], [1710, 1000]], 34);
  }

  // Field r2: the divider's light bleeds into the grass — a soft warm wash
  // painted INTO the terrain along the divider row with seeded edge flecks,
  // kept below the 0.55 core-luminance threshold so band metrics hold.
  {
    const left = toTexture(210, 414);
    const right = toTexture(1462, 414);
    const mid = toTexture(836, 414);
    const bleedHeight = 30 * texturePerScreenPx;
    const gradient = ctx.createLinearGradient(0, mid.y - bleedHeight, 0, mid.y + bleedHeight);
    gradient.addColorStop(0, 'rgba(245, 215, 131, 0)');
    gradient.addColorStop(0.5, 'rgba(245, 215, 131, 0.28)');
    gradient.addColorStop(1, 'rgba(245, 215, 131, 0)');
    ctx.fillStyle = gradient;
    // wash in irregular seeded segments (r3: organic falloff, not a strip),
    // skipping the diamond window
    const gapHalf = 100 * texturePerScreenPx;
    const spans = [
      [left.x, mid.x - gapHalf],
      [mid.x + gapHalf, right.x],
    ];
    for (const [x0, x1] of spans) {
      const segments = 26;
      const segmentWidth = (x1 - x0) / segments;
      for (let i = 0; i < segments; i++) {
        ctx.globalAlpha = 0.55 + rng() * 0.45;
        const hScale = 0.7 + rng() * 0.6;
        ctx.fillRect(
          x0 + i * segmentWidth, mid.y - bleedHeight * hScale,
          segmentWidth + 1, bleedHeight * 2 * hScale,
        );
      }
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 60; i++) {
      let fx = left.x + rng() * (right.x - left.x);
      // keep flecks clear of the diamond's measurement window
      if (Math.abs(fx - mid.x) < 110 * texturePerScreenPx) {
        fx += Math.sign(fx - mid.x 
          || 1) * 130 * texturePerScreenPx;
      }
      const fy = mid.y + (rng() - 0.5) * bleedHeight * 2.4;
      ctx.fillStyle = `rgba(245, 215, 131, ${0.10 + rng() * 0.14})`;
      ctx.beginPath();
      ctx.arc(fx, fy, (0.6 + rng() * 1.6) * texturePerScreenPx, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // §4.1 slot marks: engraved 1–2 px (screen) outlines at each camera-lock
  // anchor footprint, painted at 1.25× the local grass luminance so the
  // measured band ratio (1.15–1.35) holds. The golden quadrilateral corners
  // are screen points; each maps through the ground to texture space.
  if (slotQuads) {
    const lineWidthTexture = Math.max(2, 1.8 * texturePerScreenPx);
    for (const [anchorName, quad] of Object.entries(slotQuads)) {
      const corners = (quad.face ?? quad).map(([sx, sy]) => toTexture(sx, sy));
      // Local grass base: opponent row sits in the sunlit upper meadow,
      // player row in the lower meadow.
      const isUpper = anchorName.startsWith('opp.');
      const base = isUpper ? [194, 171, 77] : [179, 167, 79];
      // 1.25x LINEAR luminance target: sRGB channels scale by 1.25^(1/2.4).
      const line = base.map((c) => Math.min(255, Math.round(c * 1.145)));
      ctx.strokeStyle = `rgb(${line[0]}, ${line[1]}, ${line[2]})`;
      ctx.lineWidth = lineWidthTexture;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      corners.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      // Field r2 empty-slot affordance: a faint interior fill so an open
      // footprint reads as a prepared place, not bare grass. Kept far below
      // the slot-line band so the edge-probe ratio is untouched.
      ctx.save();
      ctx.fillStyle = 'rgba(240, 224, 180, 0.10)';
      ctx.fill();
      ctx.restore();
      ctx.stroke();
      // Engraved rune: small diamond at the footprint center, same band.
      const cx = corners.reduce((sum, c) => sum + c.x, 0) / corners.length;
      const cy = corners.reduce((sum, c) => sum + c.y, 0) / corners.length;
      const r = 5 * texturePerScreenPx;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Field r2 ground micro-texture: seeded short blade strokes across the
  // open field (excluded from the measured quiet rectangles), giving the
  // grass a directional weave beyond flat fill.
  {
    const quiet = [
      [660, 40, 980, 165],
      [650, 620, 870, 715],
    ];
    ctx.lineCap = 'round';
    // r3: stroke width/alpha/length raised until the weave survives the
    // full-field view (r2's strokes were sub-visible at 1x).
    for (let i = 0; i < 4200; i++) {
      const sx = 150 + rng() * 1372;
      const sy = 120 + rng() * 760;
      if (quiet.some(([l, t, r, b]) => sx > l && sx < r && sy > t && sy < b)) continue;
      // Strokes point ~77 deg upward and reach ~14 px above their root, so
      // the exclusion covers the detection window (380-450) plus that reach.
      if (sy > 378 && sy < 466) continue;
      const at = toTexture(sx, sy);
      const len = (5 + rng() * 7) * texturePerScreenPx;
      const angle = -1.35 + (rng() - 0.5) * 0.55;
      const tone = rng();
      ctx.strokeStyle = tone < 0.5
        ? `rgba(132, 122, 68, ${0.18 + rng() * 0.16})`
        : `rgba(232, 220, 128, ${0.15 + rng() * 0.16})`;
      ctx.lineWidth = Math.max(1.6, 1.7 * texturePerScreenPx);
      ctx.beginPath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(at.x + Math.cos(angle) * len, at.y + Math.sin(angle) * len);
      ctx.stroke();
    }
    // r4 clover patches: clustered dark-green cover breaking up the fill.
    for (let i = 0; i < 30; i++) {
      const cx0 = 170 + rng() * 1332;
      const cy0 = 140 + rng() * 720;
      if (quiet.some(([l, t, r, b]) => cx0 > l - 30 && cx0 < r + 30 && cy0 > t - 30 && cy0 < b + 30)) continue;
      if (cy0 > 360 && cy0 < 470) continue;
      const dots = 8 + Math.floor(rng() * 9);
      for (let d = 0; d < dots; d++) {
        const at = toTexture(cx0 + (rng() - 0.5) * 42, cy0 + (rng() - 0.5) * 30);
        ctx.fillStyle = `rgba(96, 112, 58, ${0.18 + rng() * 0.16})`;
        ctx.beginPath();
        ctx.arc(at.x, at.y, (1.4 + rng() * 1.8) * texturePerScreenPx, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // r3 painted flower speckles: warm cream/gold and sparse lavender dots
    // with darker cores, outside the quiet rects, divider window, and slot
    // footprints, so the open field reads as meadow rather than fill.
    const slotBoxes = slotQuads
      ? Object.values(slotQuads).map((quad) => {
        const cs = (quad.face ?? quad);
        const xs = cs.map((c) => c[0]);
        const ys = cs.map((c) => c[1]);
        return [Math.min(...xs) - 8, Math.min(...ys) - 8,
          Math.max(...xs) + 8, Math.max(...ys) + 8];
      })
      : [];
    for (let i = 0; i < 190; i++) {
      const sx = 160 + rng() * 1352;
      const sy = 130 + rng() * 740;
      const petal = rng();
      const radius = (1.6 + rng() * 1.7) * texturePerScreenPx;
      if (quiet.some(([l, t, r, b]) => sx > l && sx < r && sy > t && sy < b)) continue;
      if (sy > 365 && sy < 465) continue;
      if (slotBoxes.some(([l, t, r, b]) => sx > l && sx < r && sy > t && sy < b)) continue;
      const at = toTexture(sx, sy);
      ctx.fillStyle = petal < 0.55
        ? 'rgba(238, 216, 146, 0.85)'
        : petal < 0.8 ? 'rgba(244, 232, 200, 0.8)' : 'rgba(206, 178, 200, 0.75)';
      ctx.beginPath();
      ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(150, 108, 38, 0.7)';
      ctx.beginPath();
      ctx.arc(at.x, at.y, radius * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // r3 mow-band variation: broad alternating bands parallel to the divider,
  // a few percent of luminance, so the open field has macro structure.
  {
    const bandAnchor = toTexture(836, 414);
    const bandStep = 128 * texturePerScreenPx;
    ctx.save();
    ctx.translate(bandAnchor.x, bandAnchor.y);
    ctx.rotate(-0.045);
    for (let band = -8; band <= 8; band++) {
      if (band === 0) continue; // divider row stays clean
      ctx.fillStyle = band % 2 === 0
        ? 'rgba(255, 244, 190, 0.03)'
        : 'rgba(96, 92, 50, 0.026)';
      ctx.fillRect(-size, band * bandStep - bandStep / 2, size * 2, bandStep);
    }
    ctx.restore();
  }

  // r3 golden-hour grade: one warm wash from the sun's corner (upper-left)
  // and a faint cool settle in the far lower-right, tying ground and props
  // to the expressed key light.
  {
    const warm = ctx.createLinearGradient(0, 0, size * 0.8, size * 0.62);
    warm.addColorStop(0, 'rgba(246, 208, 122, 0.11)');
    warm.addColorStop(0.55, 'rgba(246, 208, 122, 0.035)');
    warm.addColorStop(1, 'rgba(246, 208, 122, 0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, size, size);
    const cool = ctx.createLinearGradient(size, size, size * 0.55, size * 0.55);
    cool.addColorStop(0, 'rgba(64, 76, 96, 0.055)');
    cool.addColorStop(1, 'rgba(64, 76, 96, 0)');
    ctx.fillStyle = cool;
    ctx.fillRect(0, 0, size, size);
  }

  // Micro grain, kept under 3% luminance RMS centrally (§4.3 grass rule).
  const grain = ctx.getImageData(0, 0, size, size);
  const data = grain.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 8; // ±4/255 ≈ 1.6% RMS
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Divider: luminous band whose projected core sits at y = 414 ± 3 with a
// 6–12 px bright core, spanning 68–80% of frame width, plus the center
// diamond (33–45 × 38–50 px core) at (836, 414). Painted on a transparent
// strip so glow blends over the terrain.
function paintDividerTexture() {
  const width = 2048;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const midY = height / 2;

  // Soft halo (~24 px screen at band scale).
  const halo = ctx.createLinearGradient(0, midY - 60, 0, midY + 60);
  halo.addColorStop(0, 'rgba(245, 215, 131, 0)');
  halo.addColorStop(0.5, 'rgba(245, 215, 131, 0.4)');
  halo.addColorStop(1, 'rgba(245, 215, 131, 0)');
  ctx.fillStyle = halo;
  // Fade the band toward its endpoints.
  for (let x = 0; x < width; x++) {
    const t = x / width;
    const endFade = Math.min(1, Math.min(t, 1 - t) * 14);
    ctx.globalAlpha = endFade;
    ctx.fillRect(x, midY - 60, 1, 120);
  }

  // Bright core (~10 px screen).
  for (let x = 0; x < width; x++) {
    const t = x / width;
    const endFade = Math.min(1, Math.min(t, 1 - t) * 14);
    ctx.globalAlpha = endFade;
    ctx.fillStyle = DIVIDER_CORE;
    ctx.fillRect(x, midY - 9, 1, 18);
  }
  ctx.globalAlpha = 1;

  // Center diamond core with halo.
  const cx = width / 2;
  // r4: halo kept small — a wide halo leaves columns threshold-marginal, so
  // grain/grade jitter widens the measured diamond nondeterministically.
  const diamondHalo = ctx.createRadialGradient(cx, midY, 0, cx, midY, 52);
  diamondHalo.addColorStop(0, 'rgba(245, 215, 131, 0.36)');
  diamondHalo.addColorStop(1, 'rgba(245, 215, 131, 0)');
  ctx.fillStyle = diamondHalo;
  ctx.fillRect(cx - 52, midY - 52, 104, 104);
  ctx.fillStyle = SUN_CORE;
  ctx.beginPath();
  ctx.moveTo(cx, midY - 40);
  ctx.lineTo(cx + 46, midY);
  ctx.lineTo(cx, midY + 40);
  ctx.lineTo(cx - 46, midY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = DIVIDER_CORE;
  ctx.beginPath();
  ctx.moveTo(cx, midY - 28);
  ctx.lineTo(cx + 37, midY);
  ctx.lineTo(cx, midY + 28);
  ctx.lineTo(cx - 37, midY);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildMeadowScene(renderer, { propsOnly = false, slotQuads = null } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COOL_FOLIAGE);
  const camera = createCameraCandidate('P');
  const rng = mulberry32(MEADOW_SEED);

  // Terrain sized from the camera's ground footprint with margin.
  const corners = [
    screenToGround(camera, 0, 0),
    screenToGround(camera, 1672, 0),
    screenToGround(camera, 0, 941),
    screenToGround(camera, 1672, 941),
  ];
  const spanX = 2.6 * Math.max(...corners.map((c) => Math.abs(c.x)));
  const spanZ = 2.6 * Math.max(...corners.map((c) => Math.abs(c.z)));
  const span = { x: spanX, z: spanZ };
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(spanX, spanZ),
    new THREE.MeshBasicMaterial({ map: paintMeadowTexture(rng, camera, span, slotQuads) }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.name = 'meadow-terrain';
  scene.add(terrain);

  // Divider band: world segment whose projection spans 74% of frame width
  // centered at x = 836, on the divider row y = 414.
  const left = screenToGround(camera, 836 - 0.415 * 1672, 414);
  const right = screenToGround(camera, 836 + 0.415 * 1672, 414);
  const center = screenToGround(camera, 836, 414);
  const bandLength = left.distanceTo(right);
  // Screen px → world units at the divider row (vertical scale).
  const probe = screenToGround(camera, 836, 424);
  const worldPerPxY = probe.distanceTo(center) / 10;
  const bandHeight = 256 * (worldPerPxY * (120 / 128)) * 0.5;

  // §4.3 perimeter props (chunk 2), seeded from the same PRNG stream.
  const props = buildMeadowProps({
    rng,
    screenToGround: (sx, sy) => screenToGround(camera, sx, sy),
  });
  scene.add(props);

  // One expressed light direction (field r2): warm key from the upper-left
  // producing down-right facet shading in the 55-75 degree section 12 band,
  // plus cool ambient fill. Intensities calibrated so a mid-facing lit
  // surface renders near its authored color (terrain is unlit/baked and
  // unaffected).
  const key = new THREE.DirectionalLight(0xfff0d2, 1.0);
  key.position.set(-700, 950, -420);
  key.target.position.set(0, 0, 0);
  scene.add(key);
  scene.add(key.target);
  scene.add(new THREE.AmbientLight(0xd8dccc, 0.5));

  if (propsOnly) {
    // §6.1-style ID mask: props alone on a white ground/background.
    scene.background = new THREE.Color(0xffffff);
    terrain.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  const divider = new THREE.Mesh(
    new THREE.PlaneGeometry(bandLength, 256 * worldPerPxY * 0.5),
    new THREE.MeshBasicMaterial({
      map: paintDividerTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  divider.rotation.x = -Math.PI / 2;
  divider.position.set(center.x, 0.5, center.z);
  divider.name = 'meadow-divider';
  divider.visible = !propsOnly;
  scene.add(divider);

  // Seeded ambient motion targets: canopy sway phases, dust motes,
  // fireflies, and the river sheen shimmer. All motion is a pure function
  // of timeMs, so any t renders deterministically.
  const swayTargets = [];
  props.traverse((node) => {
    if (node.geometry?.type === 'ConeGeometry' && node.position.y > 20) {
      swayTargets.push({
        node,
        phase: rng() * Math.PI * 2,
        amplitude: 0.004 + rng() * 0.006,
        baseRotationZ: node.rotation.z,
      });
    }
  });

  const moteCount = 40;
  const motePositions = new Float32Array(moteCount * 3);
  const moteSeeds = [];
  for (let i = 0; i < moteCount; i++) {
    const sx = 240 + rng() * 1190;
    let sy = 140 + rng() * 660;
    // Motes stay clear of the divider row: a gold point drifting over the
    // detection window reads as (and measures as) part of the diamond.
    while (sy > 345 && sy < 485) sy = 140 + rng() * 660;
    const at = screenToGround(camera, sx, sy);
    moteSeeds.push({
      x: at.x, z: at.z,
      y: 20 + rng() * 90,
      phase: rng() * Math.PI * 2,
      speed: 0.4 + rng() * 0.6,
      radius: 6 + rng() * 14,
    });
  }
  const motes = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position', new THREE.BufferAttribute(motePositions, 3),
    ),
    new THREE.PointsMaterial({
      color: 0xf5d783, size: 3.4, sizeAttenuation: false,
      transparent: true, opacity: 0.5, depthWrite: false,
    }),
  );
  motes.name = 'meadow-motes';
  motes.visible = !propsOnly;
  scene.add(motes);

  const fireflyCount = 8;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflySeeds = [];
  for (let i = 0; i < fireflyCount; i++) {
    const corner = rng() < 0.5 ? [90 + rng() * 160, 700 + rng() * 180] : [1420 + rng() * 180, 120 + rng() * 220];
    const at = screenToGround(camera, corner[0], corner[1]);
    fireflySeeds.push({
      x: at.x, z: at.z, y: 26 + rng() * 40,
      phase: rng() * Math.PI * 2, speed: 0.25 + rng() * 0.3, radius: 10 + rng() * 12,
    });
  }
  const fireflies = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position', new THREE.BufferAttribute(fireflyPositions, 3),
    ),
    new THREE.PointsMaterial({
      color: 0xeec34e, size: 5, sizeAttenuation: false,
      transparent: true, opacity: 0.85, depthWrite: false,
    }),
  );
  fireflies.name = 'meadow-fireflies';
  fireflies.visible = !propsOnly;
  scene.add(fireflies);

  const sheens = [];
  props.traverse((node) => {
    if (node.material?.color?.getHex?.() === 0x8fd8cb && node.geometry?.type === 'PlaneGeometry') {
      sheens.push({ node, base: node.material.opacity ?? 1 });
      node.material.transparent = true;
    }
  });

  function animate(timeMs) {
    const t = timeMs / 1000;
    for (const target of swayTargets) {
      target.node.rotation.z =
        target.baseRotationZ + Math.sin(t * 0.9 + target.phase) * target.amplitude * 40;
    }
    moteSeeds.forEach((seed, i) => {
      motePositions[i * 3] = seed.x + Math.cos(t * seed.speed + seed.phase) * seed.radius;
      motePositions[i * 3 + 1] = seed.y + Math.sin(t * seed.speed * 0.7 + seed.phase) * 6;
      motePositions[i * 3 + 2] = seed.z + Math.sin(t * seed.speed + seed.phase) * seed.radius;
    });
    motes.geometry.attributes.position.needsUpdate = true;
    fireflySeeds.forEach((seed, i) => {
      fireflyPositions[i * 3] = seed.x + Math.cos(t * seed.speed + seed.phase) * seed.radius;
      fireflyPositions[i * 3 + 1] = seed.y + Math.sin(t * seed.speed * 1.3 + seed.phase) * 8;
      fireflyPositions[i * 3 + 2] = seed.z + Math.sin(t * seed.speed * 0.8 + seed.phase) * seed.radius;
    });
    fireflies.geometry.attributes.position.needsUpdate = true;
    fireflies.material.opacity = 0.55 + 0.35 * Math.sin(t * 2.1);
    sheens.forEach((sheen, i) => {
      sheen.node.material.opacity = 0.75 + 0.25 * Math.sin(t * 1.7 + i);
    });
  }
  animate(0);

  return {
    scene,
    camera,
    animate,
    render() {
      renderer.render(scene, camera);
    },
    renderAt(timeMs) {
      animate(timeMs);
      renderer.render(scene, camera);
    },
    dispose() {
      scene.traverse((node) => {
        node.geometry?.dispose?.();
        node.material?.map?.dispose?.();
        node.material?.dispose?.();
      });
    },
  };
}
