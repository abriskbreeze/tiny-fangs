import { attack, createGame } from '../../../shared/engine.js';
import {
  VISUAL_FIXTURE_NAMES,
  listVisualFixtureNames,
} from './visual-fixture-names.js';

function compareCards(left, right) {
  const leftKey = `${left.cardType}:${left.type ?? ''}:${left.id}`;
  const rightKey = `${right.cardType}:${right.type ?? ''}:${right.id}`;
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return 0;
}

function normalizePlayer(player, side) {
  const cards = [...player.hand, ...player.deck].sort(compareCards);
  const copies = new Map();

  for (const card of cards) {
    const copy = (copies.get(card.id) ?? 0) + 1;
    copies.set(card.id, copy);
    card.uid = `visual-${side}-${card.id}-${String(copy).padStart(2, '0')}`;
  }

  player.deck = cards;
  player.hand = [];
  player.active = null;
  player.bench = [];
  player.grave = [];
  player.setVerse = null;
  player.usedManaSurge = false;
  player.usedLastBreath = false;
  player.attackBonuses = [];
  player.poisoned = false;
  player.chainLightning = 0;
  player.unbreakable = false;
}

function createFixtureGame(leftDeck, rightDeck) {
  const G = createGame(leftDeck, rightDeck);
  G.players.forEach((player, side) => normalizePlayer(player, side));
  return G;
}

function createCombatGame(leftDeck, rightDeck, currentPlayer = 1) {
  const G = createFixtureGame(leftDeck, rightDeck);
  G.turn = 2;
  G.currentPlayer = currentPlayer;
  G.firstTurn = false;
  G.hasAttacked = false;
  G.hasRetreated = false;
  return G;
}

function takeCard(player, predicate, description) {
  const index = player.deck.findIndex(predicate);
  if (index === -1) {
    throw new Error(`Visual fixture could not find ${description}`);
  }
  return player.deck.splice(index, 1)[0];
}

function takeCardById(player, id) {
  return takeCard(player, (card) => card.id === id, `card "${id}"`);
}

function dealToHand(player, count = 5) {
  while (player.hand.length < count) {
    const card = player.deck.shift();
    if (!card) {
      throw new Error(`Visual fixture could not deal ${count} cards`);
    }
    player.hand.push(card);
  }
}

function resolveAttackTransition(G, playerIdx, kind) {
  const attacker = G.players[playerIdx].active;
  const defender = G.players[1 - playerIdx].active;
  const result = attack(G, playerIdx);

  if (result.error) {
    throw new Error(`Visual fixture "${kind}" attack failed: ${result.error}`);
  }
  if (!attacker || !defender) {
    throw new Error(`Visual fixture "${kind}" requires two active creatures`);
  }

  return {
    kind,
    attackerUid: attacker.uid,
    defenderUid: defender.uid,
    events: result.events,
  };
}

function ownerOnlyResponsePrivacy({ hideOwnerSet = false } = {}) {
  const hiddenPaths = [
    'G.players.1.deck',
    'G.players.1.hand',
    'G.players.1.setVerse',
    'presentation.response',
  ];
  const hiddenMarkers = {
    'G.players.1.deck': { hidden: true },
    'G.players.1.hand': { hidden: true },
    'G.players.1.setVerse': { faceDown: true },
    'presentation.response': { ownerOnly: true },
  };

  if (hideOwnerSet) {
    hiddenPaths.push('G.players.0.setVerse');
    hiddenMarkers['G.players.0.setVerse'] = { faceDown: true };
  }

  return {
    hiddenPaths,
    hiddenMarkers,
  };
}

function createOpeningEmptyBoard() {
  const G = createFixtureGame('fang', 'shell');
  G.players.forEach((player) => dealToHand(player));

  return {
    name: 'opening-empty-board',
    G,
    presentation: {
      camera: 'opening',
      overlay: null,
    },
  };
}

