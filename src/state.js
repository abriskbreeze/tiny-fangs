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

// Generate unique ID
export const uid = () => Math.random().toString(36).slice(2, 9);

// State accessors for cleaner code
export function getGame() {
  return state.G;
}

export function setGame(game) {
  state.G = game;
}

export function clearGame() {
  state.G = null;
  state.selectedCard = null;
  state.startTime = null;
  if (state.timerInt) {
    clearInterval(state.timerInt);
    state.timerInt = null;
  }
  if (state.longPressTimer) {
    clearTimeout(state.longPressTimer);
    state.longPressTimer = null;
  }
}
