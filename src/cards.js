// ═══════════════════════════════════════════════════════════════
// CARD DATABASE
// ═══════════════════════════════════════════════════════════════

export const CREATURES = {
  whisper: { id:'whisper', name:'Whisper', subtitle:'Shadow Ermine', cost:1, hp:30, atk:20,
    ability: {
      name: 'Elusive',
      text: 'Cannot be targeted by Set Verses the turn it is summoned.',
      procedural: true  // Handled via summonedThisTurn flag check
    },
    flavor:'"A flicker in the corner of your eye."',
    art:' /\\_/\\\n(  ·.·)\n > ~ <' },
  thornling: { id:'thornling', name:'Thornling', subtitle:'Bramble Sprite', cost:1, hp:40, atk:10,
    ability: {
      name: 'Thorns',
      text: 'Attackers take 10 damage.',
      trigger: { event: 'afterAttack', condition: { defender: 'self' } },
      effects: [{ type: 'damage', target: 'attacker', amount: 10 }]
    },
    flavor:'"It doesn\'t chase. It waits."',
    art:'  ί\n(●oο)\n \\|/' },
  cindermaw: { id:'cindermaw', name:'Cindermaw', subtitle:'Ember Shrew', cost:2, hp:30, atk:30,
    ability: {
      name: 'Frenzy',
      text: 'Attacks twice, but takes 10 self-damage.',
      procedural: true  // Handled in doAttack() - modifies attack flow
    },
    flavor:'"Burns fast. Burns everything."',
    art:'  ~~\n=(Φ ω Φ)=\n  \\|/' },
  gloom: { id:'gloom', name:'Gloom', subtitle:'Void Mite', cost:1, hp:20, atk:20,
    ability: {
      name: 'Fade',
      text: 'When KO\'d, opponent discards 1 random card.',
      trigger: { event: 'onKO', condition: { target: 'self' } },
      effects: [{ type: 'discard', target: 'opp', count: 1, random: true }]
    },
    flavor:'"It takes something with it."',
    art:'  ┌─┐\n  │░│\n  └┬┘' },
  bladewhisker: { id:'bladewhisker', name:'Bladewhisker', subtitle:'Steel Weasel', cost:2, hp:40, atk:30,
    ability: {
      name: 'Rend',
      text: 'Attacks deal +10 damage.',
      passive: { type: 'atkBonus', amount: 10 }  // Passive modifier, always active
    },
    flavor:'"Forged in forgotten wars."',
    art:' /\\_╱\\\n<(⚔ ⚔)>\n  ╲═╱' },
  mireveil: { id:'mireveil', name:'Mireveil', subtitle:'Swamp Phantom', cost:3, hp:50, atk:20,
    ability: {
      name: 'Bog Grasp',
      text: 'Enemy creature cannot retreat next turn.',
      trigger: { event: 'afterAttack', condition: { attacker: 'self', didDamage: true, defenderAlive: true } },
      effects: [{ type: 'setStatus', target: 'defender', status: 'trapped' }]
    },
    flavor:'"The water remembers your name."',
    art:'  ,~,\n (o o)\n/| |\\' },
  pulsefin: { id:'pulsefin', name:'Pulsefin', subtitle:'Abyssal Shrimp', cost:2, hp:40, atk:30,
    ability: {
      name: 'Sonic Strike',
      text: 'First attack each game deals double damage.',
      procedural: true  // Handled via firstAtk flag in doAttack()
    },
    flavor:'"One perfect strike."',
    art:' >(°□°)>\n  ├──┤\n  /| |\\' },
  hexweaver: { id:'hexweaver', name:'Hexweaver', subtitle:'Curse Spider', cost:2, hp:40, atk:20,
    ability: {
      name: 'Venom Thread',
      // BUG-A5 FIX: Updated text to clarify poison mechanic
      text: 'On hit, enemy takes 10 damage at end of each turn until cured.',
      trigger: { event: 'afterAttack', condition: { attacker: 'self', didDamage: true, defenderAlive: true } },
      effects: [{ type: 'setStatus', target: 'defender', status: 'poison' }]
    },
    flavor:'"The web is already complete."',
    art:' /\\╱\\/\\\n(◉ _ ◉)\n /|\\|/|\\' },
  duskfang: { id:'duskfang', name:'Duskfang', subtitle:'Twilight Wolf', cost:3, hp:60, atk:40,
    ability: {
      name: 'Pack Call',
      text: 'When summoned, +20 ATK if you have a creature in graveyard.',
      trigger: { event: 'onSummon', condition: { self: true } },
      effects: [{ type: 'atkBonus', target: 'self', amount: 20, condition: 'me.grave.hasCreature' }]
    },
    flavor:'"It hunts with ghosts."',
    art:'  /\\_/\\\n (❂ ω ❂)\n  /| |\\' },
  sundewqueen: { id:'sundewqueen', name:'Sundew Queen', subtitle:'Carnivorous Monarch', cost:4, hp:70, atk:30,
    ability: {
      name: 'Digest',
      text: 'When it KO\'s a creature, heal 30 HP.',
      trigger: { event: 'afterAttack', condition: { attacker: 'self', causedKO: true } },
      effects: [{ type: 'healSelf', amount: 30 }]
    },
    flavor:'"She feeds on ambition."',
    art:' .:*::.\n(  ♛  )\n  ╲|╱' },
  stormtalon: { id:'stormtalon', name:'Stormtalon', subtitle:'Thunder Raptor', cost:4, hp:50, atk:50,
    ability: {
      name: 'Chain Lightning',
      text: 'On KO, deal 20 damage to the next creature that enters.',
      trigger: { event: 'onKO', condition: { target: 'self' } },
      effects: [{ type: 'setFlag', target: 'opp', flag: 'chainLightning', value: 20 }]
    },
    flavor:'"The sky remembers its anger."',
    art:'  ╱╲\n <(⚡)>\n  /╲' },
  echomask: { id:'echomask', name:'Echomask', subtitle:'Mirror Fiend', cost:4, hp:40, atk:0,
    ability: {
      name: 'Reflection',
      text: 'ATK equals enemy creature\'s ATK. When KO\'d, enemy loses 1 life.',
      trigger: { event: 'onKO', condition: { target: 'self' } },
      effects: [{ type: 'loseLifeOpp', count: 1 }]
    },
    flavor:'"It wears your face."',
    art:' .-----.\n(  ???  )\n `-----\'' },
  
  // === NEW CARDS ===
  
  // Shadow Pack additions
  shadePup: { id:'shadePup', name:'Shade Pup', subtitle:'Lone Shadow', cost:1, hp:25, atk:15,
    ability: {
      name: 'Orphan',
      text: '+15 ATK while you have no bench creatures.',
      passive: { type: 'atkBonus', amount: 15, condition: 'me.bench.empty' }
    },
    flavor:'"Stronger alone."',
    art:'  /\\_/\\\n (;_;)\n  / \\' },
  
  // Fang Pack additions  
  emberfang: { id:'emberfang', name:'Emberfang', subtitle:'Spark Ferret', cost:1, hp:25, atk:25,
    ability: {
      name: 'Spark',
      text: 'When summoned, deal 5 damage to enemy creature.',
      trigger: { event: 'onSummon', condition: { self: true } },
      effects: [{ type: 'damage', target: 'opp.active', amount: 5, condition: 'opp.active' }]
    },
    flavor:'"First blood."',
    art:'  ~火~\n=(ΦωΦ)=\n  \\|/' },
  
  // Venom Pack additions
  leechling: { id:'leechling', name:'Leechling', subtitle:'Blood Mite', cost:1, hp:20, atk:15,
    ability: {
      name: 'Drain',
      text: 'Heal HP equal to damage dealt.',
      trigger: { event: 'afterAttack', condition: { attacker: 'self', didDamage: true } },
      effects: [{ type: 'healSelf', amount: 'damageDealt' }]
    },
    flavor:'"It gives nothing back."',
    art:'  ┌○┐\n  │▓│\n  └─┘' },
  
  // Swarm Pack (new)
  fangpup: { id:'fangpup', name:'Fangpup', subtitle:'Pack Whelp', cost:1, hp:25, atk:20,
    ability: {
      name: 'Pack Bond',
      text: '+10 ATK for each other creature you control.',
      passive: { type: 'atkBonus', amount: 'packCount * 10' }
    },
    flavor:'"Never alone."',
    art:'  /\\_/\\\n (^ω^)\n  ┘ └' },
  hiveling: { id:'hiveling', name:'Hiveling', subtitle:'Swarm Drone', cost:1, hp:20, atk:20,
    ability: {
      name: 'Swarm',
      text: 'When summoned to the bench, draw 1 card.',
      trigger: { event: 'onSummon', condition: { self: true, location: 'bench' } },
      effects: [{ type: 'draw', count: 1 }]
    },
    flavor:'"One of many."',
    art:'  ╱▽╲\n <(●)>\n  /│\\' },
  skitter: { id:'skitter', name:'Skitter', subtitle:'Panic Mouse', cost:1, hp:30, atk:15,
    ability: {
      name: 'Scurry',
      text: 'When damaged, may swap with bench creature (free).',
      trigger: { event: 'afterDamage', condition: { target: 'self', survived: true }, optional: true },
      effects: [{ type: 'swapWithBench', target: 'self' }]
    },
    flavor:'"Too fast to catch."',
    art:'  ○\n ◐│◑\n  /\\' },
  piranix: { id:'piranix', name:'Piranix', subtitle:'Blood Fin', cost:2, hp:35, atk:25,
    ability: {
      name: 'Feeding Frenzy',
      text: '+15 ATK if enemy creature is below half HP.',
      passive: { type: 'atkBonus', amount: 15, condition: 'opp.active.belowHalf' }
    },
    flavor:'"It smells weakness."',
    art:' ><(((°>' },
  hollowfox: { id:'hollowfox', name:'Hollowfox', subtitle:'Den Guardian', cost:2, hp:40, atk:25,
    ability: {
      name: 'Den Guard',
      text: 'While you have bench creatures, take -10 damage.',
      passive: { type: 'damageReduction', amount: 10, condition: 'me.bench.notEmpty' }
    },
    flavor:'"The pack comes first."',
    art:'  /\\_/\\\n (◕ᴥ◕)\n ◢███◣' },
  alpha: { id:'alpha', name:'Alpha', subtitle:'Pack Leader', cost:3, hp:55, atk:35,
    ability: {
      name: 'Rally',
      text: 'Your bench creatures can assist attacks (+10 each).',
      procedural: true  // Handled in damage calculation - complex bench synergy
    },
    flavor:'"They follow without question."',
    art:'  ∧___∧\n (▀ ͜͞ʖ▀)\n /|███|\\' },
  broodmother: { id:'broodmother', name:'Broodmother', subtitle:'Hive Queen', cost:4, hp:60, atk:20,
    ability: {
      name: 'Spawn',
      text: 'End of your turn, summon a 10/10 Antling to bench (max 2).',
      // BUG-C3 FIX: Added myTurn condition - only fires on owner's turn
      trigger: { event: 'turnEnd', condition: { self: 'active', myTurn: true } },
      effects: [{ type: 'summonToken', token: 'antling', location: 'bench', maxBench: 2 }]
    },
    flavor:'"The swarm is eternal."',
    art:' ╱╲___╱╲\n(  ◎ ◎  )\n ╲▓▓▓▓▓╱' },
  
  // Shell Pack (defensive theme)
  shellkin: { id:'shellkin', name:'Shellkin', subtitle:'Armored Pup', cost:1, hp:20, atk:10,
    ability: {
      name: 'Harden',
      text: 'Negates first 10 damage each turn from any source.',
      trigger: { event: 'beforeDamage', condition: { target: 'self' } },
      effects: [{ type: 'reduceDamage', amount: 10, perTurn: true }]
    },
    flavor:'"Curl up. Stay safe."',
    art:'  ╭──╮\n (◕‿◕)\n  ╰┬─╯' },
  pebbleback: { id:'pebbleback', name:'Pebbleback', subtitle:'Stone Beetle', cost:1, hp:30, atk:20,
    ability: {
      name: 'Sturdy',
      text: 'Always takes -5 damage from attacks.',
      trigger: { event: 'beforeDamage', condition: { target: 'self' } },
      effects: [{ type: 'reduceDamage', amount: 5 }]
    },
    flavor:'"Small stones endure."',
    art:'  ┌▓▓┐\n  │◎◎│\n  └──┘' },
  ironhide: { id:'ironhide', name:'Ironhide', subtitle:'Metal Armadillo', cost:2, hp:50, atk:20,
    ability: {
      name: 'Iron Skin',
      text: 'Always takes -10 damage from attacks.',
      trigger: { event: 'beforeDamage', condition: { target: 'self' } },
      effects: [{ type: 'reduceDamage', amount: 10 }]
    },
    flavor:'"Nothing gets through."',
    art:'  ╔═══╗\n <(●_●)>\n  ╚═══╝' },
  coilshell: { id:'coilshell', name:'Coilshell', subtitle:'Spike Snail', cost:2, hp:45, atk:25,
    ability: {
      name: 'Recoil',
      text: 'When attacked, deal 10 back to attacker.',
      trigger: { event: 'afterAttack', condition: { defender: 'self' } },
      effects: [{ type: 'damage', target: 'attacker', amount: 10 }]
    },
    flavor:'"Touch and regret."',
    art:'   @@@\n  /◎ ◎\\\n ~~~~~~' },
  bulwark: { id:'bulwark', name:'Bulwark', subtitle:'Living Wall', cost:3, hp:70, atk:15,
    ability: {
      name: 'Fortress',
      text: 'Survives lethal hit with 1 HP (once per game).',
      trigger: { event: 'onLethalDamage', condition: { self: true, notUsed: 'fortressUsed' } },
      effects: [
        { type: 'setHP', target: 'self', amount: 1 },
        { type: 'markUsed', flag: 'fortressUsed' }
      ]
    },
    flavor:'"I will not fall."',
    art:' ╔═════╗\n ║█████║\n ╚═════╝' },
  reflector: { id:'reflector', name:'Reflector', subtitle:'Mirror Crab', cost:3, hp:45, atk:30,
    ability: {
      name: 'Mirror Shell',
      text: 'When hit, deal 15 damage back to attacker.',
      trigger: { event: 'afterAttack', condition: { defender: 'self' } },
      effects: [{ type: 'damage', target: 'attacker', amount: 15 }]
    },
    flavor:'"Your strength becomes mine."',
    art:'  ╱◇◇╲\n <(◊_◊)>\n  ╲──╱' },
  titanback: { id:'titanback', name:'Titanback', subtitle:'Ancient Tortoise', cost:4, hp:85, atk:25,
    ability: {
      name: 'Juggernaut',
      text: 'Resists first 15 damage per turn. When KO\'d deal 25 damage to enemy creature.',
      procedural: true  // Handled in damage calc + onKO - dual ability
    },
    flavor:'"Mountains move slowly."',
    art:' ╔══════╗\n(  ◉  ◉  )\n ╚══════╝' },
};

