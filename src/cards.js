/**
 * Card Database - Client Re-export
 * 
 * Simply re-exports all cards from the shared module.
 * The shared module is the single source of truth for card data.
 */

export { 
  CREATURES, 
  VERSES, 
  DECKS,
  getCreature,
  getVerse,
  getDeck
} from '../shared/cards.js';
