import { $ } from './state.js';

// ═══════════════════════════════════════════════════════════════
// RENDER HELPERS
// ═══════════════════════════════════════════════════════════════

// Hearts display for LP
export function hearts(n) {
  return '♥'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, 3 - n));
}

// Mana string display
export function manaStr(player) {
  return '●'.repeat(player.mana) + '○'.repeat(player.maxMana - player.mana);
}

// Generate mana pips HTML for desktop
export function renderManaPips(mana, maxMana) {
  let html = '';
  for (let i = 0; i < 5; i++) {
    const filled = i < mana ? 'filled' : '';
    const visible = i < maxMana ? '●' : '○';
    html += `<div class="d-mana-pip ${filled}">${visible}</div>`;
  }
  return html;
}

// Set verse indicator HTML
export function renderSetVerse(verse, id, isPlayer = false) {
  if (!verse) {
    return `<div class="card-empty set-slot" id="${id}">NO SET</div>`;
  }
  // Player's set verse is hold-to-zoom, opponent's is just [SET]
  if (isPlayer) {
    return `<div class="card-empty set-slot has-set" id="${id}" onpointerdown="setVersePress()" onpointerup="setVerseRelease()" onpointerleave="setVerseRelease()">[SET]</div>`;
  }
  return `<div class="card-empty set-slot has-set" id="${id}">[SET]</div>`;
}

// Get active effects on a creature for display
// owner is optional - pass player object to check player-level flags like unbreakable
export function getActiveEffects(c, owner = null) {
  const effects = [];
  if (c.status === 'poison') {
    effects.push({ id: 'poison', icon: '☠', name: 'Poisoned', desc: 'Takes 10 damage at turn end', color: 'poison' });
  }
  if (c.status === 'trapped') {
    effects.push({ id: 'trapped', icon: '⚓', name: 'Trapped', desc: 'Cannot retreat', color: 'trapped' });
  }
  if (c.fortified) {
    effects.push({ id: 'fortified', icon: '▣', name: 'Fortified', desc: 'Survives next lethal hit with 1 HP', color: 'fortified' });
  }
  // Unbreakable is a player-level flag - show on active creature only
  if (owner?.unbreakable) {
    effects.push({ id: 'unbreakable', icon: '◇', name: 'Unbreakable', desc: 'Next damage to any creature prevented', color: 'unbreakable' });
  }
  return effects;
}

// Render effect badges for battlefield cards (positioned bottom-right)
function renderEffectBadges(c, owner = null) {
  const effects = getActiveEffects(c, owner);
  if (effects.length === 0) return '';
  const badges = effects.map(e => `<span class="effect-badge ${e.color}" title="${e.name}: ${e.desc}">${e.icon}</span>`).join('');
  return `<div class="effect-badges">${badges}</div>`;
}

// Active creature card
// owner is optional - pass player object to show player-level effects like unbreakable
export function renderActiveCard(c, atkInfo = null, owner = null) {
  if (!c) return `<div class="card-empty active-slot">EMPTY</div>`;
  const pct = (c.curHp / c.hp) * 100;
  const low = pct <= 30 ? 'low' : '';
  
  // ATK display with modifiers
  let atkDisplay;
  if (atkInfo && atkInfo.effectiveAtk !== atkInfo.baseAtk) {
    const diff = atkInfo.effectiveAtk - atkInfo.baseAtk;
    const colorClass = diff > 0 ? 'atk-boosted' : 'atk-reduced';
    const tooltip = atkInfo.modifiers.map(m => `${m.name}: +${m.value} (${m.desc})`).join('\\n');
    atkDisplay = `<span class="atk-stat ${colorClass}" title="${tooltip}">ATK ${atkInfo.effectiveAtk}</span>`;
  } else {
    atkDisplay = `<span>ATK ${c.atk}</span>`;
  }
  
  // HP display with damage coloring
  const hpDamaged = c.curHp < c.hp ? 'hp-damaged' : '';
  const hpDisplay = `<span class="hp-stat ${hpDamaged}">${c.curHp}/${c.hp}</span>`;
  
  // Effect badges (positioned bottom-right, above footer)
  const badges = renderEffectBadges(c, owner);
  
  return `<div class="card-active creature" onpointerdown="cardPress('${c.uid}')" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    <div class="header"><span>${c.name}</span></div>
    <div class="hp-bar"><div class="hp-fill ${low}" style="width:${pct}%"></div></div>
    <div class="art">${c.art}</div>
    ${badges}
    <div class="footer">${atkDisplay}${hpDisplay}</div>
  </div>`;
}

// Mini card for bench
// BUG-B2: Add hp-damaged class when bench creature is damaged
export function renderMiniCard(c) {
  const hpDamaged = c.curHp < c.hp ? 'hp-damaged' : '';
  return `<div class="card-mini" onpointerdown="cardPress('${c.uid}')" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    <div class="name">${c.name}</div>
    <div class="stats ${hpDamaged}">${c.curHp}/${c.hp}</div>
    <div class="art">${c.art}</div>
  </div>`;
}

// Render bench with 2 slots (filled or empty)
export function renderBench(benchArray) {
  const slots = [];
  for (let i = 0; i < 2; i++) {
    if (benchArray[i]) {
      slots.push(renderMiniCard(benchArray[i]));
    } else {
      slots.push(`<div class="card-empty"></div>`);
    }
  }
  return slots.join('');
}

// Hand card (mobile or desktop vertical)
export function renderHandCard(c, vertical, selectedCardUid) {
  const sel = selectedCardUid === c.uid ? 'selected' : '';
  const typeClass = c.cardType === 'creature' ? 'creature' : (c.type === 'cast' ? 'verse-cast' : 'verse-set');
  const typeLabel = c.cardType === 'creature' ? 'Creature' : (c.type === 'cast' ? 'Cast' : 'Set');
  
  if (vertical) {
    return `<div class="d-hand-card ${typeClass} ${sel}" onclick="selectCard('${c.uid}')" onpointerdown="cardPress('${c.uid}', event)" onpointerup="cardRelease()" onpointerleave="cardRelease()">
      <div class="cost">${c.cost}</div>
      <div class="info"><div class="name">${c.name}</div><div class="type">${typeLabel}</div></div>
    </div>`;
  }
  
  return `<div class="hand-card ${typeClass} ${sel}" onclick="selectCard('${c.uid}', event)" onpointerdown="cardPress('${c.uid}', event)" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    <div class="cost-pip">${c.cost}</div>
    <div class="name">${c.name}</div>
    <div class="type">${typeLabel}</div>
  </div>`;
}

// Game log
// BUG-B1: Show full history (high limit), reversed so newest at top (desktop)
export function renderLogEntries(log, limit) {
  // Show all entries (use 500 as effectively unlimited)
  const entries = log.slice(-500);
  // Reverse so newest is at top (for desktop scrollable view)
  return entries.slice().reverse().map(l => `<div class="${l.c||''}">${l.t}</div>`).join('');
}

export function renderLogInline(log, limit) {
  return log.slice(-limit).map(l => `<span class="${l.c||''}">${l.t}</span>`).join('');
}
