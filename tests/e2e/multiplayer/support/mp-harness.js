// Shared two-browser-context multiplayer harness.
//
// Not a spec: the `multiplayer` Playwright project only collects
// `e2e/multiplayer/*.spec.js`, so this module is imported, never run.
//
// The patterns here are lifted verbatim in intent from the three suites that
// already own this ground — `lifecycle-authority.spec.js` (socket probe,
// create/join/deck-select/gameStart), `owner-responses.spec.js` (owned
// deterministic server child + MutationObserver timeline) and
// `set-privacy.spec.js` (identity sentinels, browser surface collection).
// They are consolidated here so new MP suites reuse one implementation instead
// of a fourth copy.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { expect } from '@playwright/test';

const REPO_ROOT = new URL('../../../../', import.meta.url);

export const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
export const sharedWsPort = Number(process.env.TINY_FANGS_WS_PORT ?? '3101');

export const CANONICAL_DESKTOP = Object.freeze({ width: 1672, height: 941 });

/**
 * Each suite owns a private deterministic server on its own port so the
 * shared Playwright WebSocket server keeps its real shuffle, and so two
 * suites can never share a PRNG stream.
 */
export function deterministicServerConfig(portOffset) {
  const port = sharedWsPort + portOffset;
  const endpoint = `ws://127.0.0.1:${port}`;
  return {
    endpoint,
    gameUrl:
      `http://127.0.0.1:${vitePort}/?presentation=classic&visualQa=1&ws=` +
      encodeURIComponent(endpoint),
    port,
    socketUrl: new URL(endpoint).href,
  };
}

export function startDeterministicServer(port) {
  const child = spawn(
    process.execPath,
    ['--import', './tests/server/deterministic-random.js', 'server/index.js'],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        TINY_FANGS_WS_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.setEncoding('utf8');
  child.stdout.resume();
  return child;
}

export async function waitForServer(child, port) {
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Deterministic server exited ${child.exitCode}: ${stderr}`,
      );
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {
      // The owned child has not bound its configured port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(`Timed out waiting for deterministic server: ${stderr}`);
}

export async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}

/**
 * Installs the per-context probe:
 *  - every WebSocket's inbound/outbound payloads with a monotonic timestamp,
 *  - console output (debug playback records are privacy-relevant),
 *  - a MutationObserver timeline that snapshots the *rendered board* at the
 *    exact instant `#modal` opens. That snapshot is how the suites prove a
 *    terminal result is presented after playback rather than during it.
 */
export async function installMpProbe(context, socketUrl) {
  await context.addInitScript(({ endpoint }) => {
    const NativeWebSocket = window.WebSocket;
    const probe = {
      console: [],
      inbound: [],
      outbound: [],
      sockets: [],
      timeline: [],
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
        probe.console.push(args.map(serialize).join(' '));
        original(...args);
      };
    }

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

        probe.sockets.push(socket);
        socket.addEventListener('message', (event) => {
          probe.inbound.push({
            at: performance.now(),
            payload: serialize(event.data),
            url: socket.url,
          });
        });
        socket.send = (payload) => {
          probe.outbound.push({
            at: performance.now(),
            payload: serialize(payload),
            url: socket.url,
          });
          return nativeSend(payload);
        };
        return socket;
      },
    });

    probe.send = (message) => {
      const socket = probe.sockets.find(
        (candidate) =>
          candidate.url === endpoint &&
          candidate.readyState === NativeWebSocket.OPEN,
      );
      if (!socket) throw new Error(`No open socket for ${endpoint}`);
      socket.send(JSON.stringify(message));
    };
    probe.closeOpen = () => {
      const socket = probe.sockets.find(
        (candidate) =>
          candidate.url === endpoint &&
          candidate.readyState === NativeWebSocket.OPEN,
      );
      if (!socket) throw new Error(`No open socket for ${endpoint}`);
      socket.close();
    };
    probe.openSocketCount = () =>
      probe.sockets.filter(
        (candidate) =>
          candidate.url === endpoint &&
          candidate.readyState === NativeWebSocket.OPEN,
      ).length;
    probe.socketCount = () =>
      probe.sockets.filter((candidate) => candidate.url === endpoint).length;

    Object.defineProperty(window, '__TINY_FANGS_MP_PROBE__', {
      configurable: false,
      enumerable: false,
      value: probe,
      writable: false,
    });

    const RAIL_BUTTONS = [
      'd-btn-summon',
      'd-btn-cast',
      'd-btn-set',
      'd-btn-atk',
      'd-btn-retreat',
      'd-btn-end',
    ];

    const observeModal = () => {
      const text = (id) =>
        document.getElementById(id)?.textContent ?? null;
      const record = (type) => {
        probe.timeline.push({
          at: performance.now(),
          // `processUpdate` renders state, awaits `playServerEvents`, then
          // calls `renderLog()` and only afterwards `showGameOver`. The
          // rendered battle log captured here is therefore the direct
          // ordering witness: a result modal that opened mid-playback would
          // carry a short log.
          battleLog: text('d-log'),
          myLp: text('d-my-lp'),
          oppLp: text('d-opp-lp'),
          railDisabled: Object.fromEntries(
            RAIL_BUTTONS.map((id) => [
              id,
              document.getElementById(id)?.disabled ?? null,
            ]),
          ),
          title: text('modal-title'),
          type,
        });
      };

      let wasOpen = false;
      const observer = new MutationObserver(() => {
        const modal = document.getElementById('modal');
        if (!modal) return;
        const isOpen = modal.classList.contains('open');
        if (isOpen === wasOpen) return;
        wasOpen = isOpen;
        record(isOpen ? 'modalOpen' : 'modalClose');
      });
      observer.observe(document.documentElement, {
        attributeFilter: ['class', 'disabled'],
        attributes: true,
        childList: true,
        subtree: true,
      });
    };

    if (document.documentElement) {
      observeModal();
    } else {
      document.addEventListener('DOMContentLoaded', observeModal, {
        once: true,
      });
    }

    try {
      localStorage.setItem('tinyFangsDebug', '1');
    } catch {
      // The init script also runs on about:blank, which has an opaque origin.
    }
  }, { endpoint: socketUrl });
}

