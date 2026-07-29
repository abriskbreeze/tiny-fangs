// Populated-board harness (Phase 7 exit path): the live meadow scene under
// real DOM card faces homography-mapped onto the camera-lock golden
// quadrilaterals, with a representative midgame layout and per-card contact
// shadows. Deterministic: settled t=0 meadow, fonts awaited, seeded scene.
//
// The layout is a REPRESENTATIVE midgame arrangement for the Phase 7 field
// comparison capture; deterministic gameplay-fixture wiring into the real
// shell belongs to Phase 8.

import * as THREE from 'three';
import { CREATURES, VERSES } from '../../../shared/cards.js';
import { buildCardFace, normalizeFaceModel } from '../cards/card-face.js';
import '../cards/cards.css';
import { applyQuadTransform, projectRectCorners } from '../dom/quad-transform.js';
import { buildMeadowScene } from './meadow-scene.js';

// Representative midgame board: both actives engaged, benches partly filled,
// sets face-down, graves showing a top card, decks as backs.
const BOARD_FACES = {
  'me.active': { kind: 'creature', id: 'duskfang' },
  'me.bench.a': { kind: 'creature', id: 'fangpup' },
  'me.bench.b': { kind: 'creature', id: 'cindermaw' },
  'me.set': { kind: 'back' },
  'me.deck': { kind: 'back' },
  'me.grave': { kind: 'creature', id: 'emberfang' },
  'opp.active': { kind: 'creature', id: 'ironhide' },
  'opp.bench.a': { kind: 'creature', id: 'shellkin' },
  'opp.bench.b': { kind: 'back' }, // empty opp bench slot reads as empty
  'opp.set': { kind: 'back' },
  'opp.deck': { kind: 'back' },
  'opp.grave': { kind: 'creature', id: 'whisper' },
};
const SKIP_ANCHORS = new Set(['opp.bench.b']); // authored empty slot
const STACK_ANCHORS = new Set(['me.deck', 'opp.deck', 'me.grave', 'opp.grave']);

const HAND = [
  { id: 'predatorsMark', kind: 'cast', x: 612, tilt: -7 },
  { id: 'ignite', kind: 'cast', x: 764, tilt: -2.5 },
  { id: 'packTactics', kind: 'cast', x: 916, tilt: 2.5 },
  { id: 'lastBreath', kind: 'set', x: 1068, tilt: 7 },
];
const HAND_BOTTOM = 934;
const HAND_SCALE = 0.42; // 505 px chassis → ≈212 px, inside the 228 px envelope

function faceModel(spec) {
  if (spec.kind === 'back') return normalizeFaceModel(null, 'back');
  const card = spec.kind === 'creature' ? CREATURES[spec.id] : VERSES[spec.id];
  if (!card) throw new Error(`board face missing: ${spec.id}`);
  return normalizeFaceModel(card, spec.kind);
}

function addShadow(layer, corners) {
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  // Field r3: DIRECTIONAL grounded shadow under the scene's single sun
  // (upper-left key => shadow offset down-right), replacing r2's centered
  // halo. A tight dark core at the contact edge plus a longer soft tail.
  const pad = 14;
  const core = document.createElement('div');
  core.className = 'card-shadow';
  core.style.left = `${left - pad + 15}px`;
  core.style.top = `${top - pad + 21}px`;
  core.style.width = `${width + pad * 2}px`;
  core.style.height = `${height + pad * 2}px`;
  core.style.background =
    'radial-gradient(50% 50% at 46% 44%, rgba(26,16,8,0.52) 0%, rgba(26,16,8,0.3) 50%, rgba(26,16,8,0) 72%)';
  layer.appendChild(core);
  const tail = document.createElement('div');
  tail.className = 'card-shadow';
  tail.style.left = `${left - pad + 34}px`;
  tail.style.top = `${top - pad + 44}px`;
  tail.style.width = `${width + pad * 2 + 26}px`;
  tail.style.height = `${height + pad * 2}px`;
  tail.style.background =
    'radial-gradient(52% 48% at 50% 48%, rgba(30,22,10,0.2) 0%, rgba(30,22,10,0) 68%)';
  layer.appendChild(tail);
  const spill = document.createElement('div');
  spill.className = 'card-shadow';
  spill.style.left = `${left - pad - 9}px`;
  spill.style.top = `${top - pad - 11}px`;
  spill.style.width = `${width + pad * 2}px`;
  spill.style.height = `${height + pad * 2}px`;
  spill.style.background =
    'radial-gradient(44% 44% at 40% 36%, rgba(245,215,131,0.15) 0%, rgba(245,215,131,0) 68%)';
  layer.appendChild(spill);
}

