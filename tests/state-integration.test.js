import { describe, it, expect, beforeEach } from 'vitest';
import { state, setGame, clearGame, getGame } from '../src/state.js';

/**
 * State Integration Tests
 * Verifies state management after refactor from local variables to state.js
 */

describe('State Module - Core Behavior', () => {
  
  beforeEach(() => {
    // Reset state before each test
    clearGame();
  });

  it('state.G is null initially', () => {
    expect(state.G).toBeNull();
  });

  it('state.selectedCard is null initially', () => {
    expect(state.selectedCard).toBeNull();
  });

  it('state.startTime is null initially', () => {
    expect(state.startTime).toBeNull();
  });

  it('state.timerInt is null initially', () => {
    expect(state.timerInt).toBeNull();
  });

  it('state.longPressTimer is null initially', () => {
    expect(state.longPressTimer).toBeNull();
  });
});

describe('State Module - setGame/getGame', () => {
  
  beforeEach(() => {
    clearGame();
  });

  it('setGame populates state.G', () => {
    const mockGame = { turn: 1, me: {}, opp: {} };
    setGame(mockGame);
    expect(state.G).toBe(mockGame);
    expect(getGame()).toBe(mockGame);
  });

  it('getGame returns current state.G', () => {
    expect(getGame()).toBeNull();
    state.G = { test: true };
    expect(getGame()).toEqual({ test: true });
  });
});

describe('State Module - clearGame', () => {
  
  it('clearGame resets all state to null', () => {
    // Setup dirty state
    state.G = { turn: 5 };
    state.selectedCard = 'abc123';
    state.startTime = Date.now();
    
    clearGame();
    
    expect(state.G).toBeNull();
    expect(state.selectedCard).toBeNull();
    expect(state.startTime).toBeNull();
  });

  it('clearGame clears timerInt interval', () => {
    // Mock interval
    state.timerInt = setInterval(() => {}, 1000);
    expect(state.timerInt).not.toBeNull();
    
    clearGame();
    
    expect(state.timerInt).toBeNull();
  });

  it('clearGame clears longPressTimer timeout', () => {
    // Mock timeout
    state.longPressTimer = setTimeout(() => {}, 1000);
    expect(state.longPressTimer).not.toBeNull();
    
    clearGame();
    
    expect(state.longPressTimer).toBeNull();
  });
});

describe('State Module - Mutation Visibility', () => {
  
  beforeEach(() => {
    clearGame();
  });

  it('mutations to state.G are visible across references', () => {
    const game = { turn: 1, log: [] };
    setGame(game);
    
    // Simulate game progression
    state.G.turn = 2;
    state.G.log.push('test');
    
    // Verify mutations persist
    expect(getGame().turn).toBe(2);
    expect(getGame().log).toContain('test');
  });

  it('nested object mutations persist', () => {
    setGame({
      me: { lp: 3, active: null },
      opp: { lp: 3, active: null }
    });
    
    state.G.me.lp = 2;
    state.G.me.active = { name: 'Whisper', curHp: 30 };
    
    expect(state.G.me.lp).toBe(2);
    expect(state.G.me.active.name).toBe('Whisper');
  });
});

describe('State Module - Game Lifecycle', () => {
  
  beforeEach(() => {
    clearGame();
  });

  it('simulates full game lifecycle', () => {
    // 1. Initial state
    expect(state.G).toBeNull();
    
    // 2. Game starts
    setGame({
      me: { lp: 3, hand: [], deck: [], grave: [], bench: [], active: null },
      opp: { lp: 3, hand: [], deck: [], grave: [], bench: [], active: null },
      turn: 1,
      myTurn: true,
      winner: null,
      log: []
    });
    state.startTime = Date.now();
    
    expect(state.G).not.toBeNull();
    expect(state.G.turn).toBe(1);
    expect(state.startTime).not.toBeNull();
    
    // 3. Game progresses
    state.G.turn = 5;
    state.G.me.lp = 1;
    state.G.log.push('Player took damage');
    
    expect(state.G.turn).toBe(5);
    expect(state.G.me.lp).toBe(1);
    
    // 4. Game ends
    state.G.winner = 'Rival';
    expect(state.G.winner).toBe('Rival');
    
    // 5. Cleanup
    clearGame();
    expect(state.G).toBeNull();
    expect(state.startTime).toBeNull();
  });
});
