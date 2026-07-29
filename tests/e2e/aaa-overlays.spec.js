import { expect, test } from '@playwright/test';

// Phase 9c — coin flip (3D coin, identical timing), reveals, result screen,
// graveyard browser, and rules overlay in the AAA material.

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

async function reachCoinFlip(page) {
  await page.goto(AAA_URL);
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));
  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: /\bShadow\b/ }).first().click();
  await modalOption(page, /\bShadow\b/).click();
  await expect(page.locator('#modal-title')).toHaveText('Coin Flip');
}

test('the coin is a 3D gold coin in aaa mode with the classic 1780ms timing intact', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await reachCoinFlip(page);
  await modalOption(page, /HEADS/).click();

  const overlay = page.locator('#coin-flip-overlay');
  await expect(overlay).toBeVisible();
  // AAA coin, not the ASCII pre.
  await expect(overlay.locator('.aaa-coin')).toHaveCount(1);
  await expect(overlay.locator('pre')).toHaveCount(0);
  const heads = overlay.locator('.aaa-coin-face--heads');
  const tails = overlay.locator('.aaa-coin-face--tails');
  // The faces now carry the authored coin art (ART-SPEC §5). The gold CSS
  // radial-gradient remains the procedural floor and is what renders when the
  // files are absent — that fallback is pinned in aaa-asset-degradation.spec.
  await expect
    .poll(() => heads.evaluate((el) => getComputedStyle(el).backgroundImage))
    .toContain('coin-heads.webp');
  await expect
    .poll(() => tails.evaluate((el) => getComputedStyle(el).backgroundImage))
    .toContain('coin-tails.webp');

  // Exact timing contract: still visible at duration-1, gone at duration.
  await page.clock.runFor(COIN_FLIP_DURATION_MS - 1);
  await expect(overlay).toBeVisible();
  await page.clock.runFor(1);
  await expect(overlay).toHaveCount(0);
  // Winner-choice modal appears exactly as in classic.
  await expect(page.locator('#modal-title')).toContainText('You won the toss');
});

test('cast/set reveals wear the parchment material and keep dismissal behavior', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await reachCoinFlip(page);
  await modalOption(page, /HEADS/).click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, /Go First/).click();
  await page.clock.runFor(BEGIN_DURATION_MS + 2_000);

  // Drive the reveal surface directly (same window-exposed classic flow).
  await page.evaluate(() => {
    window.showCastReveal({ name: 'Soul Siphon', text: 'Drain 20 HP.', cost: 2, type: 'cast' });
  });
  const modal = page.locator('#triggerModal');
  await expect(modal).toHaveClass(/\bopen\b/);
  const box = page.locator('#triggerModal .trigger-box');
  expect(await box.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('157deg');
  expect(await box.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Alegreya');

  // Key dismissal contract.
  await page.keyboard.press('Space');
  await expect(modal).not.toHaveClass(/\bopen\b/);
});

test('victory result screen wears the AAA material with the play-again path', async ({ page }) => {
  await page.goto('/?presentation=aaa&visualQa=1&behaviorQa=1&fixture=victory');
  const result = page.locator('#result');
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#result-text')).toContainText(/win|victory/i);
  expect(await result.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Alegreya');
  const button = page.locator('#result button');
  await expect(button).toBeVisible();
  expect(await button.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('157deg');
});

test('the grave chip opens the graveyard browser with hold-to-zoom handlers', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await page.goto('/?presentation=aaa&visualQa=1&behaviorQa=1&fixture=ko-promotion');
  await expect(page.locator('#aaa-stage .aaa-frame')).toBeVisible({ timeout: 15_000 });

  const chip = page.locator('button[data-chip="me.grave"]');
  if (await chip.count()) {
    await chip.click();
  } else {
    // Fixture may leave the grave empty; use the classic exposed entry.
    await page.evaluate(() => window.showGraveyard('me'));
  }
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toContainText(/Graveyard/);
  // Hold-to-zoom handlers are preserved on graveyard entries (if any).
  const entries = page.locator('#modal-opts .option[data-uid]');
  if (await entries.count()) {
    const hasHandler = await entries.first().evaluate((el) => Boolean(el.getAttribute('onpointerdown')));
    expect(hasHandler).toBe(true);
  }
  await page.locator('#modal .cancel').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('the rules overlay opens from the AAA rules link in the parchment material', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await reachCoinFlip(page);
  await modalOption(page, /HEADS/).click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, /Go First/).click();
  await page.clock.runFor(BEGIN_DURATION_MS + 2_000);

  await page.locator('#aaa-rules-link').click();
  const rules = page.locator('#rulesModal');
  await expect(rules).toHaveClass(/\bopen\b/);
  const box = page.locator('#rulesModal .rules-box');
  expect(await box.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('157deg');
  await page.locator('#rulesModal .rules-header button').click();
  await expect(rules).not.toHaveClass(/\bopen\b/);
});
