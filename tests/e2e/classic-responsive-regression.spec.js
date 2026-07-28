import { expect, test } from '@playwright/test';

const CLASSIC_SETUP_URL = '/?presentation=classic';
const CLASSIC_FIXTURE_URL =
  '/?presentation=classic&visualQa=1&fixture=dense-board-statuses';
const PRESENTATION_STORAGE_KEY = 'tinyFangs.presentation.mode';
const ACTION_NAMES = Object.freeze([
  'summon',
  'cast',
  'set',
  'atk',
  'retreat',
  'end',
]);
const REQUIRED_VIEWPORTS = Object.freeze([
  { width: 2560, height: 1440 },
  { width: 1672, height: 941 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]);
const CSS_BOUNDARY_WIDTHS = Object.freeze([599, 600, 601, 899, 900, 901]);

function installRuntimeErrorProbe(page) {
  const errors = {
    console: [],
    page: [],
  };
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.console.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.page.push(error.message);
  });
  return errors;
}

function expectedShell(width) {
  return width < 900 ? 'mobile' : 'desktop';
}

async function visibleShells(page) {
  return page.evaluate(() =>
    ['mobile', 'desktop'].filter((id) => {
      const element = document.getElementById(id);
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    }),
  );
}

async function documentMetrics(page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
}

async function waitForFixture(page) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const qa = window.__TINY_FANGS_VISUAL_QA__;
        return Boolean(
          qa &&
            (await qa.ready) &&
            qa.currentFixture?.name === 'dense-board-statuses' &&
            window.__TINY_FANGS_VISUAL_READY__ === true,
        );
      }),
    )
    .toBe(true);
}

async function openFixture(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(CLASSIC_FIXTURE_URL);
  await waitForFixture(page);
  await expect(page.locator('html')).toHaveAttribute(
    'data-presentation',
    'classic',
  );
  await expect(page.locator('#setup')).toBeHidden();
}

async function assertNoHorizontalDocumentOverflow(page) {
  const metrics = await documentMetrics(page);
  expect(
    metrics.scrollWidth,
    `document overflow at ${metrics.viewportWidth}px`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

async function assertActionReachable(page, selector) {
  const action = page.locator(selector);
  await expect(action).toHaveCount(1);
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeVisible();
  const geometry = await action.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const hit = document.elementFromPoint(center.x, center.y);
    return {
      centerInsideViewport:
        center.x >= 0 &&
        center.x <= window.innerWidth &&
        center.y >= 0 &&
        center.y <= window.innerHeight,
      hitWithinAction: hit === element || element.contains(hit),
      height: rect.height,
      width: rect.width,
    };
  });
  expect(geometry.width).toBeGreaterThan(0);
  expect(geometry.height).toBeGreaterThan(0);
  expect(geometry.centerInsideViewport).toBe(true);
  expect(geometry.hitWithinAction).toBe(true);
}

async function assertBoardContract(page, shell) {
  const prefix = shell === 'mobile' ? 'm' : 'd';
  for (const actionName of ACTION_NAMES) {
    await assertActionReachable(page, `#${prefix}-btn-${actionName}`);
  }

  if (shell === 'mobile') {
    for (const selector of [
      '#m-my-lp',
      '#m-opp-lp',
      '#m-my-mana',
      '#m-opp-mana',
      '#m-turn',
      '#m-hand-ct',
      '#m-my-set',
      '#m-opp-set',
    ]) {
      await expect(page.locator(selector)).not.toHaveText('');
    }
  } else {
    for (const selector of [
      '#d-my-lp',
      '#d-opp-lp',
      '#d-mana-pips',
      '#d-opp-mana-pips',
      '#d-turn',
      '#d-hand-ct',
      '#d-set-verse',
      '#d-opp-set',
    ]) {
      await expect(page.locator(selector)).not.toHaveText('');
    }
  }

  const opponentSet = page.locator(`#${prefix}-opp-set`);
  await expect(opponentSet).toHaveText('[SET]');
  await expect(opponentSet).not.toContainText('Soul Trap');
  await expect(opponentSet).not.toHaveAttribute('onclick');
  await expect(opponentSet).not.toHaveAttribute('onpointerdown');
  await expect(opponentSet).not.toHaveAttribute('role');
  await expect(opponentSet).toHaveJSProperty('tabIndex', -1);
}

