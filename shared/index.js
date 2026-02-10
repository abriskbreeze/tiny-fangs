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
  // Main action handler
  executeAction,
  
  // Core operations
  createGame,
  attack,
  summon,
  castVerse,
  setVerse,
  retreat,
  endTurn,
  
  // Special actions
  skitterSwap,
  skitterDecline,
  respondOptionalTrigger,
  
  // Helpers
  draw,
  applyDamage,
  autoSwapBenchToActive,
  getEffectiveAtk,
  resolveSelection,
  
  // Card creation
  mkCreature,
  mkVerse,
  mkDeck,
  mkPlayer
} from './engine.js';