function createOpeningHandTriad() {
  const G = createFixtureGame('fang', 'venom');
  const [player, opponent] = G.players;

  player.hand.push(
    takeCard(player, (card) => card.cardType === 'creature', 'a creature'),
    takeCard(player, (card) => card.cardType === 'verse' && card.type === 'cast', 'a cast Verse'),
    takeCard(player, (card) => card.cardType === 'verse' && card.type === 'set', 'a Set Verse'),
  );
  dealToHand(player);
  dealToHand(opponent);

  return {
    name: 'opening-hand-triad',
    G,
    presentation: {
      camera: 'hand-focus',
      overlay: null,
    },
  };
}

function createDenseBoardStatuses() {
  const G = createFixtureGame('shell', 'venom');
  const [near, far] = G.players;

  near.active = takeCardById(near, 'shellkin');
  near.active.status = 'poison';
  near.bench = [
    takeCardById(near, 'pebbleback'),
    takeCardById(near, 'ironhide'),
  ];
  near.bench[0].fortified = true;
  near.setVerse = takeCardById(near, 'brace');
  near.unbreakable = true;

  far.active = takeCardById(far, 'hexweaver');
  far.active.status = 'trapped';
  far.bench = [
    takeCardById(far, 'thornling'),
    takeCardById(far, 'leechling'),
  ];
  far.setVerse = takeCardById(far, 'soulTrap');

  dealToHand(near);
  dealToHand(far);

  return {
    name: 'dense-board-statuses',
    G,
    presentation: {
      camera: 'board',
      overlay: null,
      statusLegend: ['poison', 'trapped', 'fortified', 'unbreakable'],
    },
  };
}

function createNormalAttack() {
  const G = createCombatGame('fang', 'shadow');
  const [attackerOwner, defenderOwner] = G.players;

  attackerOwner.active = takeCardById(attackerOwner, 'emberfang');
  defenderOwner.active = takeCardById(defenderOwner, 'duskfang');
  dealToHand(attackerOwner);
  dealToHand(defenderOwner);

  return {
    name: 'normal-attack',
    G,
    presentation: {
      camera: 'board',
      transition: resolveAttackTransition(G, 0, 'normal-attack'),
    },
  };
}

function createRetaliation() {
  const G = createCombatGame('fang', 'venom');
  const [attackerOwner, defenderOwner] = G.players;

  attackerOwner.active = takeCardById(attackerOwner, 'emberfang');
  defenderOwner.active = takeCardById(defenderOwner, 'thornling');
  dealToHand(attackerOwner);
  dealToHand(defenderOwner);

  return {
    name: 'retaliation',
    G,
    presentation: {
      camera: 'board',
      transition: resolveAttackTransition(G, 0, 'retaliation'),
    },
  };
}

function createMultiHit() {
  const G = createCombatGame('fang', 'shell');
  const [attackerOwner, defenderOwner] = G.players;

  attackerOwner.active = takeCardById(attackerOwner, 'cindermaw');
  defenderOwner.active = takeCardById(defenderOwner, 'bulwark');
  dealToHand(attackerOwner);
  dealToHand(defenderOwner);

  return {
    name: 'multi-hit',
    G,
    presentation: {
      camera: 'board',
      transition: resolveAttackTransition(G, 0, 'multi-hit'),
    },
  };
}

function createDamageReduction() {
  const G = createCombatGame('fang', 'shell');
  const [attackerOwner, defenderOwner] = G.players;

  attackerOwner.active = takeCardById(attackerOwner, 'emberfang');
  defenderOwner.active = takeCardById(defenderOwner, 'ironhide');
  dealToHand(attackerOwner);
  dealToHand(defenderOwner);

  return {
    name: 'damage-reduction',
    G,
    presentation: {
      camera: 'board',
      transition: resolveAttackTransition(G, 0, 'damage-reduction'),
    },
  };
}

function createHealing() {
  const G = createCombatGame('venom', 'shadow');
  const [attackerOwner, defenderOwner] = G.players;

  attackerOwner.active = takeCardById(attackerOwner, 'leechling');
  attackerOwner.active.curHp = 5;
  defenderOwner.active = takeCardById(defenderOwner, 'duskfang');
  dealToHand(attackerOwner);
  dealToHand(defenderOwner);

  return {
    name: 'healing',
    G,
    presentation: {
      camera: 'board',
      transition: resolveAttackTransition(G, 0, 'healing'),
    },
  };
}

