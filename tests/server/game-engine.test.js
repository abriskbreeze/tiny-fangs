import { describe, expect, it } from 'vitest';
import { getStateForPlayer } from '../../server/GameEngine.js';

const SECRET_FIELDS = [
  'id',
  'uid',
  'name',
  'subtitle',
  'art',
  'text',
  'trigger',
  'triggerDef',
  'effects',
  'flavor',
  'customSecret'
];

function createSecretSet(label) {
  return {
    id: `${label}-id`,
    uid: `${label}-uid`,
    name: `${label}-name`,
    subtitle: `${label}-subtitle`,
    art: `${label}-art`,
    text: `${label}-text`,
    trigger: `${label}-trigger`,
    triggerDef: { event: `${label}-event` },
    effects: [{ type: `${label}-effect` }],
    flavor: `${label}-flavor`,
    customSecret: `${label}-custom`,
    cardType: 'verse',
    type: 'set',
    cost: 2
  };
}

function createPlayer(label, setVerse) {
  return {
    lp: label === 'p1' ? 3 : 2,
    mana: label === 'p1' ? 4 : 3,
    maxMana: 5,
    deck: [{ uid: `${label}-deck-1` }, { uid: `${label}-deck-2` }],
    hand: [{ uid: `${label}-hand-1`, name: `${label}-hand-name` }],
    active: { uid: `${label}-active`, id: `${label}-active-id` },
    bench: [{ uid: `${label}-bench`, id: `${label}-bench-id` }],
    grave: [{ uid: `${label}-grave`, id: `${label}-grave-id` }],
    setVerse,
    attackBonuses: [{ source: `${label}-bonus`, value: 10 }],
    chainLightning: label === 'p1' ? 10 : 20,
    unbreakable: label === 'p1',
    usedManaSurge: label === 'p1',
    usedLastBreath: label !== 'p1'
  };
}

function createState() {
  return {
    turn: 4,
    currentPlayer: 2,
    winner: null,
    firstTurn: false,
    hasAttacked: true,
    hasRetreated: false,
    players: [
      createPlayer('p1', createSecretSet('p1-secret')),
      createPlayer('p2', createSecretSet('p2-secret'))
    ]
  };
}

describe('getStateForPlayer hidden Set projection', () => {
  it.each([
    { viewerIdx: 0, opponentIdx: 1 },
    { viewerIdx: 1, opponentIdx: 0 }
  ])(
    'projects player $opponentIdx Set as exact opaque presence for player $viewerIdx',
    ({ viewerIdx, opponentIdx }) => {
      const state = createState();
      const stateBeforeProjection = structuredClone(state);
      const ownSet = state.players[viewerIdx].setVerse;
      const opponentSet = state.players[opponentIdx].setVerse;

      const projected = getStateForPlayer(state, viewerIdx);

      expect(projected.opp.setVerse).toStrictEqual({ faceDown: true });
      expect(projected.me.setVerse).toStrictEqual(ownSet);

      const serializedMarker = JSON.stringify(projected.opp.setVerse);
      for (const field of SECRET_FIELDS) {
        expect(serializedMarker).not.toContain(JSON.stringify(opponentSet[field]));
      }

      expect(projected.me.hand).toStrictEqual(state.players[viewerIdx].hand);
      expect(projected.me.deckCount).toBe(state.players[viewerIdx].deck.length);
      expect(projected.opp.handCount).toBe(state.players[opponentIdx].hand.length);
      expect(projected.opp.deckCount).toBe(state.players[opponentIdx].deck.length);
      expect(projected.opp.active).toStrictEqual(state.players[opponentIdx].active);
      expect(projected.opp.bench).toStrictEqual(state.players[opponentIdx].bench);
      expect(projected.opp.grave).toStrictEqual(state.players[opponentIdx].grave);
      expect(state).toEqual(stateBeforeProjection);
    }
  );

  it.each([
    { viewerIdx: 0, opponentIdx: 1 },
    { viewerIdx: 1, opponentIdx: 0 }
  ])(
    'projects an absent player $opponentIdx Set as null for player $viewerIdx',
    ({ viewerIdx, opponentIdx }) => {
      const state = createState();
      state.players[opponentIdx].setVerse = null;

      expect(getStateForPlayer(state, viewerIdx).opp.setVerse).toBeNull();
    }
  );
});
