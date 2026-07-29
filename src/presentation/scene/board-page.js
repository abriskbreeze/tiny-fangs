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
  const shadow = document.createElement('div');
  shadow.className = 'card-shadow';
  const pad = 26;
  shadow.style.left = `${left - pad + 9}px`;
  shadow.style.top = `${top - pad + 14}px`;
  shadow.style.width = `${width + pad * 2}px`;
  shadow.style.height = `${height + pad * 2}px`;
  shadow.style.background =
    'radial-gradient(50% 50% at 50% 50%, rgba(16,13,10,0.42) 0%, rgba(16,13,10,0.22) 55%, rgba(16,13,10,0) 78%)';
  layer.appendChild(shadow);
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
    const card = buildCardFace(faceModel(spec));
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
    const source = VERSES[entry.id];
    const card = buildCardFace(normalizeFaceModel(source, entry.kind));
    wrapper.appendChild(card);
    // transform-origin 50% 100% pins the UNTRANSFORMED bottom-center, so
    // offsets use the unscaled chassis box.
    wrapper.style.left = `${entry.x - 333 / 2}px`;
    wrapper.style.top = `${HAND_BOTTOM - 505}px`;
    wrapper.style.transform = `scale(${HAND_SCALE}) rotate(${entry.tilt}deg)`;
    wrapper.style.transformOrigin = '50% 100%';
    layer.appendChild(wrapper);
  }

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