async function stateSnapshot(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return {
      game: JSON.stringify(state.G),
      qaHash:
        window.__TINY_FANGS_VISUAL_QA__?.currentFixture?.stableHashInput ?? null,
      selectedCard: state.selectedCard,
    };
  });
}

async function assertNoHiddenShellSecret(page) {
  const privacy = await page.evaluate(() => {
    const shells = ['mobile', 'desktop'].map((id) => {
      const element = document.getElementById(id);
      const style = getComputedStyle(element);
      return {
        id,
        hidden: style.display === 'none',
        opponentSet:
          element.querySelector(`#${id === 'mobile' ? 'm' : 'd'}-opp-set`)
            ?.textContent ?? '',
        text: element.textContent,
      };
    });
    return {
      bodyText: document.body.textContent,
      shells,
    };
  });

  expect(privacy.bodyText).not.toContain('Soul Trap');
  expect(privacy.bodyText).not.toContain('soulTrap');
  for (const shell of privacy.shells) {
    expect(shell.opponentSet.replace(/\s+/g, ' ').trim()).toBe('[SET]');
    expect(shell.text).not.toContain('Soul Trap');
    expect(shell.text).not.toContain('soulTrap');
  }
}

async function modeStyleSignature(page) {
  return page.evaluate(() => {
    const read = (selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        background: style.background,
        color: style.color,
        display: style.display,
        fontFamily: style.fontFamily,
        position: style.position,
      };
    };
    return {
      bodyClass: document.body.className,
      body: read('body'),
      desktop: read('#desktop'),
      mobile: read('#mobile'),
      setup: read('#setup'),
    };
  });
}

async function startSoloThroughSetup(page) {
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  await page.clock.install({
    time: new Date('2026-07-27T12:00:00.000Z'),
  });
  await page.goto(CLASSIC_SETUP_URL);
  await page.getByRole('button', { name: /Solo/ }).click();
  await page
    .locator('#deck-select .deck-btn')
    .filter({ hasText: /\bFang\b/ })
    .click();
  await expect(page.locator('#modal-title')).toHaveText('Choose Rival Deck');
  await page
    .locator('#modal-opts .option')
    .filter({ hasText: /\bShell\b/ })
    .click();
  await expect(page.locator('#modal-title')).toHaveText('Coin Flip');
  await page
    .locator('#modal-opts .option')
    .filter({ hasText: /\bHEADS\b/ })
    .click();
  await page.clock.runFor(1_780);
  await expect(page.locator('#modal-title')).toHaveText(
    'HEADS! You won the toss',
  );
  await page
    .locator('#modal-opts .option')
    .filter({ hasText: /\bGo First\b/ })
    .click();
  await page.clock.runFor(1_330);
  await expect(page.locator('#setup')).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        return Boolean(state.G && state.G.myTurn && state.G.turn === 1);
      }),
    )
    .toBe(true);
}

