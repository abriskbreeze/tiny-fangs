// Phase 8 — the AAA game shell: the live meadow scene behind real gameplay.
// Mounts behind the `aaa` presentation flag, renders the projected client
// state onto the camera-lock golden quads with the shared card chassis, and
// exposes every information surface as quiet edge rails / diegetic tokens.
//
// This module is presentation only: it never mutates game state, and every
// action affordance delegates to the shell's existing action functions (the
// same ones the classic buttons call), so shared/engine.js remains the only
// rules authority and every modal/validation path is unchanged.

import * as THREE from 'three';
import { buildCardFace, normalizeFaceModel } from './cards/card-face.js';
import {
  imageAssets,
  STATUS_ASSET_PATHS,
  UI_ASSET_PATHS,
} from './assets/image-assets.js';
import { getEffectiveAtk } from '../abilities.js';
import './cards/cards.css';
// NOTE: aaa-shell.css is imported EAGERLY by src/main.js, not here. This
// module is lazily imported (three.js is heavy), but the flag-gated styles
// also dress classic-DOM surfaces — setup, modals, coin, rules — which are
// visible long before any shell mounts.
import { mountBoardCard, CHASSIS_W, CHASSIS_H } from './dom/board-card-mount.js';
import { createParticlePool } from './particle-pool.js';
import { createAudioDirector } from './audio-director.js';
import {
  QUALITY_TIER_LABELS,
  nextQualityTier,
  persistQualityTier,
  qualityProfile,
  resolveQualityTier,
} from './quality-tier.js';
import { GOLDEN_QUADS } from './scene/golden-quads.js';
import { buildMeadowScene } from './scene/meadow-scene.js';

const FRAME_W = 1672;
const FRAME_H = 941;
const HAND_BOTTOM = 934;
const HAND_SCALE = 0.42;

// Phase 14: drag-to-play. The threshold is the SAME 15 px contract the
// classic shell uses (src/main.js DRAG_THRESHOLD, covered by INP-02): below
// it a pointer sequence is a press (click → the existing modal flow), at or
// above it becomes a drag.
const DRAG_THRESHOLD = 15;
const DRAG_PROXY_SCALE = 0.3;

// The playable "field" for a cast verse is the union of every golden quad —
// the same "anywhere on the board" target classic gives `.d-field`.
const FIELD_BAND = (() => {
  const xs = [];
  const ys = [];
  for (const corners of Object.values(GOLDEN_QUADS)) {
    for (const [x, y] of corners) { xs.push(x); ys.push(y); }
  }
  return Object.freeze({
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  });
})();

