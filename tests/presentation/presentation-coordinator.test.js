import { describe, expect, it, vi } from 'vitest';
import { createPresentationCoordinator } from '../../src/presentation/presentation-coordinator.js';
import { detectCapabilities } from '../../src/presentation/capabilities.js';
import { createTargetRegistry, SEMANTIC_TARGET_NAMES } from '../../src/presentation/dom/target-registry.js';
import { matrix3dForQuad, projectRectCorners } from '../../src/presentation/dom/quad-transform.js';

function fakeDocument(ids = {}) {
  return {
    getElementById(id) {
      return ids[id] ?? null;
    },
  };
}

describe('capabilities', () => {
  it('selects static tier without webgl and never throws', () => {
    const caps = detectCapabilities({
      window: {},
      navigator: {},
      document: { createElement: () => ({ getContext: () => null }) },
    });
    expect(caps.webgl).toBe(false);
    expect(caps.qualityTier).toBe('static');
    expect(caps.webglReason).toBe('context-create-failed');
  });

  it('honors the forced-off escape hatch', () => {
    const caps = detectCapabilities({
      window: { __TINY_FANGS_FORCE_NO_WEBGL__: true },
      document: { createElement: () => ({ getContext: () => ({}) }) },
    });
    expect(caps.qualityTier).toBe('static');
    expect(caps.webglReason).toBe('forced-off');
  });

  it('selects desktop-high with webgl and no constraints', () => {
    const caps = detectCapabilities({
      window: {},
      navigator: {},
      document: { createElement: () => ({ getContext: () => ({}) }) },
    });
    expect(caps.qualityTier).toBe('desktop-high');
  });
});

describe('target registry', () => {
  it('resolves every semantic name against the classic desktop shell', () => {
    const desktop = { style: { display: 'flex' } };
    const registry = createTargetRegistry({
      document: fakeDocument({ desktop }),
    });
    for (const name of SEMANTIC_TARGET_NAMES) {
      expect(() => registry.resolve(name)).not.toThrow();
    }
  });

  it('rejects unknown names and prefers explicit registrations', () => {
    const desktop = { style: { display: 'flex' } };
    const el = { isConnected: true };
    const registry = createTargetRegistry({ document: fakeDocument({ desktop }) });
    expect(() => registry.resolve('me.nonsense')).toThrow(/Unknown semantic target/);
    registry.registerElement('me.active', el);
    expect(registry.resolve('me.active')).toBe(el);
    registry.unregisterElement('me.active');
    expect(registry.resolve('me.active')).toBeNull();
  });

  it('resolves bench targets by container child index', () => {
    const child0 = { tag: 'c0' };
    const child1 = { tag: 'c1' };
    const registry = createTargetRegistry({
      document: fakeDocument({
        desktop: { style: { display: 'flex' } },
        'd-my-bench': { children: [child0, child1] },
      }),
    });
    expect(registry.resolve('me.bench.0')).toBe(child0);
    expect(registry.resolve('me.bench.1')).toBe(child1);
  });
});

describe('presentation coordinator', () => {
  const staticCaps = Object.freeze({ webgl: false, qualityTier: 'static' });

  it('is idempotent for identical projected state', () => {
    const updates = [];
    const coordinator = createPresentationCoordinator({
      window: {},
      document: fakeDocument(),
      capabilities: { webgl: true, qualityTier: 'desktop-high' },
      createScene: () => ({ update: (s) => updates.push(s), dispose: () => {} }),
    });
    coordinator.mount({});
    const state = { turn: 3, myTurn: true, me: { lp: 3, bench: [] }, opp: { lp: 2, bench: [] } };
    coordinator.update(state);
    coordinator.update(JSON.parse(JSON.stringify(state)));
    expect(updates).toHaveLength(1);
  });

  it('stores no mutable engine references', () => {
    let seen;
    const coordinator = createPresentationCoordinator({
      window: {},
      document: fakeDocument(),
      capabilities: { webgl: true, qualityTier: 'desktop-high' },
      createScene: () => ({ update: (s) => { seen = s; }, dispose: () => {} }),
    });
    coordinator.mount({});
    const card = { uid: 'u1', id: 'shellkin', hp: 20, maxHp: 20 };
    const state = { me: { active: card, bench: [] }, opp: { bench: [] } };
    coordinator.update(state);
    expect(seen.me.active).not.toBe(card);
    card.hp = 5;
    expect(seen.me.active.hp).toBe(20);
  });

  it('contains scene failure and downgrades to static without throwing', () => {
    const onSceneError = vi.fn();
    const coordinator = createPresentationCoordinator({
      window: {},
      document: fakeDocument(),
      capabilities: { webgl: true, qualityTier: 'desktop-high' },
      createScene: () => ({
        update: () => {
          throw new Error('shader boom');
        },
        dispose: () => {},
      }),
      onSceneError,
    });
    coordinator.mount({});
    expect(() => coordinator.update({ me: { bench: [] }, opp: { bench: [] } })).not.toThrow();
    expect(onSceneError).toHaveBeenCalledOnce();
    expect(coordinator.capabilities().qualityTier).toBe('static');
  });

  it('does not create a scene in static tier and dispose is complete and re-entrant', () => {
    const createScene = vi.fn();
    const coordinator = createPresentationCoordinator({
      window: {},
      document: fakeDocument(),
      capabilities: staticCaps,
      createScene,
    });
    coordinator.mount({});
    expect(createScene).not.toHaveBeenCalled();
    coordinator.dispose();
    coordinator.dispose();
    expect(coordinator.isMounted()).toBe(false);
  });

  it('disposes the scene and listeners on dispose', () => {
    const dispose = vi.fn();
    const listeners = new Map();
    const win = {
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type) => listeners.delete(type),
      document: { addEventListener: () => {}, removeEventListener: () => {} },
    };
    const coordinator = createPresentationCoordinator({
      window: win,
      document: fakeDocument(),
      capabilities: { webgl: true, qualityTier: 'desktop-high' },
      createScene: () => ({ update: () => {}, dispose }),
    });
    coordinator.mount({});
    expect(listeners.has('resize')).toBe(true);
    coordinator.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(listeners.has('resize')).toBe(false);
  });
});

describe('quad transform', () => {
  it('round-trips a rectangle exactly', () => {
    const corners = [[100, 50], [300, 50], [300, 350], [100, 350]];
    const projected = projectRectCorners(200, 300, corners);
    projected.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(corners[i][0], 6);
      expect(p[1]).toBeCloseTo(corners[i][1], 6);
    });
  });

  it('maps a trapezoid within numeric tolerance', () => {
    const corners = [[110, 40], [290, 44], [305, 352], [95, 348]];
    const projected = projectRectCorners(200, 300, corners);
    projected.forEach((p, i) => {
      expect(Math.hypot(p[0] - corners[i][0], p[1] - corners[i][1])).toBeLessThan(1e-6);
    });
    expect(matrix3dForQuad(200, 300, corners)).toMatch(/^matrix3d\(/);
  });
});
