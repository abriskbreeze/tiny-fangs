import { expect, test } from '@playwright/test';

// Phase 14 — drag-to-play inside the AAA shell, exercised END-TO-END against
// the real solo game. A hand card dragged past the SAME 15 px threshold the
// classic shell uses (src/main.js DRAG_THRESHOLD) becomes a drag; released on
// a golden-quad drop zone it plays through the SAME classic dispatch the
// classic drop uses (canPlayCard / getPlayType / executeDrop → playCard →
// dispatchAction), so shared/engine.js stays the only rules authority.
//
// Deterministic scaffolding (fake Math.random + fake clock + solo start +
// facts reader) is copied from tests/e2e/aaa-actions.spec.js; the pointer
// mechanics are copied from tests/e2e/classic-input-regression.spec.js.

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
  return page
    .locator('#modal-opts .option')
    .filter({ hasText: pattern })
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
  await page
    .locator('#deck-select .deck-btn')
    .filter({ hasText: /\bShadow\b/ })
    .first()
    .click();
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
    const summarize = (c) => (c ? { uid: c.uid, name: c.name, hp: c.curHp ?? c.hp } : null);
    return {
      myTurn: G.myTurn,
      turn: G.turn,
      winner: G.winner ?? null,
      mana: G.me.mana,
      firstTurn: G.firstTurn,
      hasAttacked: G.hasAttacked,
      me: {
        lp: G.me.lp,
        active: summarize(G.me.active),
        bench: G.me.bench.map(summarize),
        set: Boolean(G.me.setVerse),
        graveCount: G.me.grave.length,
        hand: G.me.hand.map((c) => ({
          uid: c.uid, name: c.name, cardType: c.cardType, type: c.type ?? null, cost: c.cost,
        })),
      },
      opp: {
        lp: G.opp.lp,
        active: summarize(G.opp.active),
        graveCount: G.opp.grave.length,
      },
    };
  });
}

