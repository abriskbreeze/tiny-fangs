import { describe, expect, it, vi } from 'vitest';
import {
  VISUAL_READY_GLOBAL,
  createVisualReadinessController,
} from '../../src/presentation/testing/visual-readiness.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('visual readiness controller', () => {
  it('uses the exact public readiness global and starts false', () => {
    const target = {};
    const controller = createVisualReadinessController({
      target,
      fonts: { ready: Promise.resolve() },
      nextFrame: () => Promise.resolve(),
    });

    expect(VISUAL_READY_GLOBAL).toBe('__TINY_FANGS_VISUAL_READY__');
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(false);
    expect(controller.isReady()).toBe(false);
  });

  it('waits for registered work, fonts, and exactly two settled frames', async () => {
    const target = {};
    const asset = deferred();
    const fonts = deferred();
    const events = [];
    const nextFrame = vi.fn(async () => {
      events.push('frame');
    });
    const controller = createVisualReadinessController({
      target,
      fonts: { ready: fonts.promise.then(() => events.push('fonts')) },
      nextFrame,
    });

    controller.register(asset.promise.then(() => events.push('asset')));
    const ready = controller.waitUntilReady();

    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(false);
    asset.resolve();
    await Promise.resolve();
    expect(events).toEqual(['asset']);
    fonts.resolve();

    await expect(ready).resolves.toBe(true);
    expect(events).toEqual(['asset', 'fonts', 'frame', 'frame']);
    expect(nextFrame).toHaveBeenCalledTimes(2);
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(true);
  });

  it.each(['fixture', 'viewport', 'quality', 'route'])(
    'returns to false on a %s reset',
    async (reason) => {
      const target = {};
      const controller = createVisualReadinessController({
        target,
        fonts: { ready: Promise.resolve() },
        nextFrame: () => Promise.resolve(),
      });

      await controller.waitUntilReady();
      expect(target.__TINY_FANGS_VISUAL_READY__).toBe(true);

      controller.reset(reason);

      expect(target.__TINY_FANGS_VISUAL_READY__).toBe(false);
      expect(controller.isReady()).toBe(false);
      expect(controller.lastResetReason()).toBe(reason);
    },
  );

  it('does not publish stale readiness when a reset happens mid-flight', async () => {
    const target = {};
    const firstFrame = deferred();
    let frameCount = 0;
    const controller = createVisualReadinessController({
      target,
      fonts: { ready: Promise.resolve() },
      nextFrame: () => {
        frameCount += 1;
        return frameCount === 1 ? firstFrame.promise : Promise.resolve();
      },
    });

    const staleAttempt = controller.waitUntilReady();
    await Promise.resolve();
    await Promise.resolve();
    controller.reset('viewport');
    firstFrame.resolve();

    await expect(staleAttempt).resolves.toBe(false);
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(false);

    await expect(controller.waitUntilReady()).resolves.toBe(true);
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(true);
  });

  it('keeps readiness false when registered work rejects', async () => {
    const target = {};
    const controller = createVisualReadinessController({
      target,
      fonts: { ready: Promise.resolve() },
      nextFrame: () => Promise.resolve(),
    });
    const error = new Error('texture failed');

    controller.register(Promise.reject(error));

    await expect(controller.waitUntilReady()).rejects.toBe(error);
    expect(target.__TINY_FANGS_VISUAL_READY__).toBe(false);
  });

  it('rejects unsupported reset reasons', () => {
    const controller = createVisualReadinessController({
      target: {},
      fonts: { ready: Promise.resolve() },
      nextFrame: () => Promise.resolve(),
    });

    expect(() => controller.reset('animation')).toThrow(
      'Unknown visual readiness reset reason: animation',
    );
  });
});
