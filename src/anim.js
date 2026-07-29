import { $ } from './state.js';
import { createTargetRegistry } from './presentation/dom/target-registry.js';

// ═══════════════════════════════════════════════════════════════
// ANIMATION SYSTEM
// ═══════════════════════════════════════════════════════════════

// Shell-aware semantic targeting (plan Phase 4 acceptance): board targets
// resolve against the active shell only, so animation never plays into the
// hidden duplicate tree. The registry is rebuilt if the global document
// changes (unit tests swap DOM stand-ins between cases).
let cachedRegistry = null;
let cachedRegistryDocument = null;

function targetRegistry() {
  const doc = globalThis.document;
  if (!cachedRegistry || cachedRegistryDocument !== doc) {
    cachedRegistry = createTargetRegistry({ document: doc });
    cachedRegistryDocument = doc;
  }
  return cachedRegistry;
}

function semanticEl(name) {
  try {
    return targetRegistry().resolve(name) ?? null;
  } catch {
    return null;
  }
}

// Phase 10b: when the AAA shell is mounted, semantic card targets resolve to
// the chassis faces inside the shell (the face carries no transform, so the
// classic accent classes — shake/flash/ko — apply without fighting the
// homography on the wrapper). Classic resolution is untouched otherwise.
function aaaShellActive() {
  const doc = globalThis.document;
  return doc?.documentElement?.dataset?.presentation === 'aaa'
    && Boolean(doc.querySelector?.('#aaa-stage .aaa-frame'));
}

function aaaTarget(selector) {
  return globalThis.document?.querySelector?.(`#aaa-stage ${selector}`) ?? null;
}

// Animation timing constants (keep in sync with CSS)
export const ANIM_TIMING = {
  SHAKE: 600,
  LUNGE: 600,
  SUMMON: 500,
  KO: 400,
  FLASH: 300,
  VERSE_POPUP: 700,
  NEGATE: 500,
  FLOAT_TEXT: 800,
  ATTACK_SEQUENCE: 700, // coiled strike + hit reaction
  AI_PAUSE: 800,        // pause between AI actions for readability
  TRIGGER_REVEAL: 5000, // how long to show triggered set verse (doubled from 2500)
};

