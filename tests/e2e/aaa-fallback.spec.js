import { expect, test } from '@playwright/test';

// RSP-07 — when WebGL is unavailable, the aaa presentation must downgrade to
// the fully playable classic renderer instead of leaving a dead screen (the
// aaa CSS hides the classic shells, so the flag itself must flip back).

test.use({ viewport: { width: 1672, height: 941 } });

test('aaa downgrades to playable classic when WebGL is unavailable', async ({ context, page }) => {
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patched(type, ...rest) {
      if (typeof type === 'string' && type.includes('webgl')) return null;
      return original.call(this, type, ...rest);
    };
    // Deterministic coin: first draw 0.1 => heads => the player wins the toss.
    let cursor = 0;
    let seed = 0x54464e47;
    Math.random = () => {
      if (cursor === 0) { cursor += 1; return 0.1; }
      seed = (seed + 0x6d2b79f5) | 0;
      let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
      cursor += 1;
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
    };
  });
  await page.clock.install({ time: new Date('2026-07-27T12:00:00.000Z') });

  await page.goto('/?presentation=aaa');
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));

  // Start a solo game through the setup flow.
  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: /\bShadow\b/ }).first().click();
  await page.locator('#modal-opts .option').filter({ hasText: /\bShadow\b/ }).first().click();
  await page.locator('#modal-opts .option').filter({ hasText: /HEADS/ }).first().click();
  await page.clock.runFor(1_780);
  await page.locator('#modal-opts .option').filter({ hasText: /Go First/ }).first().click();
  await page.clock.runFor(3_400);

  // The scene mount fails => the flag downgrades and classic is PLAYABLE.
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'classic', { timeout: 15_000 });
  await expect(page.locator('#desktop')).toBeVisible();
  await expect(page.locator('#aaa-stage')).toBeHidden();

  // Playability probe: the classic End Turn hold dispatches a real turn.
  const before = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return { myTurn: state.G.myTurn, turn: state.G.turn };
  });
  expect(before.myTurn).toBe(true);
  const endButton = page.locator('#d-btn-end');
  await expect(endButton).toBeEnabled();
  await endButton.dispatchEvent('pointerdown', { pointerId: 1 });
  await page.clock.runFor(600);
  await endButton.dispatchEvent('pointerup', { pointerId: 1 });
  await page.clock.runFor(30_000);
  await expect
    .poll(() => page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G.winner !== null || state.G.turn >= 2 || state.G.myTurn === false;
    }))
    .toBe(true);
});
