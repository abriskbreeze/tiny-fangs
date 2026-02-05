/**
 * Game Event System
 * Enables declarative triggers for set verses and creature abilities
 * 
 * Event types:
 * - beforeAttack: Before attack resolves
 * - afterAttack: After attack damage
 * - beforeDamage: Before any damage applied
 * - afterDamage: After damage applied
 * - onKO: When creature is KO'd
 * - onSummon: When creature enters play
 * - onCast: When cast verse played
 * - turnStart: At turn beginning
 * - turnEnd: At turn end
 */

const GameEvents = {
  listeners: {},

  /**
   * Register a listener for an event
   * @param {string} event - Event name
   * @param {function} callback - Handler function (receives context)
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push({ callback, once: false });
  },

  /**
   * Register a one-time listener
   * @param {string} event - Event name
   * @param {function} callback - Handler function
   */
  once(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push({ callback, once: true });
  },

  /**
   * Remove a specific listener
   * @param {string} event - Event name
   * @param {function} callback - Handler to remove
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(
      listener => listener.callback !== callback
    );
  },

  /**
   * Emit an event to all listeners
   * @param {string} event - Event name
   * @param {object} context - Event context data
   */
  async emit(event, context) {
    const handlers = this.listeners[event];
    if (!handlers || handlers.length === 0) return;

    // Process handlers in order, awaiting each
    const toRemove = [];
    for (const handler of handlers) {
      await handler.callback(context);
      if (handler.once) {
        toRemove.push(handler);
      }
    }

    // Remove one-time listeners
    for (const handler of toRemove) {
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
  },

  /**
   * Remove all listeners
   */
  clear() {
    this.listeners = {};
  }
};

// Export for ES modules (tests)
export { GameEvents };

// Attach to window for browser
if (typeof window !== 'undefined') {
  window.GameEvents = GameEvents;
}
