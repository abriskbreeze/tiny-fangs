import { $ } from './state.js';

// ═══════════════════════════════════════════════════════════════
// ANIMATION SYSTEM
// ═══════════════════════════════════════════════════════════════

// Animation timing constants (keep in sync with CSS)
export const ANIM_TIMING = {
  SHAKE: 300,
  LUNGE: 300,
  SUMMON: 500,
  KO: 400,
  FLASH: 300,
  VERSE_POPUP: 700,
  NEGATE: 500,
  FLOAT_TEXT: 800,
  ATTACK_SEQUENCE: 450, // lunge + hit
  AI_PAUSE: 1000,       // pause between AI actions for readability
  TRIGGER_REVEAL: 5000, // how long to show triggered set verse (doubled from 2500)
};

export const Anim = {
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
  
  // Floating damage/heal number
  floatText(text, type, targetEl) {
    const el = document.createElement('div');
    el.className = `float-text ${type}`;
    el.textContent = text;
    
    // Position near target or center screen
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      el.style.left = rect.left + rect.width / 2 + 'px';
      el.style.top = rect.top + rect.height / 3 + 'px';
    } else {
      el.style.left = '50%';
      el.style.top = '40%';
      el.style.transform = 'translateX(-50%)';
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
    // Try to find in active or bench
    const prefix = side === 'me' ? ['m-my-active', 'd-my-active'] : ['m-opp-active', 'd-opp-active'];
    for (const id of prefix) {
      const container = $(id);
      if (container) {
        const card = container.querySelector('.card-active, .card-mini');
        if (card) return card;
      }
    }
    return null;
  },
  
  // Attack animation sequence - returns promise that resolves when complete
  attack(attackerSide, defenderSide, damage) {
    return new Promise(resolve => {
      const defEl = this.getCardEl(null, defenderSide);
      
      // Lunge animation
      const lungeClass = attackerSide === 'me' ? 'anim-lunge-up' : 'anim-lunge-down';
      const atkSelector = attackerSide === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      const defSelector = defenderSide === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      
      this.playOn(atkSelector, lungeClass, ANIM_TIMING.LUNGE + 50);
      
      // On hit (after lunge peaks)
      setTimeout(() => {
        // Screen flash for impact
        this.screenFlash('red');
        // Shake defender
        this.playOn(defSelector, 'anim-shake', ANIM_TIMING.SHAKE + 100);
        this.playOn(defSelector, 'anim-flash-red', ANIM_TIMING.FLASH);
        // Floating damage
        this.floatText(`-${damage}`, 'damage', defEl);
      }, 140);
      
      // Resolve after full sequence
      setTimeout(resolve, ANIM_TIMING.ATTACK_SEQUENCE);
    });
  },
  
  // Damage animation (non-combat) - returns promise
  damage(side, amount, targetEl) {
    return new Promise(resolve => {
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      this.playOn(selector, 'anim-shake', ANIM_TIMING.SHAKE);
      this.floatText(`-${amount}`, 'damage', targetEl || this.getCardEl(null, side));
      setTimeout(resolve, ANIM_TIMING.SHAKE);
    });
  },
  
  // Heal animation - returns promise
  heal(side, amount) {
    return new Promise(resolve => {
      const el = this.getCardEl(null, side);
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      this.playOn(selector, 'anim-flash-green', ANIM_TIMING.FLASH);
      this.floatText(`+${amount}`, 'heal', el);
      setTimeout(resolve, ANIM_TIMING.FLASH);
    });
  },
  
  // LP damage - returns promise (EXTRA DRAMATIC)
  lpDamage(side, amount) {
    return new Promise(resolve => {
      // Screen flash for LP hits
      this.screenFlash('red');
      const selector = side === 'me' ? '#m-my-lp, #d-my-lp' : '#m-opp-lp, #d-opp-lp';
      this.playOn(selector, 'anim-flash-red', ANIM_TIMING.FLASH + 100);
      this.playOn(selector, 'anim-shake', ANIM_TIMING.SHAKE + 100);
      this.playOn(selector, 'anim-pulse', ANIM_TIMING.FLASH);
      const el = document.querySelector(selector);
      this.floatText(`-${amount}`, 'damage', el);
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
      const el = document.querySelector(selector);
      this.floatText('SUMMON!', 'gold', el);
      setTimeout(resolve, ANIM_TIMING.SUMMON + 100);
    });
  },
  
  // KO animation - returns promise
  ko(side) {
    return new Promise(resolve => {
      const el = this.getCardEl(null, side);
      const selector = side === 'me' ? '#m-my-active .card-active, #d-my-active .card-active' : '#m-opp-active .card-active, #d-opp-active .card-active';
      this.playOn(selector, 'anim-ko', ANIM_TIMING.KO);
      this.floatText('KO!', 'ko', el);
      setTimeout(resolve, ANIM_TIMING.KO);
    });
  },
  
  // Cast verse - returns promise
  castVerse() {
    return new Promise(resolve => {
      this.floatText('✦', 'gold', null);
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
      this.playOn(selector, 'anim-poison', 500);
      const el = this.getCardEl(null, side);
      this.floatText('-10', 'heal', el);
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
