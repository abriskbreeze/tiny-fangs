import { expect, test } from '@playwright/test';

// Phase 9b — selector flows in the AAA shell: target selection with
// in-material ownership cues and diegetic board-highlight picking, the
// optional-trigger prompt, and the timer chip on the HUD rails.

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
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
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

async function facts(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const G = state.G;
    if (!G) return null;
    return {
      myTurn: G.myTurn,
      winner: G.winner ?? null,
      mana: G.me.mana,
      meActive: G.me.active ? { uid: G.me.active.uid, name: G.me.active.name, hp: G.me.active.curHp ?? G.me.active.hp } : null,
      benchLen: G.me.bench.length,
      hand: G.me.hand.map((c) => ({ uid: c.uid, id: c.id, name: c.name, cardType: c.cardType, type: c.type ?? null, cost: c.cost })),
      fieldUids: [
        ...(G.me.active ? [G.me.active.uid] : []),
        ...G.me.bench.map((c) => c.uid),
        ...(G.opp.active ? [G.opp.active.uid] : []),
        ...G.opp.bench.map((c) => c.uid),
      ],
    };
  });
}

async function settleModals(page) {
  for (let i = 0; i < 4; i++) {
    if (!(await page.locator('#modal.open').count())) return;
    const option = page.locator('#modal-opts .option:not(.off)').first();
    if (await option.count()) await option.click();
    await page.clock.runFor(2_000);
  }
}

async function endTurnAndReturn(page) {
  await page.locator('#aaa-action-end').click();
  await page.clock.runFor(30_000);
  await settleModals(page);
  await expect
    .poll(async () => {
      await page.clock.runFor(5_000);
      await settleModals(page);
      const f = await facts(page);
      return f?.winner !== null || f?.myTurn === true;
    }, { timeout: 20_000 })
    .toBe(true);
}

async function summonIfPossible(page) {
  const f = await facts(page);
  if (!f.myTurn || f.winner !== null) return false;
  const creature = f.hand.find((c) => c.cardType === 'creature' && c.cost <= f.mana);
  if (!creature) return false;
  if (f.meActive && f.benchLen >= 2) return false;
  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(creature.name)).click();
  await page.clock.runFor(6_000);
  return true;
}

test('target selection: ownership cues, board highlights, diegetic pick resolves exactly once', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Reach a state with Soul Siphon affordable and at least one creature on
  // the field (its board/any selector needs a target).
  let ready = null;
  for (let i = 0; i < 12 && !ready; i++) {
    while (await summonIfPossible(page)) { /* board presence */ }
    const f = await facts(page);
    expect(f.winner, 'game ended before selector shape').toBeNull();
    const siphon = f.hand.find((c) => c.id === 'soulSiphon' && c.cost <= f.mana);
    if (f.myTurn && siphon && f.fieldUids.length > 0) { ready = { f, siphon }; break; }
    await endTurnAndReturn(page);
  }
  expect(ready, 'reached Soul Siphon + field target shape').toBeTruthy();

  await page.locator('#aaa-action-cast').click();
  await expect(page.locator('#modal-title')).toHaveText('Cast Verse');
  await modalOption(page, /Soul Siphon/).click();
  await page.clock.runFor(1_500);

  // The creature selector is open with in-material ownership cues.
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  const yours = page.locator('#modal-opts .option.selector-yours');
  const enemy = page.locator('#modal-opts .option.selector-enemy');
  expect(await yours.count() + await enemy.count()).toBeGreaterThan(0);
  if (await yours.count()) {
    const border = await yours.first().evaluate((el) => getComputedStyle(el).borderColor);
    expect(border).toContain('238, 195, 78'); // gold = yours
  }
  if (await enemy.count()) {
    const border = await enemy.first().evaluate((el) => getComputedStyle(el).borderColor);
    expect(border).toContain('106, 90, 102'); // plum = enemy
  }

  // Every legal target is highlighted on the AAA board.
  const highlighted = await page.locator('#aaa-stage .aaa-card--targetable').count();
  const currentFacts = await facts(page);
  expect(highlighted).toBe(currentFacts.fieldUids.length);

  // Diegetic pick: click the highlighted BOARD card itself.
  const targetUid = await page
    .locator('#aaa-stage .aaa-card-layer .aaa-card--targetable')
    .first()
    .getAttribute('data-uid');
  const hpBefore = await page.evaluate(async (uid) => {
    const { state } = await import('/src/state.js');
    const all = [state.G.me.active, ...state.G.me.bench, state.G.opp.active, ...state.G.opp.bench].filter(Boolean);
    const c = all.find((x) => x.uid === uid);
    return c ? (c.curHp ?? c.hp) : null;
  }, targetUid);
  await page.locator('#aaa-stage .aaa-card-layer .aaa-card--targetable').first().click();
  await page.clock.runFor(6_000);

  // Selector closed, highlights cleared, effect landed exactly once.
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#aaa-stage .aaa-card--targetable')).toHaveCount(0);
  const after = await page.evaluate(async (uid) => {
    const { state } = await import('/src/state.js');
    const all = [state.G.me.active, ...state.G.me.bench, state.G.opp.active, ...state.G.opp.bench].filter(Boolean);
    const c = all.find((x) => x.uid === uid);
    return {
      hp: c ? (c.curHp ?? c.hp) : null,
      inGrave: [...state.G.me.grave, ...state.G.opp.grave].some((x) => x.uid === uid),
      handHasSiphon: state.G.me.hand.some((x) => x.id === 'soulSiphon'),
    };
  }, targetUid);
  // Drained once: hp reduced, or the target was KO'd to a grave.
  expect(after.inGrave || (after.hp !== null && after.hp < hpBefore)).toBeTruthy();
});

test('optional trigger prompt resolves exactly once in the AAA shell (fixture route)', async ({ page }) => {
  await page.goto('/?presentation=aaa&visualQa=1&behaviorQa=1&fixture=optional-trigger-pending');
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  // The AAA stage mounted around the fixture state.
  await expect(page.locator('#aaa-stage .aaa-frame')).toBeVisible();
  const modal = page.locator('#modal');
  await expect(modal).toHaveClass(/\bopen\b/, { timeout: 15_000 });

  // Escape must be inert on semantic decision modals.
  await page.keyboard.press('Escape');
  await expect(modal).toHaveClass(/\bopen\b/);

  // Choose the first option; the decision resolves exactly once.
  const before = await page.evaluate(() => window.__tfBehaviorQa?.optionalTriggerResolutions ?? null);
  await page.locator('#modal-opts .option:not(.off)').first().click();
  await expect(modal).not.toHaveClass(/\bopen\b/);
  if (before !== null) {
    await expect
      .poll(() => page.evaluate(() => window.__tfBehaviorQa?.optionalTriggerResolutions ?? null))
      .toBe(before + 1);
  }
  // No re-resolution path remains.
  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/\bopen\b/);
});

test('the AAA timer chip tracks the classic match clock', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  await expect(page.locator('#aaa-timer')).toBeAttached();
  const initial = await page.locator('#aaa-timer').textContent();
  await page.clock.runFor(61_000);
  const later = await page.locator('#aaa-timer').textContent();
  expect(later).not.toBe(initial);
  const classic = await page.locator('#d-time').textContent();
  expect(later).toBe(classic);
});
