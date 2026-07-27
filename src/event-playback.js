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
    lpDamage: async (e) => {
      await Anim.lpDamage(sideKey(e.side), e.amount);
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
      const selector = sideKey(e.side) === 'me'
        ? '#m-my-active .card-active, #d-opp-active .card-active'
        : '#m-opp-active .card-active, #d-opp-active .card-active';
      if (e.status === 'poison') {
        Anim.playOn(selector, 'anim-poison', 600);
        log('Poisoned!', 'dmg');
      } else if (e.status === 'trapped') {
        Anim.playOn(selector, 'anim-trapped', 600);
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

  async function playEvents(events) {
    if (!events || events.length === 0) return;

    for (const event of events) {
      const handler = EVENT_HANDLERS[event.type];
      if (handler) {
        try {
          await handler(event);
        } catch (err) {
          console.error(`Error playing event ${event.type}:`, err);
        }
      } else {
        console.warn(`Unknown event type: ${event.type}`, event);
      }
      await Anim.wait(50);
    }
  }

  async function playServerEvents(events) {
    if (localStorage.getItem('tinyFangsDebug')) {
      console.log('[DEBUG] Playing events:', events.map(e =>
        `${e.type}${e.amount ? `(${e.amount})` : ''}${e.source ? `[${e.source}]` : ''}`
      ));
    }
    for (const e of events) {
      const handler = EVENT_HANDLERS[e.type];
      if (handler) {
        try {
          await handler(e);
        } catch (err) {
          console.error(`Error playing event ${e.type}:`, err);
        }
      } else if (localStorage.getItem('tinyFangsDebug')) {
        console.log('Unknown event:', e.type);
      }
      await Anim.wait(50);
    }
  }

  return { sideKey, EVENT_HANDLERS, playEvents, playServerEvents };
}
