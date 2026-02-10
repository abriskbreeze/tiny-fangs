/**
 * Shared Game Logic Module
 * Single source of truth for Tiny Fangs game rules
 * Used by both client (browser) and server (Node.js)
 */

// Card definitions
export { CREATURES, VERSES, DECKS } from './cards.js';

// Effects system
export { Effects, processEffects, resolveTarget, evalCondition } from './effects.js';

// Trigger system
export { 
  getTriggerPriority, 
  matchesTrigger, 
  findMatchingTriggers, 
  sortByPriority 
} from './triggers.js';

// Game engine
export {
  createGame,
  attack,
  summon,
  castVerse,
  setVerse,
  endTurn,
  draw,
  mkCreature,
  mkVerse,
  mkDeck,
  mkPlayer,
  applyDamage,
  autoSwapBenchToActive,
  getEffectiveAtk,
  checkCondition,
  resolveSelection
} from './engine.js';
