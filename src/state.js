// ═══════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════

// Game state container
// Using an object so mutations are visible across module imports
export const state = {
  G: null,           // Main game state object
  selectedCard: null,
  startTime: null,
  timerInt: null,
  longPressTimer: null,
};

// DOM helper
export const $ = id => document.getElementById(id);

// Generate unique ID. The monotonic suffix guarantees uniqueness even when
// Math.random is stubbed deterministic (E2E does this); keyed board rendering
// fails closed on duplicate uids instead of silently mis-targeting cards.
let uidSerial = 0;
export const uid = () =>
  `${Math.random().toString(36).slice(2, 9)}-${(++uidSerial).toString(36)}`;

// State accessors for cleaner code
export function getGame() {
  return state.G;
}

export function setGame(game) {
  state.G = game;
}

export function readGameElapsedSeconds(now = Date.now()) {
  if (state.startTime === null) return 0;
  return Math.max(0, Math.floor((now - state.startTime) / 1000));
}

export function stopGameTimer() {
  if (state.timerInt === null) return;
  clearInterval(state.timerInt);
  state.timerInt = null;
}

export function resetGameTimer() {
  stopGameTimer();
  state.startTime = null;
}

export function startGameTimer(onTick) {
  if (typeof onTick !== 'function') {
    throw new TypeError('startGameTimer requires an onTick callback');
  }

  stopGameTimer();
  state.startTime = Date.now();
  onTick();
  state.timerInt = setInterval(onTick, 1000);
}

export function clearGame() {
  state.G = null;
  state.selectedCard = null;
  resetGameTimer();
  if (state.longPressTimer) {
    clearTimeout(state.longPressTimer);
    state.longPressTimer = null;
  }
}
