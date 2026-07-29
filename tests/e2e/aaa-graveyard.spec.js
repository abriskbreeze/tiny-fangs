import { expect, test } from '@playwright/test';

// Graveyard access and drill-down in the AAA shell (user bugs #3/#4/#5):
//  - the grave PILE itself is clickable, not just the small count chip;
//  - a graveyard entry opens that card's detail on a plain CLICK (the 400 ms
//    hold from INP-06/INP-08/OVR-02 keeps working and is re-proved here);
//  - closing the detail returns to the SAME graveyard list, and clicking
//    outside the browser closes the whole stack;
//  - game chrome is not selectable text, while the rules prose still is.
//
// The grave is public information (behavior matrix OVR-02 / INP-08), so both
// sides open. Opponent hand and face-down Set stay untouched by these flows.

test.use({ viewport: { width: 1672, height: 941 } });

const KO_FIXTURE = '/?presentation=aaa&visualQa=1&behaviorQa=1&fixture=ko-promotion';

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
}

async function openKoFixture(page) {
  await page.goto(KO_FIXTURE);
  await expect(page.locator('#aaa-stage .aaa-frame')).toBeVisible({ timeout: 15_000 });
}

async function facts(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const G = state.G;
    if (!G) return null;
    const side = (player) => ({
      grave: player.grave.map((c) => ({ uid: c.uid, name: c.name })),
      graveCount: player.grave.length,
    });
    return { me: side(G.me), opp: side(G.opp) };
  });
}

// Give the rival a deterministic public graveyard by moving already-public
// board creatures into it, then re-render through the classic `selectCard`
// entry point (the same round trip the shell performs on any state change).
// Nothing hidden is touched: only face-up board cards move.
async function fabricateRivalGrave(page) {
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const moved = [state.G.opp.active, ...state.G.opp.bench].filter(Boolean);
    state.G.opp.active = null;
    state.G.opp.bench = [];
    state.G.opp.grave.push(...moved);
  });
  // Two toggles: render once with the selection set, once with it cleared.
  await page.evaluate(() => window.selectCard('__graveyard-spec-render__'));
  await page.evaluate(() => window.selectCard('__graveyard-spec-render__'));
  const f = await facts(page);
  expect(f.opp.graveCount, 'rival grave is non-empty').toBeGreaterThan(0);
  return f;
}

test('the AAA grave pile itself opens the graveyard browser, not just the count chip', async ({
  context,
  page,
}) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await openKoFixture(page);

  const before = await facts(page);
  expect(before.me.graveCount, 'ko-promotion seeds one own grave card').toBeGreaterThan(0);

  // The pile: a board card mounted at the me.grave anchor.
  const pile = page.locator('#aaa-stage [data-grave-side="me"]');
  await expect(pile).toHaveCount(1);
  await pile.click();
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');
  // The pile opens the whole browser rather than the top card's detail.
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-opts .option[data-uid]')).toHaveCount(
    before.me.graveCount,
  );
  await page.locator('#modal .cancel').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);

  // The chip remains a second, equivalent affordance.
  const chip = page.locator('button[data-chip="me.grave"]');
  await expect(chip).toHaveCount(1);
  await chip.click();
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');
  await page.locator('#modal .cancel').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('clicking a graveyard entry opens its detail and closing returns to the same list', async ({
  context,
  page,
}) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await openKoFixture(page);
  const before = await facts(page);
  const newest = before.me.grave[before.me.grave.length - 1];

  await page.locator('#aaa-stage [data-grave-side="me"]').click();
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');

  const entry = page.locator('#modal-opts .option[data-uid]').first();
  await expect(entry).toHaveAttribute('data-uid', newest.uid);

  // A plain click (no 400 ms hold) opens that card's detail.
  await entry.click();
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardDetail')).toContainText(newest.name);

  // Back: the detail's own Close button returns to the graveyard list, not
  // the board.
  await page.locator('#cardDetail .close-btn').click();
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');
  await expect(page.locator('#modal-opts .option[data-uid]')).toHaveCount(
    before.me.graveCount,
  );

  // Same round trip via Escape and via the detail backdrop.
  await entry.click();
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');

  await entry.click();
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await page.locator('#cardModal').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');
});

test('clicking outside the graveyard browser closes the whole stack', async ({
  context,
  page,
}) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await openKoFixture(page);

  await page.locator('#aaa-stage [data-grave-side="me"]').click();
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);

  await page.locator('#modal').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);

  // And the drill-down does not survive the dismissal: re-opening the
  // graveyard afterwards shows the list, never a stale detail.
  await page.locator('#aaa-stage [data-grave-side="me"]').click();
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
});

