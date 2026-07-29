import { expect, test } from '@playwright/test';
import { DECKS } from '../../../shared/cards.js';

test.describe.configure({ mode: 'serial' });

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const wsPort = process.env.TINY_FANGS_WS_PORT ?? '3101';
const gameplaySocketUrl = `ws://127.0.0.1:${wsPort}/`;
const gameUrl =
  `http://127.0.0.1:${vitePort}/?presentation=classic&ws=` +
  encodeURIComponent(`ws://127.0.0.1:${wsPort}`);

// SET-03: every deck must be reachable through the real multiplayer selection
// path with the authoritative inventory the server dealt from shared/cards.js.
// A rotation of five pairings covers each deck once as host and once as guest
// without exploding into all twenty-five combinations.
const DECK_LABELS = Object.freeze({
  fang: 'Fang',
  shadow: 'Shadow',
  shell: 'Shell',
  swarm: 'Swarm',
  venom: 'Venom',
});

const PAIRINGS = Object.freeze([
  { guestDeck: 'fang', hostDeck: 'shadow' },
  { guestDeck: 'venom', hostDeck: 'fang' },
  { guestDeck: 'swarm', hostDeck: 'venom' },
  { guestDeck: 'shell', hostDeck: 'swarm' },
  { guestDeck: 'shadow', hostDeck: 'shell' },
]);

const OPENING_HAND_SIZE = 5;

function deckInventoryIds(deckId) {
  const definition = DECKS[deckId];
  return [...definition.creatures, ...definition.verses];
}

// The server projects a player's own deck as `deckCount` only (the shuffled
// order stays secret), so the full 20-card inventory is asserted as: every
// hand id consumes one copy from the shared deck list, and the leftover copies
// exactly equal the authoritative deckCount. Hand plus hidden deck can only
// reconcile with shared/cards.js DECKS when both hold.
function assertOwnInventory(gameStart, deckId, label) {
  const { me } = gameStart.state;
  expect(me.hand, `${label} opening hand`).toHaveLength(OPENING_HAND_SIZE);

  const remaining = [...deckInventoryIds(deckId)].sort();
  expect(remaining, `${label} shared deck size`).toHaveLength(20);

  for (const card of me.hand) {
    const slot = remaining.indexOf(card.id);
    expect(
      slot,
      `${label} hand card ${card.id} must consume a ${deckId} deck copy`,
    ).toBeGreaterThanOrEqual(0);
    remaining.splice(slot, 1);
  }

  expect(me.deckCount, `${label} authoritative deck count`).toBe(
    remaining.length,
  );
  expect(
    me.hand.length + me.deckCount,
    `${label} total inventory`,
  ).toBe(deckInventoryIds(deckId).length);
}

function assertOpponentPrivacy(gameStart, label) {
  const { opp } = gameStart.state;
  expect(opp.handCount, `${label} opponent hand count`).toBe(
    OPENING_HAND_SIZE,
  );
  expect(
    'hand' in opp,
    `${label} opponent hand must stay count-only`,
  ).toBe(false);
  expect(opp.deckCount, `${label} opponent deck count`).toBe(
    20 - OPENING_HAND_SIZE,
  );
}

async function installSocketProbe(context) {
  await context.addInitScript(({ endpoint }) => {
    const NativeWebSocket = window.WebSocket;
    const probe = {
      inbound: [],
      outbound: [],
      sockets: [],
    };

    window.WebSocket = new Proxy(NativeWebSocket, {
      get(Target, property) {
        if (property === 'CONNECTING') return NativeWebSocket.CONNECTING;
        if (property === 'OPEN') return NativeWebSocket.OPEN;
        if (property === 'CLOSING') return NativeWebSocket.CLOSING;
        if (property === 'CLOSED') return NativeWebSocket.CLOSED;
        return Reflect.get(Target, property, Target);
      },
      construct(Target, args) {
        const socket = Reflect.construct(Target, args, Target);
        const nativeSend = socket.send.bind(socket);

        probe.sockets.push({ socket });
        socket.addEventListener('message', (event) => {
          probe.inbound.push({
            payload: String(event.data),
            url: socket.url,
          });
        });
        socket.send = (payload) => {
          probe.outbound.push({
            payload: String(payload),
            url: socket.url,
          });
          return nativeSend(payload);
        };
        return socket;
      },
    });

    Object.defineProperty(window, '__TINY_FANGS_SOCKET_PROBE__', {
      configurable: false,
      enumerable: false,
      value: probe,
      writable: false,
    });
    void endpoint;
  }, { endpoint: gameplaySocketUrl });
}

async function socketSnapshot(page) {
  return page.evaluate(() => {
    const probe = window.__TINY_FANGS_SOCKET_PROBE__;
    const parse = ({ payload, url }) => {
      let message;
      try {
        message = JSON.parse(payload);
      } catch {
        message = null;
      }
      return { message, payload, url };
    };

    return {
      inbound: probe.inbound.map(parse),
      outbound: probe.outbound.map(parse),
    };
  });
}

