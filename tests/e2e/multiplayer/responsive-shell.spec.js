import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const wsPort = process.env.TINY_FANGS_WS_PORT ?? '3101';
const gameUrl =
  `http://127.0.0.1:${vitePort}/?presentation=classic&ws=` +
  encodeURIComponent(`ws://127.0.0.1:${wsPort}`);
// Task 25 made both gameplay shells explicitly inert on `gameStart` so no board
// can surface before the awaited coin. `startMultiplayerGame` then reveals only
// the shell its own `innerWidth <= 600` rule selects, so the non-selected shell
// keeps inline `display: none` instead of deferring to CSS.
//
// That incidentally removed the duplicate-shell symptom this test previously
// froze: 601-899 no longer renders the mobile and desktop trees at once. What
// survives is the underlying selection mismatch — the JS boundary is 600 while
// the CSS boundary is 900, so 601-899 shows the desktop shell at a width CSS
// still styles as narrow. Phase 12 still owes that focused fix, so the mismatch
// stays frozen here as `selectedShell` rather than being silently accepted.
const BOUNDARIES = Object.freeze([
  { width: 599, selectedShell: 'mobile' },
  { width: 600, selectedShell: 'mobile' },
  { width: 601, selectedShell: 'desktop' },
  { width: 899, selectedShell: 'desktop' },
  { width: 900, selectedShell: 'desktop' },
  { width: 901, selectedShell: 'desktop' },
]);

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

async function enterMultiplayer(page) {
  await page.goto(gameUrl);
  const connected = page.waitForEvent(
    'console',
    (message) => message.text().includes('Connected to server'),
  );
  await page.getByRole('button', { name: /Multiplayer/ }).click();
  await connected;
}

async function startMultiplayerAtWidth(browser, width) {
  const viewport = { width, height: 800 };
  const hostContext = await browser.newContext({ viewport });
  const guestContext = await browser.newContext({ viewport });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  const hostErrors = installRuntimeErrorProbe(hostPage);
  const guestErrors = installRuntimeErrorProbe(guestPage);

  await Promise.all([
    enterMultiplayer(hostPage),
    enterMultiplayer(guestPage),
  ]);
  await hostPage.getByRole('button', { name: /Create Room/ }).click();
  const roomCode = hostPage.locator('#room-code-display');
  await expect(roomCode).toHaveText(/^[A-HJ-NP-Z2-9]{4}$/);
  const code = await roomCode.textContent();

  await guestPage.getByRole('button', { name: /Join Room/ }).click();
  await guestPage.locator('#room-code-input').fill(code);
  await guestPage.getByRole('button', { name: 'Join', exact: true }).click();
  await Promise.all([
    expect(hostPage.locator('#deck-select')).toBeVisible(),
    expect(guestPage.locator('#deck-select')).toBeVisible(),
  ]);
  await hostPage
    .locator('#deck-select .deck-btn')
    .filter({ hasText: /\bShell\b/ })
    .click();
  await guestPage
    .locator('#deck-select .deck-btn')
    .filter({ hasText: /\bShadow\b/ })
    .click();
  await Promise.all([
    expect(hostPage.locator('#setup')).toBeHidden({ timeout: 15_000 }),
    expect(guestPage.locator('#setup')).toBeHidden({ timeout: 15_000 }),
  ]);

  return {
    contexts: [guestContext, hostContext],
    pages: [
      { errors: hostErrors, page: hostPage },
      { errors: guestErrors, page: guestPage },
    ],
  };
}

async function shellSnapshot(page) {
  return page.evaluate(() => ({
    document: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    },
    shells: ['mobile', 'desktop'].map((id) => {
      const element = document.getElementById(id);
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const prefix = id === 'mobile' ? 'm' : 'd';
      return {
        computedDisplay: style.display,
        id,
        inlineDisplay: element.style.display,
        opponentSet:
          element.querySelector(`#${prefix}-opp-set`)?.textContent
            ?.replace(/\s+/g, ' ')
            .trim() ?? '',
        text: element.textContent,
        visible:
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0,
      };
    }),
  }));
}

test('shows exactly one multiplayer shell per width and freezes the 600px JS versus 900px CSS selection mismatch', async ({
  browser,
}) => {
  test.setTimeout(120_000);

  for (const boundary of BOUNDARIES) {
    const started = await startMultiplayerAtWidth(browser, boundary.width);
    try {
      const privateHandNames = await Promise.all(
        started.pages.map(({ page }) =>
          page.evaluate(async () => {
            const { state } = await import('/src/state.js');
            return state.G.me.hand.map((card) => card.name);
          }),
        ),
      );

      for (const [pageIndex, { errors, page }] of started.pages.entries()) {
        const snapshot = await shellSnapshot(page);
        expect(
          snapshot.shells
            .filter((shell) => shell.visible)
            .map((shell) => shell.id),
          `visible shells at multiplayer start width ${boundary.width}`,
        ).toEqual([boundary.selectedShell]);
        expect(snapshot.document.scrollWidth).toBeLessThanOrEqual(
          snapshot.document.clientWidth,
        );

        for (const shell of snapshot.shells) {
          const expectedInline =
            shell.id === boundary.selectedShell ? 'flex' : 'none';
          expect(
            shell.inlineDisplay,
            `${shell.id} inline display at width ${boundary.width}`,
          ).toBe(expectedInline);
        }

        for (const shell of snapshot.shells) {
          for (const opponentPrivateName of privateHandNames[1 - pageIndex]) {
            expect(shell.text).not.toContain(opponentPrivateName);
          }
          expect(shell.opponentSet).toBe('NO SET');
        }
        expect(errors).toEqual({ console: [], page: [] });
      }
    } finally {
      await Promise.all(started.contexts.map((context) => context.close()));
    }
  }
});
