import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const wsPort = process.env.TINY_FANGS_WS_PORT ?? '3101';
const gameplaySocketUrl = `ws://127.0.0.1:${wsPort}/`;
const gameUrl =
  `http://127.0.0.1:${vitePort}/?presentation=classic&ws=` +
  encodeURIComponent(`ws://127.0.0.1:${wsPort}`);

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
        const record = {
          closed: false,
          closeCalls: 0,
          url: socket.url,
        };
        const nativeSend = socket.send.bind(socket);
        const nativeClose = socket.close.bind(socket);

        probe.sockets.push({ record, socket });
        socket.addEventListener('message', (event) => {
          probe.inbound.push({
            payload: String(event.data),
            url: socket.url,
          });
        });
        socket.addEventListener('close', () => {
          record.closed = true;
        });
        socket.send = (payload) => {
          probe.outbound.push({
            payload: String(payload),
            url: socket.url,
          });
          return nativeSend(payload);
        };
        socket.close = (...closeArgs) => {
          record.closeCalls += 1;
          return nativeClose(...closeArgs);
        };
        return socket;
      },
    });

    probe.send = (message) => {
      const entry = probe.sockets.find(
        ({ socket }) =>
          socket.url === endpoint &&
          socket.readyState === NativeWebSocket.OPEN,
      );
      if (!entry) throw new Error(`No open socket for ${endpoint}`);
      entry.socket.send(JSON.stringify(message));
    };
    probe.closeOpen = () => {
      const entry = probe.sockets.find(
        ({ socket }) =>
          socket.url === endpoint &&
          socket.readyState === NativeWebSocket.OPEN,
      );
      if (!entry) throw new Error(`No open socket for ${endpoint}`);
      entry.socket.close();
    };

    Object.defineProperty(window, '__TINY_FANGS_SOCKET_PROBE__', {
      configurable: false,
      enumerable: false,
      value: probe,
      writable: false,
    });
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
      sockets: probe.sockets.map(({ record, socket }) => ({
        closed: record.closed,
        closeCalls: record.closeCalls,
        readyState: socket.readyState,
        url: record.url,
      })),
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

async function sendProbeMessage(page, message) {
  await page.evaluate((payload) => {
    window.__TINY_FANGS_SOCKET_PROBE__.send(payload);
  }, message);
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
  await guestPage.locator('#room-code-input').evaluate((input, value) => {
    input.value = value;
  }, `  ${roomCode.toLowerCase()}  `);
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

async function selectDecksAndStart(hostPage, guestPage) {
  await hostPage.getByRole('button', { name: /Shell/ }).click();
  await expect(hostPage.locator('#mp-status')).toHaveText(
    'Waiting for opponent to select deck...',
  );
  await expect(guestPage.locator('#mp-status')).toHaveText(
    'Opponent ready! Select your deck.',
  );

  const hostStartIndex = (await socketSnapshot(hostPage)).inbound.length;
  const guestStartIndex = (await socketSnapshot(guestPage)).inbound.length;
  await guestPage.getByRole('button', { name: /Shadow/ }).click();

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

  expect([hostStart.you, guestStart.you].sort()).toEqual(['p1', 'p2']);
  expect([hostStart.yourTurn, guestStart.yourTurn].sort()).toEqual([
    false,
    true,
  ]);
  expect(hostStart.state.yourTurn).toBe(hostStart.yourTurn);
  expect(guestStart.state.yourTurn).toBe(guestStart.yourTurn);

  await Promise.all([
    expect(hostPage.locator('#setup')).toBeHidden({ timeout: 15_000 }),
    expect(guestPage.locator('#setup')).toBeHidden({ timeout: 15_000 }),
    expect(hostPage.locator('#desktop')).toBeVisible({ timeout: 15_000 }),
    expect(guestPage.locator('#desktop')).toBeVisible({ timeout: 15_000 }),
  ]);

  return {
    guest: { gameStart: guestStart, page: guestPage },
    host: { gameStart: hostStart, page: hostPage },
  };
}

test('normalizes a padded lowercase join and exposes each lobby transition', async ({
  browser,
}) => {
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
    await selectDecksAndStart(hostPage, guestPage);
  } finally {
    await Promise.all([guestContext.close(), hostContext.close()]);
  }
});

