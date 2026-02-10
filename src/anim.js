import { $ } from './state.js';

// ═══════════════════════════════════════════════════════════════
// ANIMATION SYSTEM
// ═══════════════════════════════════════════════════════════════

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
    const el = this.getVisibleElement(selector);
    if (!el || el.offsetParent === null) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  },
  
  // Cache current positions of active creatures (call before state updates)
  cacheActivePositions() {
    this.cachedPositions = {
      me: this.getElementCenter('#m-my-active .card-active, #d-my-active .card-active'),
      opp: this.getElementCenter('#m-opp-active .card-active, #d-opp-active .card-active'),
      myLp: this.getElementCenter('#m-my-lp, #d-my-lp'),
      oppLp: this.getElementCenter('#m-opp-lp, #d-opp-lp')
    };
  },
  
  // Get position for animation (cached or live)
  getAnimPosition(side) {
    return this.cachedPositions[side] || this.getElementCenter(
      side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : 
      side === 'opp' ? '#m-opp-active .card-active, #d-opp-active .card-active' :
      side === 'myLp' ? '#m-my-lp, #d-my-lp' :
      '#m-opp-lp, #d-opp-lp'
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
    // Try to find VISIBLE card in active
    const selector = side === 'me' 
      ? '#m-my-active .card-active, #d-my-active .card-active' 
      : '#m-opp-active .card-active, #d-opp-active .card-active';
    return this.getVisibleElement(selector);
  },
  
  // Attack animation sequence - returns promise that resolves when complete
  attack(attackerSide, defenderSide, damage) {
    return new Promise(resolve => {
      const defPos = this.getAnimPosition(defenderSide);
      
      // Lunge animation
      const lungeClass = attackerSide === 'me' ? 'anim-lunge-up' : 'anim-lunge-down';
      const atkSelector = attackerSide === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      const defSelector = defenderSide === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      
      this.playOn(atkSelector, lungeClass, ANIM_TIMING.LUNGE + 50);
      
      // On hit (immediate)
      this.screenFlash('red');
      this.playOn(defSelector, 'anim-shake', ANIM_TIMING.SHAKE + 100);
      this.playOn(defSelector, 'anim-flash-red', ANIM_TIMING.FLASH);
      this.floatText(`-${damage}`, 'damage', defPos);
      
      // Resolve after full sequence
      setTimeout(resolve, ANIM_TIMING.ATTACK_SEQUENCE);
    });
  },
  
  // Direct attack animation (no defender) - returns promise
  attackDirect(attackerSide) {
    return new Promise(resolve => {
      const lungeClass = attackerSide === 'me' ? 'anim-lunge-up' : 'anim-lunge-down';
      const atkSelector = attackerSide === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      
      this.playOn(atkSelector, lungeClass, ANIM_TIMING.LUNGE + 50);
      
      // Screen flash immediate
      this.screenFlash('red');
      
      setTimeout(resolve, ANIM_TIMING.ATTACK_SEQUENCE);
    });
  },
  
  // Damage animation (non-combat) - returns promise
  damage(side, amount) {
    return new Promise(resolve => {
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      const pos = this.getAnimPosition(side);
      // Same hit effects as attack: screen flash, tilt wobble, red flash
      this.screenFlash('red');
      this.playOn(selector, 'anim-shake', ANIM_TIMING.SHAKE + 100);
      this.playOn(selector, 'anim-flash-red', ANIM_TIMING.FLASH);
      this.floatText(`-${amount}`, 'damage', pos);
      setTimeout(resolve, ANIM_TIMING.SHAKE);
    });
  },
  
  // Bench damage animation - returns promise
  benchDamage(side, index, amount) {
    return new Promise(resolve => {
      const mobileSelector = side === 'me' 
        ? `#m-my-bench .card-mini:nth-child(${index + 1})` 
        : `#m-opp-bench .card-mini:nth-child(${index + 1})`;
      const desktopSelector = side === 'me'
        ? `#d-my-bench .card-mini:nth-child(${index + 1})`
        : `#d-opp-bench .card-mini:nth-child(${index + 1})`;
      const selector = `${mobileSelector}, ${desktopSelector}`;
      
      this.playOn(selector, 'anim-shake', ANIM_TIMING.SHAKE);
      this.playOn(selector, 'anim-flash-red', ANIM_TIMING.FLASH);
      const el = this.getVisibleElement(selector);
      if (el) this.floatText(`-${amount}`, 'damage', el);
      setTimeout(resolve, ANIM_TIMING.SHAKE);
    });
  },

  // Heal animation - returns promise
  heal(side, amount) {
    return new Promise(resolve => {
      const pos = this.getAnimPosition(side);
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      this.playOn(selector, 'anim-flash-green', ANIM_TIMING.FLASH);
      this.floatText(`+${amount}`, 'heal', pos);
      setTimeout(resolve, ANIM_TIMING.FLASH);
    });
  },
  
  // LP damage - returns promise (EXTRA DRAMATIC)
  lpDamage(side, amount) {
    return new Promise(resolve => {
      // Screen flash for LP hits
      this.screenFlash('red');
      const selector = side === 'me' ? '#m-my-lp, #d-my-lp' : '#m-opp-lp, #d-opp-lp';
      const pos = this.getAnimPosition(side === 'me' ? 'myLp' : 'oppLp');
      this.playOn(selector, 'anim-flash-red', ANIM_TIMING.FLASH + 100);
      this.playOn(selector, 'anim-shake', ANIM_TIMING.SHAKE + 100);
      this.playOn(selector, 'anim-pulse', ANIM_TIMING.FLASH);
      // Show hearts lost instead of number
      const hearts = '-' + '♥'.repeat(amount);
      this.floatText(hearts, 'damage', pos);
      setTimeout(resolve, ANIM_TIMING.SHAKE + 100);
    });
  },
  
  // LP heal - returns promise
  lpHeal(side, amount) {
    return new Promise(resolve => {
      const selector = side === 'me' ? '#m-my-lp, #d-my-lp' : '#m-opp-lp, #d-opp-lp';
      this.playOn(selector, 'anim-flash-green', ANIM_TIMING.FLASH);
      this.playOn(selector, 'anim-pulse', ANIM_TIMING.FLASH);
      setTimeout(resolve, ANIM_TIMING.FLASH);
    });
  },
  
  // Summon animation (dramatic card slam) - returns promise
  summon(side) {
    return new Promise(resolve => {
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      // Screen flash on summon
      this.screenFlash('gold');
      this.playOn(selector, 'anim-summon', ANIM_TIMING.SUMMON + 100);
      this.playOn(selector, 'anim-summon-glow', ANIM_TIMING.SUMMON + 200);
      // Find VISIBLE element (mobile or desktop)
      const el = this.getVisibleElement(selector);
      this.floatText('SUMMON!', 'gold', el);
      setTimeout(resolve, ANIM_TIMING.SUMMON + 100);
    });
  },
  
  // Bench summon animation (smaller version for benched creatures)
  summonBench(side, index = 0) {
    return new Promise(resolve => {
      const mobileSelector = side === 'me' ? '#m-my-bench .card-mini' : '#m-opp-bench .card-mini';
      const desktopSelector = side === 'me' ? '#d-my-bench .card-mini' : '#d-opp-bench .card-mini';
      const selector = `${mobileSelector}, ${desktopSelector}`;
      this.playOn(selector, 'anim-summon-small', 400);
      const el = this.getVisibleElement(selector, index);
      this.sparkBurst(el);
      setTimeout(resolve, 400);
    });
  },
  
  // Set verse animation (glow on the SET indicator)
  setVerse(side) {
    const selector = side === 'me' 
      ? '#m-my-set, #d-my-set' 
      : '#m-opp-set, #d-opp-set';
    this.playOn(selector, 'anim-set-verse', 600);
    const el = this.getVisibleElement(selector);
    this.sparkBurst(el, 'purple'); // Purple stars for set verse
  },
  
  // Bench to active animation (creature enters the fray)
  benchToActive(side) {
    return new Promise(resolve => {
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      this.playOn(selector, 'anim-enter-fray', 400);
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
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      this.playOn(selector, 'anim-ko', ANIM_TIMING.KO);
      this.floatText('KO!', 'ko', pos);
      setTimeout(resolve, ANIM_TIMING.KO);
    });
  },
  
  // Bench KO animation - returns promise
  benchKo(side, index) {
    return new Promise(resolve => {
      const mobileSelector = side === 'me' 
        ? `#m-my-bench .card-mini:nth-child(${index + 1})` 
        : `#m-opp-bench .card-mini:nth-child(${index + 1})`;
      const desktopSelector = side === 'me'
        ? `#d-my-bench .card-mini:nth-child(${index + 1})`
        : `#d-opp-bench .card-mini:nth-child(${index + 1})`;
      const selector = `${mobileSelector}, ${desktopSelector}`;
      
      this.playOn(selector, 'anim-ko', ANIM_TIMING.KO);
      const el = this.getVisibleElement(selector);
      if (el) this.floatText('KO!', 'ko', el);
      setTimeout(resolve, ANIM_TIMING.KO);
    });
  },
  
  // Cast verse - returns promise
  castVerse() {
    return new Promise(resolve => {
      this.floatText('*', 'gold', null);
      setTimeout(resolve, 200);
    });
  },
  
  // Mana spend
  manaSpend(amount) {
    this.playOn('#d-mana-pips .d-mana-pip.filled:last-of-type', 'anim-flash-blue', 200);
  },
  
  // Mana gain - returns promise
  manaGain() {
    return new Promise(resolve => {
      this.playOn('#d-mana-pips', 'anim-pulse', ANIM_TIMING.FLASH);
      setTimeout(resolve, ANIM_TIMING.FLASH);
    });
  },
  
  // Poison tick - returns promise
  poisonTick(side) {
    return new Promise(resolve => {
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      const pos = this.getAnimPosition(side);
      this.playOn(selector, 'anim-poison', 500);
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