export async function probeSnapshot(page) {
  return page.evaluate(() => {
    const probe = window.__TINY_FANGS_MP_PROBE__;
    const parse = ({ at, payload, url }) => {
      let message = null;
      try {
        message = JSON.parse(payload);
      } catch {
        // Malformed payloads stay available as raw text.
      }
      return { at, message, payload, url };
    };
    return {
      console: [...probe.console],
      inbound: probe.inbound.map(parse),
      openSockets: probe.openSocketCount(),
      outbound: probe.outbound.map(parse),
      timeline: [...probe.timeline],
      totalSockets: probe.socketCount(),
    };
  });
}

export async function waitForInbound(page, fromIndex, predicate, description) {
  let match = null;
  await expect
    .poll(
      async () => {
        const snapshot = await probeSnapshot(page);
        for (
          let index = fromIndex;
          index < snapshot.inbound.length;
          index += 1
        ) {
          const message = snapshot.inbound[index].message;
          if (message && predicate(message)) {
            match = message;
            return true;
          }
        }
        return false;
      },
      { message: description, timeout: 20_000 },
    )
    .toBe(true);
  return match;
}

export async function sendProbeMessage(page, message) {
  await page.evaluate((payload) => {
    window.__TINY_FANGS_MP_PROBE__.send(payload);
  }, message);
}

export async function enterMultiplayer(page, gameUrl) {
  await page.goto(gameUrl);
  const connected = page.waitForEvent(
    'console',
    (message) => message.text().includes('Connected to server'),
  );
  await page.getByRole('button', { name: /Multiplayer/ }).click();
  await connected;
}

/**
 * Real create/join lobby journey — the same visible transitions
 * `lifecycle-authority.spec.js` asserts, reused rather than reimplemented.
 */
export async function createAndJoin(hostPage, guestPage) {
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
  await Promise.all([
    expect(hostPage.locator('#deck-select')).toBeVisible({ timeout: 5_000 }),
    expect(guestPage.locator('#deck-select')).toBeVisible(),
  ]);
  return roomCode;
}

/**
 * Drives the real deck controls and returns both personalized `gameStart`
 * frames plus the started board route.
 */
export async function selectDecksAndStart(hostPage, guestPage, {
  hostDeck = /Shell/,
  guestDeck = /Swarm/,
} = {}) {
  await hostPage.getByRole('button', { name: hostDeck }).click();
  await expect(hostPage.locator('#mp-status')).toHaveText(
    'Waiting for opponent to select deck...',
  );
  await expect(guestPage.locator('#mp-status')).toHaveText(
    'Opponent ready! Select your deck.',
  );

  const hostIndex = (await probeSnapshot(hostPage)).inbound.length;
  const guestIndex = (await probeSnapshot(guestPage)).inbound.length;
  await guestPage.getByRole('button', { name: guestDeck }).click();

  const [hostStart, guestStart] = await Promise.all([
    waitForInbound(
      hostPage,
      hostIndex,
      (message) => message.type === 'gameStart',
      'host gameStart',
    ),
    waitForInbound(
      guestPage,
      guestIndex,
      (message) => message.type === 'gameStart',
      'guest gameStart',
    ),
  ]);

  expect([hostStart.you, guestStart.you].sort()).toEqual(['p1', 'p2']);
  expect([hostStart.yourTurn, guestStart.yourTurn].sort()).toEqual([
    false,
    true,
  ]);

  await Promise.all([
    expect(hostPage.locator('#setup')).toBeHidden({ timeout: 20_000 }),
    expect(guestPage.locator('#setup')).toBeHidden({ timeout: 20_000 }),
    expect(hostPage.locator('#desktop')).toBeVisible({ timeout: 20_000 }),
    expect(guestPage.locator('#desktop')).toBeVisible({ timeout: 20_000 }),
  ]);

  return {
    guest: { gameStart: guestStart, page: guestPage },
    host: { gameStart: hostStart, page: hostPage },
  };
}

