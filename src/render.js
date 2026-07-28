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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cardTemplate(c) {
  if (c.cardType === 'creature' || c.hp != null || c.atk != null) return 'creature';
  return c.type === 'cast' ? 'cast' : 'set';
}

function formatCombatStat(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric).padStart(2, '0') : escapeHtml(value);
}

function renderCardFace(c, { size = 'hand', atkInfo = null, owner = null } = {}) {
  const template = cardTemplate(c);
  const isCreature = template === 'creature';
  const effectiveAtk = atkInfo?.effectiveAtk ?? c.atk ?? 0;
  const currentHp = c.curHp ?? c.hp ?? 0;
  const maxHp = c.hp ?? currentHp;
  const hpPct = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
  const low = hpPct <= 30 ? ' low' : '';
  const effectBadges = size === 'active' && isCreature ? renderEffectBadges(c, owner) : '';
  const abilityName = isCreature ? c.ability?.name : (template === 'cast' ? 'Cast Verse' : 'Set Verse');
  const rulesText = isCreature ? c.ability?.text : (c.text || c.trigger || 'Reveal when its condition is met.');

  return `
    <div class="tf-card__inner">
      <div class="tf-card__shine" aria-hidden="true"></div>
      <header class="tf-card__header">
        <span class="tf-card__cost">${escapeHtml(c.cost ?? 0)}</span>
        <div class="tf-card__title-wrap">
          <span class="tf-card__type">${template === 'creature' ? 'Creature' : template === 'cast' ? 'Cast Verse' : 'Set Verse'}</span>
          <span class="tf-card__name">${escapeHtml(c.name)}</span>
        </div>
      </header>
      <div class="tf-card__art"><pre>${escapeHtml(c.art)}</pre></div>
      <div class="tf-card__rules">
        <span class="tf-card__ability-name">${escapeHtml(abilityName)}</span>
        <span class="tf-card__ability-text">${escapeHtml(rulesText)}</span>
      </div>
      ${isCreature ? `
        <div class="tf-card__hp-bar" aria-hidden="true"><span class="${low.trim()}" style="width:${Math.max(0, Math.min(100, hpPct))}%"></span></div>
        <footer class="tf-card__stats">
          <span class="tf-card__stat tf-card__stat--attack">ATK ${formatCombatStat(effectiveAtk)}</span>
          <span class="tf-card__stat tf-card__stat--health${low}">HP ${formatCombatStat(currentHp)}/${formatCombatStat(maxHp)}</span>
        </footer>
      ` : `
        <footer class="tf-card__verse-mark">${template === 'cast' ? 'Resolve' : 'Set'}</footer>
      `}
      ${effectBadges}
    </div>`;
}

// Set verse indicator HTML
export function renderSetVerse(verse, id, isPlayer = false) {
  if (!verse) {
    return `<div class="card-empty set-slot" id="${id}">NO SET</div>`;
  }
  const interaction = isPlayer
    ? ' onpointerdown="setVersePress()" onpointerup="setVerseRelease()" onpointerleave="setVerseRelease()"'
    : '';
  return `<div class="card-empty set-slot has-set tf-card tf-card--set tf-card--set-down" id="${id}"${interaction}>
    <div class="tf-card__set-back"><span>[SET]</span></div>
  </div>`;
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
  const modifierClass = atkInfo && atkInfo.effectiveAtk !== atkInfo.baseAtk
    ? (atkInfo.effectiveAtk > atkInfo.baseAtk ? ' atk-boosted' : ' atk-reduced')
    : '';
  const tooltip = atkInfo?.modifiers?.map(m => `${m.name}: +${m.value} (${m.desc})`).join('\\n') || '';
  return `<div class="card-active creature tf-card tf-card--creature tf-card--active${modifierClass}" title="${escapeHtml(tooltip)}" onpointerdown="cardPress('${escapeHtml(c.uid)}')" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    ${renderCardFace(c, { size: 'active', atkInfo, owner })}
  </div>`;
}

// Mini card for bench
// BUG-B2: Add hp-damaged class when bench creature is damaged
export function renderMiniCard(c) {
  return `<div class="card-mini tf-card tf-card--creature tf-card--mini" onpointerdown="cardPress('${escapeHtml(c.uid)}')" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    ${renderCardFace(c, { size: 'mini' })}
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
  const template = cardTemplate(c);
  const typeClass = template === 'creature' ? 'creature' : (template === 'cast' ? 'verse-cast' : 'verse-set');
  const layoutClass = vertical ? 'd-hand-card' : 'hand-card';
  return `<div class="${layoutClass} ${typeClass} ${sel} tf-card tf-card--${template} tf-card--hand" onclick="selectCard('${escapeHtml(c.uid)}', event)" onpointerdown="cardPress('${escapeHtml(c.uid)}', event)" onpointerup="cardRelease()" onpointerleave="cardRelease()">
    ${renderCardFace(c, { size: 'hand' })}
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
