/**
 * Declarative on-KO / survival hooks for creatures.
 * Keeps attack() free of per-creature ID switches where card data can drive behavior.
 */
import { CREATURES } from './cards.js';

function abilityOf(creature) {
  return creature?.ability || CREATURES[creature?.id]?.ability || null;
}

/**
 * Try once-per-game lethal survival (Bulwark Fortress, etc.)
 * @returns {boolean} true if KO was prevented
 */
export function tryLethalSurvival(defender, events, side) {
  if (!defender) return false;
  const ability = abilityOf(defender);
  if (ability?.trigger?.event !== 'onLethalDamage') return false;

  const flag = ability.trigger.condition?.notUsed || 'fortressUsed';
  if (defender[flag] || defender.bulwarkUsed) return false;

  const setHp = ability.effects?.find(e => e.type === 'setHP');
  const hp = setHp?.amount ?? 1;

  defender.curHp = hp;
  defender[flag] = true;
  defender.bulwarkUsed = true; // legacy alias used by endTurn resets

  events.push({
    type: 'abilityTrigger',
    side,
    creature: defender.name,
    ability: ability.name || 'Fortress'
  });
  events.push({ type: 'survival', side, creature: defender.name, hp });
  return true;
}

/**
 * Whether damaged (non-KO) creature may offer a free bench swap (Skitter Scurry).
 */
export function canOfferDamageSwap(defender, owner) {
  if (!defender || !owner?.bench?.length) return false;
  const ability = abilityOf(defender);
  return ability?.name === 'Scurry' ||
    (ability?.trigger?.event === 'afterDamage' && ability?.effects?.some(e => e.type === 'swapWithBench'));
}

/**
 * Apply self-onKO creature abilities after a creature hits the grave.
 *
 * @param {object} args
 * @param {object} args.koedCreature
 * @param {object} args.koOwner - owner of the KO'd creature
 * @param {object} args.opponent - opposing player (relative to koOwner)
 * @param {object|null} args.attacker - creature that caused the KO (may be null)
 * @param {string} args.koSide - 'p1'|'p2' for koOwner
 * @param {string} args.oppSide - opposing side key
 * @param {Array} args.events - mutate
 * @param {function} args.applyDamage - (creature, amount) => ko?
 * @param {function} args.prepareForGrave
 * @param {function} args.checkTriggers
 * @returns {{ pendingAction: object|null, attackerDied: boolean }}
 */
export function applyCreatureOnKOAbilities({
  koedCreature,
  koOwner,
  opponent,
  attacker,
  koSide,
  oppSide,
  events,
  applyDamage,
  prepareForGrave,
  checkTriggers
}) {
  let pendingAction = null;
  let attackerDied = false;
  const ability = abilityOf(koedCreature);
  if (!ability) return { pendingAction, attackerDied };

  const isSelfOnKO =
    ability.trigger?.event === 'onKO' &&
    ability.trigger?.condition?.target === 'self';

  // --- Declarative onKO effects (Echomask, Stormtalon, Gloom-style) ---
  if (isSelfOnKO) {
    for (const effect of ability.effects || []) {
      if (effect.type === 'loseLifeOpp') {
        const amount = effect.count || 1;
        const lifeTrigger = checkTriggers(
          'onLifeLoss',
          { amount, targetSide: oppSide },
          koOwner,
          opponent,
          koSide,
          oppSide
        );
        events.push(...lifeTrigger.events);
        if (!lifeTrigger.negated) {
          opponent.lp -= amount;
          events.push({
            type: 'abilityTrigger',
            side: koSide,
            creature: koedCreature.name,
            ability: ability.name
          });
          events.push({ type: 'lpDamage', side: oppSide, amount });
        }
      }

      if (effect.type === 'setFlag' && effect.flag === 'chainLightning') {
        // Card says target: 'opp' — the player who KO'd Stormtalon gets the flag
        const flagOwner = effect.target === 'opp' ? opponent : koOwner;
        const flagSide = effect.target === 'opp' ? oppSide : koSide;
        flagOwner.chainLightning = effect.value ?? 20;
        events.push({
          type: 'abilityTrigger',
          side: koSide,
          creature: koedCreature.name,
          ability: ability.name
        });
        events.push({
          type: 'setFlag',
          side: flagSide,
          flag: 'chainLightning',
          value: flagOwner.chainLightning
        });
      }

      if (effect.type === 'discard') {
        // Handled by existing processEffects path in attack() for Gloom;
        // leave a hook for future unification.
      }
    }
  }

  // --- Death recoil (Titanback Juggernaut) ---
  const recoil = ability.proceduralDeathRecoil;
  if (recoil && attacker && opponent.active && opponent.active.uid === attacker.uid) {
    const recoilKo = applyDamage(attacker, recoil);
    events.push({
      type: 'abilityTrigger',
      side: koSide,
      creature: koedCreature.name,
      ability: ability.name || 'Juggernaut'
    });
    events.push({
      type: 'damage',
      side: oppSide,
      amount: recoil,
      source: ability.name || 'Juggernaut'
    });

    if (recoilKo) {
      attackerDied = true;
      events.push({ type: 'ko', side: oppSide, creature: attacker.name });
      prepareForGrave(attacker);
      opponent.grave.push(attacker);
      opponent.active = null;
      // Match prior attack() behavior: no auto-swap here; caller may continue

      const atkKoTrigger = checkTriggers(
        'onKO',
        { koedCreature: attacker, koOwnerSide: oppSide },
        opponent,
        koOwner,
        oppSide,
        koSide
      );
      events.push(...atkKoTrigger.events);
      if (atkKoTrigger.pendingAction) pendingAction = atkKoTrigger.pendingAction;

      const atkAllyKoTrigger = checkTriggers(
        'onAllyKO',
        { koedCreature: attacker, koOwnerSide: oppSide },
        opponent,
        koOwner,
        oppSide,
        koSide
      );
      events.push(...atkAllyKoTrigger.events);
      if (!pendingAction && atkAllyKoTrigger.pendingAction) {
        pendingAction = atkAllyKoTrigger.pendingAction;
      }
    }
  }

  return { pendingAction, attackerDied };
}