// Dismiss any decision modal the rival turn may surface for us (optional
// triggers / responses): always take the first available option.
async function settleModals(page) {
  for (let i = 0; i < 4; i++) {
    const open = await page.locator('#modal.open').count();
    if (!open) return;
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

// Advance whole turns until the predicate holds (or fail loudly).
async function advanceUntil(page, predicate, description, maxTurns = 8) {
  for (let i = 0; i < maxTurns; i++) {
    const f = await facts(page);
    expect(f.winner, `game ended before: ${description}`).toBeNull();
    if (f.myTurn && predicate(f)) return f;
    await endTurnAndReturn(page);
  }
  throw new Error(`never reached: ${description}`);
}

// ── pointer mechanics (classic-input-regression.spec.js) ─────────────

async function pointerPoint(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function pointerPayload(point, pointerType, pointerId, extras = {}) {
  return {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    isPrimary: true,
    pointerId,
    pointerType,
    ...extras,
  };
}

async function beginPointer(page, locator, pointerType, pointerId) {
  const start = await pointerPoint(locator);
  await locator.dispatchEvent(
    'pointerdown',
    pointerPayload(start, pointerType, pointerId),
  );
  return start;
}

async function movePointer(page, point, pointerType, pointerId) {
  await page.locator('body').dispatchEvent(
    'pointermove',
    pointerPayload(point, pointerType, pointerId),
  );
}

async function finishPointer(page, eventName, point, pointerType, pointerId) {
  await page.locator('body').dispatchEvent(
    eventName,
    pointerPayload(point, pointerType, pointerId, { buttons: 0 }),
  );
}

// ── AAA-specific drag helpers ────────────────────────────────────────

function handCard(page, uid) {
  return page.locator(`.aaa-hand-card[data-uid="${uid}"]`);
}

// Viewport centre of a camera-lock golden quad, read from the SAME source the
// shell hit-tests against (no coordinates duplicated into the test).
async function anchorPoint(page, anchorId) {
  const point = await page.evaluate(async (id) => {
    const { GOLDEN_QUADS } = await import('/src/presentation/scene/golden-quads.js');
    const frame = document.querySelector('.aaa-frame')?.getBoundingClientRect();
    const corners = GOLDEN_QUADS[id];
    if (!frame || !corners) return null;
    const scale = frame.width / 1672;
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    return {
      x: frame.left + ((Math.min(...xs) + Math.max(...xs)) / 2) * scale,
      y: frame.top + ((Math.min(...ys) + Math.max(...ys)) / 2) * scale,
    };
  }, anchorId);
  expect(point, `golden quad ${anchorId}`).not.toBeNull();
  return point;
}

async function dragResidue(page) {
  return page.evaluate(() => ({
    proxies: document.querySelectorAll('.aaa-drag-proxy').length,
    zones: document.querySelectorAll('.aaa-drop-zone').length,
    drag: window.__tfAaaDrag?.() ?? null,
  }));
}

async function assertNoDragResidue(page) {
  await expect
    .poll(() => dragResidue(page))
    .toEqual({ proxies: 0, zones: 0, drag: null });
}

// Test-only state priming, the same lever tests/e2e/classic-input-regression
// .spec.js pulls (`prepareFullMana`): top the mana up and draw until an
// affordable creature is in hand, all WITHOUT passing a turn — so the rival
// AI never moves and the drag assertions cannot race it. It primes inputs
// only; every play under test still runs through the engine.
async function primeFullManaWithCreature(page) {
  const ok = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    state.G.me.maxMana = 5;
    const affordable = () => state.G.me.hand
      .filter((c) => c.cardType === 'creature' && c.cost <= state.G.me.maxMana).length;
    for (let i = 0; i < 25 && affordable() < 1; i++) {
      if (!state.G.me.deck?.length) break;
      window.forcePlayerTurn(); // refills mana, draws one, re-renders
    }
    window.forcePlayerTurn();
    return affordable() >= 1;
  });
  expect(ok, 'primed an affordable creature into hand').toBe(true);
}

test('an affordable creature dragged onto the me.active quad summons through the classic dispatch', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ready = await advanceUntil(
    page,
    (f) => !f.me.active && f.me.hand.some((c) => c.cardType === 'creature' && c.cost <= f.mana),
    'empty active with an affordable creature in hand',
  );
  const creature = ready.me.hand.find((c) => c.cardType === 'creature' && c.cost <= ready.mana);

  // Mid-drag: exactly one proxy, and the me.active quad is the lit zone.
  const locator = handCard(page, creature.uid);
  await beginPointer(page, locator, 'mouse', 11);
  const target = await anchorPoint(page, 'me.active');
  await movePointer(page, target, 'mouse', 11);
  await expect(page.locator('body > .aaa-drag-proxy')).toHaveCount(1);
  await expect(page.locator('.aaa-drop-zone[data-drop="me.active"]')).toHaveCount(1);
  await expect(page.locator('.aaa-drop-zone[data-drop="me.active"]'))
    .toHaveClass(/\baaa-drop-zone--hover\b/);
  expect((await dragResidue(page)).drag).toMatchObject({
    active: true, canAfford: true, uid: creature.uid,
  });
  // The picker modal is NOT what a drag opens.
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);

  await finishPointer(page, 'pointerup', target, 'mouse', 11);
  await page.clock.runFor(6_000);

  const after = await facts(page);
  expect(after.me.active?.uid).toBe(creature.uid);
  expect(after.me.hand.map((c) => c.uid)).not.toContain(creature.uid);
  await expect(
    page.locator('.aaa-card-layer [data-anchor="me.active"] .tf-aaa-card__title-text'),
  ).toHaveText(creature.name);
  await assertNoDragResidue(page);
});