/** Live client-side projection of the local player's own zones. */
export async function clientState(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const summarize = (player) => ({
      active: player.active?.uid ?? null,
      bench: player.bench.map((card) => card.uid),
      grave: player.grave.map((card) => card.uid),
      hand: player.hand.map((card) => ({
        cardType: card.cardType,
        cost: card.cost,
        id: card.id,
        name: card.name,
        type: card.type ?? null,
        uid: card.uid,
      })),
      lp: player.lp,
      mana: player.mana,
      setVerse: player.setVerse?.uid ?? player.setVerse ?? null,
    });
    return {
      animating: Boolean(state.animating),
      me: summarize(state.G.me),
      myTurn: state.G.myTurn,
      opp: {
        active: state.G.opp.active?.uid ?? null,
        bench: state.G.opp.bench.map((card) => card.uid),
        lp: state.G.opp.lp,
      },
      turn: state.G.turn,
      winner: state.G.winner,
    };
  });
}

/**
 * Records whether the match owner was disposed *before* the page navigated.
 * `restartGame` / `showGameOver` both call `clearGame()` and then
 * `location.reload()`, so a `pagehide` listener observes the post-clear,
 * pre-navigation instant. sessionStorage survives the same-tab reload.
 */
export const DISPOSAL_KEY = '__TINY_FANGS_DISPOSAL_AT_UNLOAD__';

export async function armDisposalProbe(page) {
  await page.evaluate(async (key) => {
    const { state } = await import('/src/state.js');
    sessionStorage.removeItem(key);
    window.addEventListener('pagehide', () => {
      sessionStorage.setItem(key, JSON.stringify({
        gameCleared: state.G === null,
        longPressTimerCleared: state.longPressTimer === null,
        selectedCardCleared: state.selectedCard === null,
        startTimeCleared: state.startTime === null,
        timerIntervalCleared: state.timerInt === null,
      }));
    });
  }, DISPOSAL_KEY);
}

export async function readDisposalProbe(page) {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, DISPOSAL_KEY);
}

export async function rootStateSnapshot(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return {
      game: state.G,
      longPressTimer: state.longPressTimer,
      selectedCard: state.selectedCard,
      startTime: state.startTime,
      timerInt: state.timerInt,
    };
  });
}

/**
 * Every string on a card that could identify it. Mirrors
 * `set-privacy.spec.js::identitySentinels` so hidden-information assertions
 * stay one implementation.
 */
export function identitySentinels(card) {
  return [...new Set([
    card.uid,
    card.id,
    card.name,
    card.art,
    card.flavor,
    card.text,
    card.trigger,
  ])].filter(
    (value) => typeof value === 'string' && value.trim().length >= 4,
  );
}

export async function collectBrowserSurfaces(page) {
  const [domHtml, domText, ariaSnapshot, probe] = await Promise.all([
    page.locator('html').evaluate((element) => element.outerHTML),
    page.locator('body').innerText(),
    page.locator('body').ariaSnapshot(),
    probeSnapshot(page),
  ]);

  return {
    accessibleSnapshot: ariaSnapshot,
    debugOutput: probe.console,
    domHtml,
    domText,
    websocketFrames: [
      ...probe.inbound.map((entry) => entry.payload),
      ...probe.outbound.map((entry) => entry.payload),
    ],
  };
}

export function expectSentinelsAbsent(surfaces, sentinels, context) {
  for (const sentinel of sentinels) {
    const normalized = sentinel.toLocaleLowerCase();
    for (const [surfaceName, surface] of Object.entries(surfaces)) {
      expect(
        JSON.stringify(surface).toLocaleLowerCase(),
        `${context}: ${surfaceName} exposed secret sentinel ${JSON.stringify(sentinel)}`,
      ).not.toContain(normalized);
    }
  }
}

export const RAIL_BUTTON_IDS = Object.freeze([
  '#d-btn-summon',
  '#d-btn-cast',
  '#d-btn-set',
  '#d-btn-atk',
  '#d-btn-retreat',
  '#d-btn-end',
]);

export async function railDisabledState(page) {
  return page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => [id, document.querySelector(id)?.disabled ?? null]),
      ),
    RAIL_BUTTON_IDS,
  );
}
