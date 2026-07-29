import { expect, test } from '@playwright/test';

// Bug #2 — "no defeat screen plays when you lose, so there is no game loop".
//
// The behaviour-matrix rows this file drives are STA-09 (a terminal result
// appears after event playback and blocks further actions), STA-10 (Play Again
// disposes the old owner and yields a clean, playable match) and OVR-11
// (victory / defeat / deck-out distinction on the result overlay).
//
// The important property of this file is that the terminal states are REACHED
// BY PLAYING, in both presentation modes. `desktop-overlay-results.spec.js`
// proves the overlay's own contract by calling `showResult` through the
// behaviour-QA hook; that is exactly why the shipped bug survived it. Nothing
// here calls `showResult`, and only the last assertion group uses a fixture.

const COIN_FLIP_DURATION_MS = 1_780;
const BEGIN_DURATION_MS = 1_330;
const MODES = ['classic', 'aaa'];

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

async function startSoloGameGoingFirst(
  page,
  mode,
  { deck = /\bShadow\b/, difficulty = 'hunter' } = {},
) {
  await page.goto(`/?presentation=${mode}`);
  await expect(page.locator('html')).toHaveAttribute(
    'data-presentation',
    mode,
  );
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  // The fake clock never rewinds, and it carries the time already burned by an
  // earlier match across the Play Again reload — so pause relative to now.
  const clockNow = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(clockNow + 60_000));
  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator(`#diff-${difficulty}`).click();
  await expect(page.locator(`#diff-${difficulty}`)).toHaveClass(/\bactive\b/);
  await page
    .locator('#deck-select .deck-btn')
    .filter({ hasText: deck })
    .first()
    .click();
  await modalOption(page, deck).click();
  await modalOption(page, /HEADS/).click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, /Go First/).click();
  await page.clock.runFor(BEGIN_DURATION_MS + 2_000);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        return state.G?.myTurn ?? null;
      }),
    )
    .toBe(true);
}

async function facts(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const G = state.G;
    if (!G) return null;
    return {
      firstTurn: G.firstTurn,
      hasAttacked: G.hasAttacked,
      hasRetreated: G.hasRetreated,
      mana: G.me.mana,
      me: {
        active: G.me.active ? { name: G.me.active.name } : null,
        benchCount: G.me.bench.length,
        deckCount: G.me.deck.length,
        handCount: G.me.hand.length,
        hand: G.me.hand.map((c) => ({
          cardType: c.cardType,
          cost: c.cost,
          name: c.name,
        })),
        lp: G.me.lp,
      },
      myTurn: G.myTurn,
      opp: { lp: G.opp.lp, active: Boolean(G.opp.active) },
      turn: G.turn,
      winner: G.winner ?? null,
    };
  });
}