test('a second creature dragged onto a bench quad benches it and leaves the active alone', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Fill the active by drag (same gesture as the previous test), then prime
  // again for a second creature — no turn passes, so the rival never moves.
  await primeFullManaWithCreature(page);
  const opening = await facts(page);
  expect(opening.me.active, 'active starts empty').toBeNull();
  const first = opening.me.hand.find((c) => c.cardType === 'creature' && c.cost <= opening.mana);
  const firstLocator = handCard(page, first.uid);
  await beginPointer(page, firstLocator, 'mouse', 21);
  const activePoint = await anchorPoint(page, 'me.active');
  await movePointer(page, activePoint, 'mouse', 21);
  await finishPointer(page, 'pointerup', activePoint, 'mouse', 21);
  await page.clock.runFor(6_000);
  await expect.poll(async () => (await facts(page)).me.active?.uid).toBe(first.uid);

  await primeFullManaWithCreature(page);
  const before = await facts(page);
  expect(before.winner, 'game still live before the bench drag').toBeNull();
  expect(before.me.bench.length).toBeLessThan(2);
  const second = before.me.hand.find((c) => c.cardType === 'creature' && c.cost <= before.mana);
  expect(second, 'a second affordable creature in hand').toBeTruthy();

  const locator = handCard(page, second.uid);
  await beginPointer(page, locator, 'mouse', 22);
  const bench = await anchorPoint(page, 'me.bench.a');
  await movePointer(page, bench, 'mouse', 22);
  // With the active occupied the legal zones are the free bench quads only —
  // exactly what classic getPlayType reports as `summon-bench`.
  await expect(page.locator('.aaa-drop-zone[data-drop="me.active"]')).toHaveCount(0);
  await expect(page.locator('.aaa-drop-zone[data-drop="me.bench.a"]')).toHaveCount(1);
  await finishPointer(page, 'pointerup', bench, 'mouse', 22);
  await page.clock.runFor(6_000);

  const after = await facts(page);
  expect(after.me.bench.map((c) => c.uid)).toContain(second.uid);
  expect(after.me.active?.uid).toBe(before.me.active.uid);
  expect(after.me.hand.map((c) => c.uid)).not.toContain(second.uid);
  await assertNoDragResidue(page);
});

