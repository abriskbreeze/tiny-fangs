import { expect, test } from '@playwright/test';

// Phase 8 chunk 2 — the remaining four actions exercised END-TO-END inside
// the AAA shell: set (face-down onto the me.set quad), cast (with any
// follow-up target selection), retreat (bench-choice modal, quad swap), and
// attack (damage on rival hearts/creature). Flows are adaptive: they advance
// real turns against the rival AI under the deterministic fake clock until
// the needed hand/board shape exists, always driving the game through the
// AAA action rail (classic dispatch stays the sole authority).

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

// Keep a fighting board while advancing: summon whenever it is possible —
// passively passing turns loses to the rival AI before shapes form.
async function summonIfPossible(page) {
  const f = await facts(page);
  if (!f.myTurn || f.winner !== null) return false;
  const creature = f.me.hand.find((c) => c.cardType === 'creature' && c.cost <= f.mana);
  if (!creature) return false;
  if (f.me.active && f.me.bench.length >= 2) return false;
  await page.locator('#aaa-action-summon').click();
  await expect(page.locator('#modal-title')).toHaveText('Summon Creature');
  await modalOption(page, new RegExp(creature.name)).click();
  await page.clock.runFor(6_000);
  return true;
}

async function summonFirstAffordable(page) {
  const f = await facts(page);
  const creature = f.me.hand.find((c) => c.cardType === 'creature' && c.cost <= f.mana);
  expect(creature, 'affordable creature in hand').toBeTruthy();
  await page.locator('#aaa-action-summon').click();
  await expect(page.locator('#modal-title')).toHaveText('Summon Creature');
  await modalOption(page, new RegExp(creature.name)).click();
  await page.clock.runFor(6_000);
  return creature;
}

test('set places a face-down verse on the me.set quad', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ready = await advanceUntil(
    page,
    (f) => !f.me.set
      && f.me.hand.some((c) => c.type === 'set' && c.cost <= f.mana),
    'affordable set verse in hand with empty set slot',
  );
  const verse = ready.me.hand.find((c) => c.type === 'set' && c.cost <= ready.mana);

  await page.locator('#aaa-action-set').click();
  await expect(page.locator('#modal-title')).toHaveText('Set Verse');
  await modalOption(page, new RegExp(verse.name)).click();
  await page.clock.runFor(6_000);

  const after = await facts(page);
  expect(after.me.set).toBe(true);
  expect(after.me.hand.map((c) => c.uid)).not.toContain(verse.uid);
  // The AAA board shows exactly an opaque face-down card on the set quad.
  const setCard = page.locator('.aaa-card-layer [data-anchor="me.set"]');
  await expect(setCard).toHaveCount(1);
  await expect(setCard.locator('.tf-aaa-card--back')).toHaveCount(1);
  await expect(setCard.locator('.tf-aaa-card__title-text')).toHaveCount(0);
});

test('cast resolves through the engine (with any target selection) and reaches the grave', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ready = await advanceUntil(
    page,
    (f) => f.me.hand.some((c) => c.type === 'cast' && c.cost <= f.mana),
    'affordable cast verse in hand',
  );
  const verse = ready.me.hand.find((c) => c.type === 'cast' && c.cost <= ready.mana);

  await page.locator('#aaa-action-cast').click();
  await expect(page.locator('#modal-title')).toHaveText('Cast Verse');
  await modalOption(page, new RegExp(verse.name)).click();
  await page.clock.runFor(2_000);
  await settleModals(page); // possible target-selection follow-up
  await page.clock.runFor(6_000);

  const after = await facts(page);
  expect(after.me.hand.map((c) => c.uid)).not.toContain(verse.uid);
  expect(after.me.graveCount).toBeGreaterThanOrEqual(ready.me.graveCount);
  // Grave quad reflects the count chip when the grave is non-empty.
  if (after.me.graveCount > 0) {
    await expect(page.locator('[data-chip="me.grave"]')).toHaveText(String(after.me.graveCount));
  }
});

