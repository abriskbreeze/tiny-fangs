import { describe, expect, it } from 'vitest';
import { CREATURES, VERSES } from '../../shared/cards.js';
import {
  createVisualFixture,
  listVisualFixtureNames,
} from '../../src/presentation/testing/fixture-registry.js';
import { toStableHashInput } from '../../src/presentation/testing/stable-serialization.js';

const EXPECTED_FIXTURES = [
  'damage-reduction',
  'deck-out',
  'defeat',
  'dense-board-statuses',
  'healing',
  'inspection-overlays',
  'ko-promotion',
  'multi-hit',
  'multiplayer-hidden',
  'normal-attack',
  'opening-empty-board',
  'opening-hand-triad',
  'optional-trigger-pending',
  'retaliation',
  'skitter-response-pending',
  'target-selection',
  'victory',
];

function cardsForPlayer(player) {
  return [
    ...player.deck,
    ...player.hand,
    ...(player.active ? [player.active] : []),
    ...player.bench,
    ...player.grave,
    ...(player.setVerse ? [player.setVerse] : []),
  ];
}

function expectAuthoritativeState(fixture) {
  expect(fixture.G.players).toHaveLength(2);

  fixture.G.players.forEach((player) => {
    const cards = cardsForPlayer(player);
    expect(cards).toHaveLength(20);
    expect(new Set(cards.map((card) => card.uid)).size).toBe(cards.length);

    cards.forEach((card) => {
      if (card.cardType === 'creature') {
        expect(CREATURES[card.id]).toBeDefined();
      } else {
        expect(card.cardType).toBe('verse');
        expect(VERSES[card.id]).toBeDefined();
      }
    });
  });
}

