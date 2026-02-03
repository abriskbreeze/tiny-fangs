// ═══════════════════════════════════════════════════════════════
// CARD DATABASE
// ═══════════════════════════════════════════════════════════════

export const CREATURES = {
  whisper: { id:'whisper', name:'Whisper', subtitle:'Shadow Ermine', cost:1, hp:30, atk:20,
    ability:'Elusive', abilityText:'Cannot be targeted by Set Verses the turn it is summoned.',
    flavor:'"A flicker in the corner of your eye."',
    art:' /\\_/\\\n(  ·.·)\n > ~ <' },
  thornling: { id:'thornling', name:'Thornling', subtitle:'Bramble Sprite', cost:1, hp:40, atk:10,
    ability:'Thorns', abilityText:'Attackers take 10 damage.',
    flavor:'"It doesn\'t chase. It waits."',
    art:' 🌿ί\n(●oο)\n \\|/' },
  cindermaw: { id:'cindermaw', name:'Cindermaw', subtitle:'Ember Shrew', cost:2, hp:30, atk:30,
    ability:'Frenzy', abilityText:'Attacks twice, but takes 10 self-damage.',
    flavor:'"Burns fast. Burns everything."',
    art:'  ~~\n=(Φ ω Φ)=\n  \\|/' },
  gloom: { id:'gloom', name:'Gloom', subtitle:'Void Mite', cost:1, hp:20, atk:20,
    ability:'Fade', abilityText:'When KO\'d, opponent discards 1 random card.',
    flavor:'"It takes something with it."',
    art:'  ┌─┐\n  │░│\n  └┬┘' },
  bladewhisker: { id:'bladewhisker', name:'Bladewhisker', subtitle:'Steel Weasel', cost:2, hp:40, atk:30,
    ability:'Rend', abilityText:'Attacks deal +10 damage.',
    flavor:'"Forged in forgotten wars."',
    art:' /\\_╱\\\n<(⚔ ⚔)>\n  ╲═╱' },
  mireveil: { id:'mireveil', name:'Mireveil', subtitle:'Swamp Phantom', cost:3, hp:50, atk:20,
    ability:'Bog Grasp', abilityText:'Enemy creature cannot retreat next turn.',
    flavor:'"The water remembers your name."',
    art:'  ,~,\n (o o)\n/| |\\' },
  pulsefin: { id:'pulsefin', name:'Pulsefin', subtitle:'Abyssal Shrimp', cost:2, hp:40, atk:30,
    ability:'Sonic Strike', abilityText:'First attack each game deals double damage.',
    flavor:'"One perfect strike."',
    art:' >(°□°)>\n  ├──┤\n  /| |\\' },
  hexweaver: { id:'hexweaver', name:'Hexweaver', subtitle:'Curse Spider', cost:2, hp:40, atk:20,
    ability:'Venom Thread', abilityText:'On hit, enemy takes 10 at end of each turn.',
    flavor:'"The web is already complete."',
    art:' /\\╱\\/\\\n(◉ _ ◉)\n /|\\|/|\\' },
  duskfang: { id:'duskfang', name:'Duskfang', subtitle:'Twilight Wolf', cost:3, hp:60, atk:40,
    ability:'Pack Call', abilityText:'When summoned, +20 ATK if you have a creature in graveyard.',
    flavor:'"It hunts with ghosts."',
    art:'  /\\_/\\\n (❂ ω ❂)\n  /| |\\' },
  sundewqueen: { id:'sundewqueen', name:'Sundew Queen', subtitle:'Carnivorous Monarch', cost:4, hp:70, atk:30,
    ability:'Digest', abilityText:'When it KO\'s a creature, heal 30 HP.',
    flavor:'"She feeds on ambition."',
    art:' .:*::.\n(  ♛  )\n  ╲|╱' },
  stormtalon: { id:'stormtalon', name:'Stormtalon', subtitle:'Thunder Raptor', cost:4, hp:50, atk:50,
    ability:'Chain Lightning', abilityText:'On KO, deal 20 damage to the next creature that enters.',
    flavor:'"The sky remembers its anger."',
    art:'  ╱╲\n <(⚡)>\n  /╲' },
  echomask: { id:'echomask', name:'Echomask', subtitle:'Mirror Fiend', cost:4, hp:40, atk:0,
    ability:'Reflection', abilityText:'ATK equals enemy creature\'s ATK. When KO\'d, enemy loses 1 life.',
    flavor:'"It wears your face."',
    art:' .-----.\n(  ???  )\n `-----\'' },
};

