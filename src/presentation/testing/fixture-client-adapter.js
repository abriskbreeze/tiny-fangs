import { sharedToClientState } from '../../solo-dispatch.js';

function cloneAuthoritativeState(G) {
  return structuredClone(G);
}

function classicWinner(winner) {
  if (winner === 0) return 'You';
  if (winner === 1) return 'Rival';
  return winner;
}

function projectOpponent(opponent) {
  const {
    deck,
    hand,
    setVerse,
    ...publicState
  } = opponent;

  return {
    ...publicState,
    deck: [],
    deckCount: deck.length,
    hand: [],
    handCount: hand.length,
    setVerse: setVerse ? { faceDown: true } : null,
  };
}

export function authoritativeFixtureToClientState(fixture) {
  if (!fixture?.G || !Array.isArray(fixture.G.players) || fixture.G.players.length !== 2) {
    throw new Error(
      `Visual fixture "${fixture?.name ?? 'unknown'}" does not contain authoritative game state`,
    );
  }

  const G = cloneAuthoritativeState(fixture.G);
  const client = sharedToClientState(G, {
    isMultiplayer: false,
    isVisualFixture: true,
    phase: 'main',
    log: [...(G.log ?? [])],
    actionLock: true,
    aiDifficulty: 0,
  });

  return {
    ...client,
    winner: classicWinner(G.winner),
    opp: projectOpponent(client.opp),
  };
}
