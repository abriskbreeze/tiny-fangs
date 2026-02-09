// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

let uidCounter = 0;

/**
 * Generate unique ID for cards
 */
export function uid() {
  return `card_${Date.now()}_${uidCounter++}`;
}

/**
 * Shuffle array in place (Fisher-Yates)
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