function createOptionalTriggerPending() {
  const G = createCombatGame('shell', 'fang', 2);
  const [owner, attackerOwner] = G.players;

  owner.active = takeCardById(owner, 'ironhide');
  owner.setVerse = takeCardById(owner, 'brace');
  attackerOwner.active = takeCardById(attackerOwner, 'emberfang');
  attackerOwner.setVerse = takeCardById(attackerOwner, 'lastBreath');
  dealToHand(owner);
  dealToHand(attackerOwner);

  const result = attack(G, 1);
  if (result.error || result.pendingAction?.type !== 'optionalTrigger') {
    throw new Error('Visual fixture "optional-trigger-pending" did not produce an optional response');
  }

  return {
    name: 'optional-trigger-pending',
    G,
    presentation: {
      camera: 'board',
      response: {
        kind: 'optional-trigger',
        ownerSide: 'p1',
        sourceUid: owner.setVerse.uid,
        pendingAction: result.pendingAction,
        events: result.events,
      },
    },
    privacy: ownerOnlyResponsePrivacy({ hideOwnerSet: true }),
  };
}

function createSkitterResponsePending() {
  const G = createCombatGame('swarm', 'fang', 2);
  const [owner, attackerOwner] = G.players;

  owner.active = takeCardById(owner, 'skitter');
  owner.bench = [
    takeCardById(owner, 'fangpup'),
    takeCardById(owner, 'hollowfox'),
  ];
  attackerOwner.active = takeCardById(attackerOwner, 'emberfang');
  attackerOwner.setVerse = takeCardById(attackerOwner, 'lastBreath');
  dealToHand(owner);
  dealToHand(attackerOwner);

  const attacker = attackerOwner.active;
  const defender = owner.active;
  const result = attack(G, 1);

  if (result.error || result.pendingAction?.type !== 'skitterSwap') {
    throw new Error('Visual fixture "skitter-response-pending" did not produce a Skitter response');
  }

  return {
    name: 'skitter-response-pending',
    G,
    presentation: {
      camera: 'board',
      response: {
        kind: 'skitter-response',
        ownerSide: 'p1',
        sourceUid: defender.uid,
        attackerUid: attacker.uid,
        pendingAction: result.pendingAction,
        events: result.events,
      },
    },
    privacy: ownerOnlyResponsePrivacy(),
  };
}

function createTargetSelection() {
  const G = createFixtureGame('fang', 'venom');
  const [near, far] = G.players;

  near.active = takeCardById(near, 'emberfang');
  far.active = takeCardById(far, 'hexweaver');
  far.bench = [takeCardById(far, 'thornling')];
  dealToHand(near);
  dealToHand(far);

  return {
    name: 'target-selection',
    G,
    presentation: {
      camera: 'board',
      overlay: {
        kind: 'target-selection',
        prompt: 'Choose an opposing creature',
        sourceUid: near.active.uid,
        targets: [
          { side: 1, zone: 'active', uid: far.active.uid },
          { side: 1, zone: 'bench', uid: far.bench[0].uid },
        ],
      },
    },
  };
}

function createKoPromotion() {
  const G = createFixtureGame('swarm', 'fang');
  const [player, opponent] = G.players;
  const knockedOut = takeCardById(player, 'fangpup');
  const promoted = takeCardById(player, 'skitter');

  knockedOut.curHp = 0;
  player.grave.push(knockedOut);
  player.active = promoted;
  player.bench = [takeCardById(player, 'hiveling')];
  opponent.active = takeCardById(opponent, 'emberfang');
  dealToHand(player);
  dealToHand(opponent);

  return {
    name: 'ko-promotion',
    G,
    presentation: {
      camera: 'board',
      transition: {
        kind: 'ko-promotion',
        koUid: knockedOut.uid,
        promotedUid: promoted.uid,
      },
    },
  };
}