test('rejects invalid room-code lengths without a frame and Back resets one socket lifecycle', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await installSocketProbe(context);

  try {
    const page = await context.newPage();
    await enterMultiplayer(page);
    await expect
      .poll(
        async () =>
          (await socketSnapshot(page)).sockets.filter(
            (socket) => socket.url === gameplaySocketUrl,
          ).length,
      )
      .toBe(1);
    await page.getByRole('button', { name: /Join Room/ }).click();

    for (const value of ['', 'ABC', 'ABCDE', '   ']) {
      const before = await socketSnapshot(page);
      await page.locator('#room-code-input').evaluate((input, nextValue) => {
        input.value = nextValue;
      }, value);
      await page.getByRole('button', { name: 'Join', exact: true }).click();
      await expect(page.locator('#mp-status')).toHaveText(
        'Room code must be 4 characters',
      );
      await expect
        .poll(async () => (await socketSnapshot(page)).outbound.length)
        .toBe(before.outbound.length);
    }

    await page.getByRole('button', { name: /Create Room/ }).click();
    await expect(page.locator('#room-code-display')).toHaveText(
      /^[A-HJ-NP-Z2-9]{4}$/,
    );
    expect(
      (await socketSnapshot(page)).sockets.filter(
        (socket) => socket.url === gameplaySocketUrl,
      ),
    ).toHaveLength(1);
    await page.getByRole('button', { name: /Back/ }).click();

    await expect(page.locator('#mode-select')).toBeVisible();
    await expect(page.locator('#mp-lobby')).toBeHidden();
    await expect(page.locator('#room-info')).toBeHidden();
    await expect(page.locator('#join-input')).toBeHidden();
    await expect(page.locator('#mp-status')).toHaveText('');
    await expect(page.locator('#room-code-display')).toHaveText('');
    await expect(page.locator('#room-code-input')).toHaveValue('');
    await expect(page.locator('#waiting-msg')).toHaveText(
      'Waiting for opponent...',
    );

    const reconnected = page.waitForEvent(
      'console',
      (message) => message.text().includes('Connected to server'),
    );
    await page.getByRole('button', { name: /Multiplayer/ }).click();
    await reconnected;
    await expect
      .poll(async () => {
        const sockets = (await socketSnapshot(page)).sockets.filter(
          (socket) => socket.url === gameplaySocketUrl,
        );
        return {
          open: sockets.filter((socket) => socket.readyState === WebSocket.OPEN)
            .length,
          total: sockets.length,
        };
      })
      .toEqual({ open: 1, total: 2 });
  } finally {
    await context.close();
  }
});

