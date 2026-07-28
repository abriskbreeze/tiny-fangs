// Semantic target registry (plan Phase 3). Resolves stable semantic names —
// `me.active`, `opp.bench.1`, `me.life` — to live DOM elements so event
// playback and motion never depend on brittle CSS selector lists. Resolution
// is lazy (queried per call, never cached across renders) because the classic
// shell still rebuilds subtrees; a missing target resolves to null and the
// caller's Anim facade already treats null as a safe no-op.
//
// The registry is shell-aware: the classic desktop shell uses `d-*` ids and
// the classic mobile shell `m-*`; the future AAA shell registers its own
// elements explicitly through `registerElement`, which always wins over id
// lookup. Multiplayer compatibility is by construction: names are
// side-relative (`me`/`opp`), exactly like the engine's projected state.

// Maps a semantic name to per-shell resolution: either a direct element id or
// { container, index } meaning the Nth element child of the container.
const CLASSIC_MAP = {
  'me.active': { desktop: 'd-my-active', mobile: 'm-my-active' },
  'me.bench': { desktop: 'd-my-bench', mobile: 'm-my-bench' },
  'me.bench.0': {
    desktop: { container: 'd-my-bench', index: 0 },
    mobile: { container: 'm-my-bench', index: 0 },
  },
  'me.bench.1': {
    desktop: { container: 'd-my-bench', index: 1 },
    mobile: { container: 'm-my-bench', index: 1 },
  },
  'me.set': { desktop: 'd-my-set', mobile: 'm-my-set' },
  'me.deck': { desktop: 'd-deck', mobile: 'm-deck' },
  'me.grave': { desktop: 'd-grave', mobile: 'm-my-grave-slot' },
  'me.hand': { desktop: 'd-hand', mobile: 'm-hand' },
  'me.life': { desktop: 'd-my-lp', mobile: 'm-my-lp' },
  'me.mana': { desktop: 'd-mana-pips', mobile: 'm-my-mana' },
  'opp.active': { desktop: 'd-opp-active', mobile: 'm-opp-active' },
  'opp.bench': { desktop: 'd-opp-bench', mobile: 'm-opp-bench' },
  'opp.bench.0': {
    desktop: { container: 'd-opp-bench', index: 0 },
    mobile: { container: 'm-opp-bench', index: 0 },
  },
  'opp.bench.1': {
    desktop: { container: 'd-opp-bench', index: 1 },
    mobile: { container: 'm-opp-bench', index: 1 },
  },
  'opp.set': { desktop: 'd-opp-set', mobile: 'm-opp-set' },
  'opp.deck': { desktop: 'd-opp-deck', mobile: 'm-opp-deck' },
  'opp.grave': { desktop: 'd-opp-grave', mobile: 'm-opp-grave-slot' },
  'opp.hand': { desktop: 'd-opp-hand', mobile: 'm-opp-hand' },
  'opp.life': { desktop: 'd-opp-lp', mobile: 'm-opp-lp' },
  'opp.mana': { desktop: 'd-opp-mana-pips', mobile: 'm-opp-mana' },
  'ui.log': { desktop: 'd-log', mobile: 'm-log' },
  'ui.turn': { desktop: 'd-turn', mobile: 'm-turn' },
  'ui.timer': { desktop: 'd-time', mobile: 'm-time' },
  'action.summon': { desktop: 'd-btn-summon', mobile: 'm-btn-summon' },
  'action.cast': { desktop: 'd-btn-cast', mobile: 'm-btn-cast' },
  'action.set': { desktop: 'd-btn-set', mobile: 'm-btn-set' },
  'action.attack': { desktop: 'd-btn-atk', mobile: 'm-btn-atk' },
  'action.retreat': { desktop: 'd-btn-retreat', mobile: 'm-btn-retreat' },
  'action.endTurn': { desktop: 'd-btn-end', mobile: 'm-btn-end' },
};

export const SEMANTIC_TARGET_NAMES = Object.freeze(Object.keys(CLASSIC_MAP));

export function createTargetRegistry(options = {}) {
  const doc = options.document ?? globalThis.document;
  const explicit = new Map();

  function activeShell() {
    // The effective shell is whichever classic container is actually visible;
    // ties resolve to desktop, matching the shell-selection contract.
    const desktop = doc.getElementById('desktop');
    const mobile = doc.getElementById('mobile');
    const visible = (el) => {
      if (!el) return false;
      if (el.style.display === 'none') return false;
      if (typeof getComputedStyle === 'function') {
        try {
          return getComputedStyle(el).display !== 'none';
        } catch {
          return el.style.display !== 'none';
        }
      }
      return true;
    };
    if (visible(desktop)) return 'desktop';
    if (visible(mobile)) return 'mobile';
    return 'desktop';
  }

  function resolveEntry(entry) {
    if (typeof entry === 'string') {
      return doc.getElementById(entry) ?? null;
    }
    const container = doc.getElementById(entry.container);
    if (!container) return null;
    return container.children[entry.index] ?? container;
  }

  return Object.freeze({
    registerElement(name, element) {
      if (!CLASSIC_MAP[name]) {
        throw new Error(`Unknown semantic target: ${name}`);
      }
      explicit.set(name, element);
    },

    unregisterElement(name) {
      explicit.delete(name);
    },

    resolve(name) {
      const entry = CLASSIC_MAP[name];
      if (!entry) {
        throw new Error(`Unknown semantic target: ${name}`);
      }
      const registered = explicit.get(name);
      if (registered && registered.isConnected !== false) return registered;
      return resolveEntry(entry[activeShell()]);
    },

    names() {
      return SEMANTIC_TARGET_NAMES;
    },
  });
}
