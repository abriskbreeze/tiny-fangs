import { expect, test } from '@playwright/test';

// Behavior-matrix affordance rows exercised END-TO-END inside the AAA shell:
// ACT-07B (Set disabled/inert affordances), ACT-11 (attack/retreat mutual
// exclusion as rail affordances), ACT-15 (action lock: rapid duplicate inputs
// emit exactly one action), ACT-09 (guaranteed direct-attack journey), and
// OVR-02 (symmetric rival-grave inspection). Flows are adaptive: they advance
// real turns against the rival AI under the deterministic fake clock until the
// needed board shape exists, always driving the game through the AAA action
// rail (classic dispatch stays the sole authority).

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
      hasRetreated: G.hasRetreated,
      log: G.log.map((entry) => entry.t),
      me: {
        lp: G.me.lp,
        active: summarize(G.me.active),
        bench: G.me.bench.map(summarize),
        set: Boolean(G.me.setVerse),
        grave: G.me.grave.map((c) => ({ uid: c.uid, name: c.name, cardType: c.cardType })),
        graveCount: G.me.grave.length,
        hand: G.me.hand.map((c) => ({
          uid: c.uid, name: c.name, cardType: c.cardType, type: c.type ?? null, cost: c.cost,
        })),
      },
      opp: {
        lp: G.opp.lp,
        active: summarize(G.opp.active),
        bench: G.opp.bench.map(summarize),
        set: Boolean(G.opp.setVerse),
        grave: G.opp.grave.map((c) => ({ uid: c.uid, name: c.name, cardType: c.cardType })),
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

// Card advantage while a shape is starving: with no affordable creature in
// hand, cast Grave Echo (creature back from the grave) or Dark Pact (draw
// two) through the cast rail so the summon loop can keep a board on ANY
// trajectory.
async function sustainIfPossible(page) {
  for (let i = 0; i < 3; i++) {
    const f = await facts(page);
    if (!f.myTurn || f.winner !== null) return;
    if (f.me.active && f.me.bench.length > 0) return;
    if (f.me.hand.some((c) => c.cardType === 'creature' && c.cost <= f.mana)) return;
    const echo = f.me.hand.find((c) => c.name === 'Grave Echo' && c.cost <= f.mana);
    const pact = f.me.hand.find((c) => c.name === 'Dark Pact' && c.cost <= f.mana);
    const graveCreature = f.me.grave.some((c) => c.cardType === 'creature');
    let cast = null;
    if (echo && graveCreature) cast = echo;
    else if (pact && f.me.lp >= 2) cast = pact;
    if (!cast) return;
    await page.locator('#aaa-action-cast').click();
    await expect(page.locator('#modal-title')).toHaveText('Cast Verse');
    await modalOption(page, new RegExp(cast.name)).click();
    await page.clock.runFor(2_000);
    await settleModals(page); // possible target/grave selection follow-up
    await page.clock.runFor(6_000);
  }
}

// One full board-keeping pass for the current turn: summon everything
// affordable, sustain the hand if it starved, then summon again.
async function buildBoard(page) {
  while (await summonIfPossible(page)) { /* fill active then bench */ }
  await sustainIfPossible(page);
  while (await summonIfPossible(page)) { /* summon whatever sustain found */ }
}

// Fight while advancing: attack whenever the affordance is open. Passively
// passing turns loses to the rival AI before shapes form, and trajectories
// diverge run-to-run (animation timing shifts the seeded Math.random
// consumption), so every adaptive loop must stay competitive on ANY
// trajectory. `requireDefender` skips direct attacks (they can end the game
// early when a loop still needs it running).
async function attackIfPossible(page, { requireDefender = false } = {}) {
  const f = await facts(page);
  const legal =
    f.myTurn && f.winner === null && f.me.active
    && !f.firstTurn && !f.hasAttacked && !f.hasRetreated;
  if (!legal) return false;
  if (requireDefender && !f.opp.active) return false;
  if (!f.opp.active && f.opp.lp <= 1) return false; // never win mid-loop
  await page.locator('#aaa-action-attack').click();
  await page.clock.runFor(4_000);
  await settleModals(page);
  await page.clock.runFor(8_000);
  return true;
}

// Fire two rapid clicks on one rail button inside a single JS task — no clock
// advancement and no await between them (the duplicate-input seam of ACT-15).
async function doubleClickRail(page, buttonId) {
  await page.evaluate((id) => {
    const button = document.getElementById(id);
    button.click();
    button.click();
  }, buttonId);
}

// A native click() on a disabled button must be inert; assert nothing opened
// and the engine state is byte-identical.
async function assertDisabledRailButtonInert(page, buttonId) {
  await expect(page.locator(`#${buttonId}`)).toBeDisabled();
  const before = await facts(page);
  await page.evaluate((id) => document.getElementById(id).click(), buttonId);
  await page.clock.runFor(2_000);
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
  expect(await facts(page)).toEqual(before);
}

test('ACT-07B: unaffordable Set options are inert and an occupied slot disables the rail Set button', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Phase A — an unaffordable Set option renders disabled (.off) and is
  // inert. Shape: a set verse in hand costing more than the current mana
  // (summoning first drains mana, which both keeps us alive and creates the
  // unaffordable window).
  let shapedA = null;
  for (let i = 0; i < 10 && !shapedA; i++) {
    await buildBoard(page); // drains mana too — creates the unaffordable window
    const f = await facts(page);
    expect(f.winner, 'game ended before the unaffordable-set shape').toBeNull();
    if (
      f.myTurn
      && !f.me.set
      && f.me.hand.some((c) => c.type === 'set' && c.cost > f.mana)
    ) {
      shapedA = f;
      break;
    }
    await attackIfPossible(page);
    await endTurnAndReturn(page);
  }
  expect(shapedA, 'reached hand with an unaffordable set verse').toBeTruthy();

  // The rail Set button itself stays enabled (affordability is judged per
  // option — mirrors classic updateButtons, which only gates on presence and
  // an occupied slot).
  await expect(page.locator('#aaa-action-set')).toBeEnabled();
  await page.locator('#aaa-action-set').click();
  await expect(page.locator('#modal-title')).toHaveText('Set Verse');

  const setsInHand = shapedA.me.hand.filter((c) => c.type === 'set');
  const options = page.locator('#modal-opts .option');
  await expect(options).toHaveCount(setsInHand.length);
  const offCount = setsInHand.filter((c) => c.cost > shapedA.mana).length;
  await expect(page.locator('#modal-opts .option.off')).toHaveCount(offCount);

  // Clicking a disabled option changes nothing: the modal stays open and no
  // verse leaves the hand or lands on the set slot.
  await page.locator('#modal-opts .option.off').first().click();
  await page.clock.runFor(2_000);
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  const afterOffClick = await facts(page);
  expect(afterOffClick.me.set).toBe(false);
  expect(afterOffClick.me.hand).toEqual(shapedA.me.hand);
  expect(afterOffClick.mana).toBe(shapedA.mana);
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);

  // Phase B — set an affordable verse, then the occupied slot disables the
  // rail button entirely and a click on it is inert.
  let readyB = null;
  for (let i = 0; i < 10 && !readyB; i++) {
    const f = await facts(page);
    expect(f.winner, 'game ended before the affordable-set shape').toBeNull();
    if (
      f.myTurn && !f.me.set
      && f.me.hand.some((c) => c.type === 'set' && c.cost <= f.mana)
    ) {
      readyB = f;
      break;
    }
    await attackIfPossible(page);
    await endTurnAndReturn(page);
  }
  expect(readyB, 'reached an affordable set verse with an empty set slot').toBeTruthy();
  const verse = readyB.me.hand.find((c) => c.type === 'set' && c.cost <= readyB.mana);
  await page.locator('#aaa-action-set').click();
  await expect(page.locator('#modal-title')).toHaveText('Set Verse');
  await modalOption(page, new RegExp(verse.name)).click();
  await page.clock.runFor(6_000);

  const occupied = await facts(page);
  expect(occupied.me.set).toBe(true);
  await assertDisabledRailButtonInert(page, 'aaa-action-set');
});

