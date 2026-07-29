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
import './cards/cards.css';
import './aaa-shell.css';
import { mountBoardCard, CHASSIS_W, CHASSIS_H } from './dom/board-card-mount.js';
import { GOLDEN_QUADS } from './scene/golden-quads.js';
import { buildMeadowScene } from './scene/meadow-scene.js';

const FRAME_W = 1672;
const FRAME_H = 941;
const HAND_BOTTOM = 934;
const HAND_SCALE = 0.42;

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
} = {}) {
  let stage = null;
  let cardLayer = null;
  let shadowLayer = null;
  let hudLayer = null;
  let meadow = null;
  let renderer = null;
  let mounted = false;
  let resizeHandler = null;

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

  function mount() {
    if (mounted) return true;
    const host = doc.getElementById('aaa-stage');
    if (!host) return false;
    try {
      host.innerHTML = '';
      stage = el('div', 'aaa-frame', host);
      const canvas = el('canvas', 'aaa-canvas', stage);
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      shadowLayer = el('div', 'aaa-layer aaa-shadow-layer', stage);
      cardLayer = el('div', 'aaa-layer aaa-card-layer', stage);
      hudLayer = el('div', 'aaa-layer aaa-hud-layer', stage);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
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
    const { wrapper } = mountBoardCard({
      layer: cardLayer, shadowLayer, corners, face, isStack, anchorId, document: doc,
    });
    // Face-up cards with an identity open the card-detail surface — the
    // same classic showCardDetail flow (face-down cards expose nothing).
    // During a targeting selection (Phase 9b) a highlighted card resolves
    // the selector instead: diegetic pick through the SAME option action.
    if (!faceDown && card?.uid) {
      wrapper.classList.add('aaa-board-card--inspectable');
      wrapper.dataset.uid = card.uid;
      wrapper.style.pointerEvents = 'auto';
      wrapper.addEventListener('click', () => {
        if (wrapper.classList.contains('aaa-card--targetable')
          && typeof win._aaaTargetPick === 'function') {
          win._aaaTargetPick(card.uid);
          return;
        }
        actions.showCardDetail?.(card.uid);
      });
    }
    if (count !== null && count > 0) countChip(anchorId, count, countLabel);
  }

  function renderStatuses(anchorId, card) {
    if (!card) return;
    const marks = [];
    if (card.poison) marks.push(['psn', 'poisoned']);
    if (card.trapped) marks.push(['trp', 'trapped']);
    if (card.fortified) marks.push(['frt', 'fortified']);
    if (!marks.length) return;
    const corners = GOLDEN_QUADS[anchorId];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const rail = el('div', 'aaa-status-rail', hudLayer);
    rail.style.left = `${Math.max(...xs) + 4}px`;
    rail.style.top = `${Math.min(...ys) + 6}px`;
    for (const [text, label] of marks) {
      const charm = el('span', 'aaa-status-charm', rail, text);
      charm.setAttribute('aria-label', label);
    }
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
      const wrapper = el('div', 'aaa-hand-card', cardLayer);
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
        wrapper.addEventListener('click', () => {
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
    myLp.textContent = '♥'.repeat(Math.max(0, G.me.lp)) + '♡'.repeat(Math.max(0, 3 - G.me.lp));
    const myMana = el('div', 'aaa-mana', mySide);
    myMana.id = 'aaa-my-mana';
    myMana.setAttribute('aria-label', `mana ${G.me.mana} of ${G.me.maxMana}`);
    myMana.textContent = '●'.repeat(G.me.mana) + '○'.repeat(Math.max(0, G.me.maxMana - G.me.mana));

    // Top-right rail: rival vitals + hand count.
    const right = el('div', 'aaa-rail aaa-rail--top-right', hudLayer);
    const oppSide = el('div', 'aaa-vitals', right);
    oppSide.dataset.side = 'opp';
    el('div', 'aaa-vitals-label', oppSide, 'Rival');
    const oppLp = el('div', 'aaa-hearts', oppSide);
    oppLp.id = 'aaa-opp-lp';
    oppLp.textContent = '♥'.repeat(Math.max(0, G.opp.lp)) + '♡'.repeat(Math.max(0, 3 - G.opp.lp));
    const oppMana = el('div', 'aaa-mana', oppSide);
    oppMana.id = 'aaa-opp-mana';
    oppMana.textContent = '●'.repeat(G.opp.mana) + '○'.repeat(Math.max(0, G.opp.maxMana - G.opp.mana));
    const oppHand = el('div', 'aaa-opp-hand', oppSide);
    oppHand.id = 'aaa-opp-hand';
    oppHand.textContent = `hand ${G.opp.handCount ?? G.opp.hand?.length ?? 0}`;

    // Turn token near the divider's right end, with the match timer under
    // it (the classic updateTimer keeps #aaa-timer current between renders).
    const turnChip = el('div', 'aaa-turn-chip', hudLayer);
    turnChip.id = 'aaa-turn';
    turnChip.textContent = `Turn ${G.turn} — ${myTurn ? 'You' : 'Rival'}`;
    turnChip.dataset.owner = myTurn ? 'me' : 'opp';
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
      button.disabled = !myTurn;
      button.addEventListener('click', () => handler?.());
    }

    // Rules link: quiet corner affordance opening the classic rules overlay.
    const rulesLink = el('button', 'aaa-rules-link', hudLayer, 'Rules');
    rulesLink.id = 'aaa-rules-link';
    rulesLink.type = 'button';
    rulesLink.addEventListener('click', () => actions.showRules?.());

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
    cardLayer.innerHTML = '';
    shadowLayer.innerHTML = '';
    hudLayer.innerHTML = '';

    renderAnchor('opp.deck', null, {
      faceDown: (G.opp.deckCount ?? G.opp.deck?.length ?? 0) > 0,
      isStack: true,
      count: G.opp.deckCount ?? G.opp.deck?.length ?? 0,
      countLabel: 'rival deck',
    });
    renderAnchor('opp.bench.a', G.opp.bench?.[0]);
    renderAnchor('opp.bench.b', G.opp.bench?.[1]);
    renderAnchor('opp.active', G.opp.active);
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
    renderAnchor('me.active', G.me.active);
    renderStatuses('me.active', G.me.active);
    renderAnchor('me.bench.a', G.me.bench?.[0]);
    renderAnchor('me.bench.b', G.me.bench?.[1]);
    renderAnchor('me.set', null, { faceDown: Boolean(G.me.setVerse) });
    renderAnchor('me.grave', G.me.grave?.[G.me.grave.length - 1] ?? null, {
      isStack: true, count: G.me.grave?.length ?? 0, countLabel: 'your graveyard',
    });

    renderHand(G.me.hand ?? [], Boolean(G.myTurn), options.selectedCard ?? null);
    renderHud(G);
  }

  function dispose() {
    if (resizeHandler) win.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
    try { meadow?.dispose?.(); } catch { /* best effort */ }
    try { renderer?.dispose?.(); } catch { /* best effort */ }
    meadow = null;
    renderer = null;
    mounted = false;
    const host = doc.getElementById('aaa-stage');
    if (host) host.innerHTML = '';
  }

  return { mount, update, dispose, get mounted() { return mounted; } };
}
