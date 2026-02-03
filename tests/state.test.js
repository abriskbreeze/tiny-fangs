import { describe, it, expect, beforeEach } from 'vitest';
import { state, $, uid, getGame, setGame, clearGame } from '../src/state.js';

describe('state', () => {
  beforeEach(() => {
    // Reset state before each test
    state.G = null;
    state.selectedCard = null;
    state.startTime = null;
    state.timerInt = null;
    state.longPressTimer = null;
  });

  it('starts with null values', () => {
    expect(state.G).toBeNull();
    expect(state.selectedCard).toBeNull();
    expect(state.startTime).toBeNull();
    expect(state.timerInt).toBeNull();
    expect(state.longPressTimer).toBeNull();
  });

  it('allows direct mutation of state properties', () => {
    state.G = { test: true };
    expect(state.G.test).toBe(true);
    
    state.selectedCard = { id: 'whisper' };
    expect(state.selectedCard.id).toBe('whisper');
  });
});

describe('uid', () => {
  it('generates string IDs', () => {
    const id = uid();
    expect(typeof id).toBe('string');
  });

  it('generates 7-character IDs', () => {
    const id = uid();
    expect(id.length).toBe(7);
  });

  it('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(uid());
    }
    expect(ids.size).toBe(100);
  });
});

describe('getGame / setGame', () => {
  it('setGame updates state.G', () => {
    const game = { turn: 1, me: {}, opp: {} };
    setGame(game);
    expect(state.G).toBe(game);
  });

  it('getGame retrieves state.G', () => {
    const game = { turn: 2 };
    state.G = game;
    expect(getGame()).toBe(game);
  });
});

describe('clearGame', () => {
  it('resets all state to null', () => {
    state.G = { test: true };
    state.selectedCard = { id: 'test' };
    state.startTime = Date.now();
    
    clearGame();
    
    expect(state.G).toBeNull();
    expect(state.selectedCard).toBeNull();
    expect(state.startTime).toBeNull();
  });
});

// Note: $ is a DOM helper and would need jsdom to test properly
// Skipping DOM tests for now - they'd be integration tests