test('ACT-11: attack and retreat are mutually exclusive once-per-turn rail affordances that reset on End Turn', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  async function buildCombatShape(description) {
    for (let i = 0; i < 12; i++) {
      await buildBoard(page);
      const f = await facts(page);
      expect(f.winner, `game ended before: ${description}`).toBeNull();
      if (
        f.myTurn && f.me.active && f.me.bench.length > 0
        && !f.firstTurn && !f.hasAttacked && !f.hasRetreated
      ) {
        return f;
      }
      await attackIfPossible(page);
      await endTurnAndReturn(page);
    }
    throw new Error(`never reached: ${description}`);
  }

  // Shape: active + bench on a turn where both actions are still open.
  // Retreat direction first — the shape survives a retreat (the pair merely
  // swaps), which keeps the later attack-direction rebuild cheap and the
  // whole journey inside the game's competitive window.
  const retreatShape = await buildCombatShape('retreat-first combat shape');
  await expect(page.locator('#aaa-action-attack')).toBeEnabled();
  await expect(page.locator('#aaa-action-retreat')).toBeEnabled();
  await page.locator('#aaa-action-retreat').click();
  await expect(page.locator('#modal.open')).toBeVisible();
  await modalOption(page, new RegExp(retreatShape.me.bench[0].name)).click();
  await page.clock.runFor(6_000);
  await settleModals(page);

  const afterRetreat = await facts(page);
  expect(afterRetreat.hasRetreated).toBe(true);
  expect(afterRetreat.hasAttacked).toBe(false);
  await expect(page.locator('#aaa-action-attack')).toBeDisabled();
  await expect(page.locator('#aaa-action-retreat')).toBeDisabled();
  // A click on the closed attack affordance mutates nothing.
  const beforeGhostAttack = await facts(page);
  await page.evaluate(() => document.getElementById('aaa-action-attack').click());
  await page.clock.runFor(2_000);
  const afterGhostAttack = await facts(page);
  expect(afterGhostAttack.hasAttacked).toBe(false);
  expect(afterGhostAttack.opp).toEqual(beforeGhostAttack.opp);

  // End Turn resets the pair for the next turn.
  await endTurnAndReturn(page);
  const nextTurn = await facts(page);
  expect(nextTurn.hasAttacked).toBe(false);
  expect(nextTurn.hasRetreated).toBe(false);

  // Rebuild the shape, then take the mirror direction: attack → both close.
  await buildCombatShape('attack-first combat shape');
  await expect(page.locator('#aaa-action-attack')).toBeEnabled();
  await expect(page.locator('#aaa-action-retreat')).toBeEnabled();
  await page.locator('#aaa-action-attack').click();
  await page.clock.runFor(4_000);
  await settleModals(page);
  await page.clock.runFor(8_000);
  const afterAttack = await facts(page);
  expect(afterAttack.hasAttacked).toBe(true);
  expect(afterAttack.hasRetreated).toBe(false);
  await expect(page.locator('#aaa-action-attack')).toBeDisabled();
  await expect(page.locator('#aaa-action-retreat')).toBeDisabled();
  // A click on the closed retreat affordance opens nothing.
  await page.evaluate(() => document.getElementById('aaa-action-retreat').click());
  await page.clock.runFor(2_000);
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
  expect((await facts(page)).hasRetreated).toBe(false);
});