function createInspectionOverlays() {
  const G = createFixtureGame('shadow', 'fang');
  const [player, opponent] = G.players;
  const graveCard = takeCardById(player, 'duskfang');

  graveCard.curHp = 0;
  player.grave.push(graveCard);
  player.active = takeCardById(player, 'mireveil');
  opponent.active = takeCardById(opponent, 'emberfang');
  opponent.setVerse = takeCardById(opponent, 'lastBreath');
  dealToHand(player);
  dealToHand(opponent);

  return {
    name: 'inspection-overlays',
    G,
    presentation: {
      camera: 'board',
      overlays: {
        grave: {
          open: true,
          side: 0,
        },
        rules: {
          open: true,
          section: 'turn-flow',
        },
        detail: {
          open: true,
          uid: player.active.uid,
        },
        reveal: {
          open: true,
          kind: 'trigger-reveal',
          cardId: opponent.setVerse.id,
        },
      },
    },
  };
}

function createResultFixture(name, winner, reason) {
  const G = createFixtureGame('fang', 'shell');
  const [player, opponent] = G.players;

  player.active = takeCardById(player, 'emberfang');
  opponent.active = takeCardById(opponent, 'shellkin');
  dealToHand(player);
  dealToHand(opponent);
  G.winner = winner;
  G.players[winner === 0 ? 1 : 0].lp = 0;

  return {
    name,
    G,
    presentation: {
      camera: 'result',
      result: {
        outcome: winner === 0 ? 'victory' : 'defeat',
        reason,
        viewer: 0,
      },
    },
  };
}

function createVictory() {
  return createResultFixture('victory', 0, 'victory');
}

function createDefeat() {
  return createResultFixture('defeat', 1, 'defeat');
}

function createDeckOut() {
  const fixture = createResultFixture('deck-out', 1, 'deck-out');
  const player = fixture.G.players[0];

  player.lp = 1;
  player.grave.push(...player.deck);
  player.deck = [];
  return fixture;
}

function createMultiplayerHidden() {
  const G = createFixtureGame('shell', 'fang');
  const [viewer, opponent] = G.players;

  dealToHand(viewer);
  opponent.setVerse = takeCardById(opponent, 'phantomWall');
  dealToHand(opponent);

  return {
    name: 'multiplayer-hidden',
    G,
    presentation: {
      camera: 'board',
      multiplayer: {
        viewer: 0,
        opponentHand: { hidden: true },
        opponentSet: { faceDown: true },
      },
    },
    privacy: {
      hiddenPaths: [
        'G.players.1.deck',
        'G.players.1.hand',
        'G.players.1.setVerse',
      ],
      hiddenMarkers: {
        'G.players.1.deck': { hidden: true },
        'G.players.1.hand': { hidden: true },
        'G.players.1.setVerse': { faceDown: true },
      },
    },
  };
}

const FIXTURE_BUILDERS = Object.freeze({
  'damage-reduction': createDamageReduction,
  'deck-out': createDeckOut,
  defeat: createDefeat,
  'dense-board-statuses': createDenseBoardStatuses,
  healing: createHealing,
  'inspection-overlays': createInspectionOverlays,
  'ko-promotion': createKoPromotion,
  'multi-hit': createMultiHit,
  'multiplayer-hidden': createMultiplayerHidden,
  'normal-attack': createNormalAttack,
  'opening-empty-board': createOpeningEmptyBoard,
  'opening-hand-triad': createOpeningHandTriad,
  'optional-trigger-pending': createOptionalTriggerPending,
  retaliation: createRetaliation,
  'skitter-response-pending': createSkitterResponsePending,
  'target-selection': createTargetSelection,
  victory: createVictory,
});

const registeredNames = Object.keys(FIXTURE_BUILDERS).sort();
if (registeredNames.join('\n') !== VISUAL_FIXTURE_NAMES.join('\n')) {
  throw new Error('Visual fixture names and builders are out of sync');
}

export { listVisualFixtureNames };

export function createVisualFixture(name) {
  const buildFixture = FIXTURE_BUILDERS[name];
  if (!buildFixture) {
    throw new Error(`Unknown visual fixture: ${name}`);
  }
  return buildFixture();
}
