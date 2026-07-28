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
function paintMeadowTexture(rng, camera, span) {
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
    const at = toTexture(sx, sy);
    const radius = (90 + rng() * 150) * texturePerScreenPx * 0.5;
    const toward = rng() < 0.5
      ? 'rgba(145, 135, 81, 0.10)'
      : 'rgba(194, 171, 77, 0.10)';
    const zero = toward.replace(/0\.10\)$/, '0)');
    const blotch = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius);
    blotch.addColorStop(0, toward);
    blotch.addColorStop(1, zero);
    ctx.fillStyle = blotch;
    ctx.fillRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
  }

  // Cool foliage frame: soft bands anchored to the screen frame edges
  // (left/right beyond ~13%, top beyond ~16%, corners), painted as blurred
  // strokes along the projected edge lines.
  ctx.filter = 'blur(28px)';
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
  ctx.filter = 'none';

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
  const diamondHalo = ctx.createRadialGradient(cx, midY, 0, cx, midY, 70);
  diamondHalo.addColorStop(0, 'rgba(245, 215, 131, 0.5)');
  diamondHalo.addColorStop(1, 'rgba(245, 215, 131, 0)');
  ctx.fillStyle = diamondHalo;
  ctx.fillRect(cx - 70, midY - 70, 140, 140);
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

export function buildMeadowScene(renderer) {
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
    new THREE.MeshBasicMaterial({ map: paintMeadowTexture(rng, camera, span) }),
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
  scene.add(divider);

  return {
    scene,
    camera,
    render() {
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
