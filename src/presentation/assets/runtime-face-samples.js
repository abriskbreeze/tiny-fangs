import { endTurn, mkCreature } from '../../../shared/engine.js';

function createPlayer() {
  return {
    hand: [],
    deck: [],
    grave: [],
    active: null,
    bench: [],
    setVerse: null,
    mana: 1,
    maxMana: 1,
    lp: 3,
    usedManaSurge: false,
    usedLastBreath: false,
    attackBonuses: [],
    poisoned: false,
    chainLightning: 0,
    unbreakable: false
  };
}

/**
 * Produces representative runtime-only faces through the authoritative engine.
 * Expand this function whenever a new engine path creates a non-catalog face.
 */
export function createRepresentativeRuntimeFaces() {
  const state = {
    turn: 1,
    currentPlayer: 1,
    firstTurn: true,
    hasAttacked: false,
    hasRetreated: false,
    players: [createPlayer(), createPlayer()],
    log: [],
    winner: null
  };

  state.players[0].active = mkCreature('broodmother');
  state.players[1].deck = [mkCreature('whisper')];
  endTurn(state, 0);

  return [...state.players[0].bench];
}