export const VERSES = {
  // Cast Verses
  soulSiphon: { id:'soulSiphon', name:'Soul Siphon', type:'cast', cost:2,
    text:'Deal 20 damage to enemy creature. Heal your creature 10.' },
  darkPact: { id:'darkPact', name:'Dark Pact', type:'cast', cost:1,
    text:'Draw 2 cards. Lose 1 life.' },
  graveEcho: { id:'graveEcho', name:'Grave Echo', type:'cast', cost:3,
    text:'Return a creature from your graveyard to your hand.' },
  manaSurge: { id:'manaSurge', name:'Mana Surge', type:'cast', cost:0,
    text:'Gain 2 mana this turn. Once per game.' },
  predatorsMark: { id:'predatorsMark', name:"Predator's Mark", type:'cast', cost:2,
    text:'Your creature\'s next attack deals +30 damage.' },
  banish: { id:'banish', name:'Banish', type:'cast', cost:3,
    text:'Destroy enemy creature. Remove from game.' },
  bloodMoon: { id:'bloodMoon', name:'Blood Moon', type:'cast', cost:2,
    text:'All creatures take 20 damage.' },
  secondWind: { id:'secondWind', name:'Second Wind', type:'cast', cost:2,
    text:'Heal your active creature 40 HP.' },
  // Set Verses
  phantomWall: { id:'phantomWall', name:'Phantom Wall', type:'set', cost:1,
    trigger:'When opponent attacks', text:'Negate attack. Their creature takes 10 damage.' },
  soulTrap: { id:'soulTrap', name:'Soul Trap', type:'set', cost:2,
    trigger:'When opponent summons', text:'That creature enters with -20 HP.' },
  mirrorForce: { id:'mirrorForce', name:'Mirror Force', type:'set', cost:2,
    trigger:'When your creature would be KO\'d', text:'Negate KO. Destroy attacker instead.' },
  graveRise: { id:'graveRise', name:'Grave Rise', type:'set', cost:1,
    trigger:'When your creature is KO\'d', text:'Summon 1-cost creature from grave to bench.' },
  manaDrain: { id:'manaDrain', name:'Mana Drain', type:'set', cost:1,
    trigger:'When opponent plays Cast Verse', text:'Negate it. Gain 1 mana.' },
  lastBreath: { id:'lastBreath', name:'Last Breath', type:'set', cost:1,
    trigger:'When you would lose your last life', text:'Survive with 1 life instead. Once per game.' },
};

export const DECKS = {
  shadow: {
    creatures: ['whisper','whisper','gloom','gloom','mireveil','mireveil','duskfang','duskfang'],
    verses: ['darkPact','darkPact','graveEcho','graveEcho','soulSiphon','soulSiphon','soulTrap','soulTrap','graveRise','graveRise','manaDrain','manaDrain']
  },
  fang: {
    creatures: ['cindermaw','cindermaw','bladewhisker','bladewhisker','pulsefin','pulsefin','stormtalon','stormtalon'],
    verses: ['predatorsMark','predatorsMark','manaSurge','manaSurge','bloodMoon','bloodMoon','phantomWall','phantomWall','mirrorForce','mirrorForce','lastBreath','lastBreath']
  },
  venom: {
    creatures: ['thornling','thornling','hexweaver','hexweaver','sundewqueen','sundewqueen','echomask','echomask'],
    verses: ['secondWind','secondWind','soulSiphon','soulSiphon','banish','banish','soulTrap','soulTrap','phantomWall','phantomWall','lastBreath','lastBreath']
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
