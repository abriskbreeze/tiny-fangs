import { expect, test } from '@playwright/test';

// Phase 10a — uid-keyed FLIP motion on the AAA board: summon glides from the
// hand, retreat swaps glide between quads, cards persist DOM identity across
// zone changes, and prefers-reduced-motion renders instantly with no
// transitions. Settled frames stay byte-deterministic (transforms settle to
// the empty string).

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

async function startSoloGameGoingFirst(page) {
  await page.goto(AAA_URL);
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));
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

async function firstAffordableCreatureName(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find(
      (c) => c.cardType === 'creature' && c.cost <= state.G.me.mana,
    )?.name ?? null;
  });
}

test('summon FLIPs the same DOM node from hand to the active quad', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const name = await firstAffordableCreatureName(page);
  const uid = await page.evaluate(async (n) => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find((c) => c.name === n).uid;
  }, name);

  // The hand card lives in a keyed FLIP outer; remember its element identity.
  const outer = page.locator(`[data-flip-uid="${uid}"]`);
  await expect(outer).toHaveCount(1);
  await outer.evaluate((el) => { el.dataset.identityProbe = 'kept'; });

  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(name)).click();

  // Immediately after the render, the moved outer carries the FLIP class and
  // the card now stands inside it on the active quad.
  await expect
    .poll(() => page.evaluate((u) => {
      const el = document.querySelector(`[data-flip-uid="${u}"]`);
      if (!el) return 'missing';
      return el.classList.contains('aaa-flip--moving') || el.style.transform !== ''
        ? 'moving' : 'static';
    }, uid), { timeout: 5_000 })
    .toBe('moving');
  await expect(outer.locator('[data-anchor="me.active"]')).toHaveCount(1);
  // DOM identity persisted across the zone change (FLIP requirement).
  expect(await outer.getAttribute('data-identity-probe')).toBe('kept');

  // Settles to identity: transform empty, class removed (real-time wait —
  // CSS transitions run on the compositor clock, not the mocked one).
  await page.waitForTimeout(700);
  expect(await outer.evaluate((el) =>
    el.style.transform === '' && !el.classList.contains('aaa-flip--moving'))).toBe(true);
});

test('retreat FLIPs both swapped creatures between their quads', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Summon twice (active + bench) across turns as needed.
  for (let i = 0; i < 10; i++) {
    const shape = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return {
        active: state.G.me.active?.uid ?? null,
        bench: state.G.me.bench.map((c) => c.uid),
        myTurn: state.G.myTurn,
        winner: state.G.winner ?? null,
        affordable: state.G.me.hand.find(
          (c) => c.cardType === 'creature' && c.cost <= state.G.me.mana,
        )?.name ?? null,
        attacked: state.G.hasAttacked || state.G.hasRetreated,
      };
    });
    expect(shape.winner).toBeNull();
    if (shape.myTurn && shape.active && shape.bench.length > 0 && !shape.attacked) break;
    if (shape.myTurn && shape.affordable && (!shape.active || shape.bench.length < 1)) {
      await page.locator('#aaa-action-summon').click();
      await modalOption(page, new RegExp(shape.affordable)).click();
      await page.clock.runFor(6_000);
      continue;
    }
    await page.locator('#aaa-action-end').click();
    await page.clock.runFor(35_000);
    for (let k = 0; k < 3; k++) {
      if (await page.locator('#modal.open').count()) {
        await page.locator('#modal-opts .option:not(.off)').first().click();
      }
      await page.clock.runFor(4_000);
    }
  }

  const { activeUid, benchUid, benchName } = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return {
      activeUid: state.G.me.active.uid,
      benchUid: state.G.me.bench[0].uid,
      benchName: state.G.me.bench[0].name,
    };
  });

  await page.locator('#aaa-action-retreat').click();
  await modalOption(page, new RegExp(benchName)).click();

  // Both keyed outers glide.
  await expect
    .poll(() => page.evaluate(([a, b]) => {
      const moving = (u) => {
        const el = document.querySelector(`[data-flip-uid="${u}"]`);
        return Boolean(el && (el.classList.contains('aaa-flip--moving') || el.style.transform !== ''));
      };
      return moving(a) && moving(b);
    }, [activeUid, benchUid]), { timeout: 5_000 })
    .toBe(true);
  // And the swap lands on the right quads.
  await expect(page.locator(`[data-flip-uid="${benchUid}"] [data-anchor="me.active"]`)).toHaveCount(1);
  await expect(page.locator(`[data-flip-uid="${activeUid}"] [data-anchor="me.bench.a"], [data-flip-uid="${activeUid}"] [data-anchor="me.bench.b"]`)).toHaveCount(1);
});

test('prefers-reduced-motion places cards instantly with no transitions', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startSoloGameGoingFirst(page);

  const name = await firstAffordableCreatureName(page);
  const uid = await page.evaluate(async (n) => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find((c) => c.name === n).uid;
  }, name);

  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(name)).click();
  await page.clock.runFor(6_000);

  const state = await page.evaluate((u) => {
    const el = document.querySelector(`[data-flip-uid="${u}"]`);
    return {
      exists: Boolean(el),
      transform: el?.style.transform ?? null,
      moving: el?.classList.contains('aaa-flip--moving') ?? null,
      onActive: Boolean(el?.querySelector('[data-anchor="me.active"]')),
    };
  }, uid);
  expect(state.exists).toBe(true);
  expect(state.transform).toBe('');
  expect(state.moving).toBe(false);
  expect(state.onActive).toBe(true);
});