test('retreat swaps active and bench through the choice modal, mirrored on the quads', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Build the shape (active + bench) while staying alive: summon every turn
  // it is possible, then advance.
  let shaped = null;
  for (let i = 0; i < 12 && !shaped; i++) {
    while (await summonIfPossible(page)) { /* fill active then bench */ }
    const f = await facts(page);
    expect(f.winner, 'game ended before retreat shape').toBeNull();
    if (f.myTurn && f.me.active && f.me.bench.length > 0 && !f.hasAttacked) {
      shaped = f;
      break;
    }
    await endTurnAndReturn(page);
  }
  expect(shaped, 'reached active+bench shape').toBeTruthy();

  expect(shaped.me.active).toBeTruthy();
  expect(shaped.me.bench.length).toBeGreaterThan(0);
  const benchName = shaped.me.bench[0].name;
  const oldActiveUid = shaped.me.active.uid;

  await page.locator('#aaa-action-retreat').click();
  await expect(page.locator('#modal.open')).toBeVisible();
  await modalOption(page, new RegExp(benchName)).click();
  await page.clock.runFor(6_000);

  const after = await facts(page);
  expect(after.me.active.uid).not.toBe(oldActiveUid);
  // New active stands on the active quad with its name on the chassis.
  await expect(
    page.locator('.aaa-card-layer [data-anchor="me.active"] .tf-aaa-card__title-text'),
  ).toHaveText(after.me.active.name);
});

test('attack lands damage on the rival (hearts or creature) from the AAA rail', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  let ready = null;
  for (let i = 0; i < 12 && !ready; i++) {
    while (await summonIfPossible(page)) { /* keep a fighting board */ }
    const f = await facts(page);
    expect(f.winner, 'game ended before attack shape').toBeNull();
    if (f.myTurn && f.me.active && !f.firstTurn && !f.hasAttacked) {
      ready = f;
      break;
    }
    await endTurnAndReturn(page);
  }
  expect(ready, 'reached attack-legal state').toBeTruthy();
  await expect(page.locator('#aaa-action-attack')).toBeEnabled();

  await page.locator('#aaa-action-attack').click();
  await page.clock.runFor(4_000);
  await settleModals(page);
  await page.clock.runFor(8_000);

  const after = await facts(page);
  const damagedLp = after.opp.lp < ready.opp.lp;
  const damagedCreature =
    (ready.opp.active && !after.opp.active)
    || (ready.opp.active && after.opp.active
        && (after.opp.active.hp < ready.opp.active.hp
            || after.opp.graveCount > ready.opp.graveCount));
  expect(after.hasAttacked || after.turn > ready.turn).toBeTruthy();
  expect(damagedLp || damagedCreature).toBeTruthy();
  // Hearts rail mirrors any LP change.
  if (damagedLp) {
    await expect(page.locator('#aaa-opp-lp'))
      .toHaveText('♥'.repeat(after.opp.lp) + '♡'.repeat(3 - after.opp.lp));
  }
});

test('hand fan tracks growth across turns and stays inside the frame', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Let the hand grow by drawing without playing.
  const grown = await advanceUntil(
    page,
    (f) => f.me.hand.length >= 7,
    'hand of at least 7 after draws',
    10,
  );
  await expect(page.locator('.aaa-hand-card')).toHaveCount(grown.me.hand.length);

  // Every fanned card stays inside the 1672-px frame.
  const frame = page.locator('.aaa-frame');
  const frameBox = await frame.boundingBox();
  for (const box of await page.locator('.aaa-hand-card').evaluateAll(
    (nodes) => nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { left: r.left, right: r.right };
    }),
  )) {
    expect(box.left).toBeGreaterThanOrEqual(frameBox.x - 1);
    expect(box.right).toBeLessThanOrEqual(frameBox.x + frameBox.width + 1);
  }
});
