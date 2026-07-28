import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const configuredWsPort = Number(process.env.TINY_FANGS_WS_PORT ?? '3101');
const deterministicWsPort = configuredWsPort + 37;
const wsEndpoint = `ws://127.0.0.1:${deterministicWsPort}`;
const gameplaySocketUrl = new URL(wsEndpoint).href;
const gameUrl =
  `http://127.0.0.1:${vitePort}/?presentation=classic&visualQa=1&ws=` +
  encodeURIComponent(wsEndpoint);

function startDeterministicServer() {
  return spawn(
    process.execPath,
    [
      '--import',
      './tests/server/deterministic-random.js',
      'server/index.js',
    ],
    {
      cwd: new URL('../../../', import.meta.url),
      env: {
        ...process.env,
        TINY_FANGS_WS_PORT: String(deterministicWsPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function waitForServer(child) {
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
      const response = await fetch(
        `http://127.0.0.1:${deterministicWsPort}/healthz`,
      );
      if (response.ok) return;
    } catch {
      // The child has not bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(`Timed out waiting for deterministic server: ${stderr}`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}

async function installProbe(context) {
  await context.addInitScript(({ endpoint }) => {
    const NativeWebSocket = window.WebSocket;
    const probe = {
      console: [],
      inbound: [],
      outbound: [],
      requestUrls: [],
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
        return Reflect.get(Target, property, Target);
      },
      construct(Target, args) {
        const socket = Reflect.construct(Target, args, Target);
        const nativeSend = socket.send.bind(socket);
        probe.sockets.push(socket);
        socket.addEventListener('message', (event) => {
          let message = null;
          try {
            message = JSON.parse(event.data);
          } catch {
            // The raw payload is still retained below.
          }
          probe.inbound.push({
            payload: serialize(event.data),
            url: socket.url,
          });
          if (message?.type === 'gameStart') {
            probe.timeline.push({
              at: performance.now(),
              type: 'gameStart',
            });
          }
        });
        socket.send = (payload) => {
          probe.outbound.push({
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

    Object.defineProperty(window, '__TINY_FANGS_OWNER_PROBE__', {
      configurable: false,
      enumerable: false,
      value: probe,
      writable: false,
    });

    const observeCoinAndShells = () => {
      const coinOverlays = new WeakSet();
      const isCoinOverlay = (node) =>
        node instanceof HTMLDivElement &&
        node.style.position === 'fixed' &&
        node.style.zIndex === '9999' &&
        node.firstElementChild instanceof HTMLPreElement;
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (isCoinOverlay(node)) {
                coinOverlays.add(node);
                const setup = document.getElementById('setup');
                const desktop = document.getElementById('desktop');
                probe.timeline.push({
                  at: performance.now(),
                  desktopDisplay: desktop
                    ? getComputedStyle(desktop).display
                    : null,
                  setupDisplay: setup
                    ? getComputedStyle(setup).display
                    : null,
                  type: 'coinAdded',
                });
              }
            }
            for (const node of mutation.removedNodes) {
              if (coinOverlays.has(node)) {
                probe.timeline.push({
                  at: performance.now(),
                  type: 'coinRemoved',
                });
              }
            }
          }
          if (
            mutation.type === 'attributes' &&
            (mutation.target.id === 'setup' ||
              mutation.target.id === 'desktop')
          ) {
            probe.timeline.push({
              at: performance.now(),
              display: mutation.target.style.display,
              id: mutation.target.id,
              type: 'shellStyle',
            });
          }
        }
      });
      observer.observe(document.documentElement, {
        attributeFilter: ['class', 'style'],
        attributes: true,
        childList: true,
        subtree: true,
      });
    };
    if (document.documentElement) {
      observeCoinAndShells();
    } else {
      document.addEventListener('DOMContentLoaded', observeCoinAndShells, {
        once: true,
      });
    }

    try {
      localStorage.setItem('tinyFangsDebug', '1');
    } catch {
      // The init script also runs on about:blank, which has an opaque origin.
    }
  }, { endpoint: gameplaySocketUrl });
}

async function snapshotProbe(page) {
  return page.evaluate(() => {
    const probe = window.__TINY_FANGS_OWNER_PROBE__;
    const parse = ({ payload, url }) => {
      let message = null;
      try {
        message = JSON.parse(payload);
      } catch {
        // Keep malformed data as raw text.
      }
      return { message, payload, url };
    };
    return {
      console: [...probe.console],
      inbound: probe.inbound.map(parse),
      outbound: probe.outbound.map(parse),
      timeline: [...probe.timeline],
    };
  });
}

function expectCoinBeforeBoard(timeline) {
  const gameStartIndex = timeline.findLastIndex(
    (entry) => entry.type === 'gameStart',
  );
  const gameTimeline = timeline.slice(gameStartIndex);
  const coinAddedIndex = gameTimeline.findIndex(
    (entry) => entry.type === 'coinAdded',
  );
  const coinRemovedIndex = gameTimeline.findIndex(
    (entry) => entry.type === 'coinRemoved',
  );
  const setupHiddenIndex = gameTimeline.findIndex(
    (entry) =>
      entry.type === 'shellStyle' &&
      entry.id === 'setup' &&
      entry.display === 'none',
  );
  const desktopShownIndex = gameTimeline.findIndex(
    (entry) =>
      entry.type === 'shellStyle' &&
      entry.id === 'desktop' &&
      entry.display === 'flex',
  );

  expect(gameStartIndex).toBeGreaterThanOrEqual(0);
  expect(coinAddedIndex).toBeGreaterThan(0);
  expect(coinRemovedIndex).toBeGreaterThan(coinAddedIndex);
  expect(setupHiddenIndex).toBeGreaterThan(coinRemovedIndex);
  expect(desktopShownIndex).toBeGreaterThan(coinRemovedIndex);

  const coinAdded = gameTimeline[coinAddedIndex];
  const coinRemoved = gameTimeline[coinRemovedIndex];
  expect(coinAdded.setupDisplay).not.toBe('none');
  expect(coinAdded.desktopDisplay).toBe('none');
  expect(coinRemoved.at - coinAdded.at).toBeGreaterThan(500);
}

async function waitForInbound(page, fromIndex, predicate, description) {
  let match = null;
  await expect
    .poll(
      async () => {
        const snapshot = await snapshotProbe(page);
        for (let index = fromIndex; index < snapshot.inbound.length; index += 1) {
          const message = snapshot.inbound[index].message;
          if (message && predicate(message)) {
            match = message;
            return true;
          }
        }
        return false;
      },
      { message: description, timeout: 15_000 },
    )
    .toBe(true);
  return match;
}

async function send(page, message) {
  await page.evaluate((payload) => {
    window.__TINY_FANGS_OWNER_PROBE__.send(payload);
  }, message);
}

async function performAction(actor, observer, action) {
  const actorIndex = (await snapshotProbe(actor)).inbound.length;
  const observerIndex = (await snapshotProbe(observer)).inbound.length;
  await send(actor, { type: 'action', action });
  const [actorUpdate, observerUpdate] = await Promise.all([
    waitForInbound(
      actor,
      actorIndex,
      (message) => message.type === 'stateUpdate',
      'actor state update',
    ),
    waitForInbound(
      observer,
      observerIndex,
      (message) => message.type === 'stateUpdate',
      'observer state update',
    ),
  ]);
  return { actor: actorUpdate, observer: observerUpdate };
}

async function performEndTurn(actor, observer) {
  const actorIndex = (await snapshotProbe(actor)).inbound.length;
  const observerIndex = (await snapshotProbe(observer)).inbound.length;
  await send(actor, { type: 'endTurn' });
  await Promise.all([
    waitForInbound(
      actor,
      actorIndex,
      (message) => message.type === 'turnChange',
      'actor turn change',
    ),
    waitForInbound(
      observer,
      observerIndex,
      (message) => message.type === 'turnChange',
      'observer turn change',
    ),
  ]);
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

async function browserSurfaces(page) {
  return Promise.all([
    page.locator('html').evaluate((element) => element.outerHTML),
    page.locator('body').innerText(),
    page.locator('body').ariaSnapshot(),
    snapshotProbe(page),
    page.evaluate(() => ({
      readiness: window.__TINY_FANGS_VISUAL_READY__,
      resources: performance
        .getEntriesByType('resource')
        .map((entry) => entry.name),
    })),
  ]).then(([html, text, aria, probe, metadata]) => ({
    aria,
    html,
    metadata,
    probe,
    text,
  }));
}

test('awaits the coin before board start and keeps Optional/Skitter responses owner-only', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const server = startDeterministicServer();
  await waitForServer(server);

  const hostContext = await browser.newContext({
    viewport: { width: 1672, height: 941 },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 1672, height: 941 },
  });
  await Promise.all([
    installProbe(hostContext),
    installProbe(guestContext),
  ]);

  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    await Promise.all([enterMultiplayer(host), enterMultiplayer(guest)]);

    await host.getByRole('button', { name: /Create Room/ }).click();
    await expect(host.locator('#room-code-display')).toHaveText(
      /^[A-HJ-NP-Z2-9]{4}$/,
    );
    const roomCode = await host.locator('#room-code-display').textContent();
    await guest.getByRole('button', { name: /Join Room/ }).click();
    await guest.locator('#room-code-input').fill(roomCode);
    await guest.getByRole('button', { name: 'Join', exact: true }).click();
    await Promise.all([
      expect(host.locator('#deck-select')).toBeVisible(),
      expect(guest.locator('#deck-select')).toBeVisible(),
    ]);

    await host.getByRole('button', { name: /Shell/ }).click();
    const hostStartIndex = (await snapshotProbe(host)).inbound.length;
    const guestStartIndex = (await snapshotProbe(guest)).inbound.length;
    await guest.getByRole('button', { name: /Swarm/ }).click();

    const [hostStart, guestStart] = await Promise.all([
      waitForInbound(
        host,
        hostStartIndex,
        (message) => message.type === 'gameStart',
        'host game start',
      ),
      waitForInbound(
        guest,
        guestStartIndex,
        (message) => message.type === 'gameStart',
        'guest game start',
      ),
    ]);
    expect(hostStart).toMatchObject({ you: 'p1', yourTurn: true });
    expect(guestStart).toMatchObject({ you: 'p2', yourTurn: false });

    await Promise.all([
      expect(host.locator('#setup')).toBeHidden({ timeout: 15_000 }),
      expect(guest.locator('#setup')).toBeHidden({ timeout: 15_000 }),
      expect(host.locator('#desktop')).toBeVisible({ timeout: 15_000 }),
      expect(guest.locator('#desktop')).toBeVisible({ timeout: 15_000 }),
    ]);
    expectCoinBeforeBoard((await snapshotProbe(host)).timeline);
    expectCoinBeforeBoard((await snapshotProbe(guest)).timeline);

    const shellkin = hostStart.state.me.hand.find(
      (card) => card.id === 'shellkin',
    );
    const brace = hostStart.state.me.hand.find(
      (card) => card.id === 'brace',
    );
    const skitter = guestStart.state.me.hand.find(
      (card) => card.id === 'skitter',
    );
    const benchCreature = guestStart.state.me.hand.find(
      (card) =>
        card.cardType === 'creature' && card.uid !== skitter?.uid,
    );
    expect([shellkin?.id, brace?.id, skitter?.id]).toEqual([
      'shellkin',
      'brace',
      'skitter',
    ]);
    expect(benchCreature).toBeTruthy();

    await performAction(host, guest, {
      action: 'summon',
      cardUid: shellkin.uid,
      target: 'active',
    });
    await performEndTurn(host, guest);
    await performAction(guest, host, {
      action: 'summon',
      cardUid: skitter.uid,
      target: 'active',
    });
    await performEndTurn(guest, host);
    await performAction(host, guest, {
      action: 'set',
      cardUid: brace.uid,
    });
    await performEndTurn(host, guest);
    await performAction(guest, host, {
      action: 'summon',
      cardUid: benchCreature.uid,
      target: 'bench',
    });

    const optional = await performAction(
      guest,
      host,
      { action: 'attack' },
    );
    expect(optional.observer.pendingAction).toMatchObject({
      type: 'optionalTrigger',
      side: 'me',
      verseId: 'brace',
    });
    expect(optional.actor).not.toHaveProperty('pendingAction');

    await expect(host.locator('#modal.open #modal-title')).toHaveText(
      'Activate Brace?',
      { timeout: 30_000 },
    );
    await expect(guest.locator('#modal.open')).toHaveCount(0);
    const guestOptionalSurfaces = JSON.stringify(
      await browserSurfaces(guest),
    );
    expect(guestOptionalSurfaces).not.toContain('Activate Brace?');
    expect(guestOptionalSurfaces).not.toContain('"verseId":"brace"');
    expect(guestOptionalSurfaces).not.toContain('"pendingAction"');

    const optionalOwnerInboundIndex =
      (await snapshotProbe(host)).inbound.length;
    const optionalPeerInboundIndex =
      (await snapshotProbe(guest)).inbound.length;
    const optionalResolutionIndex =
      (await snapshotProbe(host)).outbound.length;
    await host.locator('#modal.open .option').filter({ hasText: 'No' }).click();
    await expect
      .poll(
        async () => {
          const snapshot = await snapshotProbe(host);
          return snapshot.outbound
            .slice(optionalResolutionIndex)
            .some(({ message }) =>
              message?.type === 'action' &&
              message.action?.action === 'respondOptionalTrigger' &&
              message.action.confirmed === false,
            );
        },
        { message: 'one owner optional decline frame' },
      )
      .toBe(true);
    await Promise.all([
      waitForInbound(
        host,
        optionalOwnerInboundIndex,
        (message) =>
          message.type === 'stateUpdate' &&
          message.events?.some((event) => event.type === 'triggerDeclined'),
        'optional owner resolution state',
      ),
      waitForInbound(
        guest,
        optionalPeerInboundIndex,
        (message) =>
          message.type === 'stateUpdate' &&
          message.events?.some((event) => event.type === 'triggerDeclined'),
        'optional peer resolution state',
      ),
    ]);
    await performEndTurn(guest, host);

    const hostSkitterProbeStart = await snapshotProbe(host);
    const skitterOffer = await performAction(
      host,
      guest,
      { action: 'attack' },
    );
    expect(skitterOffer.observer.pendingAction).toMatchObject({
      type: 'skitterSwap',
      side: 'me',
      benchOptions: [{ idx: 0, uid: benchCreature.uid }],
    });
    expect(skitterOffer.actor).not.toHaveProperty('pendingAction');

    await expect(guest.locator('#modal.open #modal-title')).toContainText(
      'Scurry',
      { timeout: 30_000 },
    );
    await expect(host.locator('#modal.open')).toHaveCount(0);
    const hostSkitterSnapshot = await browserSurfaces(host);
    const hostSkitterSurfaces = JSON.stringify({
      ...hostSkitterSnapshot,
      probe: {
        ...hostSkitterSnapshot.probe,
        console: hostSkitterSnapshot.probe.console.slice(
          hostSkitterProbeStart.console.length,
        ),
        inbound: hostSkitterSnapshot.probe.inbound.slice(
          hostSkitterProbeStart.inbound.length,
        ),
        outbound: hostSkitterSnapshot.probe.outbound.slice(
          hostSkitterProbeStart.outbound.length,
        ),
      },
    });
    expect(hostSkitterSurfaces).not.toContain('"pendingAction"');
    expect(hostSkitterSurfaces).not.toContain('"benchOptions"');

    await guest
      .locator('#modal.open .option')
      .filter({ hasText: 'Decline' })
      .click();
    await expect(guest.locator('#modal.open')).toHaveCount(0);
  } finally {
    await Promise.allSettled([
      guestContext.close(),
      hostContext.close(),
    ]);
    await stopServer(server);
  }
});
