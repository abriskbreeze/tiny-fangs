import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const wsPort = process.env.TINY_FANGS_WS_PORT ?? '3101';
const gameUrl =
  `http://127.0.0.1:${vitePort}/?presentation=classic&ws=` +
  encodeURIComponent(`ws://127.0.0.1:${wsPort}`);
// Task 25 made both gameplay shells explicitly inert on `gameStart` so no board
// can surface before the awaited coin. `startMultiplayerGame` then reveals only
// the shell it selects, so the non-selected shell keeps inline `display: none`.
//
// RSP-02 (repaired): that selection used to be its own `innerWidth <= 600` rule
// while the stylesheet flips shells at `@media (min-width: 900px)`, so 601-899
// revealed the desktop shell at a width CSS still styles as narrow. Selection
// now runs through `src/viewport.js` (`isMobileViewport`, backed by the same
// 900px media query), so the revealed shell is the styled shell by
// construction. These boundaries are the correctness contract for that: mobile
// below the CSS threshold, desktop at/above it, and never both.
const CSS_DESKTOP_MIN_WIDTH = 900;
const BOUNDARIES = Object.freeze([
  { width: 599, selectedShell: 'mobile' },
  { width: 600, selectedShell: 'mobile' },
  { width: 601, selectedShell: 'mobile' },
  { width: 899, selectedShell: 'mobile' },
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

async function shellSnapshot(page, cssDesktopMinWidth) {
  return page.evaluate((desktopMinWidth) => ({
    // Which shell the stylesheet itself is laying out, read from the same
    // query the shell rules in `src/styles.css` are written against.
    cssShell: window.matchMedia(`(min-width: ${desktopMinWidth}px)`).matches
      ? 'desktop'
      : 'mobile',
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
  }), cssDesktopMinWidth);
}

test('reveals exactly one multiplayer shell per width and keeps that selection on the CSS 900px boundary (RSP-02)', async ({
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
        const snapshot = await shellSnapshot(page, CSS_DESKTOP_MIN_WIDTH);
        expect(
          snapshot.shells
            .filter((shell) => shell.visible)
            .map((shell) => shell.id),
          `visible shells at multiplayer start width ${boundary.width}`,
        ).toEqual([boundary.selectedShell]);
        expect(
          snapshot.cssShell,
          `stylesheet shell at multiplayer start width ${boundary.width}`,
        ).toBe(boundary.selectedShell);
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
