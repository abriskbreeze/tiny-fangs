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

// Active creature card
export function renderActiveCard(c, atkInfo = null) {
  if (!c) return `<div class="card-empty active-slot">EMPTY</div>`;
  const pct = (c.curHp / c.hp) * 100;
  const low = pct <= 30 ? 'low' : '';
  const statusStr = c.status ? `[${c.status}]` : '';
  
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
  
  return `<div class="card-active creature" onpointerdown="cardPress('${c.uid}')" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    <div class="header"><span>${c.name}</span><span>${c.curHp}/${c.hp}</span></div>
    <div class="hp-bar"><div class="hp-fill ${low}" style="width:${pct}%"></div></div>
    <div class="art">${c.art}</div>
    <div class="footer">${atkDisplay}<span class="status">${statusStr}</span></div>
  </div>`;
}

// Mini card for bench
export function renderMiniCard(c) {
  return `<div class="card-mini" onpointerdown="cardPress('${c.uid}')" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    <div class="name">${c.name}</div>
    <div class="art">${c.art}</div>
    <div class="stats">${c.curHp}/${c.hp}</div>
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
    return `<div class="d-hand-card ${typeClass} ${sel}" onclick="selectCard('${c.uid}')" onpointerdown="cardPress('${c.uid}')" onpointerup="cardRelease()" onpointerleave="cardRelease()">
      <div class="cost">${c.cost}</div>
      <div class="info"><div class="name">${c.name}</div><div class="type">${typeLabel}</div></div>
    </div>`;
  }
  
  return `<div class="hand-card ${typeClass} ${sel}" onclick="selectCard('${c.uid}')" onpointerdown="cardPress('${c.uid}')" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    <div class="cost-pip">${c.cost}</div>
    <div class="name">${c.name}</div>
    <div class="type">${typeLabel}</div>
  </div>`;
}

// Game log
export function renderLogEntries(log, limit) {
  return log.slice(-limit).map(l => `<div class="${l.c||''}">${l.t}</div>`).join('');
}

export function renderLogInline(log, limit) {
  return log.slice(-limit).map(l => `<span class="${l.c||''}">${l.t}</span>`).join('');
}