test('notifies lobby and in-game survivors while a closed client receives no more frames', async ({
  browser,
}) => {
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
    const roomCode = await createAndJoin(hostPage, guestPage);
    const guestBeforeClose = await socketSnapshot(guestPage);
    await guestPage.evaluate(() => {
      window.__TINY_FANGS_SOCKET_PROBE__.closeOpen();
    });
    await expect(hostPage.locator('#mp-status')).toHaveText(
      'Opponent disconnected',
    );

    const replacementContext = await browser.newContext();
    await installSocketProbe(replacementContext);
    try {
      const replacementPage = await replacementContext.newPage();
      await enterMultiplayer(replacementPage);
      await replacementPage.getByRole('button', { name: /Join Room/ }).click();
      await replacementPage.locator('#room-code-input').fill(roomCode);
      await replacementPage.getByRole('button', { name: 'Join', exact: true }).click();
      await expect(replacementPage.locator('#mp-status')).toHaveText(
        `Joined room ${roomCode}!`,
      );
      await expect
        .poll(async () => (await socketSnapshot(guestPage)).inbound.length)
        .toBe(guestBeforeClose.inbound.length);
    } finally {
      await replacementContext.close();
    }
  } finally {
    await Promise.all([guestContext.close(), hostContext.close()]);
  }

  const gameHostContext = await browser.newContext();
  const gameGuestContext = await browser.newContext();
  await Promise.all([
    installSocketProbe(gameHostContext),
    installSocketProbe(gameGuestContext),
  ]);
  try {
    const hostPage = await gameHostContext.newPage();
    const guestPage = await gameGuestContext.newPage();
    await Promise.all([
      enterMultiplayer(hostPage),
      enterMultiplayer(guestPage),
    ]);
    await createAndJoin(hostPage, guestPage);
    await selectDecksAndStart(hostPage, guestPage);
    await guestPage.evaluate(() => {
      window.__TINY_FANGS_SOCKET_PROBE__.closeOpen();
    });
    await expect(hostPage.locator('#modal')).toHaveClass(/open/);
    await expect(hostPage.locator('#modal-title')).toHaveText('Opponent Left');
    await expect(hostPage.locator('#modal-opts')).toContainText(
      'Return to Menu',
    );
  } finally {
    await Promise.all([
      gameGuestContext.close(),
      gameHostContext.close(),
    ]);
  }
});

// The shared Playwright WebSocket server shuffles for real, so an opening hand
// is not guaranteed to contain a castable creature: a 5-card hand is dealt from
// 20 cards at 1 mana, and Shell holds only 4 cost-1 creatures against Shadow's
// 6. That leaves a ~20.5% chance per room that the first player cannot summon,
// which previously made this test fail intermittently. Deal fresh rooms until
// the precondition this test exists to exercise actually holds, instead of
// asserting that a random deal must cooperate.
const AFFORDABLE_OPENER_ATTEMPTS = 12;

// `doSummon` lists every hand creature in hand order and only marks the
// unaffordable ones disabled, so the modal option index is the card's index
// within that filtered list. Decks run duplicate creature names, so selecting
// the option by name is ambiguous; the index resolves the exact `uid` the
// outbound-frame assertions below depend on.
function findAffordableCreature(gameStart) {
  const creatures = gameStart.state.me.hand.filter(
    (card) => card.cardType === 'creature',
  );
  const index = creatures.findIndex(
    (card) => card.cost <= gameStart.state.me.mana,
  );
  return index === -1 ? undefined : { card: creatures[index], index };
}

