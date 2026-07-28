/**
 * Event playback — translates shared-engine events into Anim / log calls.
 */
import { sideKey } from './side-key.js';

/**
 * @param {object} deps
 * @param {object} deps.Anim
 * @param {function} deps.log
 * @param {object} deps.VERSES
 * @param {object} deps.CREATURES
 */
export function createEventPlayback({ Anim, log, VERSES, CREATURES }) {
  function resolveBenchSide(event) {
    const side = sideKey(event.side ?? event.animKey);
    return side === 'me' || side === 'opp' ? side : null;
  }

  function resolveBenchIndex(event) {
    const index = event.benchIndex ?? event.benchIdx ?? event.index;
    return Number.isInteger(index) && index >= 0 ? index : null;
  }

  function playSemanticBench(side, animations, duration) {
    if (!side) return Promise.resolve();

    // Active-shell bench container via the semantic registry; hidden
    // duplicate trees are never animated (plan Phase 4 acceptance).
    const container = typeof Anim.benchContainerEl === 'function'
      ? Anim.benchContainerEl(side)
      : null;
    if (container && typeof Anim.play === 'function') {
      for (const [animation, animationDuration] of animations) {
        Anim.play(container, animation, animationDuration);
      }
    }
    return typeof Anim.wait === 'function'
      ? Anim.wait(duration)
      : Promise.resolve();
  }

  const EVENT_HANDLERS = {
    summon: (e) => {
      if (e.slot === 'bench') {
        return Anim.summonBench(sideKey(e.side), e.benchIdx || 0);
      }
      return Anim.summon(sideKey(e.side));
    },
    summonBench: (e) => Anim.summonBench(sideKey(e.side), e.benchIdx || 0),

    damage: async (e) => {
      await Anim.damage(sideKey(e.side), e.amount);
      if (e.source) {
        log(`${e.source}: ${e.amount} damage`, 'dmg');
      }
    },
    benchDamage: (e) => {
      const side = resolveBenchSide(e);
      const index = resolveBenchIndex(e);
      if (side && index !== null && typeof Anim.benchDamage === 'function') {
        return Anim.benchDamage(side, index, e.amount);
      }
      return playSemanticBench(
        side,
        [['anim-shake', 600], ['anim-flash-red', 300]],
        600,
      );
    },
    lpDamage: async (e) => {
      // Prefer absolute engine side (p1/p2); fall back to client animKey
      const side = e.side != null ? sideKey(e.side) : e.animKey;
      await Anim.lpDamage(side, e.amount);
      log('Direct hit! Lost a life!', 'dmg');
    },

    attack: async (e) => {
      const attackerSide = sideKey(e.side);
      const defenderSide = attackerSide === 'me' ? 'opp' : 'me';
      if (e.direct) {
        await Anim.attackDirect(attackerSide);
      } else {
        await Anim.attack(attackerSide, defenderSide, e.damage);
      }
    },

    ko: async (e) => {
      await Anim.ko(sideKey(e.side));
      log(`${e.creature} KO'd!`, 'dmg');
    },
    benchKo: (e) => {
      const side = resolveBenchSide(e);
      const index = resolveBenchIndex(e);
      if (side && index !== null && typeof Anim.benchKo === 'function') {
        return Anim.benchKo(side, index);
      }
      return playSemanticBench(side, [['anim-ko', 400]], 400);
    },

    heal: async (e) => {
      await Anim.heal(sideKey(e.side), e.amount);
      log(`Healed ${e.amount} HP!`, 'heal');
    },

    manaGain: () => Anim.manaGain(),

    retreat: (e) => Anim.benchToActive(sideKey(e.side)),
    swap: () => Promise.resolve(),
    benchToActive: async (e) => {
      await Anim.benchToActive(sideKey(e.side));
      if (e.creature) {
        log(`${e.creature} moved to active!`);
      }
    },

    setVerse: async (e) => {
      Anim.setVerse(sideKey(e.side));
      if (sideKey(e.side) === 'me' && typeof window.showSetReveal === 'function') {
        await window.showSetReveal();
      }
    },
    cast: async (e) => {
      const verse = Object.values(VERSES).find(v => v.name === e.verse)
        || { name: e.verse, text: '' };
      await Anim.castVerse(sideKey(e.side));
      if (typeof window.showCastReveal === 'function') {
        await window.showCastReveal(verse);
      }
    },
    triggerVerse: async (e) => {
      const verse = Object.values(VERSES).find(v => v.name === e.verse)
        || { name: e.verse, text: '', trigger: '' };
      if (typeof window.showTriggerReveal === 'function') {
        await window.showTriggerReveal(verse);
      }
    },

    abilityTrigger: async (e) => {
      if (e.creature && typeof window.showTriggerReveal === 'function') {
        const creature = Object.values(CREATURES).find(c => c.name === e.creature)
          || { name: e.creature, ability: { name: e.ability, text: '' } };
        await window.showTriggerReveal(creature);
      }
      log(`${e.creature}'s ${e.ability}!`, 'mana');
    },

    setStatus: async (e) => {
      const el = typeof Anim.activeCardEl === 'function'
        ? Anim.activeCardEl(sideKey(e.side))
        : null;
      if (e.status === 'poison') {
        Anim.play(el, 'anim-poison', 600);
        log('Poisoned!', 'dmg');
      } else if (e.status === 'trapped') {
        Anim.play(el, 'anim-trapped', 600);
        log('Trapped!', 'dmg');
      }
      return Anim.wait(400);
    },
    clearStatus: () => Promise.resolve(),

    damageReduced: (e) => {
      log(`${e.source}! -${e.amount} damage`, 'heal');
      return Promise.resolve();
    },
    damageNegated: (e) => {
      const pos = Anim.getAnimPosition(sideKey(e.side));
      Anim.floatText('BLOCKED!', 'gold', pos);
      return Anim.negateX();
    },
    atkBonus: () => Promise.resolve(),
    survival: (e) => {
      const pos = Anim.getAnimPosition(sideKey(e.side));
      Anim.floatText('SURVIVES!', 'gold', pos);
      log(`${e.creature} survives at ${e.hp} HP!`, 'heal');
      return Anim.wait(400);
    },

    draw: () => Promise.resolve(),
    discard: () => Promise.resolve(),
    graveReturn: () => Promise.resolve(),
    sacrifice: (e) => Anim.ko(sideKey(e.side)),
    banish: (e) => Anim.ko(sideKey(e.side)),

    setFlag: () => Promise.resolve(),
    turnStart: () => Promise.resolve(),
    gameOver: () => Promise.resolve(),

    skitterSwap: () => Promise.resolve(),
    skitterDecline: () => Promise.resolve(),
    optionalTrigger: () => Promise.resolve(),
    triggerDeclined: () => Promise.resolve(),
  };

  function getEventHandler(event) {
    return Object.prototype.hasOwnProperty.call(EVENT_HANDLERS, event?.type)
      ? EVENT_HANDLERS[event.type]
      : null;
  }

  function safeEventType(event) {
    return getEventHandler(event) ? event.type : 'unknown';
  }

  function summarizeDebugEvent(event) {
    const amount = Number.isFinite(event?.amount) ? `(${event.amount})` : '';
    const sourceTag = event?.source == null ? '' : '[source]';
    return `${safeEventType(event)}${amount}${sourceTag}`;
  }

  function isDebugEnabled() {
    return globalThis.localStorage?.getItem('tinyFangsDebug') === '1';
  }

  async function playEvents(events) {
    if (!events || events.length === 0) return;

    for (const event of events) {
      const handler = getEventHandler(event);
      if (handler) {
        try {
          await handler(event);
        } catch {
          console.error(`Error playing event ${safeEventType(event)}`);
        }
      } else {
        console.warn('Unknown event type');
      }
      await Anim.wait(50);
    }
  }

  async function playServerEvents(events) {
    const debugEnabled = isDebugEnabled();
    if (debugEnabled) {
      console.log(
        '[DEBUG] Playing events:',
        events.map(summarizeDebugEvent),
      );
    }
    for (const e of events) {
      const handler = getEventHandler(e);
      if (handler) {
        try {
          await handler(e);
        } catch {
          console.error(`Error playing event ${safeEventType(e)}`);
        }
      } else if (debugEnabled) {
        console.log('[DEBUG] Unknown event type');
      }
      await Anim.wait(50);
    }
  }

  return { sideKey, EVENT_HANDLERS, playEvents, playServerEvents };
}