test('ACT-15: rapid duplicate inputs emit exactly one action (attack and End Turn)', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Reach an attack-legal state with a defending rival active so damage
  // accounting can prove the single resolution.
  let ready = null;
  for (let i = 0; i < 12 && !ready; i++) {
    await buildBoard(page);
    const f = await facts(page);
    expect(f.winner, 'game ended before the duplicate-attack shape').toBeNull();
    if (
      f.myTurn && f.me.active && f.opp.active && !f.opp.set
      && !f.firstTurn && !f.hasAttacked && !f.hasRetreated
    ) {
      // No rival face-down verse: damage accounting stays exact (no
      // negation/trigger can distort the single-resolution proof).
      ready = f;
      break;
    }
    // The shape needs an untouched attack and a defender, so any legal
    // attack here would BE the shape — only advancing remains. Direct
    // attacks are skipped so the loop cannot win the game early.
    await endTurnAndReturn(page);
  }
  expect(ready, 'reached duplicate-attack shape').toBeTruthy();

  const myAtk = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const { getEffectiveAtk } = await import('/shared/engine.js');
    return getEffectiveAtk(state.G.me.active, state.G.me, state.G.opp);
  });

  // TWO clicks in the same task, no clock advance between them.
  await doubleClickRail(page, 'aaa-action-attack');
  await page.clock.runFor(4_000);
  await settleModals(page);
  await page.clock.runFor(8_000);

  const after = await facts(page);
  expect(after.winner).toBeNull();
  expect(after.myTurn).toBe(true);
  expect(after.hasAttacked).toBe(true);
  // The duplicate never reached the engine: no rejection was ever logged.
  expect(after.log).not.toContain('Already attacked this turn');
  // Exactly one attack's worth of damage landed on the rival:
  // a doubled attack would either hit the promoted/bench creature again or
  // (with an emptied board) convert to a direct hit — so LP must be intact.
  expect(after.opp.lp).toBe(ready.opp.lp);
  if (myAtk >= ready.opp.active.hp) {
    // Single exact resolution: the defender was KO'd into the grave once —
    // and no OTHER rival creature followed it there (a doubled attack with a
    // promoted bench would fell a second one).
    expect(after.opp.grave.map((c) => c.uid)).toContain(ready.opp.active.uid);
    expect(after.opp.grave.filter((c) => c.cardType === 'creature').length)
      .toBe(ready.opp.grave.filter((c) => c.cardType === 'creature').length + 1);
    // Any bench creature promoted after the KO is untouched — a doubled
    // attack would have carved into it.
    if (after.opp.active) {
      const promotedFrom = ready.opp.bench.find((c) => c.uid === after.opp.active.uid);
      if (promotedFrom) expect(after.opp.active.hp).toBe(promotedFrom.hp);
    }
  } else {
    expect(after.opp.active.uid).toBe(ready.opp.active.uid);
    expect(after.opp.active.hp).toBe(ready.opp.active.hp - myAtk);
  }
  // The rail mirrors the spent attack.
  await expect(page.locator('#aaa-action-attack')).toBeDisabled();

  // Double-click End Turn: exactly one turn cycle passes and the wrong-turn
  // duplicate never reaches the engine.
  const beforeEnd = await facts(page);
  await doubleClickRail(page, 'aaa-action-end');
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
  const afterEnd = await facts(page);
  expect(afterEnd.winner).toBeNull();
  expect(afterEnd.myTurn).toBe(true);
  expect(afterEnd.turn).toBe(beforeEnd.turn + 1);
  expect(afterEnd.log).not.toContain('Not your turn');
});

