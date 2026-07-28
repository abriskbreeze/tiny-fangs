import { describe, expect, it } from 'vitest';
import { createVisualFixture } from '../../src/presentation/testing/fixture-registry.js';
import { toStableHashInput } from '../../src/presentation/testing/stable-serialization.js';

describe('stable visual state serialization', () => {
  it('sorts object keys while preserving array order and stable UIDs', () => {
    const value = {
      z: 3,
      cards: [
        { uid: 'card-b', id: 'b' },
        { id: 'a', uid: 'card-a' },
      ],
      a: 1,
    };

    expect(toStableHashInput(value)).toBe(
      '{"a":1,"cards":[{"id":"b","uid":"card-b"},{"id":"a","uid":"card-a"}],"z":3}',
    );
  });

  it('removes functions and nondeterministic timestamps at any depth', () => {
    const value = {
      uid: 'fixture-card-01',
      createdAt: '2026-07-27T12:00:00.000Z',
      nested: {
        timerInt: 17,
        timestamp: 123456789,
        onResolve() {},
        stable: true,
      },
      onClick() {},
      updatedAt: new Date('2026-07-27T12:00:00.000Z'),
    };

    expect(toStableHashInput(value)).toBe(
      '{"nested":{"stable":true},"uid":"fixture-card-01"}',
    );
  });

  it('collapses hidden objects to opaque markers before serializing them', () => {
    const value = {
      opponentHand: {
        hidden: true,
        ids: ['secret-a', 'secret-b'],
      },
      opponentSet: {
        faceDown: true,
        id: 'secret-set',
        name: 'Secret Set Name',
        uid: 'secret-uid',
      },
    };

    expect(toStableHashInput(value)).toBe(
      '{"opponentHand":{"hidden":true},"opponentSet":{"faceDown":true}}',
    );
  });

  it('applies fixture privacy paths without losing visible card identity', () => {
    const fixture = createVisualFixture('multiplayer-hidden');
    const hiddenSet = fixture.G.players[1].setVerse;
    const visibleUid = fixture.G.players[0].hand[0].uid;
    const serialized = toStableHashInput(fixture);

    expect(serialized).toContain(visibleUid);
    expect(serialized).toContain('"faceDown":true');
    expect(serialized).not.toContain(hiddenSet.id);
    expect(serialized).not.toContain(hiddenSet.uid);
    expect(serialized).not.toContain(hiddenSet.name);
  });

  it('fails clearly on circular state instead of producing unstable output', () => {
    const value = {};
    value.self = value;

    expect(() => toStableHashInput(value)).toThrow(
      'Cannot serialize circular visual state',
    );
  });
});