export const VERSES = {
  // Cast Verses (with declarative effects)
  soulSiphon: { id:'soulSiphon', name:'Soul Siphon', type:'cast', cost:2,
    art: ' ◇~◇\n<soul>\n ◇~◇',
    flavor: 'What flows out must flow in.',
    text:'Deal 20 damage to any creature. Heal your creature 10 if damage was dealt.',
    requiresSelection: true,
    selection: { type: 'anyCreature', prompt: 'Choose a creature to drain' },
    effects: [
      { type: 'damage', target: 'selected', amount: 20 },
      { type: 'heal', target: 'me.active', amount: 10, condition: 'damageWasDealt' }
    ] },
  darkPact: { id:'darkPact', name:'Dark Pact', type:'cast', cost:1,
    art: ' ⚀⚀\n[PACT]\n ♠♠',
    flavor: 'Power has a price. Pay it.',
    text:'Draw 2 cards. Lose 1 life.',
    effects: [
      { type: 'draw', count: 2 },
      { type: 'loseLife', count: 1 }
    ] },
  graveEcho: { id:'graveEcho', name:'Grave Echo', type:'cast', cost:3,
    art: '~○~○~\n ECHO\n~○~○~',
    flavor: 'The dead still whisper.',
    text:'Return a creature from your graveyard to your hand.',
    requiresSelection: true,
    selection: { type: 'graveCreature', prompt: 'Choose creature to return' },
    effects: [
      { type: 'moveCard', from: 'me.grave', to: 'me.hand', target: 'selected' }
    ] },
  manaSurge: { id:'manaSurge', name:'Mana Surge', type:'cast', cost:0,
    art: '  ⚡\n<●●●>\n  ⚡',
    flavor: 'Once per lifetime, the well overflows.',
    text:'Gain 2 mana this turn. Once per game.',
    effects: [
      { type: 'gainMana', amount: 2 },
      { type: 'setFlag', flag: 'usedManaSurge', value: true }
    ] },
  predatorsMark: { id:'predatorsMark', name:"Predator's Mark", type:'cast', cost:2,
    art: ' \\|/\n--X--\n /|\\',
    flavor: 'The hunt ends here.',
    text:'Your next attack deals +30 damage.',
    effects: [
      { type: 'atkBonus', amount: 30, source: "Predator's Mark" }
    ] },
  banish: { id:'banish', name:'Banish', type:'cast', cost:3,
    art: '|    |\n| ∅ |\n|____|',
    flavor: 'Gone. Not dead. Worse.',
    text:'Destroy any creature. Remove from game.',
    requiresSelection: true,
    selection: { type: 'anyCreature', prompt: 'Choose a creature to banish' },
    effects: [
      { type: 'banish', target: 'selected' }
    ] },
  bloodMoon: { id:'bloodMoon', name:'Blood Moon', type:'cast', cost:2,
    art: ' ,--.\n( ☽ )\n `--\'',
    flavor: 'When the moon bleeds, so does everything else.',
    text:'All creatures take 20 damage.',
    effects: [
      { type: 'aoeAll', amount: 20 }
    ] },
  secondWind: { id:'secondWind', name:'Second Wind', type:'cast', cost:2,
    art: ' ~≈~\n<AIR>\n ~≈~',
    flavor: 'Breathe deep. Fight again.',
    text:'Heal your active creature 40 HP.',
    effects: [
      { type: 'heal', target: 'me.active', amount: 40, condition: 'me.active' }
    ] },
  // Set Verses (with declarative triggers for future migration)
  phantomWall: { id:'phantomWall', name:'Phantom Wall', type:'set', cost:1,
    art: '|░░░░|\n|WALL|\n|░░░░|',
    flavor: 'You cannot strike what is not there.',
    trigger:'When opponent attacks', text:'Negate attack. Their creature takes 10 damage.',
    triggerDef: { event: 'beforeAttack', condition: { attacker: 'opp' }, optional: true, priority: 2 },
    effects: [{ type: 'negateAttack' }, { type: 'damage', target: 'attacker', amount: 10 }] },
  soulTrap: { id:'soulTrap', name:'Soul Trap', type:'set', cost:2,
    art: ' /\\ /\\\n{TRAP}\n \\/  \\/',
    flavor: 'Welcome to your new home.',
    trigger:'When opponent summons', text:'That creature enters with -20 HP.',
    triggerDef: { event: 'onSummon', condition: { owner: 'opp' } },
    effects: [{ type: 'damage', target: 'summoned', amount: 20 }] },
  vengeance: { id:'vengeance', name:'Vengeance', type:'set', cost:2,
    art: '  †\n /|\\\n/ | \\',
    flavor: 'If I fall, you fall with me.',
    trigger:'When your creature would be KO\'d by attack', text:'Negate KO. Destroy attacker instead.',
    triggerDef: { event: 'beforeKO', condition: { target: 'me.active', source: 'attack' }, optional: true, priority: 2 },
    effects: [{ type: 'negateKO' }, { type: 'destroy', target: 'attacker' }] },
  graveRise: { id:'graveRise', name:'Grave Rise', type:'set', cost:1,
    art: ' ▲\n/†\\\n~~~',
    flavor: 'The fallen answer the call.',
    trigger:'When your creature is KO\'d', text:'Summon 1-cost creature from grave to bench.',
    triggerDef: { event: 'onKO', condition: { owner: 'me', hasOneCostInGrave: true, benchNotFull: true }, optional: true },
    effects: [{ type: 'summonFromGrave', filter: { cost: 1 }, location: 'bench' }] },
  manaDrain: { id:'manaDrain', name:'Mana Drain', type:'set', cost:1,
    art: ' ○→\n[  ]\n ○→',
    flavor: 'Your words mean nothing here.',
    trigger:'When opponent plays Cast Verse', text:'Negate the next spell your opponent casts.',
    triggerDef: { event: 'onCast', condition: { caster: 'opp' } },
    effects: [{ type: 'negateSpell' }] },
  lastBreath: { id:'lastBreath', name:'Last Breath', type:'set', cost:1,
    art: ' ~♥~\n<  >\n ~♥~',
    flavor: 'Not yet. Not today.',
    trigger:'When you would lose your last life', text:'Survive with 1 life instead. Once per game.',
    triggerDef: { event: 'beforeLifeLoss', condition: { owner: 'me', lastLife: true }, priority: 2 },
    effects: [{ type: 'negateLifeLoss' }] },
  
  // === NEW VERSES ===
  
  // Fang Pack addition
  ignite: { id:'ignite', name:'Ignite', type:'cast', cost:1,
    art: ' )\\ /(\n( ⚬ )\n )/\\(',
    flavor: 'Some things just need to burn.',
    text:'Deal 15 damage to any creature.',
    requiresSelection: true,
    selection: { type: 'anyCreature', prompt: 'Choose a creature to ignite' },
    effects: [
      { type: 'damage', target: 'selected', amount: 15 }
    ] },
  
  // Swarm Pack verses
  packTactics: { id:'packTactics', name:'Pack Tactics', type:'cast', cost:1,
    art: '◄►◄►\nPACK\n◄►◄►',
    flavor: 'Together, we see everything.',
    text:'Draw 1 card for each creature you control (max 3).',
    effects: [
      { type: 'draw', count: 'creatureCount', max: 3 }
    ] },
  callOfTheWild: { id:'callOfTheWild', name:'Call of the Wild', type:'cast', cost:2,
    art: ' ~*~\n/CALL\\\n ~*~',
    flavor: 'The pack always answers.',
    text:'Summon a RANDOM 1-cost creature from your deck to bench.',
    effects: [
      { type: 'summon', filter: { cost: 1 }, location: 'bench' }
    ] },
  sacrifice: { id:'sacrifice', name:'Sacrifice', type:'cast', cost:0,
    art: ' _†_\n|   |\n|___|',
    flavor: 'One falls. Two rise.',
    text:'KO one of your creatures. Draw 2 cards.',
    requiresSelection: true,
    selection: { type: 'ownCreature', prompt: 'Choose creature to sacrifice' },
    effects: [
      { type: 'koSelected' },
      { type: 'draw', count: 2 }
    ] },
  denMother: { id:'denMother', name:'Den Mother', type:'set', cost:2,
    art: '/\\_/\\\n( DEN )\n \\_/',
    flavor: 'Touch my children and burn.',
    trigger:'When a creature you control is KO\'d', text:'Your next attack deals +10 bonus damage.',
    triggerDef: { event: 'onKO', condition: { owner: 'me' }, optional: true },
    effects: [{ type: 'atkBonus', amount: 10, source: 'Den Mother' }] },
  swarmShield: { id:'swarmShield', name:'Swarm Shield', type:'set', cost:1,
    art: '◄▓▓▓►\n SHIELD\n◄▓▓▓►',
    flavor: 'The swarm protects its own.',
    trigger:'When your active would take damage', text:'If you have bench, reduce damage by 15.',
    triggerDef: { event: 'beforeDamage', condition: { target: 'me.active', hasBench: true }, optional: true },
    effects: [{ type: 'reduceDamage', amount: 15 }] },
  
  // Shell Pack verses
  shellArmor: { id:'shellArmor', name:'Shell Armor', type:'cast', cost:1,
    art: ' /==\\\n| ♥ |\n \\==/',
    flavor: 'Hard outside, soft inside.',
    text:'Heal your creature 25 HP.',
    effects: [
      { type: 'heal', target: 'me.active', amount: 25, condition: 'me.active' }
    ] },
  brace: { id:'brace', name:'Brace', type:'set', cost:1,
    art: ' |=|\n<|=|>\n |=|',
    flavor: 'Stand firm. Hold the line.',
    trigger:'When opponent attacks', text:'Reduce damage by 15.',
    triggerDef: { event: 'beforeDamage', condition: { target: 'me.active' }, optional: true },
    effects: [{ type: 'reduceDamage', amount: 15 }] },
  spikeShield: { id:'spikeShield', name:'Spike Shield', type:'set', cost:2,
    art: '/\\/\\/\\\n|SPIKE|\n\\/\\/\\/',
    flavor: 'Strike me if you dare.',
    trigger:'When opponent attacks', text:'Deal 15 damage to their creature.',
    triggerDef: { event: 'beforeAttack', condition: { attacker: 'opp' }, optional: true },
    effects: [{ type: 'damage', target: 'attacker', amount: 15 }] },
  regenerate: { id:'regenerate', name:'Regenerate', type:'cast', cost:2,
    art: ' ❀\n/||\\\n ❀',
    flavor: 'Life finds a way back.',
    text:'Heal your creature 40 HP. Cure poison.',
    effects: [
      { type: 'heal', target: 'me.active', amount: 40, condition: 'me.active' },
      { type: 'cureStatus', target: 'me.active', status: 'poison' }
    ] },
  fortify: { id:'fortify', name:'Fortify', type:'cast', cost:2,
    art: '[===]\n|FRT|\n[===]',
    flavor: 'One more hit. Just one more.',
    text:'Your creature survives the next lethal hit with 1 HP.',
    effects: [
      { type: 'setStatus', target: 'me.active', status: 'fortified' }
    ] },
  unbreakable: { id:'unbreakable', name:'Unbreakable', type:'cast', cost:3,
    art: ' ◆\n<◆>\n ◆',
    flavor: 'Diamonds do not shatter.',
    text:'Prevent the next instance of damage to your creatures.',
    customHandler: true },  // Player-level flag, not creature-specific
};

