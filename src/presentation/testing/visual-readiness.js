export const VISUAL_READY_GLOBAL = '__TINY_FANGS_VISUAL_READY__';

const RESET_REASONS = new Set([
  'fixture',
  'viewport',
  'quality',
  'route',
]);

function browserTarget() {
  return globalThis.window ?? globalThis;
}

function defaultNextFrame(target) {
  if (typeof target.requestAnimationFrame === 'function') {
    return () => new Promise((resolve) => {
      target.requestAnimationFrame(() => resolve());
    });
  }

  return () => new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function createVisualReadinessController(options = {}) {
  const target = options.target ?? browserTarget();
  const fonts = options.fonts ?? target.document?.fonts ?? { ready: Promise.resolve() };
  const nextFrame = options.nextFrame ?? defaultNextFrame(target);
  let generation = 0;
  let lastReset = null;
  let registered = [];

  function setReady(value) {
    target[VISUAL_READY_GLOBAL] = value;
  }

  setReady(false);

  return Object.freeze({
    register(promise) {
      generation += 1;
      setReady(false);
      const registeredPromise = Promise.resolve(promise);
      registered.push(registeredPromise);
      return registeredPromise;
    },

    reset(reason) {
      if (!RESET_REASONS.has(reason)) {
        throw new Error(`Unknown visual readiness reset reason: ${reason}`);
      }

      generation += 1;
      registered = [];
      lastReset = reason;
      setReady(false);
    },

    async waitUntilReady() {
      const attempt = generation;
      setReady(false);

      try {
        await Promise.all([...registered]);
        if (attempt !== generation) return false;

        await Promise.resolve(fonts.ready);
        if (attempt !== generation) return false;

        await nextFrame();
        if (attempt !== generation) return false;

        await nextFrame();
        if (attempt !== generation) return false;

        setReady(true);
        return true;
      } catch (error) {
        if (attempt === generation) {
          setReady(false);
        }
        throw error;
      }
    },

    isReady() {
      return target[VISUAL_READY_GLOBAL] === true;
    },

    lastResetReason() {
      return lastReset;
    },
  });
}
