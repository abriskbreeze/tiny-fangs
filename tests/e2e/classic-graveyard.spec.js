import { expect, test } from '@playwright/test';

// Classic-shell graveyard access and drill-down (user bugs #3/#4/#5):
//  - the grave zone opens the browser on a plain CLICK at both desktop and
//    mobile, for the player AND the rival (the grave is public — OVR-02);
//  - a graveyard entry opens its detail on a click, and closing the detail
//    returns to the SAME list instead of dumping the player on the board;
//  - clicking outside the browser closes the whole stack;
//  - board/HUD/modal chrome is not selectable text, rules prose is.

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
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'classic');
  await expect(page.locator('#setup')).toBeHidden();
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

async function graveNames(page, who) {
  return page.evaluate(async (side) => {
    const { state } = await import('/src/state.js');
    const player = side === 'me' ? state.G.me : state.G.opp;
    return player.grave.map((card) => ({ uid: card.uid, name: card.name }));
  }, who);
}

// Move the rival's face-up board creatures into their (public) graveyard and
// re-render through the classic `selectCard` entry point. Hidden hand/Set are
// never touched.
async function fabricateRivalGrave(page) {
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const moved = [state.G.opp.active, ...state.G.opp.bench].filter(Boolean);
    state.G.opp.active = null;
    state.G.opp.bench = [];
    state.G.opp.grave.push(...moved);
  });
  await page.evaluate(() => window.selectCard('__graveyard-spec-render__'));
  await page.evaluate(() => window.selectCard('__graveyard-spec-render__'));
  const grave = await graveNames(page, 'opp');
  expect(grave.length, 'rival grave is non-empty').toBeGreaterThan(0);
  return grave;
}

test('the desktop grave zones open both graveyards on a plain click', async ({ page }) => {
  await openFixture(page, 'ko-promotion', { width: 1672, height: 941 });
  await expect(page.locator('#desktop')).toBeVisible();

  const mine = await graveNames(page, 'me');
  expect(mine.length).toBeGreaterThan(0);
  await expect(page.locator('#d-grave')).toHaveText(String(mine.length));

  await page.locator('#d-grave').click();
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');
  await expect(page.locator('#modal-opts .option[data-uid]')).toHaveCount(mine.length);
  await page.locator('#modal .cancel').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);

  // Empty rival grave: the browser still opens and still dismisses outside.
  await expect(page.locator('#d-opp-grave')).toHaveText('0');
  await page.locator('#d-opp-grave').click();
  await expect(page.locator('#modal-title')).toHaveText("Rival's Graveyard");
  await expect(page.locator('#modal-opts')).toContainText('No cards in graveyard');
  await page.locator('#modal').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);

  const rival = await fabricateRivalGrave(page);
  await expect(page.locator('#d-opp-grave')).toHaveText(String(rival.length));
  await page.locator('#d-opp-grave').click();
  await expect(page.locator('#modal-title')).toHaveText("Rival's Graveyard");
  await expect(page.locator('#modal-opts .option[data-uid]')).toHaveCount(rival.length);
  await page.locator('#modal .cancel').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('the mobile grave slots open both graveyards on a plain click', async ({ page }) => {
  await openFixture(page, 'ko-promotion', { width: 390, height: 844 });
  await expect(page.locator('#mobile')).toBeVisible();

  const mine = await graveNames(page, 'me');
  await page.locator('#m-my-grave-slot').click();
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');
  await expect(page.locator('#modal-opts .option[data-uid]')).toHaveCount(mine.length);
  await page.locator('#modal .cancel').click();

  const rival = await fabricateRivalGrave(page);
  await page.locator('#m-opp-grave-slot').click();
  await expect(page.locator('#modal-title')).toHaveText("Rival's Graveyard");
  await expect(page.locator('#modal-opts .option[data-uid]')).toHaveCount(rival.length);
  await page.locator('#modal .cancel').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('classic graveyard drill-down returns to the same list and outside-click closes all', async ({
  page,
}) => {
  await openFixture(page, 'ko-promotion', { width: 1672, height: 941 });
  const mine = await graveNames(page, 'me');
  const newest = mine[mine.length - 1];

  await page.locator('#d-grave').click();
  const entry = page.locator('#modal-opts .option[data-uid]').first();
  await expect(entry).toHaveAttribute('data-uid', newest.uid);

  await entry.click();
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardDetail')).toContainText(newest.name);

  await page.locator('#cardDetail .close-btn').click();
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');

  // Outside the browser closes everything.
  await page.locator('#modal').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);

  // A detail opened from the BOARD keeps the plain close contract: closing
  // it must NOT resurrect a graveyard browser.
  await page.locator('#d-my-active .card-active').dispatchEvent('pointerdown', {
    bubbles: true,
    pointerId: 81,
    pointerType: 'mouse',
  });
  await page.clock.runFor(400);
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await page.evaluate(() => window.closeCardModal(new Event('click'), true));
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
});

test('classic game chrome is not selectable while the rules overlay prose is', async ({
  page,
}) => {
  await openFixture(page, 'ko-promotion', { width: 1672, height: 941 });
  const userSelect = (locator) =>
    locator.first().evaluate((el) => getComputedStyle(el).userSelect);

  expect(await userSelect(page.locator('#desktop'))).toBe('none');
  expect(await userSelect(page.locator('#d-my-active .card-active'))).toBe('none');
  expect(await userSelect(page.locator('#d-grave'))).toBe('none');
  expect(await userSelect(page.locator('#d-btn-summon'))).toBe('none');

  await page.locator('#d-grave').click();
  expect(await userSelect(page.locator('#modal-opts .option'))).toBe('none');
  await page.locator('#modal .cancel').click();

  await page.evaluate(() => window.showRules());
  await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
  expect(await userSelect(page.locator('#rulesModal .rules-content'))).not.toBe('none');
  expect(await userSelect(page.locator('#rulesModal .rules-content p'))).not.toBe('none');
});