export const DECKS = {
  shadow: {
    // 8 creatures: 2 whisper, 2 gloom, 2 shadePup (new!), 1 mireveil, 1 duskfang
    creatures: ['whisper','whisper','gloom','gloom','shadePup','shadePup','mireveil','duskfang'],
    // 12 verses
    verses: ['darkPact','darkPact','darkPact','graveEcho','graveEcho','soulSiphon','soulSiphon','soulTrap','soulTrap','graveRise','graveRise','manaDrain']
  },
  fang: {
    // 8 creatures: 2 emberfang (new!), 2 cindermaw, 2 bladewhisker, 1 pulsefin, 1 stormtalon
    creatures: ['emberfang','emberfang','cindermaw','cindermaw','bladewhisker','bladewhisker','pulsefin','stormtalon'],
    // 12 verses: now with ignite!
    verses: ['ignite','ignite','ignite','predatorsMark','predatorsMark','bloodMoon','bloodMoon','phantomWall','phantomWall','vengeance','vengeance','lastBreath']
  },
  venom: {
    // 8 creatures: 2 leechling (new!), 2 thornling, 2 hexweaver, 1 sundewqueen, 1 echomask
    creatures: ['leechling','leechling','thornling','thornling','hexweaver','hexweaver','sundewqueen','echomask'],
    // 12 verses
    verses: ['secondWind','secondWind','soulSiphon','soulSiphon','soulSiphon','banish','banish','soulTrap','soulTrap','phantomWall','phantomWall','lastBreath']
  },
  swarm: {
    // 8 creatures: pack synergy focus (includes Hollowfox for defense, Broodmother for spawning)
    creatures: ['fangpup','fangpup','hiveling','hiveling','skitter','hollowfox','alpha','broodmother'],
    // 12 verses: draw, summon, bench synergy
    verses: ['packTactics','packTactics','packTactics','callOfTheWild','callOfTheWild','sacrifice','sacrifice','denMother','denMother','swarmShield','swarmShield','lastBreath']
  },
  shell: {
    // 8 creatures: defensive wall, damage reduction
    creatures: ['shellkin','shellkin','pebbleback','pebbleback','ironhide','coilshell','bulwark','titanback'],
    // 12 verses: healing, damage prevention, retaliation
    verses: ['shellArmor','shellArmor','shellArmor','regenerate','regenerate','fortify','fortify','brace','brace','spikeShield','spikeShield','unbreakable']
  }
};

// Helper to get all cards
export function getCreature(id) {
  return CREATURES[id];
}

export function getVerse(id) {
  return VERSES[id];
}

export function getDeck(id) {
  return DECKS[id];
}