test('visible actions and End Turn follow authoritative projected server state', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  let hostContext;
  let guestContext;
  let started;
  let current;
  let waiting;
  let affordable;

  for (let attempt = 1; attempt <= AFFORDABLE_OPENER_ATTEMPTS; attempt += 1) {
    hostContext = await browser.newContext();
    guestContext = await browser.newContext();
    await Promise.all([
      installSocketProbe(hostContext),
      installSocketProbe(guestContext),
    ]);
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    await Promise.all([
      enterMultiplayer(hostPage),
      enterMultiplayer(guestPage),
    ]);
    await createAndJoin(hostPage, guestPage);
    started = await selectDecksAndStart(hostPage, guestPage);
    current = started.host.gameStart.yourTurn ? started.host : started.guest;
    waiting = started.host.gameStart.yourTurn ? started.guest : started.host;
    affordable = findAffordableCreature(current.gameStart);

    if (affordable) {
      break;
    }
    await Promise.all([guestContext.close(), hostContext.close()]);
    hostContext = undefined;
    guestContext = undefined;
  }

  expect(
    affordable,
    `no affordable opener after ${AFFORDABLE_OPENER_ATTEMPTS} fresh rooms`,
  ).toBeTruthy();

  try {

    await expect(current.page.locator('#d-btn-end')).toBeEnabled();
    await expect(waiting.page.locator('#d-btn-end')).toBeDisabled();

    const currentBeforeSummon = await socketSnapshot(current.page);
    const waitingBeforeSummon = await socketSnapshot(waiting.page);
    await current.page.getByRole('button', { name: /Summon/ }).click();
    await expect(current.page.locator('#modal-title')).toHaveText(
      'Summon Creature',
    );
    const affordableOption = current.page
      .locator('#modal-opts .option')
      .nth(affordable.index);
    await expect(affordableOption).not.toHaveClass(/\boff\b/);
    await expect(affordableOption.locator('.name')).toHaveText(
      affordable.card.name,
    );
    await affordableOption.click();

    await expect
      .poll(async () => {
        const snapshot = await socketSnapshot(current.page);
        return snapshot.outbound
          .slice(currentBeforeSummon.outbound.length)
          .some(
            ({ message }) =>
              message?.type === 'action' &&
              message.action?.action === 'summon' &&
              message.action?.cardUid === affordable.card.uid,
          );
      })
      .toBe(true);

    const [currentSummon, waitingSummon] = await Promise.all([
      waitForInbound(
        current.page,
        currentBeforeSummon.inbound.length,
        (message) =>
          message.type === 'stateUpdate' &&
          message.state.me.active?.uid === affordable.card.uid,
        'owner summon projection',
      ),
      waitForInbound(
        waiting.page,
        waitingBeforeSummon.inbound.length,
        (message) =>
          message.type === 'stateUpdate' &&
          message.state.opp.active?.uid === affordable.card.uid,
        'opponent summon projection',
      ),
    ]);
    expect(currentSummon.state.me.active.uid).toBe(
      waitingSummon.state.opp.active.uid,
    );

    const currentBeforeIllegal = await socketSnapshot(current.page);
    const waitingBeforeIllegal = await socketSnapshot(waiting.page);
    await sendProbeMessage(waiting.page, {
      type: 'action',
      action: { action: 'attack' },
    });
    await waitForInbound(
      waiting.page,
      waitingBeforeIllegal.inbound.length,
      (message) =>
        message.type === 'error' && message.message === 'Not your turn',
      'illegal action error',
    );
    await expect
      .poll(async () => {
        const currentNow = await socketSnapshot(current.page);
        const waitingNow = await socketSnapshot(waiting.page);
        return {
          currentStateUpdates: currentNow.inbound
            .slice(currentBeforeIllegal.inbound.length)
            .filter(({ message }) => message?.type === 'stateUpdate').length,
          waitingStateUpdates: waitingNow.inbound
            .slice(waitingBeforeIllegal.inbound.length)
            .filter(({ message }) => message?.type === 'stateUpdate').length,
        };
      })
      .toEqual({ currentStateUpdates: 0, waitingStateUpdates: 0 });
    await expect(current.page.locator('#d-btn-end')).toBeEnabled();
    await expect(waiting.page.locator('#d-btn-end')).toBeDisabled();

    const currentBeforeEnd = await socketSnapshot(current.page);
    const waitingBeforeEnd = await socketSnapshot(waiting.page);
    await current.page.locator('#d-btn-end').dispatchEvent('pointerdown');
    await current.page.waitForTimeout(550);
    await current.page.locator('#d-btn-end').dispatchEvent('pointerup');

    await Promise.all([
      waitForInbound(
        current.page,
        currentBeforeEnd.inbound.length,
        (message) =>
          message.type === 'stateUpdate' &&
          message.state.yourTurn === false,
        'ending player state projection',
      ),
      waitForInbound(
        waiting.page,
        waitingBeforeEnd.inbound.length,
        (message) =>
          message.type === 'stateUpdate' &&
          message.state.yourTurn === true,
        'next player state projection',
      ),
    ]);
    await expect(current.page.locator('#d-btn-end')).toBeDisabled();
    await expect(waiting.page.locator('#d-btn-end')).toBeEnabled();
  } finally {
    await Promise.all(
      [guestContext, hostContext]
        .filter(Boolean)
        .map((context) => context.close()),
    );
  }
});
