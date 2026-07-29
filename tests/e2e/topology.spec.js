import { expect, test } from '@playwright/test';

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const wsPort = process.env.TINY_FANGS_WS_PORT ?? '3101';
const wsEndpoint = `ws://127.0.0.1:${wsPort}`;

test('owned Vite and WebSocket processes honor the query endpoint override', async ({
  page,
  request,
}) => {
  const healthResponse = await request.get(
    `http://127.0.0.1:${wsPort}/healthz`,
  );
  expect(healthResponse.status()).toBe(200);
  await expect(healthResponse.json()).resolves.toEqual({ status: 'ok' });

  await page.goto(
    `http://127.0.0.1:${vitePort}/?presentation=classic&ws=${encodeURIComponent(wsEndpoint)}`,
  );
  await expect(page.getByRole('heading', { name: 'TINY FANGS' })).toBeVisible();

  const socketCreated = page.waitForEvent('websocket');
  const socketOpened = page.waitForEvent(
    'console',
    (message) => message.text().includes('Connected to server'),
  );

  await page.getByRole('button', { name: /Multiplayer/ }).click();

  const socket = await socketCreated;
  await socketOpened;
  const connectedUrl = new URL(socket.url());
  expect(connectedUrl.origin).toBe(wsEndpoint);
  expect(connectedUrl.pathname).toBe('/');

  await page.getByRole('button', { name: /Create Room/ }).click();
  await expect(page.locator('#room-code-display')).toHaveText(
    /^[A-HJ-NP-Z2-9]{4}$/,
  );
});
