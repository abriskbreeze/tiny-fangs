import { expect, test } from '@playwright/test';

// The graceful-degradation contract, proven in a real browser.
//
// Every art file is placeholder-pending user regeneration, so the AAA shell
// must be fully playable with ZERO art present and must actually use art when
// it is present. These two tests pin both ends. The unit-level contract lives
// in tests/presentation/image-assets.test.js.

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

function modalOption(page, label) {
  return page
    .locator('#modal-opts .option')
    .filter({ hasText: new RegExp(label) })
    .first();
}

async function startSoloGameGoingFirst(page) {
  await page.goto(AAA_URL);
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));

  await page.getByRole('button', { name: /Solo/ }).click();
  await expect(page.locator('#deck-select')).toBeVisible();
  await page
    .locator('#deck-select .deck-btn')
    .filter({ hasText: /\bShadow\b/ })
    .first()
    .click();
  await expect(page.locator('#modal-title')).toHaveText('Choose Rival Deck');
  await modalOption(page, '\\bShadow\\b').click();
  await expect(page.locator('#modal-title')).toHaveText('Coin Flip');
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

// Refuse every image byte, exactly as if the user had not generated a single
// art file yet.
//
// Filtering on resourceType (not the URL) matters: `import.meta.glob(…,
// query:'?url')` makes the dev server serve each asset URL as a JS *module*
// at '/src/assets/…webp?url'. Aborting those would break the module graph and
// take aaa-shell.js down with it — a dev-server artifact that cannot happen in
// a production build, where the same URLs are inlined strings. Only the actual
// image fetch is starved here, which is what a missing file really looks like.
async function starveAssets(page) {
  await page.route('**/*', (route) => (
    route.request().resourceType() === 'image' ? route.abort() : route.continue()
  ));
}

test('the AAA game boots, renders and plays with zero art files present', async ({ context, page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  // The shell must NOT fall back to classic just because art is missing: art
  // absence is not a mount failure, and RSP-07's downgrade is reserved for a
  // scene that genuinely cannot run.
  await installDeterministicBrowser(context, page, [0.1]);
  await starveAssets(page);
  await startSoloGameGoingFirst(page);

  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  await expect(page.locator('.aaa-frame')).toBeVisible();

  // The procedural chassis is fully intact: frame layers, art window, rails.
  const card = page.locator('.aaa-hand-card .tf-aaa-card').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.tf-aaa-card__panel')).toHaveCount(1);
  await expect(card.locator('.tf-aaa-card__art')).toHaveCount(1);
  // Present but unpainted — that is the degradation, not a missing element.
  await expect(card.locator('.tf-aaa-card__frame')).toHaveCount(1);
  await expect(card.locator('.tf-aaa-card__frame[data-frame-wired]')).toHaveCount(0);

  // The Unicode HUD floor still reads exactly as it always has.
  await expect(page.locator('#aaa-my-lp')).toHaveText('♥♥♥');
  await expect(page.locator('#aaa-my-mana')).toContainText('●');
  await expect(page.locator('#aaa-turn')).toContainText('You');

  // And the game is still playable end to end: summon reaches the engine and
  // the creature lands on the active quad as a real chassis face.
  const summonTarget = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find(
      (c) => c.cardType === 'creature' && c.cost <= state.G.me.mana,
    )?.name ?? null;
  });
  expect(summonTarget).not.toBeNull();

  await page.locator('#aaa-action-summon').click();
  await expect(page.locator('#modal-title')).toHaveText('Summon Creature');
  await modalOption(page, summonTarget).click();
  await page.clock.runFor(6_000);

  const active = page.locator('.aaa-card-layer [data-anchor="me.active"]');
  await expect(active).toHaveCount(1);
  await expect(active.locator('.tf-aaa-card__title-text')).toHaveText(summonTarget);

  expect(pageErrors).toEqual([]);
});

test('art that is present is actually used', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Frame plates paint from src/assets/frames/*.webp.
  await expect
    .poll(() => page.locator('.tf-aaa-card__frame[data-frame-wired]').count())
    .toBeGreaterThan(0);

  // Card art paints from the thumbnail derivative — the board/hand size,
  // never the archival source.png.
  const artWired = page.locator('.tf-aaa-card__art[data-art-wired]').first();
  await expect(artWired).toHaveAttribute('data-art-wired', /thumbnail\.webp$/);
  await expect(artWired).toHaveAttribute('data-art-variant', 'thumbnail');

  // Life and mana pips carry their token art while keeping the glyph text.
  await expect
    .poll(() => page.locator('#aaa-my-lp .aaa-vital-token[data-asset-wired]').count())
    .toBe(3);
  await expect(page.locator('#aaa-my-lp')).toHaveText('♥♥♥');

  // source.png is archival: it must never be requested at runtime.
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.reload();
  await expect(page.locator('.aaa-frame, #setup')).toHaveCount(1);
  expect(requested.filter((u) => u.includes('source.png'))).toEqual([]);
});
