// Card showcase harness (plan Phase 2 golden samples). Two modes:
//
//   /showcase.html?mode=chassis   — unprojected 333 × 505 specimens plus the
//                                    three §7.4 nameplate fixtures, laid out
//                                    flat for exact measurement.
//   /showcase.html                — the §13.2 desktop-four-family placement:
//                                    duskfang / manaSurge / phantomWall faces
//                                    and the soulTrap-slot card back at their
//                                    manifest centers, sizes, and rotations.
//
// This page is capture/QA surface only; the classic shell never loads it.

import './cards.css';
import { CREATURES, VERSES } from '../../../shared/cards.js';
import { buildCardFace, normalizeFaceModel } from './card-face.js';
import {
  CHASSIS_HEIGHT,
  CHASSIS_WIDTH,
  NAMEPLATE_FIXTURES,
} from './chassis-geometry.js';

// §13.2 desktop-four-family revision 1 geometry.
export const SHOWCASE_SPECIMENS = [
  {
    id: 'card-creature-frame',
    faceId: 'duskfang',
    kind: 'creature',
    center: { x: 445, y: 578 },
    size: { width: 330, height: 500 },
    rotationDeg: -1.5,
    z: 3,
  },
  {
    id: 'card-cast-frame',
    faceId: 'manaSurge',
    kind: 'cast',
    center: { x: 833, y: 577 },
    size: { width: 330, height: 500 },
    rotationDeg: 0,
    z: 4,
  },
  {
    id: 'card-set-frame',
    faceId: 'phantomWall',
    kind: 'set',
    center: { x: 1206, y: 584 },
    size: { width: 330, height: 500 },
    rotationDeg: 1.5,
    z: 6,
  },
  {
    id: 'card-back',
    faceId: 'soulTrap', // manifest slot only; the back renders no identity
    kind: 'back',
    center: { x: 1405, y: 575 },
    size: { width: 300, height: 455 },
    rotationDeg: 6,
    z: 2,
  },
];

function faceModelFor(specimen) {
  if (specimen.kind === 'back') return normalizeFaceModel(null, 'back');
  const card = specimen.kind === 'creature'
    ? CREATURES[specimen.faceId]
    : VERSES[specimen.faceId];
  if (!card) {
    throw new Error(`Showcase face missing from catalog: ${specimen.faceId}`);
  }
  return normalizeFaceModel(card, specimen.kind);
}

function mountChassisMode(stage) {
  stage.classList.add('chassis');
  for (const specimen of SHOWCASE_SPECIMENS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'specimen';
    wrapper.dataset.specimen = specimen.id;
    wrapper.append(buildCardFace(faceModelFor(specimen)));
    stage.append(wrapper);
  }
  for (const fixture of NAMEPLATE_FIXTURES) {
    const source = CREATURES[fixture.id] ?? VERSES[fixture.id];
    if (!source) {
      throw new Error(`Nameplate fixture missing from catalog: ${fixture.id}`);
    }
    if (source.name !== fixture.name) {
      throw new Error(
        `Nameplate fixture name drift for ${fixture.id}: ${source.name}`,
      );
    }
    const kind = source.atk != null ? 'creature' : (source.type === 'set' ? 'set' : 'cast');
    const wrapper = document.createElement('div');
    wrapper.className = 'specimen';
    wrapper.dataset.nameplateFixture = fixture.id;
    wrapper.append(buildCardFace(normalizeFaceModel(source, kind)));
    stage.append(wrapper);
  }
}

function mountShowcaseMode(stage) {
  for (const specimen of SHOWCASE_SPECIMENS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'specimen';
    wrapper.dataset.specimen = specimen.id;
    const card = buildCardFace(faceModelFor(specimen));
    wrapper.append(card);
    const scaleX = specimen.size.width / CHASSIS_WIDTH;
    const scaleY = specimen.size.height / CHASSIS_HEIGHT;
    wrapper.style.left = `${specimen.center.x - CHASSIS_WIDTH / 2}px`;
    wrapper.style.top = `${specimen.center.y - CHASSIS_HEIGHT / 2}px`;
    wrapper.style.zIndex = String(specimen.z);
    wrapper.style.transform =
      `rotate(${specimen.rotationDeg}deg) scale(${scaleX}, ${scaleY})`;
    stage.append(wrapper);
  }
}

const stage = document.getElementById('stage');
const mode = new URLSearchParams(window.location.search).get('mode');

try {
  if (mode === 'chassis') {
    mountChassisMode(stage);
  } else {
    mountShowcaseMode(stage);
  }
  document.fonts.ready.then(() => {
    window.__TF_CARDS_READY__ = true;
  });
} catch (error) {
  window.__TF_CARDS_ERROR__ = String(error?.message ?? error);
  throw error;
}