// Field r3 card stock: even stepped extrusion toward the shadow side so
// every card reads as thick paper, and deck/grave piles read as real stacks.
function addCardStock(wrapper, isStack) {
  const steps = isStack
    ? [[9.6, 13.2, '#8F7355'], [6.4, 8.8, '#CBA87E'], [3.2, 4.4, '#8F7355'], [1.4, 1.9, '#C4A47A']]
    : [[3.4, 4.6, '#8F7355'], [2.2, 3.0, '#B99977'], [1.1, 1.5, '#C4A47A']];
  for (const [dx, dy, tint] of steps) {
    const slab = document.createElement('div');
    slab.style.position = 'absolute';
    slab.style.width = '333px';
    slab.style.height = '505px';
    slab.style.borderRadius = '21px';
    slab.style.background = `linear-gradient(150deg, ${tint} 0%, #9A7D5F 100%)`;
    slab.style.transform = `translate(${dx}px, ${dy}px)`;
    wrapper.appendChild(slab);
  }
}

async function main() {
  const canvas = document.getElementById('scene-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(1672, 941, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const golden = await (await fetch('/tests/visual/baselines/camera-lock-v1/golden-quadrilaterals.json')).json();
  const anchors = golden.anchors ?? golden;

  const meadow = buildMeadowScene(renderer, { slotQuads: anchors });
  meadow.renderAt(0);

  await document.fonts.ready;

  const shadowLayer = document.getElementById('shadow-layer');
  const layer = document.getElementById('dom-layer');
  const registration = [];

  for (const [anchorId, quads] of Object.entries(anchors)) {
    const spec = BOARD_FACES[anchorId];
    if (!spec || SKIP_ANCHORS.has(anchorId)) continue;
    const corners = quads.face ?? quads;
    addShadow(shadowLayer, corners);

    const wrapper = document.createElement('div');
    wrapper.className = 'board-card';
    wrapper.dataset.anchor = anchorId;
    addCardStock(wrapper, STACK_ANCHORS.has(anchorId));
    const card = buildCardFace(faceModel(spec));
    card.style.position = 'absolute';
    wrapper.appendChild(card);
    // Homography: card chassis rect → golden quad.
    applyQuadTransform(wrapper, 333, 505, corners);
    layer.appendChild(wrapper);

    const projected = projectRectCorners(333, 505, corners);
    const maxCornerError = Math.max(
      ...projected.map((p, i) => Math.hypot(p[0] - corners[i][0], p[1] - corners[i][1])),
    );
    registration.push({ anchorId, maxCornerError });
  }

  // Hand row: upright fanned cards inside the §12 hand envelope.
  for (const entry of HAND) {
    const wrapper = document.createElement('div');
    wrapper.className = 'hand-card-aaa';
    wrapper.dataset.hand = entry.id;
    // r3: directional ground shadow + card-stock edge inside the scaled
    // wrapper, so hand cards sit on the meadow like the board cards.
    const handShadow = document.createElement('div');
    handShadow.style.position = 'absolute';
    handShadow.style.left = '-26px';
    handShadow.style.top = '-10px';
    handShadow.style.width = '385px';
    handShadow.style.height = '545px';
    handShadow.style.background =
      'radial-gradient(48% 48% at 52% 54%, rgba(26,16,8,0.42) 0%, rgba(26,16,8,0.2) 52%, rgba(26,16,8,0) 72%)';
    handShadow.style.transform = 'translate(20px, 30px)';
    wrapper.appendChild(handShadow);
    addCardStock(wrapper, false);
    const source = VERSES[entry.id];
    const card = buildCardFace(normalizeFaceModel(source, entry.kind));
    card.style.position = 'absolute';
    wrapper.appendChild(card);
    // transform-origin 50% 100% pins the UNTRANSFORMED bottom-center, so
    // offsets use the unscaled chassis box.
    wrapper.style.left = `${entry.x - 333 / 2}px`;
    wrapper.style.top = `${HAND_BOTTOM - 505}px`;
    wrapper.style.transform = `scale(${HAND_SCALE}) rotate(${entry.tilt}deg)`;
    wrapper.style.transformOrigin = '50% 100%';
    layer.appendChild(wrapper);
  }

  // Readiness must not race template-art decode: every CSS background art
  // aperture is preloaded and decoded before the ready flag flips.
  const artUrls = [...document.querySelectorAll('[data-art-tier]')]
    .map((node) => node.style.backgroundImage.match(/url\(["']?([^"')]+)/)?.[1])
    .filter(Boolean);
  await Promise.all([...new Set(artUrls)].map((url) => {
    const img = new Image();
    img.src = url;
    return img.decode();
  }));

  window.__TF_BOARD_REPORT__ = {
    anchorsPlaced: registration.length,
    handPlaced: HAND.length,
    maxCornerError: Math.max(...registration.map((r) => r.maxCornerError)),
    registration,
  };
  window.__TF_BOARD_READY__ = true;
}

main().catch((error) => {
  window.__TF_BOARD_ERROR__ = String(error?.message ?? error);
  throw error;
});
