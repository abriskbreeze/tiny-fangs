import { describe, expect, it } from 'vitest';
import { createVisualFixture } from '../../src/presentation/testing/fixture-registry.js';
import {
  authoritativeFixtureToClientState,
} from '../../src/presentation/testing/fixture-client-adapter.js';

const CLIENT_STATE_KEYS = [
  'actionLock',
  'aiDifficulty',
  'firstTurn',
  'hasAttacked',
  'hasRetreated',
  'isMultiplayer',
  'isVisualFixture',
  'log',
  'me',
  'myTurn',
  'opp',
  'phase',
  'turn',
  'winner',
];

describe('authoritative fixture to client-state adapter', () => {
  it('produces the exact classic client shell through the shared-state bridge', () => {
    const fixture = createVisualFixture('dense-board-statuses');
    const client = authoritativeFixtureToClientState(fixture);

    expect(Object.keys(client).sort()).toEqual(CLIENT_STATE_KEYS);
    expect(client).toMatchObject({
      isMultiplayer: false,
      isVisualFixture: true,
      phase: 'main',
      actionLock: true,
      aiDifficulty: 0,
      turn: fixture.G.turn,
      myTurn: fixture.G.currentPlayer === 1,
      firstTurn: fixture.G.firstTurn,
      hasAttacked: fixture.G.hasAttacked,
      hasRetreated: fixture.G.hasRetreated,
      log: fixture.G.log,
    });
    expect(client.me).toEqual(fixture.G.players[0]);
    expect(client.me).not.toBe(fixture.G.players[0]);
  });

  it('projects opponent private zones to counts and opaque Set presence', () => {
    const fixture = createVisualFixture('multiplayer-hidden');
    const opponent = fixture.G.players[1];
    const secretSet = opponent.setVerse;
    const client = authoritativeFixtureToClientState(fixture);
    const serializedOpponent = JSON.stringify(client.opp);

    expect(client.opp.deck).toEqual([]);
    expect(client.opp.deckCount).toBe(opponent.deck.length);
    expect(client.opp.hand).toEqual([]);
    expect(client.opp.handCount).toBe(opponent.hand.length);
    expect(client.opp.setVerse).toEqual({ faceDown: true });
    expect(serializedOpponent).not.toContain(secretSet.id);
    expect(serializedOpponent).not.toContain(secretSet.uid);
    expect(serializedOpponent).not.toContain(secretSet.name);
  });

  it('preserves public opponent board/grave state without sharing references', () => {
    const fixture = createVisualFixture('inspection-overlays');
    const client = authoritativeFixtureToClientState(fixture);

    expect(client.opp.active).toEqual(fixture.G.players[1].active);
    expect(client.opp.grave).toEqual(fixture.G.players[1].grave);
    expect(client.opp).not.toBe(fixture.G.players[1]);

    client.opp.active.curHp = 1;
    client.me.lp = 1;

    expect(fixture.G.players[1].active.curHp).not.toBe(1);
    expect(fixture.G.players[0].lp).toBe(3);
  });

  it.each([
    'normal-attack',
    'retaliation',
    'multi-hit',
    'damage-reduction',
    'healing',
    'optional-trigger-pending',
    'skitter-response-pending',
  ])('adapts the %s fixture through the real client-state bridge', (name) => {
    const fixture = createVisualFixture(name);
    const client = authoritativeFixtureToClientState(fixture);

    expect(client.isVisualFixture).toBe(true);
    expect(client.me).toEqual(fixture.G.players[0]);
    expect(client.opp.active).toEqual(fixture.G.players[1].active);
    expect(client.opp.hand).toEqual([]);
    expect(client.opp.deck).toEqual([]);
  });

  it.each([
    ['opening-empty-board', null],
    ['victory', 'You'],
    ['defeat', 'Rival'],
    ['deck-out', 'Rival'],
  ])('maps %s winner semantics to the classic client vocabulary', (name, winner) => {
    const fixture = createVisualFixture(name);

    expect(authoritativeFixtureToClientState(fixture).winner).toBe(winner);
  });

  it('rejects malformed fixtures before producing client state', () => {
    expect(() => authoritativeFixtureToClientState({ name: 'broken' })).toThrow(
      'Visual fixture "broken" does not contain authoritative game state',
    );
  });
});