test('a decision modal still refuses backdrop dismissal after the graveyard opts in', async ({
  context,
  page,
}) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await openKoFixture(page);

  // Opt the graveyard in first, then close it, so the next modal proves the
  // flag is per-modal rather than sticky.
  await page.locator('#aaa-stage [data-grave-side="me"]').click();
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await page.locator('#modal').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);

  await page.evaluate(() => window.doSummon());
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Summon Creature');
  await page.locator('#modal').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await page.locator('#modal .cancel').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('the rival grave pile opens the rival browser and drills down back to it', async ({
  context,
  page,
}) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await openKoFixture(page);
  const shaped = await fabricateRivalGrave(page);
  const newest = shaped.opp.grave[shaped.opp.grave.length - 1];

  const pile = page.locator('#aaa-stage [data-grave-side="opp"]');
  await expect(pile).toHaveCount(1);
  await pile.click();
  await expect(page.locator('#modal-title')).toHaveText("Rival's Graveyard");
  const entries = page.locator('#modal-opts .option[data-uid]');
  await expect(entries).toHaveCount(shaped.opp.graveCount);
  // Newest first (OVR-02).
  await expect(entries.first()).toHaveAttribute('data-uid', newest.uid);

  await entries.first().click();
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardDetail')).toContainText(newest.name);

  // Back lands on the RIVAL list, not the player's.
  await page.locator('#cardDetail .close-btn').click();
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText("Rival's Graveyard");
  await expect(page.locator('#modal-opts .option[data-uid]')).toHaveCount(
    shaped.opp.graveCount,
  );

  // Privacy: the rival hand and face-down Set never leak into the browser.
  const leaked = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const text = document.getElementById('modal-opts').innerHTML;
    const secrets = [
      ...(state.G.opp.hand ?? []).map((c) => c.uid),
      state.G.opp.setVerse?.uid,
    ].filter(Boolean);
    return secrets.filter((uid) => text.includes(uid));
  });
  expect(leaked).toEqual([]);
});

test('the 400 ms hold-to-detail path still works alongside the new click', async ({
  context,
  page,
}) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await page.clock.install({ time: new Date('2026-07-27T12:00:00.000Z') });
  await openKoFixture(page);
  // Freeze the clock so only explicit runFor() advances the hold timer.
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));
  const before = await facts(page);
  const newest = before.me.grave[before.me.grave.length - 1];

  await page.evaluate(() => window.showGraveyard('me'));
  const entry = page.locator('#modal-opts .option[data-uid]').first();
  const box = await entry.boundingBox();
  expect(box).not.toBeNull();
  const payload = {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    isPrimary: true,
    pointerId: 31,
    pointerType: 'touch',
  };

  await entry.dispatchEvent('pointerdown', payload);
  await page.clock.runFor(399);
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await page.clock.runFor(1);
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardDetail')).toContainText(newest.name);
  await entry.dispatchEvent('pointerup', { ...payload, buttons: 0 });

  // The hold-opened detail also returns to the graveyard list.
  await page.evaluate(() => window.closeCardModal(new Event('click'), true));
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');

  // A hold that is released early still cancels cleanly (INP-08).
  await entry.dispatchEvent('pointerdown', { ...payload, pointerId: 32 });
  await page.clock.runFor(399);
  await entry.dispatchEvent('pointercancel', { ...payload, pointerId: 32, buttons: 0 });
  await page.clock.runFor(1);
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
});

test('game chrome is not selectable text while the rules overlay prose still is', async ({
  context,
  page,
}) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await openKoFixture(page);

  const userSelect = (locator) =>
    locator.first().evaluate((el) => getComputedStyle(el).userSelect);

  // Card faces on the AAA stage.
  const face = page.locator('#aaa-stage .tf-aaa-card');
  await expect(face.first()).toBeAttached();
  expect(await userSelect(face)).toBe('none');
  // Nested face text inherits the same lock.
  const stage = page.locator('#aaa-stage');
  expect(await userSelect(stage)).toBe('none');

  // Modal option rows.
  await page.locator('#aaa-stage [data-grave-side="me"]').click();
  expect(await userSelect(page.locator('#modal-opts .option'))).toBe('none');
  await page.locator('#modal .cancel').click();

  // Rules prose stays selectable: it is the one surface a player may want to
  // copy out of.
  await page.evaluate(() => window.showRules());
  await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
  expect(await userSelect(page.locator('#rulesModal .rules-content'))).not.toBe('none');
  expect(
    await userSelect(page.locator('#rulesModal .rules-content p')),
  ).not.toBe('none');
});
