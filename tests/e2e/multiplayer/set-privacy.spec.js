import { expect, test } from '@playwright/test';
import { DECKS, VERSES } from '../../../shared/cards.js';

test.describe.configure({ mode: 'serial' });

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const wsPort = process.env.TINY_FANGS_WS_PORT ?? '3101';
const wsEndpoint = `ws://127.0.0.1:${wsPort}`;
const gameplaySocketUrl = new URL(wsEndpoint).href;
const gameUrl =
  `http://127.0.0.1:${vitePort}/?presentation=classic&visualQa=1&ws=` +
  encodeURIComponent(wsEndpoint);

const knownDecks = Object.freeze({
  host: 'shell',
  guest: 'shadow',
});

function payloadText(payload) {
  return typeof payload === 'string' ? payload : Buffer.from(payload).toString();
}

function parseJson(payload) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function observePage(page) {
  const observation = {
    frames: [],
    requestUrls: [],
  };

  page.on('request', (request) => {
    observation.requestUrls.push(request.url());
  });
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      observation.frames.push({
        url: socket.url(),
        payload: payloadText(payload),
      });
    });
  });

  return observation;
}

async function installPrivacyProbe(context) {
  await context.addInitScript(({ endpoint }) => {
    const nativeWebSocket = window.WebSocket;
    const probe = {
      console: [],
      inbound: [],
      outbound: [],
      sockets: [],
    };

    const serialize = (value) => {
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    for (const level of ['debug', 'info', 'log', 'warn', 'error']) {
      const original = console[level].bind(console);
      console[level] = (...args) => {
        probe.console.push({
          level,
          text: args.map(serialize).join(' '),
        });
        original(...args);
      };
    }

    window.WebSocket = new Proxy(nativeWebSocket, {
      construct(Target, args) {
        const socket = Reflect.construct(Target, args, Target);
        const nativeSend = socket.send.bind(socket);

        probe.sockets.push(socket);
        socket.addEventListener('message', (event) => {
          probe.inbound.push({
            url: socket.url,
            payload: serialize(event.data),
          });
        });
        socket.send = (payload) => {
          probe.outbound.push({
            url: socket.url,
            payload: serialize(payload),
          });
          return nativeSend(payload);
        };
        return socket;
      },
    });

    probe.clearObservation = () => {
      probe.console.length = 0;
      probe.inbound.length = 0;
      probe.outbound.length = 0;
    };
    probe.send = (payload) => {
      const socket = probe.sockets.find(
        (candidate) =>
          candidate.url === endpoint &&
          candidate.readyState === nativeWebSocket.OPEN,
      );
      if (!socket) {
        throw new Error(`No open gameplay WebSocket for ${endpoint}`);
      }
      socket.send(JSON.stringify(payload));
    };

    Object.defineProperty(window, '__TINY_FANGS_PRIVACY_PROBE__', {
      configurable: false,
      enumerable: false,
      value: probe,
      writable: false,
    });

    try {
      localStorage.setItem('tinyFangsDebug', '1');
    } catch {
      // The initial about:blank document has an opaque origin. The same init
      // script runs again on the real game origin, where localStorage works.
    }
  }, { endpoint: gameplaySocketUrl });
}

async function enterMultiplayerLobby(page) {
  await page.goto(gameUrl);
  const connected = page.waitForEvent(
    'console',
    (message) => message.text().includes('Connected to server'),
  );
  await page.getByRole('button', { name: /Multiplayer/ }).click();
  await connected;
}

async function waitForMessage(
  observation,
  fromIndex,
  predicate,
  description,
) {
  let match = null;

  await expect
    .poll(
      () => {
        for (
          let index = fromIndex;
          index < observation.frames.length;
          index += 1
        ) {
          const frame = observation.frames[index];
          if (frame.url !== gameplaySocketUrl) continue;
          const message = parseJson(frame.payload);
          if (message && predicate(message)) {
            match = message;
            return true;
          }
        }
        return false;
      },
      {
        message: description,
        timeout: 10_000,
      },
    )
    .toBe(true);

  return match;
}

async function sendGameplayMessage(page, message) {
  await page.evaluate((payload) => {
    window.__TINY_FANGS_PRIVACY_PROBE__.send(payload);
  }, message);
}

function findAffordableSet(state) {
  return state.me.hand.find(
    (card) =>
      card.cardType === 'verse' &&
      card.type === 'set' &&
      card.cost <= state.me.mana,
  );
}

async function advanceUntilAffordableSet(owner, nonOwner) {
  let ownerState = owner.gameStart.state;

  for (let cycle = 0; cycle <= 15; cycle += 1) {
    const setCard = findAffordableSet(ownerState);
    if (setCard) return { ownerState, setCard, cycles: cycle };

    const nonOwnerFrameStart = nonOwner.observation.frames.length;
    await sendGameplayMessage(owner.page, { type: 'endTurn' });
    await waitForMessage(
      nonOwner.observation,
      nonOwnerFrameStart,
      (message) =>
        message.type === 'stateUpdate' && message.state.yourTurn === true,
      'the non-owner to receive their turn',
    );

    const ownerFrameStart = owner.observation.frames.length;
    await sendGameplayMessage(nonOwner.page, { type: 'endTurn' });
    const ownerTurn = await waitForMessage(
      owner.observation,
      ownerFrameStart,
      (message) =>
        message.type === 'stateUpdate' && message.state.yourTurn === true,
      'the owner to receive their next turn',
    );
    ownerState = ownerTurn.state;
  }

  throw new Error(
    `Known ${owner.deckId} deck did not yield an affordable Set Verse`,
  );
}

function identitySentinels(card) {
  return [...new Set([
    card.uid,
    card.id,
    card.name,
    card.art,
    card.flavor,
  ])].filter((value) => typeof value === 'string' && value.trim().length >= 4);
}

async function collectBrowserSurfaces(page) {
  const [domHtml, domText, ariaSnapshot, metadata] = await Promise.all([
    page.locator('html').evaluate((element) => element.outerHTML),
    page.locator('body').innerText(),
    page.locator('body').ariaSnapshot(),
    page.evaluate(() => {
      const qa = window.__TINY_FANGS_VISUAL_QA__;
      const probe = window.__TINY_FANGS_PRIVACY_PROBE__;

      return {
        debugEnabled: localStorage.getItem('tinyFangsDebug'),
        debugOutput: probe.console.map((entry) => entry.text),
        qa: qa
          ? {
              keys: Reflect.ownKeys(qa).map(String),
              fixtureNames: [...qa.fixtureNames],
              readiness: {
                keys: Reflect.ownKeys(qa.readiness).map(String),
                isReady: qa.readiness.isReady(),
                lastResetReason: qa.readiness.lastResetReason(),
              },
            }
          : null,
        readinessGlobal: window.__TINY_FANGS_VISUAL_READY__,
        assetAndPreloadMetadata: {
          declared: [
            ...document.querySelectorAll(
              'link[rel~="preload"], link[rel~="prefetch"], img, source',
            ),
          ].map((element) => ({
            as: element.getAttribute('as'),
            href: element.getAttribute('href'),
            rel: element.getAttribute('rel'),
            src: element.getAttribute('src'),
            srcset: element.getAttribute('srcset'),
          })),
          resources: performance
            .getEntriesByType('resource')
            .map((entry) => entry.name),
        },
      };
    }),
  ]);

  return {
    domHtml,
    domText,
    ariaSnapshot,
    metadata,
  };
}

test('a debug-enabled non-owner receives and renders only an opaque Set before reveal', async ({
  browser,
}) => {
  test.setTimeout(120_000);

  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  await Promise.all([
    installPrivacyProbe(hostContext),
    installPrivacyProbe(guestContext),
  ]);

  try {
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const hostObservation = observePage(hostPage);
    const guestObservation = observePage(guestPage);

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

    await Promise.all([
      expect(hostPage.locator('#deck-select')).toBeVisible(),
      expect(guestPage.locator('#deck-select')).toBeVisible(),
    ]);

    const hostGameStartIndex = hostObservation.frames.length;
    const guestGameStartIndex = guestObservation.frames.length;
    await Promise.all([
      hostPage.getByRole('button', { name: /Shell/ }).click(),
      guestPage.getByRole('button', { name: /Shadow/ }).click(),
    ]);

    const [hostGameStart, guestGameStart] = await Promise.all([
      waitForMessage(
        hostObservation,
        hostGameStartIndex,
        (message) => message.type === 'gameStart',
        'the host gameStart frame',
      ),
      waitForMessage(
        guestObservation,
        guestGameStartIndex,
        (message) => message.type === 'gameStart',
        'the guest gameStart frame',
      ),
    ]);

    const host = {
      deckId: knownDecks.host,
      gameStart: hostGameStart,
      observation: hostObservation,
      page: hostPage,
    };
    const guest = {
      deckId: knownDecks.guest,
      gameStart: guestGameStart,
      observation: guestObservation,
      page: guestPage,
    };
    const owner = hostGameStart.yourTurn ? host : guest;
    const nonOwner = owner === host ? guest : host;

    expect(owner.gameStart.yourTurn).toBe(true);
    expect(nonOwner.gameStart.yourTurn).toBe(false);
    expect(
      DECKS[owner.deckId].verses.some((verseId) => VERSES[verseId].type === 'set'),
    ).toBe(true);

    await Promise.all([
      expect(hostPage.locator('#setup')).toBeHidden({ timeout: 15_000 }),
      expect(guestPage.locator('#setup')).toBeHidden({ timeout: 15_000 }),
      expect(hostPage.locator('#desktop')).toBeVisible({ timeout: 15_000 }),
      expect(guestPage.locator('#desktop')).toBeVisible({ timeout: 15_000 }),
    ]);

    const { ownerState, setCard } = await advanceUntilAffordableSet(
      owner,
      nonOwner,
    );
    await expect(owner.page.locator('#d-turn')).toHaveText(
      String(ownerState.turn),
      { timeout: 15_000 },
    );
    await expect(owner.page.locator('#d-turn-indicator')).toHaveText(
      'YOUR TURN',
    );
    await expect(owner.page.locator('#d-hand-ct')).toHaveText(
      String(ownerState.me.hand.length),
    );
    await expect(
      owner.page.locator('#d-mana-pips .d-mana-pip.filled'),
    ).toHaveCount(ownerState.me.mana);
    await expect(owner.page.locator('#d-hand')).toContainText(setCard.name, {
      timeout: 15_000,
    });
    await expect(owner.page.locator('#d-btn-set')).toBeEnabled();

    const ownerFrameStart = owner.observation.frames.length;
    const nonOwnerFrameStart = nonOwner.observation.frames.length;
    await nonOwner.page.evaluate(() => {
      window.__TINY_FANGS_PRIVACY_PROBE__.clearObservation();
    });

    await owner.page.locator('#d-btn-set').click();
    await expect(owner.page.locator('#modal-title')).toHaveText('Set Verse');
    const selectedOption = owner.page
      .locator('#modal-opts .option:not(.off)')
      .filter({ hasText: setCard.name })
      .first();
    await expect(selectedOption).toBeVisible();
    await selectedOption.click();

    const [ownerUpdate, nonOwnerUpdate] = await Promise.all([
      waitForMessage(
        owner.observation,
        ownerFrameStart,
        (message) =>
          message.type === 'stateUpdate' &&
          message.state.me.setVerse?.uid === setCard.uid,
        'the owner state containing the full Set Verse',
      ),
      waitForMessage(
        nonOwner.observation,
        nonOwnerFrameStart,
        (message) =>
          message.type === 'stateUpdate' &&
          message.state.opp.setVerse?.faceDown === true,
        'the non-owner opaque Set Verse projection',
      ),
    ]);

    expect(ownerUpdate.state.me.setVerse).toEqual(setCard);
    expect(nonOwnerUpdate.state.opp.setVerse).toEqual({ faceDown: true });
    expect(Object.keys(nonOwnerUpdate.state.opp.setVerse)).toEqual([
      'faceDown',
    ]);

    const placementEvent = nonOwnerUpdate.events.find(
      (event) => event.type === 'setVerse',
    );
    expect(placementEvent).toEqual({
      type: 'setVerse',
      side: 'opp',
    });

    const nonOwnerSet = nonOwner.page.locator('#d-opp-set');
    await expect(nonOwnerSet).toBeVisible();
    await expect(nonOwnerSet).toHaveClass(/tf-card--set-down/);
    await expect(nonOwnerSet).toHaveText('[SET]');
    await expect(nonOwnerSet.locator('.tf-card__set-back')).toBeVisible();

    const interactionAttributes = await nonOwnerSet.evaluate((element) => ({
      onclick: element.getAttribute('onclick'),
      onpointerdown: element.getAttribute('onpointerdown'),
      onpointerleave: element.getAttribute('onpointerleave'),
      onpointerup: element.getAttribute('onpointerup'),
    }));
    expect(interactionAttributes).toEqual({
      onclick: null,
      onpointerdown: null,
      onpointerleave: null,
      onpointerup: null,
    });
    await nonOwnerSet.dispatchEvent('pointerdown');
    await nonOwner.page.waitForTimeout(450);
    await nonOwnerSet.dispatchEvent('pointerup');
    await expect(nonOwner.page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);

    const ownerSet = owner.page.locator('#d-my-set');
    await expect(ownerSet).toBeVisible();
    await ownerSet.dispatchEvent('pointerdown');
    await owner.page.waitForTimeout(450);
    await ownerSet.dispatchEvent('pointerup');
    await expect(owner.page.locator('#cardModal')).toHaveClass(/\bopen\b/);
    await expect(owner.page.locator('#cardDetail')).toContainText(setCard.name);
    await expect(owner.page.locator('#cardDetail')).toContainText(setCard.trigger);
    await expect(owner.page.locator('#cardDetail')).toContainText(setCard.text);

    await expect
      .poll(
        () =>
          nonOwner.page.evaluate(() =>
            window.__TINY_FANGS_PRIVACY_PROBE__.console.some(
              (entry) =>
                entry.text.includes('[DEBUG] Playing events:') &&
                entry.text.includes('setVerse'),
            ),
          ),
        { message: 'the direct browser debug event playback record' },
      )
      .toBe(true);

    const browserSurfaces = await collectBrowserSurfaces(nonOwner.page);
    expect(browserSurfaces.metadata.debugEnabled).toBe('1');
    expect(browserSurfaces.metadata.qa).not.toBeNull();
    expect(browserSurfaces.metadata.qa.readiness.isReady).toBe(true);
    expect(browserSurfaces.metadata.readinessGlobal).toBe(true);

    const postPlacementFrames = nonOwner.observation.frames
      .slice(nonOwnerFrameStart)
      .filter((frame) => frame.url === gameplaySocketUrl)
      .map((frame) => frame.payload);
    const inspectedSurfaces = {
      accessibleSnapshot: browserSurfaces.ariaSnapshot,
      assetAndPreloadMetadata:
        browserSurfaces.metadata.assetAndPreloadMetadata,
      debugOutput: browserSurfaces.metadata.debugOutput,
      domHtml: browserSurfaces.domHtml,
      domText: browserSurfaces.domText,
      qaAndReadinessMetadata: {
        qa: browserSurfaces.metadata.qa,
        readinessGlobal: browserSurfaces.metadata.readinessGlobal,
      },
      requestedUrls: nonOwner.observation.requestUrls,
      websocketFrames: postPlacementFrames,
    };

    for (const sentinel of identitySentinels(setCard)) {
      const normalizedSentinel = sentinel.toLocaleLowerCase();
      for (const [surfaceName, surface] of Object.entries(inspectedSurfaces)) {
        expect(
          JSON.stringify(surface).toLocaleLowerCase(),
          `${surfaceName} exposed secret Set sentinel ${JSON.stringify(sentinel)}`,
        ).not.toContain(normalizedSentinel);
      }
    }
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});
