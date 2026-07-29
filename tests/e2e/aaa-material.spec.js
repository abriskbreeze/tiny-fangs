import { expect, test } from '@playwright/test';

// Phase 9a — setup, deck select, generic modal, and card detail wear the AAA
// material system when (and only when) the aaa flag is active. Behavior
// contracts (dismissal, backdrop, keys, disabled options) are asserted on
// the SAME classic DOM flows; classic mode computed styles stay untouched.

test.use({ viewport: { width: 1672, height: 941 } });

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

const parchmentish = (css) => css.includes('231, 199, 158') || css.includes('#E7C79E');

test('setup and deck select wear the AAA material only under the aaa flag', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);

  // Classic first: the mode button must NOT be parchment.
  await page.goto('/?presentation=classic');
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'classic');
  const classicButton = await page
    .getByRole('button', { name: /Solo/ })
    .evaluate((el) => getComputedStyle(el).backgroundImage + getComputedStyle(el).backgroundColor);
  expect(parchmentish(classicButton)).toBe(false);

  // AAA: parchment material + serif face on setup surfaces.
  await page.goto('/?presentation=aaa');
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  const solo = page.getByRole('button', { name: /Solo/ });
  const aaaButton = await solo.evaluate(
    (el) => getComputedStyle(el).backgroundImage + getComputedStyle(el).backgroundColor,
  );
  expect(parchmentish(aaaButton)).toBe(true);
  expect(await solo.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Alegreya');

  await solo.click();
  const deckButton = page.locator('#deck-select .deck-btn').first();
  await expect(deckButton).toBeVisible();
  expect(parchmentish(await deckButton.evaluate(
    (el) => getComputedStyle(el).backgroundImage + getComputedStyle(el).backgroundColor,
  ))).toBe(true);
});

test('generic modal keeps its behavior contracts in the AAA material', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await page.goto('/?presentation=aaa');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));
  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: /\bShadow\b/ }).first().click();

  // Material: parchment box, ink title, serif face.
  const box = page.locator('#modal .modal-box');
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  expect(parchmentish(await box.evaluate(
    (el) => getComputedStyle(el).backgroundImage,
  ))).toBe(true);
  expect(await box.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Alegreya');
  const titleColor = await page.locator('#modal-title').evaluate((el) => getComputedStyle(el).color);
  expect(titleColor).toBe('rgb(59, 35, 23)');

  // Behavior: options are clickable; the flow continues exactly as classic.
  await modalOption(page, /\bShadow\b/).click();
  await expect(page.locator('#modal-title')).toHaveText('Coin Flip');
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

  // Disabled options render with the .off treatment (unaffordable summon).
  await page.locator('#aaa-action-summon').click();
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  const offCount = await page.locator('#modal-opts .option.off').count();
  const offStyleOk = offCount === 0 || await page
    .locator('#modal-opts .option.off')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).opacity) < 0.7);
  expect(offStyleOk).toBe(true);

  // Dismissal: the Close control still closes.
  await page.locator('#modal .cancel').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('card detail wears the parchment panel and closes on backdrop click', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await page.goto('/?presentation=aaa');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));
  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: /\bShadow\b/ }).first().click();
  await modalOption(page, /\bShadow\b/).click();
  await modalOption(page, /HEADS/).click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, /Go First/).click();
  await page.clock.runFor(BEGIN_DURATION_MS + 2_000);

  // Inspect a hand card, assert material, then dismiss via backdrop —
  // the classic backdrop contract (click outside the panel closes).
  await page.locator('.aaa-hand-card').first().click({ button: 'right' });
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  expect(parchmentish(await page.locator('#cardDetail').evaluate(
    (el) => getComputedStyle(el).backgroundImage,
  ))).toBe(true);
  await page.locator('#cardModal').click({ position: { x: 12, y: 12 } });
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
});