async function waitForInbound(page, fromIndex, predicate, description) {
  let match = null;
  await expect
    .poll(
      async () => {
        const snapshot = await socketSnapshot(page);
        for (let index = fromIndex; index < snapshot.inbound.length; index += 1) {
          const message = snapshot.inbound[index].message;
          if (message && predicate(message)) {
            match = message;
            return true;
          }
        }
        return false;
      },
      { message: description, timeout: 12_000 },
    )
    .toBe(true);
  return match;
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

async function createAndJoin(hostPage, guestPage) {
  await hostPage.getByRole('button', { name: /Create Room/ }).click();
  const codeDisplay = hostPage.locator('#room-code-display');
  await expect(codeDisplay).toHaveText(/^[A-HJ-NP-Z2-9]{4}$/);
  const roomCode = await codeDisplay.textContent();

  await guestPage.getByRole('button', { name: /Join Room/ }).click();
  await guestPage.locator('#room-code-input').fill(roomCode);
  await guestPage.getByRole('button', { name: 'Join', exact: true }).click();

  await expect(guestPage.locator('#mp-status')).toHaveText(
    `Joined room ${roomCode}!`,
  );
  await expect(hostPage.locator('#waiting-msg')).toHaveText(
    'Opponent joined!',
  );
  await Promise.all([
    expect(hostPage.locator('#deck-select')).toBeVisible({ timeout: 5_000 }),
    expect(guestPage.locator('#deck-select')).toBeVisible(),
  ]);
  return roomCode;
}

function deckButton(page, deckId) {
  return page
    .locator('#deck-select .deck-btn')
    .filter({ hasText: new RegExp(`\\b${DECK_LABELS[deckId]}\\b`) });
}

async function selectDecksAndStart(hostPage, guestPage, hostDeck, guestDeck) {
  await deckButton(hostPage, hostDeck).click();
  await expect(hostPage.locator('#mp-status')).toHaveText(
    'Waiting for opponent to select deck...',
  );
  await expect(guestPage.locator('#mp-status')).toHaveText(
    'Opponent ready! Select your deck.',
  );

  const hostStartIndex = (await socketSnapshot(hostPage)).inbound.length;
  const guestStartIndex = (await socketSnapshot(guestPage)).inbound.length;
  await deckButton(guestPage, guestDeck).click();

  const [hostStart, guestStart] = await Promise.all([
    waitForInbound(
      hostPage,
      hostStartIndex,
      (message) => message.type === 'gameStart',
      'host gameStart',
    ),
    waitForInbound(
      guestPage,
      guestStartIndex,
      (message) => message.type === 'gameStart',
      'guest gameStart',
    ),
  ]);

  await Promise.all([
    expect(hostPage.locator('#setup')).toBeHidden({ timeout: 15_000 }),
    expect(guestPage.locator('#setup')).toBeHidden({ timeout: 15_000 }),
  ]);

  return { guestStart, hostStart };
}

async function assertDeckSelectFrame(page, deckId, label) {
  const snapshot = await socketSnapshot(page);
  const frames = snapshot.outbound.filter(
    ({ message }) => message?.type === 'deckSelect',
  );
  expect(
    frames.map(({ message }) => message.deckId),
    `${label} deckSelect frames`,
  ).toEqual([deckId]);
}

for (const { guestDeck, hostDeck } of PAIRINGS) {
  test(
    `host ${DECK_LABELS[hostDeck]} vs guest ${DECK_LABELS[guestDeck]} ` +
    'deals both authoritative 20-card inventories with a count-only opponent hand',
    async ({ browser }) => {
      const hostContext = await browser.newContext();
      const guestContext = await browser.newContext();
      await Promise.all([
        installSocketProbe(hostContext),
        installSocketProbe(guestContext),
      ]);

      try {
        const hostPage = await hostContext.newPage();
        const guestPage = await guestContext.newPage();
        await Promise.all([
          enterMultiplayer(hostPage),
          enterMultiplayer(guestPage),
        ]);
        await createAndJoin(hostPage, guestPage);
        const { guestStart, hostStart } = await selectDecksAndStart(
          hostPage,
          guestPage,
          hostDeck,
          guestDeck,
        );

        // The selection really traveled the wire as the chosen deck id.
        await assertDeckSelectFrame(hostPage, hostDeck, 'host');
        await assertDeckSelectFrame(guestPage, guestDeck, 'guest');

        // One player is p1, the other p2, per the coin flip.
        expect([hostStart.you, guestStart.you].sort()).toEqual(['p1', 'p2']);

        assertOwnInventory(hostStart, hostDeck, 'host');
        assertOwnInventory(guestStart, guestDeck, 'guest');
        assertOpponentPrivacy(hostStart, 'host');
        assertOpponentPrivacy(guestStart, 'guest');
      } finally {
        await Promise.all([guestContext.close(), hostContext.close()]);
      }
    },
  );
}