function quadFrameRect(anchorId) {
  const corners = GOLDEN_QUADS[anchorId];
  if (!corners) return null;
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

function faceKindOf(card) {
  if (!card) return null;
  if (card.cardType === 'creature') return 'creature';
  return card.type === 'set' ? 'set' : 'cast';
}

function safeFace(card, kind) {
  try {
    return buildCardFace(normalizeFaceModel(card, kind));
  } catch {
    // Fail-open to a card back rather than blocking gameplay on a bad model.
    return buildCardFace(normalizeFaceModel(null, 'back'));
  }
}

export function createAaaShell({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  actions = {},
  onError = null,
  quality = null,
} = {}) {
  // Phase 13: the tier is resolved once per shell instance. Changing it is a
  // shell rebuild (actions.setQuality), never a live mutation — the renderer
  // has to be recreated for antialiasing anyway.
  const tier = resolveQualityTier({ tier: quality });
  const profile = qualityProfile(tier);
  let stage = null;
  let cardLayer = null;
  let shadowLayer = null;
  let hudLayer = null;
  let meadow = null;
  let renderer = null;
  let mounted = false;
  let resizeHandler = null;
  let particleLayer = null;
  let dropLayer = null;
  let particles = null;
  let audio = null;
  // Phase 14 drag-to-play. `latestG` is the projected state the last update
  // rendered — drag decisions (affordability, legal zones) always read it, so
  // they can never go stale against the engine. `drag` is null unless a
  // pointer sequence is in flight.
  let latestG = null;
  let drag = null;
  // A completed drag must not also fire the hand card's click handler (which
  // opens the classic picker modal). Cleared on the next pointerdown so an
  // off-element release can never poison a later press.
  let suppressNextClick = false;
  // Phase 10a: uid-keyed FLIP outers. Each card with an identity renders
  // inside a persistent frame-spanning outer; zone changes animate the outer
  // with a deterministic fixed-curve transform that always settles to ''.
  const flipMap = new Map(); // uid -> outer element

  function prefersReducedMotion() {
    try {
      return win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    } catch {
      return false;
    }
  }

  function getFlipOuter(uid) {
    let outer = flipMap.get(uid);
    if (!outer) {
      outer = doc.createElement('div');
      outer.className = 'aaa-flip';
      outer.dataset.flipUid = uid;
      flipMap.set(uid, outer);
    }
    outer.replaceChildren();
    return outer;
  }

  function measureFlip(outer) {
    const inner = outer.firstElementChild;
    if (!inner) return null;
    const rect = inner.getBoundingClientRect();
    return rect.width > 0 ? rect : null;
  }

  function quadViewportRect(anchorId) {
    const corners = GOLDEN_QUADS[anchorId];
    const frame = stage?.getBoundingClientRect();
    if (!corners || !frame) return null;
    const scale = frame.width / FRAME_W;
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    return {
      left: frame.left + Math.min(...xs) * scale,
      top: frame.top + Math.min(...ys) * scale,
      width: (Math.max(...xs) - Math.min(...xs)) * scale,
      height: (Math.max(...ys) - Math.min(...ys)) * scale,
    };
  }

  function animateFlip(outer, fromRect, toRect) {
    const frame = stage?.getBoundingClientRect();
    if (!frame || !fromRect || !toRect) return;
    const stageScale = frame.width / FRAME_W || 1;
    const fromCx = fromRect.left + fromRect.width / 2;
    const fromCy = fromRect.top + fromRect.height / 2;
    const toCx = toRect.left + toRect.width / 2;
    const toCy = toRect.top + toRect.height / 2;
    const dx = (fromCx - toCx) / stageScale;
    const dy = (fromCy - toCy) / stageScale;
    const sx = toRect.width > 0 ? fromRect.width / toRect.width : 1;
    const sy = toRect.height > 0 ? fromRect.height / toRect.height : 1;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.02) return;
    outer.style.transformOrigin =
      `${(toCx - frame.left) / stageScale}px ${(toCy - frame.top) / stageScale}px`;
    outer.classList.remove('aaa-flip--moving');
    outer.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    void outer.offsetWidth; // commit First
    outer.classList.add('aaa-flip--moving');
    outer.style.transform = '';
    const settle = () => {
      outer.classList.remove('aaa-flip--moving');
      outer.removeEventListener('transitionend', settle);
    };
    outer.addEventListener('transitionend', settle);
    win.setTimeout(settle, 520);
  }

  function animateExitToGrave(outer, side) {
    const toRect = quadViewportRect(`${side}.grave`);
    const fromRect = measureFlip(outer);
    if (!toRect || !fromRect) { flipMap.delete(outer.dataset.flipUid); return; }
    cardLayer.appendChild(outer); // resurrect the old content for the exit
    const frame = stage.getBoundingClientRect();
    const stageScale = frame.width / FRAME_W || 1;
    const dx = ((toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2)) / stageScale;
    const dy = ((toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2)) / stageScale;
    outer.style.transformOrigin =
      `${(fromRect.left + fromRect.width / 2 - frame.left) / stageScale}px ${(fromRect.top + fromRect.height / 2 - frame.top) / stageScale}px`;
    outer.classList.add('aaa-flip--moving', 'aaa-flip--exiting');
    outer.style.transform = `translate(${dx}px, ${dy}px) scale(0.55)`;
    const uid = outer.dataset.flipUid;
    win.setTimeout(() => {
      outer.remove();
      if (flipMap.get(uid) === outer) flipMap.delete(uid);
    }, 460);
  }

  function el(tag, className, parent, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function fitStage() {
    if (!stage) return;
    const scale = Math.min(win.innerWidth / FRAME_W, win.innerHeight / FRAME_H);
    stage.style.transform = `scale(${scale})`;
    stage.style.left = `${Math.max(0, (win.innerWidth - FRAME_W * scale) / 2)}px`;
    stage.style.top = `${Math.max(0, (win.innerHeight - FRAME_H * scale) / 2)}px`;
  }

  // Targeting/selection rings are drawn by CSS pseudo-elements, so their art
  // is published as custom properties on the stage. `data-ring-art` appears
  // only once BOTH rings load, and CSS keys the swap off it — so a missing
  // file leaves the authored border-and-glow exactly as it was.
  //
  // Deliberately OUTSIDE the mount critical path: art is decoration and must
  // never be able to influence whether the scene reports itself mounted.
  let ringArtWired = false;
  function wireRingArt() {
    if (ringArtWired || !stage) return;
    ringArtWired = true;
    try {
      Promise.all([
        imageAssets.applyCssVar(stage, '--tf-ring-selection', UI_ASSET_PATHS.selectionRing),
        imageAssets.applyCssVar(stage, '--tf-ring-target', UI_ASSET_PATHS.legalTargetRing),
      ]).then(([selection, target]) => {
        if (selection && target && stage) stage.dataset.ringArt = 'true';
      }, () => {});
    } catch { /* art never blocks the shell */ }
  }

  function mount() {
    if (mounted) return true;
    // `static` never mounts a WebGL scene at all. Reporting an unmounted
    // shell is the SAME RSP-07 contract a WebGL failure uses, so the caller
    // downgrades `data-presentation` to the fully playable classic renderer.
    if (!profile.scene) return false;
    const host = doc.getElementById('aaa-stage');
    if (!host) return false;
    try {
      host.innerHTML = '';
      stage = el('div', 'aaa-frame', host);
      stage.dataset.quality = tier;
      const canvas = el('canvas', 'aaa-canvas', stage);
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      shadowLayer = el('div', 'aaa-layer aaa-shadow-layer', stage);
      // Drop-zone highlights sit under the cards and are NOT cleared by
      // update(): a re-render mid-drag must not drop the affordance.
      dropLayer = el('div', 'aaa-layer aaa-drop-layer', stage);
      cardLayer = el('div', 'aaa-layer aaa-card-layer', stage);
      particleLayer = el('div', 'aaa-layer aaa-particle-layer', stage);
      hudLayer = el('div', 'aaa-layer aaa-hud-layer', stage);
      particles = createParticlePool({
        document: doc, layer: particleLayer, max: profile.particleMax,
      });
      audio = createAudioDirector({ document: doc, window: win });
      audio.bindFirstGesture();
      // Event seams for the Anim facade (null-safe on both sides): bursts
      // originate from a resolved element's frame-space center.
      win.__tfAaaBurst = (element, kind) => {
        try {
          const rect = element?.getBoundingClientRect?.();
          const frame = stage.getBoundingClientRect();
          if (!rect || rect.width === 0) return;
          const scale = frame.width / FRAME_W || 1;
          particles.burst({
            x: (rect.left + rect.width / 2 - frame.left) / scale,
            y: (rect.top + rect.height / 2 - frame.top) / scale,
            kind,
            count: kind === 'ko' ? 14 : 10,
          });
        } catch { /* garnish never throws */ }
      };
      win.__tfAaaAudio = audio;
      // Read-only seam so a test can assert the tier's actual budget rather
      // than inferring it (mirrors the existing __tfAaa* garnish seams).
      win.__tfAaaQuality = Object.freeze({
        tier,
        antialias: profile.antialias,
        particleMax: particles.max,
        lightSpill: profile.lightSpill,
      });
      // Read-only drag seam (same __tfAaa* convention): lets a test assert
      // the press/drag threshold and residue directly instead of inferring.
      win.__tfAaaDrag = () => (drag
        ? {
          active: drag.active,
          canAfford: drag.canAfford,
          uid: drag.uid ?? null,
          zones: drag.zones.map((zone) => zone.id),
        }
        : null);

      renderer = new THREE.WebGLRenderer({
        canvas, antialias: profile.antialias, preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(FRAME_W, FRAME_H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      meadow = buildMeadowScene(renderer, { slotQuads: GOLDEN_QUADS });
      meadow.renderAt(0);

      resizeHandler = () => fitStage();
      win.addEventListener('resize', resizeHandler);
      fitStage();
      mounted = true;
      wireRingArt();
      return true;
    } catch (error) {
      onError?.(error);
      dispose();
      return false;
    }
  }

  // ── zone rendering ──────────────────────────────────────────────

  function countChip(anchorId, count, label) {
    const corners = GOLDEN_QUADS[anchorId];
    if (!corners) return;
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const isGrave = anchorId.endsWith('.grave');
    const chip = el(isGrave ? 'button' : 'div', 'aaa-count-chip', hudLayer, String(count));
    chip.dataset.chip = anchorId;
    chip.setAttribute('aria-label', `${label}: ${count}`);
    chip.style.left = `${Math.max(...xs) - 18}px`;
    chip.style.top = `${Math.max(...ys) - 12}px`;
    if (isGrave) {
      // Phase 9c: the grave chip opens the graveyard browser (classic
      // showGraveyard flow with hold-to-zoom preserved).
      chip.classList.add('aaa-count-chip--action');
      chip.style.pointerEvents = 'auto';
      chip.type = 'button';
      chip.addEventListener('click', () =>
        actions.showGraveyard?.(anchorId.startsWith('me.') ? 'me' : 'opp'));
    }
  }

  function renderAnchor(anchorId, card, { isStack = false, faceDown = false, count = null, countLabel = '' } = {}) {
    const corners = GOLDEN_QUADS[anchorId];
    if (!corners) return;
    if (!card && !faceDown) return;
    const face = faceDown
      ? buildCardFace(normalizeFaceModel(null, 'back'))
      : safeFace(card, faceKindOf(card));
    const keyed = !faceDown && card?.uid;
    const host = keyed ? getFlipOuter(card.uid) : cardLayer;
    const { wrapper } = mountBoardCard({
      layer: host, shadowLayer, corners, face, isStack, anchorId, document: doc,
      lightSpill: profile.lightSpill,
    });
    if (keyed) cardLayer.appendChild(host);
    // Face-up cards with an identity open the card-detail surface — the
    // same classic showCardDetail flow (face-down cards expose nothing).
    // During a targeting selection (Phase 9b) a highlighted card resolves
    // the selector instead: diegetic pick through the SAME option action.
    if (!faceDown && card?.uid) {
      const graveSide = anchorId.endsWith('.grave')
        ? (anchorId.startsWith('me.') ? 'me' : 'opp')
        : null;
      wrapper.classList.add('aaa-board-card--inspectable');
      wrapper.dataset.uid = card.uid;
      wrapper.style.pointerEvents = 'auto';
      if (graveSide) wrapper.dataset.graveSide = graveSide;
      wrapper.addEventListener('click', () => {
        if (wrapper.classList.contains('aaa-card--targetable')
          && typeof win._aaaTargetPick === 'function') {
          win._aaaTargetPick(card.uid);
          return;
        }
        // A grave stack is a pile, not a card: clicking it opens the whole
        // browser (the top card is reachable as its first entry). The grave
        // is public, so both sides open.
        if (graveSide) {
          actions.showGraveyard?.(graveSide);
          return;
        }
        actions.showCardDetail?.(card.uid);
      });
    }
    if (count !== null && count > 0) countChip(anchorId, count, countLabel);
  }

  function renderStatuses(anchorId, card) {
    if (!card) return;
    // Engine truth: creature.status carries poison/trapped; fortified is a
    // boolean flag (the pre-audit check read fields that never exist).
    const marks = [];
    if (card.status === 'poison') marks.push(['psn', 'poisoned', 'poison']);
    if (card.status === 'trapped') marks.push(['trp', 'trapped', 'trapped']);
    if (card.fortified) marks.push(['frt', 'fortified', 'fortified']);
    if (!marks.length) return;
    const corners = GOLDEN_QUADS[anchorId];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const rail = el('div', 'aaa-status-rail', hudLayer);
    rail.style.left = `${Math.max(...xs) + 4}px`;
    rail.style.top = `${Math.min(...ys) + 6}px`;
    for (const [text, label, iconKey] of marks) {
      const charm = el('span', 'aaa-status-charm', rail, text);
      charm.setAttribute('aria-label', label);
      // The three-letter text stays in the DOM as the procedural floor and as
      // the accessible/e2e-observable value; CSS hides the glyph only once an
      // icon has actually loaded (see .aaa-status-charm[data-asset-wired]).
      imageAssets.applyBackground(charm, STATUS_ASSET_PATHS[iconKey], { size: 'contain' });
    }
  }

  // A life/mana pip. The unicode glyph remains the element's text so the HUD's
  // aggregate textContent ('♥♥♡') is unchanged whether or not art is present;
  // the token image, when it loads, paints over it and the glyph goes
  // transparent. Filled and empty stay distinguishable in both modes.
  function vitalToken(parent, glyph, filled, assetPath) {
    const token = el('span', 'aaa-vital-token', parent, glyph);
    token.dataset.filled = filled ? 'true' : 'false';
    imageAssets.applyBackground(token, assetPath, { size: 'contain' });
    return token;
  }

  function fillVitals(node, filledCount, emptyCount, glyphs, assetPath) {
    node.textContent = '';
    for (let i = 0; i < filledCount; i += 1) {
      vitalToken(node, glyphs[0], true, assetPath);
    }
    for (let i = 0; i < emptyCount; i += 1) {
      vitalToken(node, glyphs[1], false, assetPath);
    }
  }

  // ── drag-to-play ────────────────────────────────────────────────
  //
  // Presentation only. The shell owns pointer tracking, the proxy, and the
  // quad hit-test; every rules question (is this playable? what would it do?
  // execute it) is answered by the SAME classic functions the classic drop
  // uses — `canPlayCard`, `getPlayType`, `executeDrop` — so shared/engine.js
  // stays the only rules authority and all validation/selection modals still
  // run unchanged.

  function frameRectToViewport(rect) {
    const frame = stage?.getBoundingClientRect();
    if (!frame || !rect) return null;
    const scale = frame.width / FRAME_W || 1;
    return {
      left: frame.left + rect.x * scale,
      top: frame.top + rect.y * scale,
      right: frame.left + (rect.x + rect.w) * scale,
      bottom: frame.top + (rect.y + rect.h) * scale,
    };
  }

  function rectContains(rect, x, y) {
    return Boolean(rect)
      && x >= rect.left && x <= rect.right
      && y >= rect.top && y <= rect.bottom;
  }

  // Legal drop zones for a card, derived strictly from the classic play type
  // so a highlighted quad can never promise something the engine refuses.
  function dropZonesFor(card) {
    if (!card) return [];
    if (actions.canPlayCard && !actions.canPlayCard(card)) return [];
    const playType = actions.getPlayType?.(card) ?? null;
    if (!playType) return [];
    const anchored = (ids) => ids
      .map((id) => ({ id, playType, ...quadFrameRect(id) }))
      .filter((zone) => zone.w > 0);
    if (playType === 'summon-active') return anchored(['me.active']);
    if (playType === 'summon-bench') {
      const bench = latestG?.me?.bench ?? [];
      const free = [];
      if (!bench[0]) free.push('me.bench.a');
      if (!bench[1]) free.push('me.bench.b');
      return anchored(free);
    }
    if (playType === 'set-verse') return anchored(['me.set']);
    // A cast verse resolves against the board as a whole: the whole field
    // band is one zone, mirroring classic's `.d-field` drop target.
    if (playType === 'cast') return [{ id: 'field', playType, ...FIELD_BAND }];
    return [];
  }

  function clearDropZones() {
    dropLayer?.replaceChildren();
  }

  function highlightDropZones() {
    clearDropZones();
    if (!dropLayer || !drag?.canAfford) return;
    for (const zone of drag.zones) {
      const node = el('div', 'aaa-drop-zone', dropLayer);
      node.dataset.drop = zone.id;
      node.style.left = `${zone.x}px`;
      node.style.top = `${zone.y}px`;
      node.style.width = `${zone.w}px`;
      node.style.height = `${zone.h}px`;
    }
  }

  function updateDropZoneHover(hitId) {
    if (!dropLayer) return;
    for (const node of dropLayer.children) {
      node.classList.toggle('aaa-drop-zone--hover', node.dataset.drop === hitId);
    }
  }

  function detectDropZone(x, y) {
    if (!drag) return null;
    for (const zone of drag.zones) {
      if (rectContains(frameRectToViewport(zone), x, y)) return zone;
    }
    return null;
  }

  function overField(x, y) {
    return rectContains(frameRectToViewport(FIELD_BAND), x, y);
  }

  function createDragProxy() {
    const proxy = el('div', 'aaa-drag-proxy', doc.body);
    if (!prefersReducedMotion()) proxy.classList.add('aaa-drag-proxy--lively');
    proxy.dataset.uid = drag.card?.uid ?? '';
    proxy.style.setProperty('--aaa-drag-scale', String(DRAG_PROXY_SCALE));
    proxy.appendChild(safeFace(drag.card, faceKindOf(drag.card)));
    positionDragProxy(proxy, drag.currentX, drag.currentY);
    drag.proxy = proxy;
  }

  function positionDragProxy(proxy, x, y) {
    proxy.style.left = `${x}px`;
    proxy.style.top = `${y}px`;
  }

  function detachDragListeners() {
    doc.removeEventListener('pointermove', onDragMove);
    doc.removeEventListener('pointerup', onDragEnd);
    doc.removeEventListener('pointercancel', onDragEnd);
  }

  // Total teardown: no proxy, no highlights, no listeners, no drag record.
  // pointercancel takes exactly this path and nothing else (INP-05).
  function cleanupDrag() {
    detachDragListeners();
    drag?.proxy?.remove();
    clearDropZones();
    drag = null;
  }

  function beginDrag(card, event) {
    // Primary button only: right-click stays the inspect gesture.
    if (event.button !== undefined && event.button !== 0) return;
    suppressNextClick = false;
    const G = latestG;
    if (!card || !G || !G.myTurn || G.winner != null) return;
    // A drag already in flight (lost pointerup) is torn down first.
    if (drag) cleanupDrag();
    const clientX = event.clientX ?? 0;
    const clientY = event.clientY ?? 0;
    drag = {
      card,
      uid: card.uid ?? null,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      // Same affordability rule as classic cardPress.
      canAfford: (card.cost ?? 0) <= (G.me?.mana ?? 0),
      zones: dropZonesFor(card),
      active: false,
      proxy: null,
    };
    doc.addEventListener('pointermove', onDragMove);
    doc.addEventListener('pointerup', onDragEnd);
    doc.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(event) {
    if (!drag) return;
    const clientX = event.clientX ?? 0;
    const clientY = event.clientY ?? 0;
    drag.currentX = clientX;
    drag.currentY = clientY;

    // Only suppress scrolling once this is confirmed to be a drag.
    if (drag.active && event.cancelable) event.preventDefault();

    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (!drag.active && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
      drag.active = true;
      createDragProxy();
      if (drag.canAfford) highlightDropZones();
    }

    if (!drag.active || !drag.proxy) return;
    positionDragProxy(drag.proxy, clientX, clientY);
    if (drag.canAfford) {
      updateDropZoneHover(detectDropZone(clientX, clientY)?.id ?? null);
      drag.proxy.classList.remove('unaffordable');
    } else {
      // Same "unavailable" cue classic paints on its ghost.
      drag.proxy.classList.toggle('unaffordable', overField(clientX, clientY));
    }
  }

  function onDragEnd(event) {
    if (!drag) { detachDragListeners(); return; }
    const wasActive = drag.active;
    const clientX = event.clientX ?? drag.currentX;
    const clientY = event.clientY ?? drag.currentY;
    const cancelled = event.type === 'pointercancel';
    const card = drag.card;
    const canAfford = drag.canAfford;
    const zone = wasActive && !cancelled && canAfford
      ? detectDropZone(clientX, clientY)
      : null;

    const captureTarget = event.target;
    if (Number.isInteger(event.pointerId)
      && captureTarget?.hasPointerCapture?.(event.pointerId)) {
      captureTarget.releasePointerCapture(event.pointerId);
    }

    // Tear everything down BEFORE dispatching: the play triggers a re-render
    // and no artifact may outlive the gesture.
    cleanupDrag();
    if (wasActive) suppressNextClick = true;
    if (!zone) return;
    // The card must still be the same hand card the gesture started on.
    const live = (latestG?.me?.hand ?? []).find((c) => c.uid === card.uid);
    if (!live) return;
    actions.executeDrop?.(live, { type: zone.playType });
  }

  function renderHand(hand, myTurn, selectedCard = null) {
    const n = hand.length;
    if (!n) return;
    const spacing = Math.min(152, n > 1 ? 560 / (n - 1) : 0);
    const startX = 840 - ((n - 1) * spacing) / 2;
    const maxTilt = Math.min(8, 2 + n * 1.2);
    hand.forEach((card, i) => {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const tilt = (t - 0.5) * 2 * maxTilt;
      const host = card.uid ? getFlipOuter(card.uid) : cardLayer;
      const wrapper = el('div', 'aaa-hand-card', host);
      if (card.uid) cardLayer.appendChild(host);
      wrapper.dataset.hand = card.uid ?? String(i);
      if (card.uid) wrapper.dataset.uid = card.uid;
      if (selectedCard && card.uid === selectedCard) {
        wrapper.classList.add('aaa-hand-card--selected');
      }
      wrapper.dataset.handIndex = String(i);
      const shadow = el('div', 'aaa-hand-shadow', wrapper);
      shadow.style.transform = 'translate(20px, 30px)';
      const face = safeFace(card, faceKindOf(card));
      face.style.position = 'absolute';
      wrapper.appendChild(face);
      wrapper.style.left = `${startX + i * spacing - CHASSIS_W / 2}px`;
      wrapper.style.top = `${HAND_BOTTOM - CHASSIS_H + Math.abs(t - 0.5) * 26}px`;
      wrapper.style.transform = `scale(${HAND_SCALE}) rotate(${tilt}deg)`;
      if (myTurn) {
        wrapper.classList.add('aaa-hand-card--live');
        // Drag-to-play is an ADDITION: past the 15 px threshold the pointer
        // sequence becomes a drag and the click below is suppressed; below it
        // the press still opens the picker (keyboard/AT users keep the click
        // path untouched).
        wrapper.addEventListener('pointerdown', (event) => beginDrag(card, event));
        wrapper.addEventListener('click', () => {
          if (suppressNextClick) { suppressNextClick = false; return; }
          // A hand card routes to its family's existing action flow — the
          // same modal/validation path as the classic buttons.
          if (card.cardType === 'creature') actions.doSummon?.();
          else if (card.type === 'set') actions.doSet?.();
          else actions.doCast?.();
        });
      }
      if (card.uid) {
        // Inspect from hand regardless of turn: context-click opens the
        // detail surface without playing the card.
        wrapper.style.pointerEvents = 'auto';
        wrapper.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          actions.showCardDetail?.(card.uid);
        });
      }
    });
  }

  function renderHud(G) {
    const myTurn = Boolean(G.myTurn);

    // Left rail: my vitals (diegetic hearts + mana pips).
    const left = el('div', 'aaa-rail aaa-rail--left', hudLayer);
    const mySide = el('div', 'aaa-vitals', left);
    mySide.dataset.side = 'me';
    el('div', 'aaa-vitals-label', mySide, 'You');
    const myLp = el('div', 'aaa-hearts', mySide);
    myLp.id = 'aaa-my-lp';
    fillVitals(myLp, Math.max(0, G.me.lp), Math.max(0, 3 - G.me.lp), ['♥', '♡'], UI_ASSET_PATHS.lifeToken);
    const myMana = el('div', 'aaa-mana', mySide);
    myMana.id = 'aaa-my-mana';
    myMana.setAttribute('aria-label', `mana ${G.me.mana} of ${G.me.maxMana}`);
    fillVitals(myMana, G.me.mana, Math.max(0, G.me.maxMana - G.me.mana), ['●', '○'], UI_ASSET_PATHS.manaToken);
    if (G.me.unbreakable) {
      const ward = el('div', 'aaa-status-charm aaa-ward-charm', mySide, 'ward');
      ward.setAttribute('aria-label', 'unbreakable this turn');
      imageAssets.applyBackground(ward, STATUS_ASSET_PATHS.unbreakable, { size: 'contain' });
    }

    // Top-right rail: rival vitals + hand count.
    const right = el('div', 'aaa-rail aaa-rail--top-right', hudLayer);
    const oppSide = el('div', 'aaa-vitals', right);
    oppSide.dataset.side = 'opp';
    el('div', 'aaa-vitals-label', oppSide, 'Rival');
    const oppLp = el('div', 'aaa-hearts', oppSide);
    oppLp.id = 'aaa-opp-lp';
    fillVitals(oppLp, Math.max(0, G.opp.lp), Math.max(0, 3 - G.opp.lp), ['♥', '♡'], UI_ASSET_PATHS.lifeToken);
    const oppMana = el('div', 'aaa-mana', oppSide);
    oppMana.id = 'aaa-opp-mana';
    fillVitals(oppMana, G.opp.mana, Math.max(0, G.opp.maxMana - G.opp.mana), ['●', '○'], UI_ASSET_PATHS.manaToken);
    const oppHand = el('div', 'aaa-opp-hand', oppSide);
    oppHand.id = 'aaa-opp-hand';
    oppHand.textContent = `hand ${G.opp.handCount ?? G.opp.hand?.length ?? 0}`;
    if (G.opp.unbreakable) {
      const ward = el('div', 'aaa-status-charm aaa-ward-charm', oppSide, 'ward');
      ward.setAttribute('aria-label', 'rival unbreakable this turn');
      imageAssets.applyBackground(ward, STATUS_ASSET_PATHS.unbreakable, { size: 'contain' });
    }

    // Turn token near the divider's right end, with the match timer under
    // it (the classic updateTimer keeps #aaa-timer current between renders).
    const turnChip = el('div', 'aaa-turn-chip', hudLayer);
    turnChip.id = 'aaa-turn';
    turnChip.textContent = `Turn ${G.turn} — ${myTurn ? 'You' : 'Rival'}`;
    turnChip.dataset.owner = myTurn ? 'me' : 'opp';
    // The marker rides as a left-hand medallion on the chip, so the chip's
    // own text (asserted by the shell e2e specs) is untouched either way.
    imageAssets.applyBackground(turnChip, UI_ASSET_PATHS.turnMarker, {
      size: '22px 22px',
      position: 'left 8px center',
    });
    const timerChip = el('div', 'aaa-timer-chip', hudLayer);
    timerChip.id = 'aaa-timer';
    timerChip.textContent = doc.getElementById('d-time')?.textContent ?? '0:00';

    // Bottom-right action rail: all six actions, same handlers as classic.
    const bar = el('div', 'aaa-rail aaa-action-rail', hudLayer);
    const buttons = [
      ['summon', 'Summon', actions.doSummon],
      ['attack', 'Attack', actions.doAttack],
      ['cast', 'Cast', actions.doCast],
      ['set', 'Set', actions.doSet],
      ['retreat', 'Retreat', actions.doRetreat],
      ['end', 'End Turn', actions.endTurn],
    ];
    for (const [id, label, handler] of buttons) {
      const button = el('button', 'aaa-action', bar, label);
      button.id = `aaa-action-${id}`;
      button.type = 'button';
      // Terminal states disable the rail alongside off-turn, matching the
      // classic `updateButtons` contract: once a match is decided the AAA
      // action rail stops offering moves.
      button.disabled = !myTurn || G.winner != null;
      button.addEventListener('click', () => handler?.());
    }

    // Rules link: quiet corner affordance opening the classic rules overlay.
    const rulesLink = el('button', 'aaa-rules-link', hudLayer, 'Rules');
    rulesLink.id = 'aaa-rules-link';
    rulesLink.type = 'button';
    rulesLink.addEventListener('click', () => actions.showRules?.());

    // Sound chip: mute toggle with persisted state (audio director owns it).
    const soundChip = el('button', 'aaa-rules-link aaa-sound-chip', hudLayer,
      audio?.muted ? 'Sound: Off' : 'Sound: On');
    soundChip.id = 'aaa-sound';
    soundChip.type = 'button';
    soundChip.setAttribute('aria-pressed', String(Boolean(audio?.muted)));
    soundChip.addEventListener('click', () => {
      const muted = audio?.toggleMute?.();
      soundChip.textContent = muted ? 'Sound: Off' : 'Sound: On';
      soundChip.setAttribute('aria-pressed', String(Boolean(muted)));
    });

    // Quality chip: cycles the render tier, persists the pick, and asks the
    // host to rebuild the shell (the renderer cannot change antialiasing in
    // place). Picking `static` rebuilds into the classic renderer via the
    // existing RSP-07 downgrade contract.
    const qualityChip = el('button', 'aaa-rules-link aaa-quality-chip', hudLayer,
      `Quality: ${QUALITY_TIER_LABELS[tier]}`);
    qualityChip.id = 'aaa-quality';
    qualityChip.type = 'button';
    qualityChip.dataset.quality = tier;
    qualityChip.setAttribute('aria-label', `Quality: ${QUALITY_TIER_LABELS[tier]} — cycle render quality`);
    qualityChip.addEventListener('click', () => {
      const next = nextQualityTier(tier);
      persistQualityTier(next);
      actions.setQuality?.(next);
    });

    // Log rail: mirror of the shell's log entries (newest last).
    const logRail = el('div', 'aaa-rail aaa-log-rail', hudLayer);
    logRail.id = 'aaa-log';
    const source = doc.getElementById('d-log');
    if (source) {
      const entries = [...source.children].slice(-6);
      for (const entry of entries) {
        el('div', 'aaa-log-line', logRail, entry.textContent);
      }
    }
  }

  function update(G, options = {}) {
    if (!mounted && !mount()) return;
    if (!G) return;
    // Drag decisions always read the freshest projected state.
    latestG = G;
    const reduced = prefersReducedMotion();
    // FLIP First: capture the rect of every keyed card still on stage.
    const prevRects = new Map();
    if (!reduced) {
      for (const [uid, outer] of flipMap) {
        if (outer.isConnected && !outer.classList.contains('aaa-flip--exiting')) {
          const rect = measureFlip(outer);
          if (rect) prevRects.set(uid, rect);
        }
      }
    }
    cardLayer.innerHTML = '';
    shadowLayer.innerHTML = '';
    hudLayer.innerHTML = '';

    renderAnchor('opp.deck', null, {
      faceDown: (G.opp.deckCount ?? G.opp.deck?.length ?? 0) > 0,
      isStack: true,
      count: G.opp.deckCount ?? G.opp.deck?.length ?? 0,
      countLabel: 'rival deck',
    });
    // Presentation-only effective stats: actives show the modifier-adjusted
    // attack (same shared getEffectiveAtk the classic shell displays).
    const withEffective = (card, owner, enemy) => {
      if (!card) return card;
      try {
        return { ...card, displayAtk: getEffectiveAtk(card, owner, enemy) };
      } catch {
        return card;
      }
    };
    renderAnchor('opp.bench.a', G.opp.bench?.[0]);
    renderStatuses('opp.bench.a', G.opp.bench?.[0]);
    renderAnchor('opp.bench.b', G.opp.bench?.[1]);
    renderStatuses('opp.bench.b', G.opp.bench?.[1]);
    renderAnchor('opp.active', withEffective(G.opp.active, G.opp, G.me));
    renderStatuses('opp.active', G.opp.active);
    // Privacy: the rival Set is exactly opaque presence.
    renderAnchor('opp.set', null, { faceDown: Boolean(G.opp.setVerse) });
    renderAnchor('opp.grave', G.opp.grave?.[G.opp.grave.length - 1] ?? null, {
      isStack: true, count: G.opp.grave?.length ?? 0, countLabel: 'rival graveyard',
    });

    renderAnchor('me.deck', null, {
      faceDown: (G.me.deckCount ?? G.me.deck?.length ?? 0) > 0,
      isStack: true,
      count: G.me.deckCount ?? G.me.deck?.length ?? 0,
      countLabel: 'your deck',
    });
    renderAnchor('me.active', withEffective(G.me.active, G.me, G.opp));
    renderStatuses('me.active', G.me.active);
    renderAnchor('me.bench.a', G.me.bench?.[0]);
    renderStatuses('me.bench.a', G.me.bench?.[0]);
    renderAnchor('me.bench.b', G.me.bench?.[1]);
    renderStatuses('me.bench.b', G.me.bench?.[1]);
    renderAnchor('me.set', null, { faceDown: Boolean(G.me.setVerse) });
    renderAnchor('me.grave', G.me.grave?.[G.me.grave.length - 1] ?? null, {
      isStack: true, count: G.me.grave?.length ?? 0, countLabel: 'your graveyard',
    });

    renderHand(G.me.hand ?? [], Boolean(G.myTurn), options.selectedCard ?? null);
    renderHud(G);

    if (!reduced) {
      // FLIP Last+Play: moved cards glide; drawn cards rise from the deck;
      // departed cards that reached a grave exit toward it.
      const present = new Set();
      for (const outer of cardLayer.querySelectorAll('.aaa-flip')) {
        const uid = outer.dataset.flipUid;
        present.add(uid);
        const newRect = measureFlip(outer);
        if (!newRect) continue;
        if (prevRects.has(uid)) {
          animateFlip(outer, prevRects.get(uid), newRect);
        } else if ((G.me.hand ?? []).some((c) => c.uid === uid)) {
          const deckRect = quadViewportRect('me.deck');
          if (deckRect) animateFlip(outer, deckRect, newRect);
        }
      }
      for (const [uid, rect] of prevRects) {
        if (present.has(uid)) continue;
        const outer = flipMap.get(uid);
        if (!outer || outer.isConnected) continue;
        const side = (G.me.grave ?? []).some((c) => c.uid === uid)
          ? 'me'
          : (G.opp.grave ?? []).some((c) => c.uid === uid) ? 'opp' : null;
        if (side) animateExitToGrave(outer, side);
        else flipMap.delete(uid);
      }
      // Prune map entries neither on stage nor exiting.
      for (const [uid, outer] of flipMap) {
        if (!outer.isConnected) flipMap.delete(uid);
      }
    } else {
      for (const [uid, outer] of flipMap) {
        outer.classList.remove('aaa-flip--moving', 'aaa-flip--exiting');
        outer.style.transform = '';
        if (!outer.isConnected) flipMap.delete(uid);
      }
    }
  }

  function dispose() {
    cleanupDrag();
    suppressNextClick = false;
    latestG = null;
    dropLayer = null;
    if (resizeHandler) win.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
    if (win.__tfAaaAudio === audio) win.__tfAaaAudio = null;
    win.__tfAaaBurst = null;
    win.__tfAaaQuality = null;
    win.__tfAaaDrag = null;
    audio?.dispose?.();
    audio = null;
    particles = null;
    try { meadow?.dispose?.(); } catch { /* best effort */ }
    try { renderer?.dispose?.(); } catch { /* best effort */ }
    meadow = null;
    renderer = null;
    mounted = false;
    const host = doc.getElementById('aaa-stage');
    if (host) host.innerHTML = '';
  }

  return {
    mount,
    update,
    dispose,
    get mounted() { return mounted; },
    get quality() { return tier; },
  };
}
