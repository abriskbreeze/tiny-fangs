import { expect, test } from '@playwright/test';

// Phase 13 — adaptive quality tiers and the explicit user override.
//
// Proves the three things a tier has to actually do on the shipping path:
//   1. `?quality=desktop-low` really reduces renderer/DOM work.
//   2. The HUD chip cycles the tier, persists it, and survives a reload.
//   3. `?quality=static` lands in playable classic through the existing
//      RSP-07 downgrade contract (no second fallback mechanism).

const COIN_FLIP_DURATION_MS = 1_780;
const BEGIN_DURATION_MS = 1_330;

async function installDeterministicBrowser(context, page) {
  await context.addInitScript(() => {
    // First draw 0.1 => heads => the player wins the toss, on every load.
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
}

function modalOption(page, label) {
  return page.locator('#modal-opts .option').filter({ hasText: new RegExp(label) }).first();
}

async function startSoloGameGoingFirst(page, url, pauseAt = '2026-07-27T12:01:00.000Z') {
  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(new Date(pauseAt));

  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: /\bShadow\b/ }).first().click();
  await modalOption(page, '\\bShadow\\b').click();
  await modalOption(page, 'HEADS').click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, 'Go First').click();
  await page.clock.runFor(BEGIN_DURATION_MS);
  await page.clock.runFor(2_000);
  await expect
    .poll(() => page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G?.myTurn ?? null;
    }))
    .toBe(true);
}

const readQuality = (page) => page.evaluate(() => window.__tfAaaQuality ?? null);

// Every board card mounts one shadow node per active shadow layer, so the
// ratio is an exact, tier-visible DOM consequence of the light-spill toggle.
async function shadowsPerCard(page) {
  return page.evaluate(() => {
    const cards = document.querySelectorAll('.aaa-card-layer .board-card').length;
    const shadows = document.querySelectorAll('.aaa-shadow-layer .card-shadow').length;
    return { cards, shadows, ratio: cards ? shadows / cards : null };
  });
}

test('?quality=desktop-low reduces renderer, particle, and shadow work', async ({ context, page }) => {
  await installDeterministicBrowser(context, page);
  await startSoloGameGoingFirst(page, '/?presentation=aaa&quality=desktop-low');

  await expect(page.locator('#aaa-stage .aaa-frame')).toHaveAttribute('data-quality', 'desktop-low');
  expect(await readQuality(page)).toEqual({
    tier: 'desktop-low',
    antialias: false,
    particleMax: 16,
    lightSpill: false,
  });

  const low = await shadowsPerCard(page);
  expect(low.cards).toBeGreaterThan(0);
  expect(low.ratio).toBe(2); // grounding core + tail, no warm light spill

  await expect(page.locator('#aaa-quality')).toHaveText('Quality: Low');
  await expect(page.locator('#aaa-quality')).toHaveAttribute('data-quality', 'desktop-low');
});

test('desktop-high is the default and keeps the full budget', async ({ context, page }) => {
  await installDeterministicBrowser(context, page);
  await startSoloGameGoingFirst(page, '/?presentation=aaa');

  await expect(page.locator('#aaa-stage .aaa-frame')).toHaveAttribute('data-quality', 'desktop-high');
  expect(await readQuality(page)).toEqual({
    tier: 'desktop-high',
    antialias: true,
    particleMax: 48,
    lightSpill: true,
  });

  const high = await shadowsPerCard(page);
  expect(high.cards).toBeGreaterThan(0);
  expect(high.ratio).toBe(3); // core + tail + warm light spill
});

test('the HUD quality chip cycles the tier and persists it across a reload', async ({ context, page }) => {
  await installDeterministicBrowser(context, page);
  await startSoloGameGoingFirst(page, '/?presentation=aaa');

  const chip = page.locator('#aaa-quality');
  await expect(chip).toHaveText('Quality: High');
  await expect(chip).toHaveAttribute('aria-label', /High/);

  // Cycling rebuilds the shell in place: the game is untouched, the tier is not.
  await chip.click();
  await expect(page.locator('#aaa-stage .aaa-frame')).toHaveAttribute('data-quality', 'desktop-low');
  await expect(page.locator('#aaa-quality')).toHaveText('Quality: Low');
  expect((await readQuality(page)).particleMax).toBe(16);
  expect(await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.myTurn;
  })).toBe(true);

  expect(await page.evaluate(() => localStorage.getItem('tinyFangs.presentation.quality')))
    .toBe('desktop-low');

  // Reload with no query override: the persisted pick is what comes back.
  // The fake clock keeps running across the navigation, so pause forward.
  await startSoloGameGoingFirst(page, '/?presentation=aaa', '2026-07-27T12:10:00.000Z');
  await expect(page.locator('#aaa-stage .aaa-frame')).toHaveAttribute('data-quality', 'desktop-low');
  await expect(page.locator('#aaa-quality')).toHaveText('Quality: Low');
  expect((await readQuality(page)).antialias).toBe(false);
});

test('?quality=static lands in playable classic via the RSP-07 downgrade', async ({ context, page }) => {
  await installDeterministicBrowser(context, page);
  await page.goto('/?presentation=aaa&quality=static');
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));

  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: /\bShadow\b/ }).first().click();
  await modalOption(page, '\\bShadow\\b').click();
  await modalOption(page, 'HEADS').click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, 'Go First').click();
  await page.clock.runFor(3_400);

  // No scene is ever mounted, so the shell reports unmounted and the SAME
  // downgrade path a WebGL failure uses hands the match to classic.
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'classic', { timeout: 15_000 });
  await expect(page.locator('#desktop')).toBeVisible();
  await expect(page.locator('#aaa-stage')).toBeHidden();
  await expect(page.locator('#aaa-stage canvas.aaa-canvas')).toHaveCount(0);

  // Playability probe: the classic End Turn hold dispatches a real turn.
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
