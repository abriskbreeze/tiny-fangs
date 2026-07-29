import { expect, test } from '@playwright/test';

// INP-10 — the classic End Turn hold contract (setupHoldButton, 500 ms):
// a PRE-threshold pointerleave or pointercancel cancels the hold with NO
// dispatch, and the disabled / wrong-turn / animating guards make pointerdown
// inert. Covers both classic surfaces (#d-btn-end desktop, #m-btn-end mobile).

const CLOCK_START = new Date('2026-07-27T12:00:00.000Z');
const CLOCK_PAUSE = new Date('2026-07-27T12:01:00.000Z');
const CLASSIC_FIXTURE_URL = (fixture) =>
  `/?presentation=classic&visualQa=1&fixture=${fixture}`;

async function openFixture(page, fixture, viewport) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  await page.clock.install({ time: CLOCK_START });
  await page.goto(CLASSIC_FIXTURE_URL(fixture));
  await expect(page.locator('html')).toHaveAttribute(
    'data-presentation',
    'classic',
  );
  await expect(page.locator('#setup')).toBeHidden();
  if (viewport?.width < 900) {
    await expect(page.locator('#mobile')).toBeVisible();
  } else {
    await expect(page.locator('#desktop')).toBeVisible();
  }
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const qa = window.__TINY_FANGS_VISUAL_QA__;
        return Boolean(qa && (await qa.ready) && qa.currentFixture);
      }),
    )
    .toBe(true);
  await page.clock.pauseAt(CLOCK_PAUSE);
}

async function gameSnapshot(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const summarizePlayer = (player) => ({
      active: player.active?.uid ?? null,
      bench: player.bench.map((card) => card.uid),
      grave: player.grave.map((card) => card.uid),
      hand: player.hand.map((card) => card.uid),
      lp: player.lp,
      mana: player.mana,
      setVerse: player.setVerse?.uid ?? player.setVerse ?? null,
    });

    return {
      me: summarizePlayer(state.G.me),
      opp: summarizePlayer(state.G.opp),
      firstTurn: state.G.firstTurn,
      hasAttacked: state.G.hasAttacked,
      log: state.G.log.map((entry) => entry.t),
      myTurn: state.G.myTurn,
      turn: state.G.turn,
      winner: state.G.winner,
    };
  });
}

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

async function beginHold(locator, pointerType, pointerId) {
  const point = await pointerPoint(locator);
  await locator.dispatchEvent(
    'pointerdown',
    pointerPayload(point, pointerType, pointerId),
  );
  return point;
}

// The hold-cancel listeners live on the button itself, so the cancelling
// event must be dispatched on the button element.
async function cancelHoldOn(locator, eventName, point, pointerType, pointerId) {
  await locator.dispatchEvent(
    eventName,
    pointerPayload(point, pointerType, pointerId, { buttons: 0 }),
  );
}

const VARIANTS = [
  {
    name: 'desktop pointer',
    button: '#d-btn-end',
    pointerType: 'mouse',
    viewport: { width: 1672, height: 941 },
  },
  {
    name: '390x844 touch',
    button: '#m-btn-end',
    pointerType: 'touch',
    viewport: { width: 390, height: 844 },
  },
];

test.describe('classic End Turn hold: pre-threshold cancellation and guards', () => {
  test.use({
    hasTouch: true,
    viewport: { width: 1672, height: 941 },
  });

  for (const variant of VARIANTS) {
    test(`pre-threshold pointerleave and pointercancel cancel without dispatch for ${variant.name}`, async ({
      page,
    }) => {
      await openFixture(page, 'opening-hand-triad', variant.viewport);
      const button = page.locator(variant.button);
      const before = await gameSnapshot(page);
      expect(before.myTurn).toBe(true);

      for (const [eventName, pointerId] of [
        ['pointerleave', 11],
        ['pointercancel', 12],
      ]) {
        const point = await beginHold(button, variant.pointerType, pointerId);
        await page.clock.runFor(300);
        await expect(button).toHaveClass(/\bholding\b/);
        expect(await gameSnapshot(page)).toEqual(before);

        await cancelHoldOn(
          button,
          eventName,
          point,
          variant.pointerType,
          pointerId,
        );
        await expect(button).not.toHaveClass(/\bholding\b/);

        // Run well past the 500 ms threshold: the cancelled hold must never
        // fire — the turn does not end and no state moves.
        await page.clock.runFor(400);
        expect(await gameSnapshot(page)).toEqual(before);
        await expect
          .poll(() => page.evaluate(async () => {
            const { state } = await import('/src/state.js');
            return state.G.myTurn;
          }))
          .toBe(true);
      }
    });

    test(`disabled, wrong-turn, and animating states make the hold inert for ${variant.name}`, async ({
      page,
    }) => {
      await openFixture(page, 'opening-hand-triad', variant.viewport);
      const button = page.locator(variant.button);

      // Wrong turn: flip the turn and re-render — updateButtons disables the
      // End Turn button, and startHold's guards refuse the pointerdown.
      await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        state.G.myTurn = false;
        // Trigger a classic re-render through an exposed UI entry (selectCard
        // toggles selection and renders; toggling twice leaves it null).
        window.selectCard('hold-guard-render-probe');
        window.selectCard('hold-guard-render-probe');
      });
      await expect(button).toBeDisabled();
      const wrongTurn = await gameSnapshot(page);
      const wrongTurnPoint = await beginHold(button, variant.pointerType, 21);
      await expect(button).not.toHaveClass(/\bholding\b/);
      await page.clock.runFor(600);
      expect(await gameSnapshot(page)).toEqual(wrongTurn);
      await cancelHoldOn(
        button,
        'pointerup',
        wrongTurnPoint,
        variant.pointerType,
        21,
      );

      // Back on our turn the button re-enables (forcePlayerTurn re-renders).
      await page.evaluate(() => window.forcePlayerTurn());
      await expect(button).toBeEnabled();

      // Animating: the guard refuses the hold even on an enabled button.
      await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        state.animating = true;
      });
      const animating = await gameSnapshot(page);
      const animatingPoint = await beginHold(button, variant.pointerType, 22);
      await expect(button).not.toHaveClass(/\bholding\b/);
      await page.clock.runFor(600);
      expect(await gameSnapshot(page)).toEqual(animating);
      expect(animating.myTurn).toBe(true);
      await cancelHoldOn(
        button,
        'pointerup',
        animatingPoint,
        variant.pointerType,
        22,
      );
      await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        state.animating = false;
      });

      // Clean of guards, the same hold still works end-to-end (the guard
      // table blocked the dispatch, not the mechanism).
      const live = await gameSnapshot(page);
      expect(live.myTurn).toBe(true);
      await beginHold(button, variant.pointerType, 23);
      await page.clock.runFor(500);
      await expect
        .poll(() => gameSnapshot(page))
        .toMatchObject({ myTurn: false });
    });
  }
});
