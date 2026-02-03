#!/usr/bin/env node
/**
 * TINY FANGS — ASCII Card Battler
 * Inspired by Pokemon TCG GBC
 * Theme: Tiny Predators
 */

const readline = require('readline');

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ENERGY_TYPES = {
  FANG: { symbol: '🦷', name: 'Fang', color: '\x1b[31m' },
  VENOM: { symbol: '🧪', name: 'Venom', color: '\x1b[32m' },
  SWIFT: { symbol: '⚡', name: 'Swift', color: '\x1b[33m' },
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// ═══════════════════════════════════════════════════════════════════════════
// CREATURE DATABASE
// ═══════════════════════════════════════════════════════════════════════════

const CREATURES = {
  // ─── FANG TYPE ───
  ermine: {
    id: 'ermine',
    name: 'Ermine',
    type: 'FANG',
    hp: 50,
    attacks: [
      { name: 'Bite', cost: { FANG: 1 }, damage: 20, effect: null },
      { name: 'Winter Strike', cost: { FANG: 2 }, damage: 40, effect: null },
    ],
    weakness: 'VENOM',
    resistance: 'SWIFT',
    retreatCost: 1,
    ascii: [
      '  /\\_/\\  ',
      ' ( o.o ) ',
      '  > ^ <  ',
    ],
  },
  shrew: {
    id: 'shrew',
    name: 'Shrew',
    type: 'FANG',
    hp: 40,
    attacks: [
      { name: 'Frenzy', cost: { FANG: 1 }, damage: 10, effect: 'hitTwice' },
      { name: 'Devour', cost: { FANG: 2 }, damage: 30, effect: 'heal10' },
    ],
    weakness: 'SWIFT',
    resistance: null,
    retreatCost: 0,
    ascii: [
      '   .--.  ',
      ' =(o  )= ',
      '   `--´  ',
    ],
  },

  // ─── VENOM TYPE ───
  assassinBug: {
    id: 'assassinBug',
    name: 'Assassin Bug',
    type: 'VENOM',
    hp: 50,
    attacks: [
      { name: 'Toxic Stab', cost: { VENOM: 1 }, damage: 10, effect: 'poison' },
      { name: 'Ambush', cost: { VENOM: 2 }, damage: 40, effect: null },
    ],
    weakness: 'SWIFT',
    resistance: 'FANG',
    retreatCost: 1,
    ascii: [
      ' \\(-o-)/ ',
      '  /| |\\  ',
      ' / | | \\ ',
    ],
  },
  sundew: {
    id: 'sundew',
    name: 'Sundew',
    type: 'VENOM',
    hp: 60,
    attacks: [
      { name: 'Sticky Trap', cost: { VENOM: 1 }, damage: 10, effect: 'noRetreat' },
      { name: 'Digest', cost: { VENOM: 2 }, damage: 30, effect: 'heal20' },
    ],
    weakness: 'FANG',
    resistance: null,
    retreatCost: 2,
    ascii: [
      '  .:*::.  ',
      ' .:*@*:. ',
      '   |||   ',
    ],
  },

  // ─── SWIFT TYPE ───
  mantisShrimp: {
    id: 'mantisShrimp',
    name: 'Mantis Shrimp',
    type: 'SWIFT',
    hp: 60,
    attacks: [
      { name: 'Snap', cost: { SWIFT: 1 }, damage: 20, effect: null },
      { name: 'Sonic Punch', cost: { SWIFT: 2, FANG: 1 }, damage: 60, effect: null },
    ],
    weakness: 'VENOM',
    resistance: 'FANG',
    retreatCost: 1,
    ascii: [
      ' ╭(°□°)╮ ',
      ' ┣━━━━┫ ',
      ' ╰┳━━┳╯ ',
    ],
  },
  glintfang: {
    id: 'glintfang',
    name: 'Glintfang',
    type: 'SWIFT',
    hp: 50,
    attacks: [
      { name: 'Flash', cost: { SWIFT: 1 }, damage: 10, effect: 'confuse' },
      { name: 'Steel Bite', cost: { SWIFT: 1, FANG: 1 }, damage: 40, effect: null },
    ],
    weakness: 'FANG',
    resistance: 'VENOM',
    retreatCost: 0,
    ascii: [
      ' ╱╲_╱╲  ',
      ' ◇(ᐛ)◇ ',
      '  ╲▼╱   ',
    ],
  },
};

// Energy cards
const ENERGY_CARDS = {
  fangEnergy: { id: 'fangEnergy', type: 'ENERGY', energyType: 'FANG', name: 'Fang Energy' },
  venomEnergy: { id: 'venomEnergy', type: 'ENERGY', energyType: 'VENOM', name: 'Venom Energy' },
  swiftEnergy: { id: 'swiftEnergy', type: 'ENERGY', energyType: 'SWIFT', name: 'Swift Energy' },
};

// ═══════════════════════════════════════════════════════════════════════════
// CARD CREATION
// ═══════════════════════════════════════════════════════════════════════════

function createCreatureCard(creatureId) {
  const template = CREATURES[creatureId];
  return {
    ...template,
    cardType: 'CREATURE',
    currentHp: template.hp,
    attachedEnergy: [],
    status: null, // poison, confused, trapped
    uid: Math.random().toString(36).substr(2, 9),
  };
}

function createEnergyCard(energyType) {
  const template = ENERGY_CARDS[energyType + 'Energy'];
  return {
    ...template,
    uid: Math.random().toString(36).substr(2, 9),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DECK BUILDING
// ═══════════════════════════════════════════════════════════════════════════

function createStarterDeck(type) {
  const deck = [];
  
  if (type === 'FANG') {
    // Creatures
    for (let i = 0; i < 3; i++) deck.push(createCreatureCard('ermine'));
    for (let i = 0; i < 2; i++) deck.push(createCreatureCard('shrew'));
    deck.push(createCreatureCard('mantisShrimp')); // splash
    // Energy
    for (let i = 0; i < 10; i++) deck.push(createEnergyCard('fang'));
    for (let i = 0; i < 4; i++) deck.push(createEnergyCard('swift'));
  } else if (type === 'VENOM') {
    for (let i = 0; i < 3; i++) deck.push(createCreatureCard('assassinBug'));
    for (let i = 0; i < 2; i++) deck.push(createCreatureCard('sundew'));
    deck.push(createCreatureCard('glintfang'));
    for (let i = 0; i < 10; i++) deck.push(createEnergyCard('venom'));
    for (let i = 0; i < 4; i++) deck.push(createEnergyCard('swift'));
  } else { // SWIFT
    for (let i = 0; i < 3; i++) deck.push(createCreatureCard('mantisShrimp'));
    for (let i = 0; i < 2; i++) deck.push(createCreatureCard('glintfang'));
    deck.push(createCreatureCard('ermine'));
    for (let i = 0; i < 10; i++) deck.push(createEnergyCard('swift'));
    for (let i = 0; i < 4; i++) deck.push(createEnergyCard('fang'));
  }
  
  return shuffle(deck);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════════

function createPlayer(name, deckType) {
  const deck = createStarterDeck(deckType);
  return {
    name,
    deck,
    hand: [],
    active: null,
    bench: [], // max 3
    prizes: [],
    discard: [],
    energyPlayedThisTurn: false,
  };
}

function initGame(playerDeckType, opponentDeckType) {
  const player = createPlayer('You', playerDeckType);
  const opponent = createPlayer('Rival', opponentDeckType);
  
  // Draw opening hands (5 cards)
  for (let i = 0; i < 5; i++) {
    drawCard(player);
    drawCard(opponent);
  }
  
  // Set aside 3 prize cards
  for (let i = 0; i < 3; i++) {
    player.prizes.push(player.deck.pop());
    opponent.prizes.push(opponent.deck.pop());
  }
  
  return {
    player,
    opponent,
    turn: 1,
    currentPlayer: 'player',
    phase: 'setup', // setup, main, attack, end
    winner: null,
    log: [],
  };
}

function drawCard(player) {
  if (player.deck.length === 0) return null;
  const card = player.deck.pop();
  player.hand.push(card);
  return card;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASCII RENDERING
// ═══════════════════════════════════════════════════════════════════════════

function renderCard(card, compact = false) {
  if (!card) return ['┌─────────┐', '│  EMPTY  │', '└─────────┘'];
  
  if (card.type === 'ENERGY') {
    const sym = ENERGY_TYPES[card.energyType].symbol;
    return [
      '┌─────────┐',
      `│   ${sym}    │`,
      `│ ${card.energyType.padEnd(7)} │`,
      '└─────────┘',
    ];
  }
  
  // Creature card
  const type = ENERGY_TYPES[card.type];
  const hpBar = `${card.currentHp}/${card.hp}`;
  
  if (compact) {
    return [
      `┌───────────────┐`,
      `│ ${type.symbol} ${card.name.padEnd(10)} │`,
      `│ HP: ${hpBar.padEnd(9)} │`,
      `└───────────────┘`,
    ];
  }
  
  const lines = [
    `┌───────────────────┐`,
    `│ ${type.symbol} ${card.name.padEnd(14)} │`,
    `│ HP: ${hpBar.padEnd(13)} │`,
    `├───────────────────┤`,
  ];
  
  // ASCII art
  for (const artLine of card.ascii) {
    lines.push(`│ ${artLine.padEnd(17)} │`);
  }
  
  lines.push(`├───────────────────┤`);
  
  // Attacks
  for (const atk of card.attacks) {
    const costStr = Object.entries(atk.cost)
      .map(([t, n]) => ENERGY_TYPES[t].symbol.repeat(n))
      .join('');
    lines.push(`│ ${costStr.padEnd(4)} ${atk.name.padEnd(10)} ${String(atk.damage).padStart(2)} │`);
  }
  
  // Energy attached
  const energyStr = card.attachedEnergy.map(e => ENERGY_TYPES[e].symbol).join('') || 'none';
  lines.push(`├───────────────────┤`);
  lines.push(`│ Energy: ${energyStr.padEnd(9)} │`);
  lines.push(`└───────────────────┘`);
  
  return lines;
}

function renderBattlefield(game) {
  const p = game.player;
  const o = game.opponent;
  
  console.clear();
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}                    🦷 TINY FANGS 🦷                           ${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════════════════${RESET}\n`);
  
  // Opponent side
  console.log(`${DIM}─── ${o.name} ───  Prizes: ${o.prizes.length}  |  Deck: ${o.deck.length}  |  Hand: ${o.hand.length}${RESET}`);
  
  // Opponent bench
  const oBench = o.bench.slice(0, 3).map(c => `[${c.name} ${c.currentHp}HP]`).join(' ');
  console.log(`  Bench: ${oBench || '(empty)'}`);
  
  // Opponent active
  if (o.active) {
    console.log('');
    renderCard(o.active, true).forEach(line => console.log('              ' + line));
  } else {
    console.log('\n              [ NO ACTIVE ]');
  }
  
  console.log(`\n${DIM}─────────────────────── VS ───────────────────────${RESET}\n`);
  
  // Player active
  if (p.active) {
    renderCard(p.active).forEach(line => console.log('              ' + line));
  } else {
    console.log('              [ NO ACTIVE ]');
  }
  
  // Player bench
  const pBench = p.bench.slice(0, 3).map(c => `[${c.name} ${c.currentHp}HP]`).join(' ');
  console.log(`\n  Bench: ${pBench || '(empty)'}`);
  
  console.log(`\n${DIM}─── ${p.name} ───  Prizes: ${p.prizes.length}  |  Deck: ${p.deck.length}${RESET}`);
  
  // Hand
  console.log(`\n${BOLD}Your Hand:${RESET}`);
  p.hand.forEach((card, i) => {
    if (card.cardType === 'CREATURE') {
      console.log(`  [${i + 1}] ${ENERGY_TYPES[card.type].symbol} ${card.name} (${card.hp} HP)`);
    } else {
      console.log(`  [${i + 1}] ${ENERGY_TYPES[card.energyType].symbol} ${card.name}`);
    }
  });
  
  console.log('');
}

function renderLog(game) {
  if (game.log.length > 0) {
    console.log(`${DIM}─── Battle Log ───${RESET}`);
    game.log.slice(-5).forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME LOGIC
// ═══════════════════════════════════════════════════════════════════════════

function countEnergy(card) {
  const counts = { FANG: 0, VENOM: 0, SWIFT: 0 };
  for (const e of card.attachedEnergy) {
    counts[e]++;
  }
  return counts;
}

function canUseAttack(card, attackIndex) {
  const attack = card.attacks[attackIndex];
  const energy = countEnergy(card);
  
  for (const [type, needed] of Object.entries(attack.cost)) {
    if (energy[type] < needed) return false;
  }
  return true;
}

function calculateDamage(attacker, defender, attack) {
  let damage = attack.damage;
  
  // Weakness (double damage)
  if (defender.weakness === attacker.type) {
    damage *= 2;
  }
  
  // Resistance (-20 damage)
  if (defender.resistance === attacker.type) {
    damage = Math.max(0, damage - 20);
  }
  
  return damage;
}

function applyDamage(game, defender, damage, defenderOwner) {
  defender.currentHp -= damage;
  
  if (defender.currentHp <= 0) {
    defender.currentHp = 0;
    game.log.push(`${defender.name} was knocked out!`);
    
    // Move to discard
    defenderOwner.discard.push(defender);
    defenderOwner.active = null;
    
    // Attacker draws a prize
    const attacker = defenderOwner === game.player ? game.opponent : game.player;
    if (attacker.prizes.length > 0) {
      const prize = attacker.prizes.pop();
      attacker.hand.push(prize);
      game.log.push(`${attacker.name} drew a prize card!`);
    }
    
    // Check win condition
    if (attacker.prizes.length === 0) {
      game.winner = attacker.name;
      game.log.push(`${attacker.name} wins!`);
    }
    
    return true; // KO occurred
  }
  return false;
}

function applyEffect(game, effect, attacker, defender, attackerOwner, defenderOwner) {
  switch (effect) {
    case 'poison':
      defender.status = 'poison';
      game.log.push(`${defender.name} was poisoned!`);
      break;
    case 'confuse':
      defender.status = 'confused';
      game.log.push(`${defender.name} is confused!`);
      break;
    case 'noRetreat':
      defender.status = 'trapped';
      game.log.push(`${defender.name} can't retreat!`);
      break;
    case 'heal10':
      attacker.currentHp = Math.min(attacker.hp, attacker.currentHp + 10);
      game.log.push(`${attacker.name} healed 10 HP!`);
      break;
    case 'heal20':
      attacker.currentHp = Math.min(attacker.hp, attacker.currentHp + 20);
      game.log.push(`${attacker.name} healed 20 HP!`);
      break;
    case 'hitTwice':
      // Damage already calculated, just log
      game.log.push(`Hit twice!`);
      break;
  }
}

function processPoison(game, player) {
  if (player.active && player.active.status === 'poison') {
    game.log.push(`${player.active.name} took 10 poison damage!`);
    applyDamage(game, player.active, 10, player);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AI OPPONENT
// ═══════════════════════════════════════════════════════════════════════════

function aiTurn(game) {
  const ai = game.opponent;
  
  game.log.push(`--- ${ai.name}'s turn ---`);
  
  // Draw
  if (ai.deck.length > 0) {
    drawCard(ai);
  }
  
  // Play a creature if no active
  if (!ai.active) {
    const creatures = ai.hand.filter(c => c.cardType === 'CREATURE');
    if (creatures.length > 0) {
      const pick = creatures[0];
      ai.active = pick;
      ai.hand = ai.hand.filter(c => c.uid !== pick.uid);
      game.log.push(`${ai.name} sent out ${pick.name}!`);
    }
  }
  
  // Bench creatures
  while (ai.bench.length < 3) {
    const creatures = ai.hand.filter(c => c.cardType === 'CREATURE');
    if (creatures.length === 0) break;
    const pick = creatures[0];
    ai.bench.push(pick);
    ai.hand = ai.hand.filter(c => c.uid !== pick.uid);
    game.log.push(`${ai.name} benched ${pick.name}.`);
  }
  
  // Attach energy to active
  if (ai.active) {
    const energyCards = ai.hand.filter(c => c.type === 'ENERGY');
    // Prefer matching energy type
    const matching = energyCards.find(c => c.energyType === ai.active.type);
    const toAttach = matching || energyCards[0];
    
    if (toAttach) {
      ai.active.attachedEnergy.push(toAttach.energyType);
      ai.hand = ai.hand.filter(c => c.uid !== toAttach.uid);
      game.log.push(`${ai.name} attached ${ENERGY_TYPES[toAttach.energyType].symbol} to ${ai.active.name}.`);
    }
  }
  
  // Attack if possible
  if (ai.active && game.player.active) {
    // Find best usable attack
    let bestAttack = -1;
    let bestDamage = 0;
    
    for (let i = 0; i < ai.active.attacks.length; i++) {
      if (canUseAttack(ai.active, i)) {
        const dmg = calculateDamage(ai.active, game.player.active, ai.active.attacks[i]);
        if (dmg > bestDamage) {
          bestDamage = dmg;
          bestAttack = i;
        }
      }
    }
    
    if (bestAttack >= 0) {
      const attack = ai.active.attacks[bestAttack];
      const damage = calculateDamage(ai.active, game.player.active, attack);
      
      game.log.push(`${ai.active.name} used ${attack.name}!`);
      
      let actualDamage = damage;
      if (attack.effect === 'hitTwice') {
        actualDamage = attack.damage * 2;
        game.log.push(`Hit twice for ${actualDamage} damage!`);
      }
      
      applyDamage(game, game.player.active, actualDamage, game.player);
      
      if (attack.effect && attack.effect !== 'hitTwice') {
        applyEffect(game, attack.effect, ai.active, game.player.active, ai, game.player);
      }
    }
  }
  
  // Process poison on AI's creature
  processPoison(game, ai);
  
  game.turn++;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER INPUT
// ═══════════════════════════════════════════════════════════════════════════

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function playerSelectActive(game) {
  const p = game.player;
  const creatures = p.hand.filter(c => c.cardType === 'CREATURE');
  
  if (creatures.length === 0) {
    console.log('No creatures in hand! Drawing until you get one...');
    while (p.deck.length > 0) {
      const card = drawCard(p);
      if (card && card.cardType === 'CREATURE') {
        console.log(`Drew ${card.name}!`);
        creatures.push(card);
        break;
      }
    }
    if (creatures.length === 0) {
      game.winner = game.opponent.name;
      game.log.push('No creatures available. You lose!');
      return;
    }
  }
  
  console.log('\nChoose your starting creature:');
  creatures.forEach((c, i) => {
    console.log(`  [${i + 1}] ${ENERGY_TYPES[c.type].symbol} ${c.name} (${c.hp} HP)`);
  });
  
  const choice = await prompt('> ');
  const idx = parseInt(choice) - 1;
  
  if (idx >= 0 && idx < creatures.length) {
    const pick = creatures[idx];
    p.active = pick;
    p.hand = p.hand.filter(c => c.uid !== pick.uid);
    game.log.push(`You sent out ${pick.name}!`);
  } else {
    // Default to first
    const pick = creatures[0];
    p.active = pick;
    p.hand = p.hand.filter(c => c.uid !== pick.uid);
    game.log.push(`You sent out ${pick.name}!`);
  }
}

async function playerTurn(game) {
  const p = game.player;
  
  game.log.push(`--- Your turn (${game.turn}) ---`);
  
  // Draw
  if (p.deck.length > 0) {
    const card = drawCard(p);
    game.log.push(`You drew a card.`);
  }
  
  p.energyPlayedThisTurn = false;
  
  let turnOver = false;
  
  while (!turnOver && !game.winner) {
    renderBattlefield(game);
    renderLog(game);
    
    console.log(`${BOLD}Actions:${RESET}`);
    console.log('  [P] Play creature to bench');
    console.log('  [E] Attach energy to active');
    console.log('  [A] Attack');
    console.log('  [R] Retreat (switch active)');
    console.log('  [D] Done (end turn)');
    
    const action = (await prompt('> ')).toUpperCase();
    
    switch (action) {
      case 'P': {
        const creatures = p.hand.filter(c => c.cardType === 'CREATURE');
        if (creatures.length === 0) {
          game.log.push('No creatures in hand.');
          break;
        }
        if (p.bench.length >= 3) {
          game.log.push('Bench is full!');
          break;
        }
        console.log('Choose creature to bench:');
        creatures.forEach((c, i) => {
          console.log(`  [${i + 1}] ${ENERGY_TYPES[c.type].symbol} ${c.name}`);
        });
        const choice = await prompt('> ');
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < creatures.length) {
          const pick = creatures[idx];
          p.bench.push(pick);
          p.hand = p.hand.filter(c => c.uid !== pick.uid);
          game.log.push(`You benched ${pick.name}.`);
        }
        break;
      }
      
      case 'E': {
        if (!p.active) {
          game.log.push('No active creature!');
          break;
        }
        if (p.energyPlayedThisTurn) {
          game.log.push('Already attached energy this turn!');
          break;
        }
        const energyCards = p.hand.filter(c => c.type === 'ENERGY');
        if (energyCards.length === 0) {
          game.log.push('No energy cards in hand.');
          break;
        }
        console.log('Choose energy to attach:');
        energyCards.forEach((c, i) => {
          console.log(`  [${i + 1}] ${ENERGY_TYPES[c.energyType].symbol} ${c.name}`);
        });
        const choice = await prompt('> ');
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < energyCards.length) {
          const pick = energyCards[idx];
          p.active.attachedEnergy.push(pick.energyType);
          p.hand = p.hand.filter(c => c.uid !== pick.uid);
          p.energyPlayedThisTurn = true;
          game.log.push(`Attached ${ENERGY_TYPES[pick.energyType].symbol} to ${p.active.name}.`);
        }
        break;
      }
      
      case 'A': {
        if (!p.active) {
          game.log.push('No active creature!');
          break;
        }
        if (!game.opponent.active) {
          game.log.push('Opponent has no active creature!');
          break;
        }
        
        console.log('Choose attack:');
        p.active.attacks.forEach((atk, i) => {
          const costStr = Object.entries(atk.cost)
            .map(([t, n]) => ENERGY_TYPES[t].symbol.repeat(n))
            .join('');
          const canUse = canUseAttack(p.active, i);
          const status = canUse ? '' : ' (not enough energy)';
          console.log(`  [${i + 1}] ${costStr} ${atk.name} - ${atk.damage} dmg${status}`);
        });
        console.log('  [0] Cancel');
        
        const choice = await prompt('> ');
        const idx = parseInt(choice) - 1;
        
        if (idx >= 0 && idx < p.active.attacks.length) {
          if (!canUseAttack(p.active, idx)) {
            game.log.push('Not enough energy for that attack!');
            break;
          }
          
          const attack = p.active.attacks[idx];
          const damage = calculateDamage(p.active, game.opponent.active, attack);
          
          game.log.push(`${p.active.name} used ${attack.name}!`);
          
          let actualDamage = damage;
          if (attack.effect === 'hitTwice') {
            actualDamage = attack.damage * 2;
            game.log.push(`Hit twice for ${actualDamage} damage!`);
          }
          
          applyDamage(game, game.opponent.active, actualDamage, game.opponent);
          
          if (attack.effect && attack.effect !== 'hitTwice') {
            applyEffect(game, attack.effect, p.active, game.opponent.active, p, game.opponent);
          }
          
          turnOver = true;
        }
        break;
      }
      
      case 'R': {
        if (!p.active) {
          game.log.push('No active creature!');
          break;
        }
        if (p.active.status === 'trapped') {
          game.log.push(`${p.active.name} is trapped and can't retreat!`);
          break;
        }
        if (p.bench.length === 0) {
          game.log.push('No creatures on bench!');
          break;
        }
        
        const retreatCost = p.active.retreatCost;
        if (p.active.attachedEnergy.length < retreatCost) {
          game.log.push(`Need ${retreatCost} energy to retreat!`);
          break;
        }
        
        console.log('Choose creature to switch in:');
        p.bench.forEach((c, i) => {
          console.log(`  [${i + 1}] ${ENERGY_TYPES[c.type].symbol} ${c.name} (${c.currentHp}/${c.hp} HP)`);
        });
        const choice = await prompt('> ');
        const idx = parseInt(choice) - 1;
        
        if (idx >= 0 && idx < p.bench.length) {
          // Pay retreat cost
          for (let i = 0; i < retreatCost; i++) {
            p.active.attachedEnergy.pop();
          }
          
          // Swap
          const newActive = p.bench[idx];
          p.bench = p.bench.filter(c => c.uid !== newActive.uid);
          p.bench.push(p.active);
          p.active = newActive;
          p.active.status = null; // Clear status on switch in
          
          game.log.push(`Retreated! ${newActive.name} is now active.`);
        }
        break;
      }
      
      case 'D':
        turnOver = true;
        break;
    }
  }
  
  // Process poison
  processPoison(game, p);
  
  // If no active, must send from bench
  if (!p.active && p.bench.length > 0 && !game.winner) {
    console.log('\nYour active was knocked out! Choose a replacement:');
    p.bench.forEach((c, i) => {
      console.log(`  [${i + 1}] ${ENERGY_TYPES[c.type].symbol} ${c.name} (${c.currentHp}/${c.hp} HP)`);
    });
    const choice = await prompt('> ');
    const idx = parseInt(choice) - 1;
    
    if (idx >= 0 && idx < p.bench.length) {
      p.active = p.bench[idx];
      p.bench = p.bench.filter(c => c.uid !== p.active.uid);
      game.log.push(`You sent out ${p.active.name}!`);
    } else if (p.bench.length > 0) {
      p.active = p.bench[0];
      p.bench = p.bench.filter(c => c.uid !== p.active.uid);
      game.log.push(`You sent out ${p.active.name}!`);
    }
  }
  
  // Check if player lost (no active, no bench)
  if (!p.active && p.bench.length === 0 && !game.winner) {
    game.winner = game.opponent.name;
    game.log.push('You have no more creatures! You lose!');
  }
}

async function opponentSelectActive(game) {
  const o = game.opponent;
  const creatures = o.hand.filter(c => c.cardType === 'CREATURE');
  
  if (creatures.length === 0) {
    while (o.deck.length > 0) {
      const card = drawCard(o);
      if (card && card.cardType === 'CREATURE') {
        creatures.push(card);
        break;
      }
    }
  }
  
  if (creatures.length > 0) {
    const pick = creatures[0];
    o.active = pick;
    o.hand = o.hand.filter(c => c.uid !== pick.uid);
    game.log.push(`${o.name} sent out ${pick.name}!`);
  }
}

function aiReplaceActive(game) {
  const o = game.opponent;
  
  if (!o.active && o.bench.length > 0) {
    o.active = o.bench[0];
    o.bench = o.bench.filter(c => c.uid !== o.active.uid);
    game.log.push(`${o.name} sent out ${o.active.name}!`);
  }
  
  if (!o.active && o.bench.length === 0 && !game.winner) {
    game.winner = game.player.name;
    game.log.push(`${o.name} has no more creatures! You win!`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GAME LOOP
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.clear();
  console.log(`
${BOLD}═══════════════════════════════════════════════════════════════${RESET}
${BOLD}                    🦷 TINY FANGS 🦷                           ${RESET}
${BOLD}               A Tiny Predator Card Battler                    ${RESET}
${BOLD}═══════════════════════════════════════════════════════════════${RESET}

Choose your deck:
  [1] 🦷 Fang Deck  - Ermine & Shrew (physical power)
  [2] 🧪 Venom Deck - Assassin Bug & Sundew (poison & traps)
  [3] ⚡ Swift Deck - Mantis Shrimp & Glintfang (speed & combo)
`);
  
  const deckChoice = await prompt('> ');
  const deckTypes = { '1': 'FANG', '2': 'VENOM', '3': 'SWIFT' };
  const playerDeck = deckTypes[deckChoice] || 'FANG';
  
  // AI picks a random different deck
  const aiOptions = Object.values(deckTypes).filter(t => t !== playerDeck);
  const aiDeck = aiOptions[Math.floor(Math.random() * aiOptions.length)];
  
  const game = initGame(playerDeck, aiDeck);
  
  console.log(`\nYou chose the ${ENERGY_TYPES[playerDeck].symbol} ${playerDeck} deck!`);
  console.log(`Rival chose the ${ENERGY_TYPES[aiDeck].symbol} ${aiDeck} deck!\n`);
  
  await prompt('Press Enter to start...');
  
  // Setup phase - both sides pick active
  await playerSelectActive(game);
  await opponentSelectActive(game);
  
  // Main game loop
  while (!game.winner) {
    await playerTurn(game);
    
    if (game.winner) break;
    
    // AI needs to replace if KO'd
    aiReplaceActive(game);
    
    if (game.winner) break;
    
    aiTurn(game);
    
    // Player needs to replace if KO'd (handled in playerTurn start next loop)
    if (!game.player.active && game.player.bench.length === 0) {
      game.winner = game.opponent.name;
    }
  }
  
  // Game over
  renderBattlefield(game);
  renderLog(game);
  
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════════════${RESET}`);
  if (game.winner === 'You') {
    console.log(`${BOLD}                    🏆 YOU WIN! 🏆                            ${RESET}`);
  } else {
    console.log(`${BOLD}                    💀 YOU LOSE 💀                            ${RESET}`);
  }
  console.log(`${BOLD}═══════════════════════════════════════════════════════════════${RESET}\n`);
  
  const again = await prompt('Play again? (y/n) ');
  if (again.toLowerCase() === 'y') {
    rl.close();
    const newRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // Restart would require re-running - for now just exit
    console.log('Run `node game.js` to play again!');
  }
  
  rl.close();
}

main().catch(console.error);