export const Anim = {
  // Cached element positions (set before state updates to preserve positions for animations)
  cachedPositions: {},
  
  // Add animation class, remove after duration. Returns promise.
  play(el, animClass, durationMs = 300) {
    return new Promise(resolve => {
      if (!el) { resolve(); return; }
      el.classList.add(animClass);
      setTimeout(() => {
        el.classList.remove(animClass);
        resolve();
      }, durationMs);
    });
  },
  
  // Play on element(s) matching selector
  playOn(selector, animClass, durationMs = 300) {
    document.querySelectorAll(selector).forEach(el => this.play(el, animClass, durationMs));
  },
  
  // Get visible element from selector (skips display:none elements)
  getVisibleElement(selector, index = 0) {
    const elements = document.querySelectorAll(selector);
    let visibleCount = 0;
    for (const el of elements) {
      // Check if element or parent is visible
      if (el.offsetParent !== null || el.offsetWidth > 0) {
        if (visibleCount === index) return el;
        visibleCount++;
      }
    }
    // Fallback to first element
    return elements[index] || elements[0] || null;
  },
  
  // Get element center position (for caching before DOM changes)
  getElementCenter(selector) {
    return this.centerOf(this.getVisibleElement(selector));
  },

  centerOf(el) {
    if (!el || el.offsetParent === null) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  },

  // Active-shell semantic targets. Null when the slot is empty or the shell
  // is not mounted; play(null) is already a safe no-op.
  activeCardEl(side) {
    if (aaaShellActive()) {
      const key = side === 'me' ? 'me' : 'opp';
      return aaaTarget(`[data-anchor="${key}.active"] .tf-aaa-card`);
    }
    const container = semanticEl(side === 'me' ? 'me.active' : 'opp.active');
    return container?.querySelector?.('.card-active') ?? null;
  },

  lpEl(side) {
    if (aaaShellActive()) {
      return aaaTarget(side === 'me' || side === 'myLp' ? '#aaa-my-lp' : '#aaa-opp-lp');
    }
    return semanticEl(side === 'me' || side === 'myLp' ? 'me.life' : 'opp.life');
  },

  setSlotEl(side) {
    if (aaaShellActive()) {
      return aaaTarget(`[data-anchor="${side === 'me' ? 'me' : 'opp'}.set"] .tf-aaa-card`);
    }
    return semanticEl(side === 'me' ? 'me.set' : 'opp.set');
  },

  benchContainerEl(side) {
    // AAA has no bench container; per-card targets below cover the bench and
    // container-wide plays no-op safely (play(null) resolves immediately).
    if (aaaShellActive()) return null;
    return semanticEl(side === 'me' ? 'me.bench' : 'opp.bench');
  },

  benchCardEl(side, index) {
    if (aaaShellActive()) {
      const slot = index === 0 ? 'a' : 'b';
      return aaaTarget(`[data-anchor="${side === 'me' ? 'me' : 'opp'}.bench.${slot}"] .tf-aaa-card`);
    }
    const container = this.benchContainerEl(side);
    return container?.querySelector?.(`.card-mini:nth-child(${index + 1})`) ?? null;
  },

  benchCardEls(side) {
    if (aaaShellActive()) {
      return [this.benchCardEl(side, 0), this.benchCardEl(side, 1)].filter(Boolean);
    }
    const container = this.benchContainerEl(side);
    return container?.querySelectorAll
      ? [...container.querySelectorAll('.card-mini')]
      : [];
  },

  // Cache current positions of active creatures (call before state updates)
  cacheActivePositions() {
    this.cachedPositions = {
      me: this.centerOf(this.activeCardEl('me')),
      opp: this.centerOf(this.activeCardEl('opp')),
      myLp: this.centerOf(this.lpEl('me')),
      oppLp: this.centerOf(this.lpEl('opp'))
    };
  },

  // Get position for animation (cached or live)
  getAnimPosition(side) {
    return this.cachedPositions[side] || this.centerOf(
      side === 'me' || side === 'opp'
        ? this.activeCardEl(side)
        : this.lpEl(side === 'myLp' ? 'me' : 'opp')
    );
  },
  
  // Floating damage/heal number - accepts targetEl OR coords {x, y}
  floatText(text, type, targetElOrCoords) {
    const el = document.createElement('div');
    el.className = `float-text ${type}`;
    el.textContent = text;
    
    // Handle coordinate object directly (for cached positions)
    if (targetElOrCoords && typeof targetElOrCoords === 'object' && 'x' in targetElOrCoords) {
      el.style.left = targetElOrCoords.x + 'px';
      el.style.top = targetElOrCoords.y + 'px';
      el.style.transform = 'translate(-50%, -50%)';
    }
    // Handle DOM element
    else if (targetElOrCoords && targetElOrCoords.offsetParent !== null) {
      const rect = targetElOrCoords.getBoundingClientRect();
      el.style.left = rect.left + rect.width / 2 + 'px';
      el.style.top = rect.top + rect.height / 2 + 'px';
      el.style.transform = 'translate(-50%, -50%)';
    }
    // Fallback to center screen
    else {
      el.style.left = '50%';
      el.style.top = '40%';
      el.style.transform = 'translate(-50%, -50%)';
    }
    
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  },
  
  // Verse trigger popup - returns promise
  versePopup(verseName) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'verse-popup';
      el.innerHTML = `<div class="label">Set Verse Triggered</div><div class="name">${verseName}</div>`;
      document.body.appendChild(el);
      setTimeout(() => {
        el.remove();
        resolve();
      }, ANIM_TIMING.VERSE_POPUP);
    });
  },
  
  // Negate X - returns promise
  negateX() {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'negate-x';
      el.textContent = '✕';
      document.body.appendChild(el);
      setTimeout(() => {
        el.remove();
        resolve();
      }, ANIM_TIMING.NEGATE);
    });
  },
  
  // Get card element by creature uid
  getCardEl(creatureUid, side) {
    return this.activeCardEl(side);
  },

  // Attack animation sequence - returns promise that resolves when complete
  attack(attackerSide, defenderSide, damage) {
    return new Promise(resolve => {
      const defPos = this.getAnimPosition(defenderSide);

      // Lunge animation
      const lungeClass = attackerSide === 'me' ? 'anim-lunge-up' : 'anim-lunge-down';
      const atkEl = this.activeCardEl(attackerSide);
      const defEl = this.activeCardEl(defenderSide);

      this.play(atkEl, lungeClass, ANIM_TIMING.LUNGE + 50);

      // On hit (immediate)
      this.screenFlash('red');
      this.play(defEl, 'anim-shake', ANIM_TIMING.SHAKE + 100);
      this.play(defEl, 'anim-flash-red', ANIM_TIMING.FLASH);
      this.floatText(`-${damage}`, 'damage', defPos);

      // Resolve after full sequence
      setTimeout(resolve, ANIM_TIMING.ATTACK_SEQUENCE);
    });
  },

  // Direct attack animation (no defender) - returns promise
  attackDirect(attackerSide) {
    return new Promise(resolve => {
      const lungeClass = attackerSide === 'me' ? 'anim-lunge-up' : 'anim-lunge-down';
      this.play(this.activeCardEl(attackerSide), lungeClass, ANIM_TIMING.LUNGE + 50);

      // Screen flash immediate
      this.screenFlash('red');

      setTimeout(resolve, ANIM_TIMING.ATTACK_SEQUENCE);
    });
  },

  // Damage animation (non-combat) - returns promise
  damage(side, amount) {
    return new Promise(resolve => {
      const el = this.activeCardEl(side);
      const pos = this.getAnimPosition(side);
      // Same hit effects as attack: screen flash, tilt wobble, red flash
      this.screenFlash('red');
      this.play(el, 'anim-shake', ANIM_TIMING.SHAKE + 100);
      this.play(el, 'anim-flash-red', ANIM_TIMING.FLASH);
      this.floatText(`-${amount}`, 'damage', pos);
      setTimeout(resolve, ANIM_TIMING.SHAKE);
    });
  },

  // Bench damage animation - returns promise
  benchDamage(side, index, amount) {
    return new Promise(resolve => {
      const el = this.benchCardEl(side, index);
      this.play(el, 'anim-shake', ANIM_TIMING.SHAKE);
      this.play(el, 'anim-flash-red', ANIM_TIMING.FLASH);
      if (el) this.floatText(`-${amount}`, 'damage', el);
      setTimeout(resolve, ANIM_TIMING.SHAKE);
    });
  },

  // Heal animation - returns promise
  heal(side, amount) {
    return new Promise(resolve => {
      const pos = this.getAnimPosition(side);
      this.play(this.activeCardEl(side), 'anim-flash-green', ANIM_TIMING.FLASH);
      this.floatText(`+${amount}`, 'heal', pos);
      setTimeout(resolve, ANIM_TIMING.FLASH);
    });
  },

  // LP damage - returns promise (EXTRA DRAMATIC)
  lpDamage(side, amount) {
    return new Promise(resolve => {
      // Screen flash for LP hits
      this.screenFlash('red');
      const el = this.lpEl(side);
      const pos = this.getAnimPosition(side === 'me' ? 'myLp' : 'oppLp');
      this.play(el, 'anim-flash-red', ANIM_TIMING.FLASH + 100);
      this.play(el, 'anim-shake', ANIM_TIMING.SHAKE + 100);
      this.play(el, 'anim-pulse', ANIM_TIMING.FLASH);
      // Show hearts lost instead of number
      const hearts = '-' + '♥'.repeat(amount);
      this.floatText(hearts, 'damage', pos);
      setTimeout(resolve, ANIM_TIMING.SHAKE + 100);
    });
  },

  // LP heal - returns promise
  lpHeal(side, amount) {
    return new Promise(resolve => {
      const el = this.lpEl(side);
      this.play(el, 'anim-flash-green', ANIM_TIMING.FLASH);
      this.play(el, 'anim-pulse', ANIM_TIMING.FLASH);
      setTimeout(resolve, ANIM_TIMING.FLASH);
    });
  },

  // Summon animation (dramatic card slam) - returns promise
  summon(side) {
    return new Promise(resolve => {
      const el = this.activeCardEl(side);
      // Screen flash on summon
      this.screenFlash('gold');
      this.play(el, 'anim-summon', ANIM_TIMING.SUMMON + 100);
      this.play(el, 'anim-summon-glow', ANIM_TIMING.SUMMON + 200);
      this.floatText('SUMMON!', 'gold', el);
      setTimeout(resolve, ANIM_TIMING.SUMMON + 100);
    });
  },

  // Bench summon animation (smaller version for benched creatures)
  summonBench(side, index = 0) {
    return new Promise(resolve => {
      const els = this.benchCardEls(side);
      for (const mini of els) {
        this.play(mini, 'anim-summon-small', 400);
      }
      this.sparkBurst(els[index] ?? null);
      setTimeout(resolve, 400);
    });
  },

  // Set verse animation (glow on the SET indicator)
  setVerse(side) {
    const el = this.setSlotEl(side);
    this.play(el, 'anim-set-verse', 600);
    this.sparkBurst(el, 'purple'); // Purple stars for set verse
  },

  // Bench to active animation (creature enters the fray)
  benchToActive(side) {
    return new Promise(resolve => {
      this.play(this.activeCardEl(side), 'anim-enter-fray', 400);
      setTimeout(resolve, 400);
    });
  },
  
  // Particle burst - 3 stars of random sizes for "poof" effect
  sparkBurst(targetEl, color = 'gold') {
    if (!targetEl || targetEl.offsetParent === null) return;
    
    const rect = targetEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Create 3 stars with random offsets and sizes
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('div');
      star.className = `spark-particle spark-${color}`;
      star.textContent = '*';
      
      // Random offset from center (-15 to +15 px)
      const offsetX = (Math.random() - 0.5) * 30;
      const offsetY = (Math.random() - 0.5) * 30;
      
      // Random size (0.6 to 1.4 scale)
      const scale = 0.6 + Math.random() * 0.8;
      
      // Random delay (0 to 100ms)
      const delay = Math.random() * 100;
      
      star.style.left = centerX + offsetX + 'px';
      star.style.top = centerY + offsetY + 'px';
      star.style.fontSize = (16 * scale) + 'px';
      star.style.animationDelay = delay + 'ms';
      
      document.body.appendChild(star);
      setTimeout(() => star.remove(), 600 + delay);
    }
  },
  
  // KO animation - returns promise
  ko(side) {
    return new Promise(resolve => {
      const pos = this.getAnimPosition(side);
      this.play(this.activeCardEl(side), 'anim-ko', ANIM_TIMING.KO);
      this.floatText('KO!', 'ko', pos);
      setTimeout(resolve, ANIM_TIMING.KO);
    });
  },

  // Bench KO animation - returns promise
  benchKo(side, index) {
    return new Promise(resolve => {
      const el = this.benchCardEl(side, index);
      this.play(el, 'anim-ko', ANIM_TIMING.KO);
      if (el) this.floatText('KO!', 'ko', el);
      setTimeout(resolve, ANIM_TIMING.KO);
    });
  },
  
  // Cast verse - returns promise
  castVerse(side = 'me') {
    return new Promise(resolve => {
      const pos = this.getAnimPosition(side);
      this.floatText('✦ CAST ✦', 'gold', pos);
      this.screenFlash('gold');
      setTimeout(resolve, 300);
    });
  },
  
  // Mana pips are a desktop-shell affordance: resolve semantically, then
  // animate only when the active shell actually renders pips. This keeps
  // classic behavior identical on both shells without touching hidden trees.
  manaPipContainer() {
    const el = semanticEl('me.mana');
    return el && el.id === 'd-mana-pips' ? el : null;
  },

  // Mana spend
  manaSpend(amount) {
    const pips = this.manaPipContainer();
    const pip = pips?.querySelector?.('.d-mana-pip.filled:last-of-type') ?? null;
    this.play(pip, 'anim-flash-blue', 200);
  },

  // Mana gain - returns promise
  manaGain() {
    return new Promise(resolve => {
      this.play(this.manaPipContainer(), 'anim-pulse', ANIM_TIMING.FLASH);
      setTimeout(resolve, ANIM_TIMING.FLASH);
    });
  },

  // Poison tick - returns promise
  poisonTick(side) {
    return new Promise(resolve => {
      const pos = this.getAnimPosition(side);
      this.play(this.activeCardEl(side), 'anim-poison', 500);
      this.floatText('-10', 'damage', pos); // Red like regular damage
      setTimeout(resolve, 500);
    });
  },
  
  // Wait helper - use to sequence animations
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Screen flash for impact
  screenFlash(color = 'red') {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 1000;
    `;
    overlay.className = `screen-flash-${color}`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 400);
  }
};
