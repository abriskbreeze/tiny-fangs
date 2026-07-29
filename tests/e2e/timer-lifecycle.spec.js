import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1672, height: 941 } });

async function installDeterministicPage(page) {
  await page.clock.install({ time: new Date('2026-07-27T20:00:00.000Z') });
  await page.addInitScript(() => {
    let seed = 0x20_27_07_27;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });
  await page.goto('/');
  const currentPageTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentPageTime + 1_000);
  await page.evaluate(() => {
    const originalSetInterval = window.setInterval.bind(window);
    const originalClearInterval = window.clearInterval.bind(window);
    const activeIntervals = new Set();

    window.setInterval = (callback, delay, ...args) => {
      const intervalId = originalSetInterval(callback, delay, ...args);
      activeIntervals.add(intervalId);
      return intervalId;
    };
    window.clearInterval = (intervalId) => {
      activeIntervals.delete(intervalId);
      return originalClearInterval(intervalId);
    };
    window.__TASK20_TIMER_PROBE__ = {
      activeCount: () => activeIntervals.size,
    };
  });
}

async function beginSoloMatch(page) {
  await page.evaluate(() => {
    window.__TASK20_START_PROMISE__ = window.startGame('fang', true);
  });
  await page.clock.runFor(1_330);
  await expect.poll(() => page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return Boolean(state.G);
  })).toBe(true);
}

async function timerSnapshot(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return {
      activeIntervals: window.__TASK20_TIMER_PROBE__.activeCount(),
      desktopTime: document.getElementById('d-time').textContent,
      gameHasStartTime: Object.hasOwn(state.G ?? {}, 'startTime'),
      gameHasTimerInt: Object.hasOwn(state.G ?? {}, 'timerInt'),
      hasTimerOwner: state.timerInt !== null,
      mobileTime: document.getElementById('m-time').textContent,
      startTime: state.startTime,
    };
  });
}

test('classic desktop owns one timer across replacement/restart and stops at solo result', async ({ page }) => {
  await installDeterministicPage(page);
  await beginSoloMatch(page);

  await expect.poll(() => timerSnapshot(page)).toMatchObject({
    activeIntervals: 1,
    desktopTime: '0:00',
    gameHasStartTime: false,
    gameHasTimerInt: false,
    hasTimerOwner: true,
    mobileTime: '0:00',
  });

  await page.clock.runFor(61_000);
  await expect.poll(() => timerSnapshot(page)).toMatchObject({
    activeIntervals: 1,
    desktopTime: '1:01',
    hasTimerOwner: true,
    mobileTime: '1:01',
  });

  const replacementResult = await page.evaluate(async () => {
    const { setGame, state } = await import('/src/state.js');
    const startTime = state.startTime;
    const timerInt = state.timerInt;
    setGame({ ...state.G, turn: state.G.turn + 1 });
    return {
      keptStartTime: state.startTime === startTime,
      keptTimerOwner: state.timerInt === timerInt,
    };
  });
  expect(replacementResult).toEqual({ keptStartTime: true, keptTimerOwner: true });
  await page.clock.runFor(1_000);
  await expect.poll(() => timerSnapshot(page)).toMatchObject({
    activeIntervals: 1,
    desktopTime: '1:02',
    mobileTime: '1:02',
  });

  await beginSoloMatch(page);
  await expect.poll(() => timerSnapshot(page)).toMatchObject({
    activeIntervals: 1,
    desktopTime: '0:00',
    mobileTime: '0:00',
  });

  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const active = [...state.G.me.hand, ...state.G.me.deck].find((card) => card.cardType === 'creature');
    state.G.me.active = active;
    state.G.me.hand = state.G.me.hand.filter((card) => card.uid !== active.uid);
    state.G.me.deck = state.G.me.deck.filter((card) => card.uid !== active.uid);
    state.G.opp.active = null;
    state.G.opp.lp = 1;
    state.G.firstTurn = false;
    state.G.myTurn = true;
    state.G._playerSetupDone = true;
    window.startPlayerTurn();
  });
  await expect(page.locator('#d-btn-atk')).toBeEnabled();
  await page.locator('#d-btn-atk').click();
  await page.clock.runFor(2_500);

  await expect(page.locator('#result')).toHaveClass(/open/);
  const terminalSnapshot = await timerSnapshot(page);
  expect(terminalSnapshot.activeIntervals).toBe(0);
  expect(terminalSnapshot.hasTimerOwner).toBe(false);
  expect(terminalSnapshot.startTime).not.toBeNull();
  const terminalDisplay = terminalSnapshot.desktopTime;
  await page.clock.runFor(10_000);
  await expect.poll(() => timerSnapshot(page)).toMatchObject({
    activeIntervals: 0,
    desktopTime: terminalDisplay,
    hasTimerOwner: false,
    mobileTime: terminalDisplay,
  });
});

test('clear/unmount disposes the mounted timer owner', async ({ page }) => {
  await installDeterministicPage(page);
  await beginSoloMatch(page);

  await expect.poll(() => timerSnapshot(page)).toMatchObject({
    activeIntervals: 1,
    hasTimerOwner: true,
  });

  await page.evaluate(async () => {
    const { clearGame } = await import('/src/state.js');
    clearGame();
  });

  await expect.poll(() => timerSnapshot(page)).toMatchObject({
    activeIntervals: 0,
    hasTimerOwner: false,
    startTime: null,
  });
});
