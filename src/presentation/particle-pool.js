// Phase 10c — pooled event particles for the AAA shell. A fixed-size pool of
// DOM sparks reused across bursts: no allocation churn, a hard cap on live
// nodes, pointer-events none throughout (no hit-target drift), and no effect
// on layout (absolute nodes in a dedicated layer). Reduced motion disables
// bursts entirely — particles are pure garnish, never state communication.

const KIND_PALETTES = {
  summon: ['#F5D783', '#EEC34E', '#FFF6E2'],
  ko: ['#8f2f2a', '#54492F', '#B47015'],
  damage: ['#8f2f2a', '#EEC34E'],
  heal: ['#74a05e', '#F5D783', '#FFF6E2'],
};

export function createParticlePool({
  document: doc = globalThis.document,
  layer,
  max = 48,
  random = Math.random,
  reducedMotion = null,
} = {}) {
  const pool = [];
  const live = new Set();

  function isReduced() {
    if (typeof reducedMotion === 'function') return reducedMotion();
    try {
      return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    } catch {
      return false;
    }
  }

  function obtain() {
    const idle = pool.find((p) => !live.has(p));
    if (idle) return idle;
    if (pool.length >= max) return null;
    const node = doc.createElement('div');
    node.className = 'aaa-particle';
    node.style.pointerEvents = 'none';
    pool.push(node);
    return node;
  }

  /**
   * Burst up to `count` particles from a viewport-space origin. Frame-space
   * conversion is the caller's job (the shell passes frame coordinates).
   */
  function burst({ x, y, count = 10, kind = 'summon', spreadPx = 90, durationMs = 620 }) {
    if (!layer || isReduced()) return 0;
    const palette = KIND_PALETTES[kind] ?? KIND_PALETTES.summon;
    let fired = 0;
    for (let i = 0; i < count; i++) {
      const node = obtain();
      if (!node) break;
      live.add(node);
      fired += 1;
      const angle = random() * Math.PI * 2;
      const distance = (0.35 + random() * 0.65) * spreadPx;
      const size = 3 + random() * 5;
      node.style.background = palette[Math.floor(random() * palette.length) % palette.length];
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.opacity = '1';
      node.style.transition = 'none';
      node.style.transform = 'translate(0px, 0px) scale(1)';
      node.classList.add('aaa-particle--live');
      layer.appendChild(node);
      // Two-phase: commit start, then transition outward and fade.
      void node.offsetWidth;
      node.style.transition =
        `transform ${durationMs}ms cubic-bezier(0.16, 0.8, 0.35, 1), opacity ${durationMs}ms linear`;
      node.style.transform =
        `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance - 18}px) scale(0.25)`;
      node.style.opacity = '0';
      const release = () => {
        node.classList.remove('aaa-particle--live');
        node.remove();
        live.delete(node);
      };
      globalThis.setTimeout(release, durationMs + 60);
    }
    return fired;
  }

  return Object.freeze({
    burst,
    get liveCount() { return live.size; },
    get poolSize() { return pool.length; },
    max,
  });
}
