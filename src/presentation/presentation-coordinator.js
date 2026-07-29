// PresentationCoordinator (plan Phase 3). Owns the optional scene lifecycle
// behind the game: mount, idempotent state updates, and complete disposal.
// It never becomes a rules authority — `update` receives already-projected
// state, deep-snapshots what it needs, and stores no mutable engine object
// references. Scene failure can never block gameplay: every scene call is
// wrapped, and a failure downgrades to the static tier.

import { detectCapabilities } from './capabilities.js';
import { createTargetRegistry } from './dom/target-registry.js';

function snapshotCard(card) {
  if (!card) return null;
  return {
    uid: card.uid ?? null,
    presentationFaceId: card.presentationFaceId ?? card.id ?? null,
    hp: card.hp ?? null,
    maxHp: card.maxHp ?? null,
    atk: card.atk ?? null,
    poison: Boolean(card.poison),
    trapped: Boolean(card.trapped),
    fortified: Boolean(card.fortified),
  };
}

function snapshotSide(side) {
  if (!side) return null;
  return {
    lp: side.lp ?? null,
    mana: side.mana ?? null,
    maxMana: side.maxMana ?? null,
    active: snapshotCard(side.active),
    bench: (side.bench ?? []).map(snapshotCard),
    setPresent: Boolean(side.setVerse),
    deckCount: side.deckCount ?? side.deck?.length ?? 0,
    graveCount: side.grave?.length ?? side.graveCount ?? 0,
    handCount: side.handCount ?? side.hand?.length ?? 0,
  };
}

export function createPresentationCoordinator(options = {}) {
  const win = options.window ?? globalThis.window;
  const registry = options.targetRegistry ?? createTargetRegistry({
    document: options.document ?? win?.document,
  });
  const createScene = options.createScene ?? null;

  let capabilities = null;
  let scene = null;
  let mounted = false;
  let lastSnapshot = null;
  let disposers = [];

  function safeScene(method, ...args) {
    if (!scene || typeof scene[method] !== 'function') return undefined;
    try {
      return scene[method](...args);
    } catch (error) {
      // Scene errors are contained: log through the optional hook, tear the
      // scene down, and continue in static mode. Gameplay is never blocked.
      options.onSceneError?.(error);
      try {
        scene.dispose?.();
      } catch {
        /* disposal best-effort during failure */
      }
      scene = null;
      capabilities = { ...capabilities, qualityTier: 'static' };
      return undefined;
    }
  }

  return Object.freeze({
    mount(container) {
      if (mounted) return capabilities;
      capabilities = options.capabilities ?? detectCapabilities({ window: win });
      mounted = true;
      if (capabilities.qualityTier !== 'static' && createScene) {
        try {
          scene = createScene({ container, capabilities, registry });
        } catch (error) {
          options.onSceneError?.(error);
          scene = null;
          capabilities = { ...capabilities, qualityTier: 'static' };
        }
      }
      if (win?.addEventListener && scene) {
        const onResize = () => safeScene('resize');
        win.addEventListener('resize', onResize);
        disposers.push(() => win.removeEventListener('resize', onResize));
        const onVisibility = () => safeScene(
          win.document?.hidden ? 'suspend' : 'resume',
        );
        win.document?.addEventListener('visibilitychange', onVisibility);
        disposers.push(() => win.document?.removeEventListener('visibilitychange', onVisibility));
      }
      return capabilities;
    },

    // Idempotent: the same projected state produces the same snapshot and a
    // second call with it is a no-op for the scene.
    update(nextState) {
      if (!mounted) return null;
      const snapshot = nextState
        ? {
          turn: nextState.turn ?? null,
          myTurn: Boolean(nextState.myTurn),
          winner: nextState.winner ?? null,
          me: snapshotSide(nextState.me),
          opp: snapshotSide(nextState.opp),
        }
        : null;
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastSnapshot) return snapshot;
      lastSnapshot = serialized;
      safeScene('update', snapshot);
      return snapshot;
    },

    resolveTarget(name) {
      return registry.resolve(name);
    },

    capabilities() {
      return capabilities;
    },

    isMounted() {
      return mounted;
    },

    dispose() {
      if (!mounted) return;
      for (const disposer of disposers) {
        try {
          disposer();
        } catch {
          /* best-effort */
        }
      }
      disposers = [];
      try {
        scene?.dispose?.();
      } catch {
        /* best-effort */
      }
      scene = null;
      lastSnapshot = null;
      mounted = false;
    },
  });
}