test('ACT-09: a direct attack with no opposing active removes exactly one rival life, mirrored on the hearts rail', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Adaptive build: attack-KO the rival board whenever legal until an attack
  // window opens with NO opposing active, then attack directly.
  let landed = false;
  for (let i = 0; i < 14 && !landed; i++) {
    await buildBoard(page);
    const f = await facts(page);
    expect(f.winner, 'game ended before the direct-attack window').toBeNull();
    const attackLegal =
      f.myTurn && f.me.active && !f.firstTurn && !f.hasAttacked && !f.hasRetreated;
    if (attackLegal && !f.opp.active) {
      // The guaranteed-direct journey: rival board is empty at our window.
      await expect(page.locator('#aaa-action-attack')).toBeEnabled();
      await page.locator('#aaa-action-attack').click();
      await page.clock.runFor(4_000);
      await settleModals(page);
      await page.clock.runFor(8_000);

      const after = await facts(page);
      expect(after.hasAttacked).toBe(true);
      // Exactly one life lost, straight off the engine's direct branch.
      expect(after.opp.lp).toBe(f.opp.lp - 1);
      expect(after.log).toContain('Direct hit! Lost a life!');
      // The AAA hearts rail mirrors the engine LP.
      await expect(page.locator('#aaa-opp-lp'))
        .toHaveText('♥'.repeat(after.opp.lp) + '♡'.repeat(3 - after.opp.lp));
      landed = true;
      break;
    }
    if (attackLegal) {
      // Clear the way: attack the occupied rival active (KO chips at it).
      await page.locator('#aaa-action-attack').click();
      await page.clock.runFor(4_000);
      await settleModals(page);
      await page.clock.runFor(8_000);
      const swung = await facts(page);
      if (swung.winner !== null) break;
    }
    await endTurnAndReturn(page);
  }
  expect(landed, 'reached and landed the guaranteed direct attack').toBe(true);
});

test('OVR-02: the rival grave chip opens the symmetric graveyard browser with hold-to-zoom detail', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Shape: a non-empty rival grave (the rival AI casting a verse or losing a
  // creature both feed it; keep a board so the game stays alive).
  let shaped = null;
  for (let i = 0; i < 10 && !shaped; i++) {
    await buildBoard(page);
    const f = await facts(page);
    expect(f.winner, 'game ended before the rival grave filled').toBeNull();
    if (f.myTurn && f.opp.graveCount > 0) {
      shaped = f;
      break;
    }
    // A KO on the defender feeds the rival grave; direct attacks are skipped
    // so the loop cannot win the game before the browser is inspected.
    await attackIfPossible(page, { requireDefender: true });
    await endTurnAndReturn(page);
  }
  expect(shaped, 'reached a non-empty rival grave').toBeTruthy();

  // The rival grave chip exists exactly because the grave is non-empty, and
  // opens the classic browser for the OPPONENT side.
  const chip = page.locator('button[data-chip="opp.grave"]');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveText(String(shaped.opp.graveCount));
  await chip.click();
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText("Rival's Graveyard");

  // Newest first, one entry per grave card, each carrying the hold-to-zoom
  // handlers.
  const entries = page.locator('#modal-opts .option[data-uid]');
  await expect(entries).toHaveCount(shaped.opp.graveCount);
  const newest = shaped.opp.grave[shaped.opp.grave.length - 1];
  await expect(entries.first()).toHaveAttribute('data-uid', newest.uid);
  expect(
    await entries.first().evaluate((el) => el.getAttribute('onpointerdown')),
  ).toContain("'opp'");

  // Hold an entry for 400 ms: the card detail modal opens on that exact card.
  const box = await entries.first().boundingBox();
  expect(box).not.toBeNull();
  const payload = {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    isPrimary: true,
    pointerId: 21,
    pointerType: 'touch',
  };
  await entries.first().dispatchEvent('pointerdown', payload);
  await page.clock.runFor(399);
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await page.clock.runFor(1);
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardDetail')).toContainText(newest.name);
  await entries.first().dispatchEvent('pointerup', { ...payload, buttons: 0 });
  await page.evaluate(() => window.closeCardModal(new Event('click'), true));
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await page.evaluate(() => window.closeModal());
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});