async function resultSnapshot(page) {
  return page.evaluate(() => {
    const el = document.getElementById('result');
    const rect = el.getBoundingClientRect();
    return {
      open: el.classList.contains('open'),
      outcome: el.dataset.outcome ?? null,
      painted: rect.width > 0 && rect.height > 0,
      reason: el.dataset.reason ?? null,
      text: document.getElementById('result-text').textContent,
      visible: getComputedStyle(el).display !== 'none',
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

// Every action goes through a real control: the AAA rail in `aaa`, the exposed
// desktop entry points in `classic` (whose buttons are hold-to-confirm).
async function act(page, mode, action) {
  if (mode === 'aaa') {
    await page.locator(`#aaa-action-${action}`).click();
    return;
  }
  const entry = { attack: 'doAttack', end: 'endTurn', summon: 'doSummon' };
  await page.evaluate((name) => {
    void window[name]?.();
  }, entry[action]);
}

async function summonWhilePossible(page, mode) {
  for (let i = 0; i < 3; i++) {
    const f = await facts(page);
    if (!f || !f.myTurn || f.winner !== null) return;
    if (f.me.active && f.me.benchCount >= 2) return;
    const creature = f.me.hand.find(
      (c) => c.cardType === 'creature' && c.cost <= f.mana,
    );
    if (!creature) return;
    await act(page, mode, 'summon');
    await expect(page.locator('#modal-title')).toHaveText('Summon Creature');
    await modalOption(page, new RegExp(creature.name)).click();
    await page.clock.runFor(6_000);
  }
}

/**
 * Play real turns until the match ends or `maxTurns` is spent.
 *
 * `aggressive` plays to win (build a board, swing every legal turn); passive
 * play hands the initiative to the rival AI, which is how a real player loses.
 */
async function playUntilTerminal(page, mode, { aggressive, maxTurns = 30 }) {
  for (let i = 0; i < maxTurns; i++) {
    const f = await facts(page);
    if (!f || f.winner !== null) return f;
    if (f.myTurn) {
      if (aggressive) {
        await summonWhilePossible(page, mode);
        const armed = await facts(page);
        if (
          armed?.winner === null &&
          armed.me.active &&
          !armed.firstTurn &&
          !armed.hasAttacked &&
          !armed.hasRetreated
        ) {
          await act(page, mode, 'attack');
          await page.clock.runFor(4_000);
          await settleModals(page);
          await page.clock.runFor(8_000);
        }
      }
      const beforeEnd = await facts(page);
      if (beforeEnd?.winner !== null) return beforeEnd;
      await act(page, mode, 'end');
    }
    await page.clock.runFor(20_000);
    await settleModals(page);
    await page.clock.runFor(10_000);
  }
  return facts(page);
}

test.describe('the solo game loop closes on a real terminal state', () => {
  for (const mode of MODES) {
    test(`a real solo defeat presents the defeat result and blocks further actions (${mode})`, async ({
      context,
      page,
    }) => {
      test.setTimeout(180_000);
      await installDeterministicBrowser(context, page, [0.1]);
      await startSoloGameGoingFirst(page, mode);

      // Before the match ends the overlay must stay shut — otherwise the
      // assertions below would prove nothing.
      expect(await resultSnapshot(page)).toMatchObject({
        open: false,
        visible: false,
      });

      // Passive play: the rival AI takes the match.
      const final = await playUntilTerminal(page, mode, { aggressive: false });
      expect(final, 'a real match reached a terminal state').toBeTruthy();
      expect(final.winner, 'the rival won a real match').not.toBeNull();
      expect(final.me.lp).toBe(0);

      const result = await resultSnapshot(page);
      expect(result.open).toBe(true);
      expect(result.visible).toBe(true);
      // Painted, not merely class-flagged: in `aaa` the stage would otherwise
      // sit on top of a technically-open overlay.
      expect(result.painted).toBe(true);
      expect(result.outcome).toBe('defeat');
      expect(result.text).toBe('[ DEFEAT ]');
      await expect(page.locator('#result')).toBeVisible();
      await expect(page.locator('#result-text')).toHaveText('[ DEFEAT ]');

      // Further actions are refused. Attempt every offensive control and
      // require the terminal state to be untouched.
      const before = await facts(page);
      if (mode === 'aaa') {
        for (const action of ['summon', 'attack', 'end']) {
          await expect(page.locator(`#aaa-action-${action}`)).toBeDisabled();
        }
      } else {
        for (const id of ['d-btn-summon', 'd-btn-atk', 'd-btn-end']) {
          await expect(page.locator(`#${id}`)).toBeDisabled();
        }
      }
      await page.evaluate(() => {
        void window.doSummon?.();
        void window.doAttack?.();
        void window.doRetreat?.();
        void window.endTurn?.();
      });
      await page.clock.runFor(10_000);
      expect(await facts(page)).toEqual(before);
      expect(await resultSnapshot(page)).toMatchObject({
        open: true,
        outcome: 'defeat',
      });
    });
  }

  for (const mode of MODES) {
    test(`a real solo victory presents the victory result (${mode})`, async ({
      context,
      page,
    }) => {
      test.setTimeout(180_000);
      await installDeterministicBrowser(context, page, [0.1]);
      // Real play against the shipped Pup difficulty — a supported solo mode,
      // driven entirely through the real controls.
      await startSoloGameGoingFirst(page, mode, {
        deck: /\bFang\b/,
        difficulty: 'pup',
      });

      expect(await resultSnapshot(page)).toMatchObject({ open: false });

      const final = await playUntilTerminal(page, mode, { aggressive: true });
      expect(final, 'a real match reached a terminal state').toBeTruthy();
      expect(final.winner, 'a real match was decided').not.toBeNull();
      expect(final.opp.lp, 'the rival was beaten, not the player').toBe(0);
      expect(final.me.lp).toBeGreaterThan(0);

      const result = await resultSnapshot(page);
      expect(result.open).toBe(true);
      expect(result.visible).toBe(true);
      expect(result.painted).toBe(true);
      expect(result.outcome).toBe('victory');
      expect(result.text).toBe('[ VICTORY ]');
      await expect(page.locator('#result')).toBeVisible();
    });
  }

  for (const mode of MODES) {
    test(`Play Again after a real defeat yields a fresh playable match (${mode})`, async ({
      context,
      page,
    }) => {
      test.setTimeout(180_000);
      await installDeterministicBrowser(context, page, [0.1]);
      await startSoloGameGoingFirst(page, mode);

      const final = await playUntilTerminal(page, mode, { aggressive: false });
      expect(final?.winner, 'a real match ended').not.toBeNull();
      await expect(page.locator('#result')).toBeVisible();

      // The real button, from a real finished match.
      await page.locator('#result button').click();

      // The owner is disposed before navigation and the fresh document mounts
      // on the setup screen with no leftover match, timer or result.
      await page.waitForLoadState('load');
      await expect(page.locator('#setup')).toBeVisible();
      await expect(page.locator('#result')).not.toHaveClass(/\bopen\b/);
      await expect(page.locator('#result')).toBeHidden();
      expect(
        await page.evaluate(async () => {
          const { state } = await import('/src/state.js');
          return {
            game: state.G,
            startTime: state.startTime,
            timerInt: state.timerInt,
          };
        }),
      ).toEqual({ game: null, startTime: null, timerInt: null });

      // Coupled journey: the fresh mount is actually playable again.
      await startSoloGameGoingFirst(page, mode);
      const fresh = await facts(page);
      expect(fresh.turn).toBe(1);
      expect(fresh.winner).toBeNull();
      expect(fresh.me.lp).toBe(3);
      expect(fresh.opp.lp).toBe(3);
      expect(fresh.me.handCount).toBeGreaterThanOrEqual(5);
      expect(fresh.me.active).toBeNull();
      expect(fresh.me.benchCount).toBe(0);
      // Exactly one live match timer survives the loop (no leak across the
      // reload boundary).
      expect(
        await page.evaluate(async () => {
          const { state } = await import('/src/state.js');
          return state.timerInt !== null && state.startTime !== null;
        }),
      ).toBe(true);

      // And a real move lands in the new match.
      await summonWhilePossible(page, mode);
      const moved = await facts(page);
      expect(moved.me.active).not.toBeNull();
      expect(moved.winner).toBeNull();
    });
  }

  // Deck-out is the third terminal distinction OVR-11 owns. Real deck-out
  // needs ~20 uninterrupted turns, so the deterministic fixture route carries
  // the presentation contract while the tests above carry "reached by play".
  for (const mode of MODES) {
    test(`the deck-out terminal keeps its own result wording (${mode})`, async ({
      page,
    }) => {
      await page.goto(
        `/?presentation=${mode}&visualQa=1&behaviorQa=1&fixture=deck-out`,
      );
      await expect(page.locator('#result')).toBeVisible({ timeout: 15_000 });
      const result = await resultSnapshot(page);
      expect(result.open).toBe(true);
      expect(result.painted).toBe(true);
      expect(result.reason).toBe('deck-out');
      expect(result.text).toContain('DECK OUT');
      expect(result.outcome).toBe('defeat');
    });
  }
});