test('an unaffordable card drags without a drop zone and mutates nothing on release', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ready = await advanceUntil(
    page,
    (f) => f.me.hand.some((c) => c.cost > f.mana),
    'a card in hand costing more than the current mana',
  );
  const tooDear = ready.me.hand.find((c) => c.cost > ready.mana);
  const before = await facts(page);

  const locator = handCard(page, tooDear.uid);
  await beginPointer(page, locator, 'mouse', 31);
  const target = await anchorPoint(page, 'me.active');
  await movePointer(page, target, 'mouse', 31);

  // The proxy exists (the gesture is real) but is painted unavailable and no
  // quad ever lights up — the same contract classic paints on its ghost.
  await expect(page.locator('body > .aaa-drag-proxy')).toHaveCount(1);
  await expect(page.locator('body > .aaa-drag-proxy')).toHaveClass(/\bunaffordable\b/);
  await expect(page.locator('.aaa-drop-zone')).toHaveCount(0);
  expect((await dragResidue(page)).drag).toMatchObject({ active: true, canAfford: false });

  await finishPointer(page, 'pointerup', target, 'mouse', 31);
  await assertNoDragResidue(page);
  expect(await facts(page)).toEqual(before);
  await page.clock.runFor(4_000);
  expect(await facts(page)).toEqual(before);
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('pointercancel mid-drag mutates nothing and leaves no proxy or highlight behind', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ready = await advanceUntil(
    page,
    (f) => !f.me.active && f.me.hand.some((c) => c.cardType === 'creature' && c.cost <= f.mana),
    'empty active with an affordable creature in hand',
  );
  const creature = ready.me.hand.find((c) => c.cardType === 'creature' && c.cost <= ready.mana);
  const before = await facts(page);

  const locator = handCard(page, creature.uid);
  await beginPointer(page, locator, 'mouse', 41);
  const target = await anchorPoint(page, 'me.active');
  await movePointer(page, target, 'mouse', 41);
  await expect(page.locator('body > .aaa-drag-proxy')).toHaveCount(1);
  await expect(page.locator('.aaa-drop-zone[data-drop="me.active"]')).toHaveCount(1);

  // Cancellation is cleanup-only, even though the final coordinates sit on a
  // legal drop zone (the classic INP-05 contract).
  await finishPointer(page, 'pointercancel', target, 'mouse', 41);
  await assertNoDragResidue(page);
  expect(await facts(page)).toEqual(before);
  await page.clock.runFor(4_000);
  expect(await facts(page)).toEqual(before);
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('a sub-threshold press is still a press: no drag, no mutation, and the picker still opens on click', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ready = await advanceUntil(
    page,
    (f) => f.me.hand.length > 0,
    'a hand to press',
  );
  // The last fanned card is the topmost one — a real click can always reach it.
  const topUid = await page.locator('.aaa-hand-card').last().getAttribute('data-uid');
  const card = ready.me.hand.find((c) => c.uid === topUid);
  expect(card, 'top hand card resolves to a hand entry').toBeTruthy();
  const before = await facts(page);

  const locator = handCard(page, card.uid);
  const start = await beginPointer(page, locator, 'mouse', 51);
  const belowThreshold = { x: start.x + 14.99, y: start.y };
  await movePointer(page, belowThreshold, 'mouse', 51);

  // 14.99 px is still a press: tracked, but not a drag.
  expect((await dragResidue(page)).drag).toMatchObject({ active: false });
  await expect(page.locator('body > .aaa-drag-proxy')).toHaveCount(0);
  await expect(page.locator('.aaa-drop-zone')).toHaveCount(0);

  await finishPointer(page, 'pointerup', belowThreshold, 'mouse', 51);
  await assertNoDragResidue(page);
  expect(await facts(page)).toEqual(before);

  // The click fallback survives untouched: it still opens the classic picker.
  await locator.click();
  const expectedTitle = card.cardType === 'creature'
    ? 'Summon Creature'
    : (card.type === 'set' ? 'Set Verse' : 'Cast Verse');
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText(expectedTitle);
  expect(await facts(page)).toEqual(before);
});

test('a set verse dragged onto the me.set quad lands face-down through the classic dispatch', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ready = await advanceUntil(
    page,
    (f) => !f.me.set && f.me.hand.some((c) => c.type === 'set' && c.cost <= f.mana),
    'affordable set verse in hand with an empty set slot',
  );
  const verse = ready.me.hand.find((c) => c.type === 'set' && c.cost <= ready.mana);

  const locator = handCard(page, verse.uid);
  await beginPointer(page, locator, 'mouse', 61);
  const target = await anchorPoint(page, 'me.set');
  await movePointer(page, target, 'mouse', 61);
  // A set verse only ever offers the empty set quad.
  await expect(page.locator('.aaa-drop-zone')).toHaveCount(1);
  await expect(page.locator('.aaa-drop-zone[data-drop="me.set"]')).toHaveCount(1);
  await finishPointer(page, 'pointerup', target, 'mouse', 61);
  await page.clock.runFor(6_000);

  const after = await facts(page);
  expect(after.me.set).toBe(true);
  expect(after.me.hand.map((c) => c.uid)).not.toContain(verse.uid);
  const setCard = page.locator('.aaa-card-layer [data-anchor="me.set"]');
  await expect(setCard).toHaveCount(1);
  await expect(setCard.locator('.tf-aaa-card--back')).toHaveCount(1);
  await expect(setCard.locator('.tf-aaa-card__title-text')).toHaveCount(0);
  await assertNoDragResidue(page);
});

test('a cast verse dragged onto the field resolves through the engine and reaches the grave', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ready = await advanceUntil(
    page,
    (f) => f.me.hand.some((c) => c.type === 'cast' && c.cost <= f.mana),
    'affordable cast verse in hand',
  );
  const verse = ready.me.hand.find((c) => c.type === 'cast' && c.cost <= ready.mana);

  const locator = handCard(page, verse.uid);
  await beginPointer(page, locator, 'mouse', 71);
  const target = await anchorPoint(page, 'me.active');
  await movePointer(page, target, 'mouse', 71);
  // A cast verse resolves against the board as a whole: one field zone.
  await expect(page.locator('.aaa-drop-zone[data-drop="field"]')).toHaveCount(1);
  await finishPointer(page, 'pointerup', target, 'mouse', 71);
  await page.clock.runFor(2_000);
  await settleModals(page); // any target selection still opens, unchanged
  await page.clock.runFor(6_000);

  const after = await facts(page);
  expect(after.me.hand.map((c) => c.uid)).not.toContain(verse.uid);
  expect(after.me.graveCount).toBeGreaterThan(ready.me.graveCount);
  await assertNoDragResidue(page);
});