describe('visual fixture registry', () => {
  it('publishes a sorted, complete deterministic fixture catalog', () => {
    expect(listVisualFixtureNames()).toEqual(EXPECTED_FIXTURES);
    expect(EXPECTED_FIXTURES).toEqual([...EXPECTED_FIXTURES].sort());

    for (const name of EXPECTED_FIXTURES) {
      const first = createVisualFixture(name);
      const second = createVisualFixture(name);

      expect(first.name).toBe(name);
      expect(first).not.toBe(second);
      expect(toStableHashInput(first)).toBe(toStableHashInput(second));
      expectAuthoritativeState(first);
    }
  });

  it('keeps every registered fixture narrowly and deterministically distinct', () => {
    const serialized = EXPECTED_FIXTURES.map((name) => (
      toStableHashInput(createVisualFixture(name))
    ));

    expect(new Set(serialized).size).toBe(EXPECTED_FIXTURES.length);
  });

  it('rejects unknown fixture names', () => {
    expect(() => createVisualFixture('not-a-fixture')).toThrow(
      'Unknown visual fixture: not-a-fixture',
    );
  });

  it('represents an empty opening board without inventing invalid cards', () => {
    const { G } = createVisualFixture('opening-empty-board');

    for (const player of G.players) {
      expect(player.hand).toHaveLength(5);
      expect(player.deck).toHaveLength(15);
      expect(player.active).toBeNull();
      expect(player.bench).toEqual([]);
      expect(player.setVerse).toBeNull();
    }
  });

  it('contains creature, cast, and set cards in the representative hand', () => {
    const { G } = createVisualFixture('opening-hand-triad');
    const kinds = G.players[0].hand.map((card) => (
      card.cardType === 'creature' ? 'creature' : card.type
    ));

    expect(kinds).toEqual(expect.arrayContaining(['creature', 'cast', 'set']));
  });

  it('covers dense zones and all four persistent status treatments', () => {
    const { G } = createVisualFixture('dense-board-statuses');
    const [near, far] = G.players;
    const creatures = [
      near.active,
      ...near.bench,
      far.active,
      ...far.bench,
    ];

    expect(near.active).not.toBeNull();
    expect(near.bench).toHaveLength(2);
    expect(near.setVerse?.type).toBe('set');
    expect(far.active).not.toBeNull();
    expect(far.bench).toHaveLength(2);
    expect(far.setVerse?.type).toBe('set');
    expect(creatures.some((card) => card.status === 'poison')).toBe(true);
    expect(creatures.some((card) => card.status === 'trapped')).toBe(true);
    expect(creatures.some((card) => card.fortified === true)).toBe(true);
    expect(near.unbreakable || far.unbreakable).toBe(true);
  });

  it('carries target-selection intent while keeping the engine state valid', () => {
    const fixture = createVisualFixture('target-selection');

    expect(fixture.presentation.overlay.kind).toBe('target-selection');
    expect(fixture.presentation.overlay.targets).toHaveLength(2);
    expect(fixture.presentation.overlay.targets.every(({ uid }) => (
      fixture.G.players.some((player) => (
        player.active?.uid === uid || player.bench.some((card) => card.uid === uid)
      ))
    ))).toBe(true);
  });

  it('captures a resolved KO and promotion using real creature instances', () => {
    const fixture = createVisualFixture('ko-promotion');
    const player = fixture.G.players[0];
    const transition = fixture.presentation.transition;

    expect(transition.kind).toBe('ko-promotion');
    expect(player.grave.some((card) => (
      card.uid === transition.koUid && card.curHp === 0
    ))).toBe(true);
    expect(player.active?.uid).toBe(transition.promotedUid);
  });

  it('captures an ordinary attack from canonical cards and real engine events', () => {
    const fixture = createVisualFixture('normal-attack');
    const [attackerOwner, defenderOwner] = fixture.G.players;
    const transition = fixture.presentation.transition;

    expect(attackerOwner.active?.id).toBe('emberfang');
    expect(defenderOwner.active?.id).toBe('duskfang');
    expect(transition).toMatchObject({
      kind: 'normal-attack',
      attackerUid: attackerOwner.active.uid,
      defenderUid: defenderOwner.active.uid,
      events: [
        { type: 'attack', side: 'p1', damage: 25 },
        { type: 'damage', side: 'p2', amount: 25 },
      ],
    });
    expect(defenderOwner.active.curHp).toBe(
      defenderOwner.active.hp - 25,
    );
  });

  it('captures retaliation after committed attack damage in authoritative order', () => {
    const fixture = createVisualFixture('retaliation');
    const [attackerOwner, defenderOwner] = fixture.G.players;
    const transition = fixture.presentation.transition;

    expect(attackerOwner.active?.id).toBe('emberfang');
    expect(defenderOwner.active?.id).toBe('thornling');
    expect(transition.events).toEqual([
      { type: 'attack', side: 'p1', damage: 25 },
      { type: 'damage', side: 'p2', amount: 25 },
      {
        type: 'abilityTrigger',
        side: 'p2',
        creature: 'Thornling',
        ability: 'Thorns',
      },
      { type: 'damage', side: 'p1', amount: 10, source: 'Thorns' },
    ]);
    expect(attackerOwner.active.curHp).toBe(attackerOwner.active.hp - 10);
  });

  it('captures both Frenzy hits and canonical burnout as a multi-hit transition', () => {
    const fixture = createVisualFixture('multi-hit');
    const [attackerOwner, defenderOwner] = fixture.G.players;
    const transition = fixture.presentation.transition;

    expect(attackerOwner.active?.id).toBe('cindermaw');
    expect(defenderOwner.active?.id).toBe('bulwark');
    expect(transition.kind).toBe('multi-hit');
    expect(transition.events.filter(({ type }) => type === 'attack')).toHaveLength(2);
    expect(transition.events.filter(({ type, side }) => (
      type === 'damage' && side === 'p2'
    ))).toHaveLength(2);
    expect(transition.events).toContainEqual({
      type: 'damage',
      side: 'p1',
      amount: 10,
      source: 'Frenzy (Burnout)',
    });
    expect(defenderOwner.active.curHp).toBe(10);
  });

  it('captures declarative damage reduction and the reduced committed damage', () => {
    const fixture = createVisualFixture('damage-reduction');
    const defender = fixture.G.players[1].active;
    const events = fixture.presentation.transition.events;

    expect(defender?.id).toBe('ironhide');
    expect(events).toContainEqual({
      type: 'damageReduced',
      side: 'p2',
      amount: 10,
      source: 'Iron Skin',
    });
    expect(events).toContainEqual({
      type: 'damage',
      side: 'p2',
      amount: 15,
    });
    expect(defender.curHp).toBe(defender.hp - 15);
  });

  it('captures a real Drain heal after Leechling deals damage', () => {
    const fixture = createVisualFixture('healing');
    const healer = fixture.G.players[0].active;
    const events = fixture.presentation.transition.events;

    expect(healer?.id).toBe('leechling');
    expect(events).toContainEqual({
      type: 'heal',
      side: 'p1',
      amount: 15,
    });
    expect(healer.curHp).toBe(20);
    expect(healer.curHp).toBe(healer.hp);
  });

  it('captures an owner-confirmable optional Set response without resolving it', () => {
    const fixture = createVisualFixture('optional-trigger-pending');
    const [owner] = fixture.G.players;
    const response = fixture.presentation.response;

    expect(owner.setVerse?.id).toBe('brace');
    expect(response).toMatchObject({
      kind: 'optional-trigger',
      ownerSide: 'p1',
      sourceUid: owner.setVerse.uid,
      pendingAction: {
        type: 'optionalTrigger',
        side: 'p1',
        verseId: 'brace',
        verseName: 'Brace',
        prompt: 'Activate Brace?',
      },
    });
    expect(response.pendingAction.context.attacker.uid).toBe(
      fixture.G.players[1].active.uid,
    );
    expect(response.pendingAction.context.defender.uid).toBe(owner.active.uid);
    expect(response.pendingAction.context.damage).toBe(25);
    expect(fixture.G.hasAttacked).toBe(false);
  });

  it('captures owner-only Skitter response options from the real pending action', () => {
    const fixture = createVisualFixture('skitter-response-pending');
    const [owner] = fixture.G.players;
    const response = fixture.presentation.response;

    expect(owner.active?.id).toBe('skitter');
    expect(response).toMatchObject({
      kind: 'skitter-response',
      ownerSide: 'p1',
      sourceUid: owner.active.uid,
      pendingAction: {
        type: 'skitterSwap',
        side: 'p1',
        creature: 'Skitter',
      },
    });
    expect(response.pendingAction.benchOptions).toEqual(
      owner.bench.map((card, idx) => ({
        uid: card.uid,
        name: card.name,
        idx,
      })),
    );
    expect(owner.active.curHp).toBe(owner.active.hp - 25);
    expect(fixture.G.hasAttacked).toBe(false);
  });

  it.each([
    'optional-trigger-pending',
    'skitter-response-pending',
  ])('serializes %s with opaque response and opponent-private zones', (name) => {
    const fixture = createVisualFixture(name);
    const serialized = toStableHashInput(fixture);
    const opponentPrivateUids = [
      ...fixture.G.players[1].deck,
      ...fixture.G.players[1].hand,
      ...(fixture.G.players[1].setVerse
        ? [fixture.G.players[1].setVerse]
        : []),
    ].map((card) => card.uid);

    expect(serialized).toContain('"ownerOnly":true');
    expect(serialized).not.toContain('"pendingAction"');
    opponentPrivateUids.forEach((uid) => {
      expect(serialized).not.toContain(uid);
    });
  });

  it('describes grave, rules, card-detail, and reveal overlays as presentation intent', () => {
    const fixture = createVisualFixture('inspection-overlays');

    expect(fixture.presentation.overlays).toMatchObject({
      grave: { open: true },
      rules: { open: true },
      detail: { open: true },
      reveal: { open: true },
    });
    expect(fixture.presentation.overlays.detail.uid).toBe(
      fixture.G.players[0].active.uid,
    );
  });

  it.each([
    ['victory', 0, 'victory'],
    ['defeat', 1, 'defeat'],
    ['deck-out', 1, 'deck-out'],
  ])('captures the %s result state', (name, winner, reason) => {
    const fixture = createVisualFixture(name);

    expect(fixture.G.winner).toBe(winner);
    expect(fixture.presentation.result.reason).toBe(reason);
  });

  it('keeps deck-out visually distinct from losing the final life point', () => {
    const fixture = createVisualFixture('deck-out');

    expect(fixture.G.players[0].deck).toEqual([]);
    expect(fixture.G.players[0].lp).toBeGreaterThan(0);
  });

  it('keeps the real multiplayer Set in valid G and exposes only an opaque marker', () => {
    const fixture = createVisualFixture('multiplayer-hidden');

    expect(fixture.G.players[1].setVerse?.type).toBe('set');
    expect(fixture.presentation.multiplayer.opponentSet).toEqual({ faceDown: true });
    expect(fixture.privacy.hiddenPaths).toContain('G.players.1.setVerse');
  });
});