test.describe('classic responsive shell and mode resolution', () => {
  for (const width of CSS_BOUNDARY_WIDTHS) {
    test(`ordinary fixture selects exactly one CSS shell at ${width}px`, async ({
      page,
    }) => {
      const runtimeErrors = installRuntimeErrorProbe(page);
      await openFixture(page, { width, height: 800 });
      expect(await visibleShells(page)).toEqual([expectedShell(width)]);
      await assertNoHorizontalDocumentOverflow(page);
      expect(runtimeErrors).toEqual({ console: [], page: [] });
    });
  }

  for (const viewport of REQUIRED_VIEWPORTS) {
    test(`setup and dense board remain reachable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      const runtimeErrors = installRuntimeErrorProbe(page);
      await page.setViewportSize(viewport);
      await page.goto(CLASSIC_SETUP_URL);
      await expect(page.locator('#setup')).toBeVisible();
      await expect(page.getByRole('button', { name: /Solo/ })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Multiplayer/ }),
      ).toBeVisible();
      expect(await visibleShells(page)).toEqual([
        expectedShell(viewport.width),
      ]);
      await assertNoHorizontalDocumentOverflow(page);

      await openFixture(page, viewport);
      const shell = expectedShell(viewport.width);
      expect(await visibleShells(page)).toEqual([shell]);
      await assertNoHorizontalDocumentOverflow(page);
      await assertBoardContract(page, shell);
      await assertNoHiddenShellSecret(page);
      expect(runtimeErrors).toEqual({ console: [], page: [] });
    });
  }

  test('fixture rotation preserves state, public hash, selection, safe modal, and action access', async ({
    page,
  }) => {
    const runtimeErrors = installRuntimeErrorProbe(page);
    await openFixture(page, { width: 430, height: 932 });
    await page.locator('#m-hand .hand-card').first().click();
    await page.evaluate(() => window.showRules());
    await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
    const before = await stateSnapshot(page);
    expect(before.selectedCard).not.toBeNull();
    expect(before.qaHash).not.toBeNull();

    for (const viewport of [
      { width: 844, height: 390 },
      { width: 899, height: 800 },
      { width: 900, height: 800 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);
      expect(await visibleShells(page)).toEqual([
        expectedShell(viewport.width),
      ]);
      expect(await stateSnapshot(page)).toEqual(before);
      await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
      await assertNoHorizontalDocumentOverflow(page);
      await page.evaluate(() => window.closeRules());
      await assertBoardContract(page, expectedShell(viewport.width));
      await assertNoHiddenShellSecret(page);
      await page.evaluate(() => window.showRules());
      await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
      expect(await stateSnapshot(page)).toEqual(before);
    }
    expect(runtimeErrors).toEqual({ console: [], page: [] });
  });

  test('started solo rotation preserves authoritative state, selection, safe modal, and action access', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const runtimeErrors = installRuntimeErrorProbe(page);
    await page.setViewportSize({ width: 430, height: 932 });
    await startSoloThroughSetup(page);
    await page.locator('#m-hand .hand-card').first().click();
    await page.evaluate(() => window.showRules());
    await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
    const before = await stateSnapshot(page);
    expect(before.selectedCard).not.toBeNull();
    expect(before.qaHash).toBeNull();

    for (const viewport of [
      { width: 844, height: 390 },
      { width: 899, height: 800 },
      { width: 900, height: 800 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);
      expect(await visibleShells(page)).toEqual([
        expectedShell(viewport.width),
      ]);
      expect(await stateSnapshot(page)).toEqual(before);
      await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
      await assertNoHorizontalDocumentOverflow(page);
      await page.evaluate(() => window.closeRules());
      const prefix = expectedShell(viewport.width) === 'mobile' ? 'm' : 'd';
      for (const actionName of ACTION_NAMES) {
        await assertActionReachable(
          page,
          `#${prefix}-btn-${actionName}`,
        );
      }
      await page.evaluate(() => window.showRules());
      await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
      expect(await stateSnapshot(page)).toEqual(before);
    }
    expect(runtimeErrors).toEqual({ console: [], page: [] });
  });

  test('real reload resolves query first, storage second, and invalid storage safely without restyling classic', async ({
    page,
  }) => {
    const runtimeErrors = installRuntimeErrorProbe(page);
    await page.goto('/?presentation=classic');
    await expect(page.locator('html')).toHaveAttribute(
      'data-presentation',
      'classic',
    );
    const classicStyle = await modeStyleSignature(page);
    expect(classicStyle.bodyClass).toBe('');

    await page.evaluate((key) => {
      localStorage.setItem(key, 'aaa');
    }, PRESENTATION_STORAGE_KEY);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(
      'data-presentation',
      'classic',
    );
    expect(await modeStyleSignature(page)).toEqual(classicStyle);

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute(
      'data-presentation',
      'aaa',
    );
    const storedAaaStyle = await modeStyleSignature(page);
    expect(storedAaaStyle).toEqual(classicStyle);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(
      'data-presentation',
      'aaa',
    );
    expect(await modeStyleSignature(page)).toEqual(classicStyle);

    await page.evaluate((key) => {
      localStorage.setItem(key, 'not-a-mode');
    }, PRESENTATION_STORAGE_KEY);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute(
      'data-presentation',
      'classic',
    );
    expect(await modeStyleSignature(page)).toEqual(classicStyle);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(
      'data-presentation',
      'classic',
    );
    expect(await modeStyleSignature(page)).toEqual(classicStyle);
    expect(runtimeErrors).toEqual({ console: [], page: [] });
  });
});
