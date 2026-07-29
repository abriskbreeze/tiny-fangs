import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const wsPort = process.env.TINY_FANGS_WS_PORT ?? '3101';
const wsEndpoint = `ws://127.0.0.1:${wsPort}`;
const gameUrl =
  `http://127.0.0.1:${vitePort}/?presentation=classic&ws=` +
  encodeURIComponent(wsEndpoint);

async function enterMultiplayerLobby(page) {
  await page.goto(gameUrl);
  const connected = page.waitForEvent(
    'console',
    (message) => message.text().includes('Connected to server'),
  );
  await page.getByRole('button', { name: /Multiplayer/ }).click();
  await connected;
}

test('two isolated browser contexts create and join a fresh room', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();

  try {
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await Promise.all([
      enterMultiplayerLobby(hostPage),
      enterMultiplayerLobby(guestPage),
    ]);

    await hostPage.getByRole('button', { name: /Create Room/ }).click();
    const roomCodeDisplay = hostPage.locator('#room-code-display');
    await expect(roomCodeDisplay).toHaveText(/^[A-HJ-NP-Z2-9]{4}$/);
    const roomCode = await roomCodeDisplay.textContent();

    await guestPage.getByRole('button', { name: /Join Room/ }).click();
    await guestPage.locator('#room-code-input').fill(roomCode.toLowerCase());
    await guestPage.getByRole('button', { name: 'Join', exact: true }).click();

    await expect(guestPage.locator('#mp-status')).toHaveText(
      `Joined room ${roomCode}!`,
    );
    await expect(hostPage.locator('#waiting-msg')).toHaveText(
      'Opponent joined!',
    );
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});
