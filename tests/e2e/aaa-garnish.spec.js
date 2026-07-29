import { expect, test } from '@playwright/test';

// Phase 10c — pooled particles and the audio director in the live shell:
// summon bursts within the pool cap with no hit-target interference, the
// mute chip persists across reload, and reduced motion suppresses bursts.

test.use({ viewport: { width: 1672, height: 941 } });

const AAA_URL = '/?presentation=aaa';
const COIN_FLIP_DURATION_MS = 1_780;
const BEGIN_DURATION_MS = 1_330;

async function installDeterministicBrowser(context, page, randomValues = []) {
  await context.addInitScript(
    ({ values, fallbackSeed }) => {
      let cursor = 0;
      let seed = fallbackSeed >>> 0;
      Math.random = () => {
        let value;
        if (cursor < values.length) {
          value = values[cursor];
        } else {
          seed = (seed + 0x6d2b79f5) | 0;
          let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
          value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
        }
        cursor += 1;
        return value;
      };
    },
    { values: randomValues, fallbackSeed: 0x54464e47 },
  );
  await page.clock.install({ time: new Date('2026-07-27T12:00:00.000Z') });
}

function modalOption(page, pattern) {
  return page.locator('#modal-opts .option').filter({ hasText: pattern }).first();
}

async function startSoloGameGoingFirst(page, pauseAtIso = '2026-07-27T12:01:00.000Z') {
  await page.goto(AAA_URL);
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(new Date(pauseAtIso));
  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: /\bShadow\b/ }).first().click();
  await modalOption(page, /\bShadow\b/).click();
  await modalOption(page, /HEADS/).click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, /Go First/).click();
  await page.clock.runFor(BEGIN_DURATION_MS + 2_000);
  await expect
    .poll(() => page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G?.myTurn ?? null;
    }))
    .toBe(true);
}

test('summon fires a pooled burst: capped, pointer-transparent, self-cleaning', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const name = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find((c) => c.cardType === 'creature' && c.cost <= state.G.me.mana).name;
  });
  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(name)).click();

  // Particles appear during playback (poll the fake clock forward in steps).
  let observed = 0;
  for (let i = 0; i < 40 && observed === 0; i++) {
    observed = await page.locator('.aaa-particle--live').count();
    if (!observed) await page.clock.runFor(150);
  }
  expect(observed).toBeGreaterThan(0);
  expect(observed).toBeLessThanOrEqual(48); // pool cap

  // Never interactive: every particle is pointer-transparent.
  const pointerSafe = await page.evaluate(() =>
    [...document.querySelectorAll('.aaa-particle')]
      .every((n) => getComputedStyle(n).pointerEvents === 'none'));
  expect(pointerSafe).toBe(true);

  // Self-cleaning: pool empties after the burst lifetime.
  await page.clock.runFor(6_000);
  await expect
    .poll(() => page.locator('.aaa-particle--live').count(), { timeout: 5_000 })
    .toBe(0);
});

test('the sound chip toggles mute and persists across reload', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const chip = page.locator('#aaa-sound');
  await expect(chip).toHaveText('Sound: On');
  await chip.click();
  await expect(page.locator('#aaa-sound')).toHaveText('Sound: Off');
  await expect(page.locator('#aaa-sound')).toHaveAttribute('aria-pressed', 'true');
  const stored = await page.evaluate(() => localStorage.getItem('tinyFangs.audio.v1'));
  expect(JSON.parse(stored).muted).toBe(true);

  // A fresh shell restores the persisted state (later pause time: the fake
  // clock cannot rewind across the reload).
  await startSoloGameGoingFirst(page, '2026-07-27T12:30:00.000Z');
  await expect(page.locator('#aaa-sound')).toHaveText('Sound: Off');
});

test('reduced motion suppresses particle bursts entirely', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startSoloGameGoingFirst(page);

  const name = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find((c) => c.cardType === 'creature' && c.cost <= state.G.me.mana).name;
  });
  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(name)).click();
  for (let i = 0; i < 20; i++) {
    expect(await page.locator('.aaa-particle--live').count()).toBe(0);
    await page.clock.runFor(200);
  }
});
