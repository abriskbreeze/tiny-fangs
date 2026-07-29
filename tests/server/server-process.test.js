import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = new URL('../../', import.meta.url);
const runningChildren = new Set();

async function findAvailablePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');

  const address = probe.address();
  if (!address || typeof address === 'string') {
    probe.close();
    throw new Error('Could not resolve an available TCP port');
  }

  const { port } = address;
  probe.close();
  await once(probe, 'close');
  return port;
}

function startServer(portValue, { deterministicRandom = false } = {}) {
  const nodeArgs = deterministicRandom
    ? ['--import', './tests/server/deterministic-random.js', 'server/index.js']
    : ['server/index.js'];
  const child = spawn(process.execPath, nodeArgs, {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      TINY_FANGS_WS_PORT: String(portValue),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  const output = {
    stdout: '',
    stderr: '',
  };

  child.stdout.on('data', (chunk) => {
    output.stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output.stderr += chunk;
  });

  runningChildren.add(child);
  child.once('exit', () => runningChildren.delete(child));
  return { child, output };
}

async function waitForHealth(port, child, output, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  const healthUrl = `http://127.0.0.1:${port}/healthz`;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Server exited before health check passed.\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
      );
    }

    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return response;
      }
    } catch {
      // The owned child has not bound its configured port yet.
    }

    await delay(40);
  }

  throw new Error(
    `Timed out waiting for ${healthUrl}.\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
  );
}

async function waitForExit(child, timeoutMs = 4_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return {
      code: child.exitCode,
      signal: child.signalCode,
    };
  }

  return Promise.race([
    once(child, 'exit').then(([code, signal]) => ({ code, signal })),
    delay(timeoutMs).then(() => {
      throw new Error(`Server did not exit within ${timeoutMs} ms`);
    }),
  ]);
}

async function terminateChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGKILL');
  await once(child, 'exit');
}

async function openWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener(
      'error',
      () => reject(new Error(`WebSocket failed to open: ${url}`)),
      { once: true },
    );
  });
}

function nextSocketMessage(socket, timeoutMs = 4_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener('message', onMessage);
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeoutMs);

    function onMessage(event) {
      clearTimeout(timeout);
      resolve(JSON.parse(event.data));
    }

    socket.addEventListener('message', onMessage, { once: true });
  });
}

async function sendAndReceive(socket, message) {
  const response = nextSocketMessage(socket);
  socket.send(
    typeof message === 'string' ? message : JSON.stringify(message),
  );
  return response;
}

async function closeWebSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return;
  const closed = once(socket, 'close');
  socket.close();
  await closed;
}

async function createRoom(socket) {
  const response = await sendAndReceive(socket, { type: 'create' });
  expect(response).toMatchObject({
    type: 'roomCreated',
  });
  expect(response.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  return response.roomCode;
}

async function startRawGame(host, guest, {
  hostDeckId = 'shell',
  guestDeckId = 'swarm',
} = {}) {
  const roomCode = await createRoom(host);
  const opponentJoined = nextSocketMessage(host);
  await expect(
    sendAndReceive(guest, { type: 'join', roomCode }),
  ).resolves.toEqual({ type: 'roomJoined', roomCode });
  await opponentJoined;

  const guestReady = nextSocketMessage(guest);
  await expect(
    sendAndReceive(host, { type: 'deckSelect', deckId: hostDeckId }),
  ).resolves.toEqual({ type: 'waitingForOpponent' });
  await expect(guestReady).resolves.toEqual({ type: 'opponentReady' });

  const hostStart = nextSocketMessage(host);
  const guestStart = nextSocketMessage(guest);
  guest.send(JSON.stringify({ type: 'deckSelect', deckId: guestDeckId }));

  const [hostGame, guestGame] = await Promise.all([hostStart, guestStart]);
  expect(hostGame.type).toBe('gameStart');
  expect(guestGame.type).toBe('gameStart');
  return {
    guest: { gameStart: guestGame, socket: guest },
    host: { gameStart: hostGame, socket: host },
    roomCode,
  };
}

function createMessageInbox(socket) {
  const queued = [];
  const waiters = [];

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const waiterIndex = waiters.findIndex(({ predicate }) =>
      predicate(message),
    );
    if (waiterIndex === -1) {
      queued.push(message);
      return;
    }

    const [{ resolve, timeout }] = waiters.splice(waiterIndex, 1);
    clearTimeout(timeout);
    resolve(message);
  });

  return {
    next(predicate = () => true, timeoutMs = 4_000) {
      const queuedIndex = queued.findIndex(predicate);
      if (queuedIndex !== -1) {
        return Promise.resolve(queued.splice(queuedIndex, 1)[0]);
      }

      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          timeout: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index !== -1) waiters.splice(index, 1);
            reject(new Error('Timed out waiting for queued WebSocket message'));
          }, timeoutMs),
        };
        waiters.push(waiter);
      });
    },
  };
}

async function performGameAction(actor, observer, action) {
  const actorUpdate = actor.inbox.next(
    (message) => message.type === 'stateUpdate',
  );
  const observerUpdate = observer.inbox.next(
    (message) => message.type === 'stateUpdate',
  );
  actor.socket.send(JSON.stringify({ type: 'action', action }));
  const [actorMessage, observerMessage] = await Promise.all([
    actorUpdate,
    observerUpdate,
  ]);
  actor.state = actorMessage.state;
  observer.state = observerMessage.state;
  return {
    actor: actorMessage,
    observer: observerMessage,
  };
}

async function performEndTurn(actor, observer) {
  const actorUpdate = actor.inbox.next(
    (message) => message.type === 'stateUpdate',
  );
  const observerUpdate = observer.inbox.next(
    (message) => message.type === 'stateUpdate',
  );
  const actorTurn = actor.inbox.next(
    (message) => message.type === 'turnChange',
  );
  const observerTurn = observer.inbox.next(
    (message) => message.type === 'turnChange',
  );
  actor.socket.send(JSON.stringify({ type: 'endTurn' }));
  const [
    actorMessage,
    observerMessage,
    actorTurnMessage,
    observerTurnMessage,
  ] = await Promise.all([
    actorUpdate,
    observerUpdate,
    actorTurn,
    observerTurn,
  ]);
  actor.state = actorMessage.state;
  observer.state = observerMessage.state;
  expect(actorTurnMessage.yourTurn).toBe(actor.state.yourTurn);
  expect(observerTurnMessage.yourTurn).toBe(observer.state.yourTurn);
}

afterEach(async () => {
  await Promise.all([...runningChildren].map(terminateChild));
});

describe('multiplayer server process topology', () => {
  it('serves health and WebSocket upgrades from the configured port', async () => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);

    const response = await waitForHealth(port, child, output);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });

    const socket = await openWebSocket(`ws://127.0.0.1:${port}`);
    expect(socket.readyState).toBe(WebSocket.OPEN);
    socket.close();
  });

  it.each(['SIGINT', 'SIGTERM'])('exits cleanly after %s', async (signal) => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);
    await waitForHealth(port, child, output);

    child.kill(signal);
    const exit = await waitForExit(child);

    expect(exit).toEqual({ code: 0, signal: null });
  });

  it.each(['0', '65536', 'not-a-port', '12.5', ''])(
    'rejects invalid TINY_FANGS_WS_PORT=%j',
    async (portValue) => {
      const { child, output } = startServer(portValue);
      const exit = await waitForExit(child);

      expect(exit).toEqual({ code: 1, signal: null });
      expect(output.stderr).toContain('TINY_FANGS_WS_PORT');
    },
  );

  it('exits non-zero when the configured port is already occupied', async () => {
    const port = await findAvailablePort();
    const blocker = createServer();
    blocker.listen(port);
    await once(blocker, 'listening');

    try {
      const { child, output } = startServer(port);
      const exit = await waitForExit(child);

      expect(exit).toEqual({ code: 1, signal: null });
      expect(output.stderr).toContain('EADDRINUSE');
    } finally {
      blocker.close();
      await once(blocker, 'close');
    }
  });
});

describe('multiplayer server protocol', () => {
  it('normalizes padded lowercase room codes at the protocol boundary', async () => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);
    await waitForHealth(port, child, output);
    const endpoint = `ws://127.0.0.1:${port}`;
    const host = await openWebSocket(endpoint);
    const guest = await openWebSocket(endpoint);

    try {
      const roomCode = await createRoom(host);
      const hostNotice = nextSocketMessage(host);
      const joined = await sendAndReceive(guest, {
        type: 'join',
        roomCode: `  ${roomCode.toLowerCase()}  `,
      });

      expect(joined).toEqual({ type: 'roomJoined', roomCode });
      await expect(hostNotice).resolves.toEqual({ type: 'opponentJoined' });
    } finally {
      await Promise.all([closeWebSocket(guest), closeWebSocket(host)]);
    }
  });

  it('returns exact safe errors for malformed room and message requests', async () => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);
    await waitForHealth(port, child, output);
    const socket = await openWebSocket(`ws://127.0.0.1:${port}`);

    try {
      const cases = [
        [{ type: 'join' }, 'Missing roomCode'],
        [{ type: 'join', roomCode: 'ZZZZ' }, 'Room not found'],
        [{ type: 'deckSelect', deckId: 'shell' }, 'Not in a room'],
        [{ type: 'action', action: { action: 'attack' } }, 'Not in a room'],
        [{ type: 'endTurn' }, 'Not in a room'],
        [{ type: 'notAProtocolMessage' }, 'Unknown: notAProtocolMessage'],
        ['{"type":', 'Invalid message'],
      ];

      for (const [request, message] of cases) {
        await expect(sendAndReceive(socket, request)).resolves.toEqual({
          type: 'error',
          message,
        });
      }
    } finally {
      await closeWebSocket(socket);
    }
  });

  it('rejects a third player and actions before a game is in progress', async () => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);
    await waitForHealth(port, child, output);
    const endpoint = `ws://127.0.0.1:${port}`;
    const host = await openWebSocket(endpoint);
    const guest = await openWebSocket(endpoint);
    const third = await openWebSocket(endpoint);

    try {
      const roomCode = await createRoom(host);

      const hostNotice = nextSocketMessage(host);
      await expect(
        sendAndReceive(guest, { type: 'join', roomCode }),
      ).resolves.toEqual({ type: 'roomJoined', roomCode });
      await hostNotice;

      await expect(
        sendAndReceive(third, { type: 'join', roomCode }),
      ).resolves.toEqual({ type: 'error', message: 'Room is full' });

      await expect(
        sendAndReceive(host, {
          type: 'action',
          action: { action: 'attack' },
        }),
      ).resolves.toEqual({
        type: 'error',
        message: 'Game not in progress',
      });
      await expect(
        sendAndReceive(host, { type: 'endTurn' }),
      ).resolves.toEqual({
        type: 'error',
        message: 'Game not in progress',
      });
    } finally {
      await Promise.all([
        closeWebSocket(third),
        closeWebSocket(guest),
        closeWebSocket(host),
      ]);
    }
  });

  it('emits waiting, ready, personalized start, and authoritative action errors', async () => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);
    await waitForHealth(port, child, output);
    const endpoint = `ws://127.0.0.1:${port}`;
    const host = await openWebSocket(endpoint);
    const guest = await openWebSocket(endpoint);

    try {
      const roomCode = await createRoom(host);
      const opponentJoined = nextSocketMessage(host);
      await sendAndReceive(guest, { type: 'join', roomCode });
      await opponentJoined;

      const guestReady = nextSocketMessage(guest);
      await expect(
        sendAndReceive(host, { type: 'deckSelect', deckId: 'shell' }),
      ).resolves.toEqual({ type: 'waitingForOpponent' });
      await expect(guestReady).resolves.toEqual({ type: 'opponentReady' });

      const hostStart = nextSocketMessage(host);
      const guestStart = nextSocketMessage(guest);
      guest.send(JSON.stringify({ type: 'deckSelect', deckId: 'shadow' }));
      const [hostGame, guestGame] = await Promise.all([
        hostStart,
        guestStart,
      ]);

      expect(hostGame.type).toBe('gameStart');
      expect(guestGame.type).toBe('gameStart');
      expect([hostGame.you, guestGame.you].sort()).toEqual(['p1', 'p2']);
      expect([hostGame.yourTurn, guestGame.yourTurn].sort()).toEqual([
        false,
        true,
      ]);
      expect(hostGame.yourTurn).toBe(hostGame.state.yourTurn);
      expect(guestGame.yourTurn).toBe(guestGame.state.yourTurn);

      const current = hostGame.yourTurn ? host : guest;
      const waiting = hostGame.yourTurn ? guest : host;

      await expect(
        sendAndReceive(waiting, { type: 'endTurn' }),
      ).resolves.toEqual({ type: 'error', message: 'Not your turn' });
      await expect(
        sendAndReceive(current, {
          type: 'action',
          action: { action: 'notAnAction' },
        }),
      ).resolves.toEqual({ type: 'error', message: 'Unknown action' });
    } finally {
      await Promise.all([closeWebSocket(guest), closeWebSocket(host)]);
    }
  });

  it('rejects unsolicited, malformed, and stale response actions atomically', async () => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);
    await waitForHealth(port, child, output);
    const endpoint = `ws://127.0.0.1:${port}`;
    const host = await openWebSocket(endpoint);
    const guest = await openWebSocket(endpoint);

    try {
      const started = await startRawGame(host, guest);
      const current = started.host.gameStart.yourTurn
        ? started.host
        : started.guest;
      const waiting = started.host.gameStart.yourTurn
        ? started.guest
        : started.host;

      const cases = [
        [waiting.socket, {
          type: 'action',
          action: { action: 'skitterDecline' },
        }],
        [current.socket, {
          type: 'action',
          action: { action: 'skitterSwap', benchIdx: 0 },
        }],
        [waiting.socket, {
          type: 'action',
          action: {
            action: 'respondOptionalTrigger',
            confirmed: true,
            verseId: 'brace',
            context: { damage: 999, attacker: { uid: 'forged' } },
          },
        }],
      ];

      for (const [socket, request] of cases) {
        await expect(sendAndReceive(socket, request)).resolves.toEqual({
          type: 'error',
          message: 'No pending response',
        });
      }

      await expect(
        sendAndReceive(waiting.socket, { type: 'endTurn' }),
      ).resolves.toEqual({ type: 'error', message: 'Not your turn' });
    } finally {
      await Promise.all([closeWebSocket(guest), closeWebSocket(host)]);
    }
  });

  it.each([
    {
      confirmed: false,
      expectedOptionalEvent: 'triggerDeclined',
      label: 'No and decline',
      skitterAction: { action: 'skitterDecline' },
      expectedSkitterEvent: 'skitterDecline',
    },
    {
      confirmed: true,
      expectedOptionalEvent: 'triggerVerse',
      label: 'Yes and swap',
      skitterAction: { action: 'skitterSwap', benchIdx: 0 },
      expectedSkitterEvent: 'skitterSwap',
    },
  ])(
    'delivers owner-only pending metadata and resolves $label exactly once',
    async ({
      confirmed,
      expectedOptionalEvent,
      skitterAction,
      expectedSkitterEvent,
    }) => {
      const port = await findAvailablePort();
      const { child, output } = startServer(port, {
        deterministicRandom: true,
      });
      await waitForHealth(port, child, output);
      const endpoint = `ws://127.0.0.1:${port}`;
      const hostSocket = await openWebSocket(endpoint);
      const guestSocket = await openWebSocket(endpoint);

      try {
        const started = await startRawGame(hostSocket, guestSocket);
        expect(started.host.gameStart).toMatchObject({
          you: 'p1',
          yourTurn: true,
        });
        expect(started.guest.gameStart).toMatchObject({
          you: 'p2',
          yourTurn: false,
        });

        const host = {
          inbox: createMessageInbox(hostSocket),
          socket: hostSocket,
          state: started.host.gameStart.state,
        };
        const guest = {
          inbox: createMessageInbox(guestSocket),
          socket: guestSocket,
          state: started.guest.gameStart.state,
        };

        const shellkin = host.state.me.hand.find(
          (card) => card.id === 'shellkin',
        );
        const brace = host.state.me.hand.find(
          (card) => card.id === 'brace',
        );
        const skitter = guest.state.me.hand.find(
          (card) => card.id === 'skitter',
        );
        const benchCreature = guest.state.me.hand.find(
          (card) =>
            card.cardType === 'creature' && card.uid !== skitter?.uid,
        );
        expect({
          benchCreature: benchCreature?.id,
          brace: brace?.id,
          shellkin: shellkin?.id,
          skitter: skitter?.id,
        }).toEqual({
          benchCreature: expect.any(String),
          brace: 'brace',
          shellkin: 'shellkin',
          skitter: 'skitter',
        });

        await performGameAction(host, guest, {
          action: 'summon',
          cardUid: shellkin.uid,
          target: 'active',
        });
        await performEndTurn(host, guest);
        await performGameAction(guest, host, {
          action: 'summon',
          cardUid: skitter.uid,
          target: 'active',
        });
        await performEndTurn(guest, host);
        await performGameAction(host, guest, {
          action: 'set',
          cardUid: brace.uid,
        });
        await performEndTurn(host, guest);
        await performGameAction(guest, host, {
          action: 'summon',
          cardUid: benchCreature.uid,
          target: 'bench',
        });

        const optionalOffer = await performGameAction(
          guest,
          host,
          { action: 'attack' },
        );
        expect(optionalOffer.observer.pendingAction).toMatchObject({
          type: 'optionalTrigger',
          side: 'me',
          verseId: 'brace',
          verseName: 'Brace',
          context: {
            attacker: { uid: skitter.uid },
            defender: { uid: shellkin.uid },
          },
        });
        expect(optionalOffer.actor).not.toHaveProperty('pendingAction');
        const nonOwnerOptionalFrame = JSON.stringify(optionalOffer.actor);
        expect(nonOwnerOptionalFrame).not.toContain('"pendingAction"');
        expect(nonOwnerOptionalFrame).not.toContain('"verseId":"brace"');
        expect(nonOwnerOptionalFrame).not.toContain('"verseName":"Brace"');

        guest.socket.send(JSON.stringify({
          type: 'action',
          action: {
            action: 'respondOptionalTrigger',
            confirmed,
          },
        }));
        await expect(
          guest.inbox.next((message) => message.type === 'error'),
        ).resolves.toEqual({
          type: 'error',
          message: 'Action unavailable',
        });

        host.socket.send(JSON.stringify({
          type: 'action',
          action: {
            action: 'respondOptionalTrigger',
            confirmed,
            context: { damage: 999 },
          },
        }));
        await expect(host.inbox.next()).resolves.toEqual({
          type: 'error',
          message: 'Invalid pending response',
        });

        const optionalResolution = await performGameAction(host, guest, {
          action: 'respondOptionalTrigger',
          confirmed,
        });
        expect(
          optionalResolution.actor.events.filter(
            (event) => event.type === expectedOptionalEvent,
          ),
        ).toHaveLength(1);
        expect(optionalResolution.actor.pendingAction).toBeUndefined();
        expect(optionalResolution.observer.pendingAction).toBeUndefined();
        expect(optionalResolution.actor.state.hasAttacked).toBe(true);

        host.socket.send(JSON.stringify({
          type: 'action',
          action: {
            action: 'respondOptionalTrigger',
            confirmed,
          },
        }));
        await expect(host.inbox.next()).resolves.toEqual({
          type: 'error',
          message: 'No pending response',
        });

        await performEndTurn(guest, host);
        const skitterOffer = await performGameAction(
          host,
          guest,
          { action: 'attack' },
        );
        expect(skitterOffer.observer.pendingAction).toMatchObject({
          type: 'skitterSwap',
          side: 'me',
          creature: 'Skitter',
          benchOptions: [
            {
              idx: 0,
              name: benchCreature.name,
              uid: benchCreature.uid,
            },
          ],
        });
        expect(skitterOffer.actor).not.toHaveProperty('pendingAction');
        const nonOwnerSkitterFrame = JSON.stringify(skitterOffer.actor);
        expect(nonOwnerSkitterFrame).not.toContain('"pendingAction"');
        expect(nonOwnerSkitterFrame).not.toContain('"benchOptions"');

        host.socket.send(JSON.stringify({
          type: 'action',
          action: { action: 'skitterDecline' },
        }));
        await expect(host.inbox.next()).resolves.toEqual({
          type: 'error',
          message: 'Action unavailable',
        });

        guest.socket.send(JSON.stringify({
          type: 'action',
          action: { action: 'skitterSwap', benchIdx: 99 },
        }));
        await expect(guest.inbox.next()).resolves.toEqual({
          type: 'error',
          message: 'Invalid pending response',
        });

        const skitterResolution = await performGameAction(
          guest,
          host,
          skitterAction,
        );
        expect(
          skitterResolution.actor.events.filter(
            (event) => event.type === expectedSkitterEvent,
          ),
        ).toHaveLength(1);
        expect(skitterResolution.actor.pendingAction).toBeUndefined();
        expect(skitterResolution.observer.pendingAction).toBeUndefined();

        guest.socket.send(JSON.stringify({
          type: 'action',
          action: skitterAction,
        }));
        await expect(guest.inbox.next()).resolves.toEqual({
          type: 'error',
          message: 'No pending response',
        });
      } finally {
        await Promise.all([
          closeWebSocket(guestSocket),
          closeWebSocket(hostSocket),
        ]);
      }
    },
    20_000,
  );

  // MP-07. `handleAction` and `handleEndTurn` both guard with
  //
  //   const player = room.getPlayerData(ws);
  //   if (!player) { send(ws, { type: 'error', message: 'Player not found' }); return; }
  //
  // Reaching that branch requires `ws.roomCode` to name a room whose player
  // list does not contain `ws`. Only three sites ever write `ws.roomCode`:
  // `handleCreate` and `handleJoin` both set it to a room they have just
  // inserted `ws` into, and `handleLeave` nulls it after removing `ws`. This
  // test walks every publicly reachable way to try to break that invariant —
  // leaving, re-creating, re-joining, joining a full room, joining one's own
  // room, and surviving a reindexing replacement — and proves each one lands
  // on a different, correct named error. The branch is therefore structurally
  // unreachable defence in depth, not a missing test.
  it('cannot reach the Player not found guard through any membership escape the protocol allows', async () => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);
    await waitForHealth(port, child, output);
    const endpoint = `ws://127.0.0.1:${port}`;
    const hostSocket = await openWebSocket(endpoint);
    const guestSocket = await openWebSocket(endpoint);
    const replacementSocket = await openWebSocket(endpoint);
    const outsiderSocket = await openWebSocket(endpoint);
    const observedErrors = [];

    try {
      const started = await startRawGame(hostSocket, guestSocket);
      const host = {
        inbox: createMessageInbox(hostSocket),
        socket: hostSocket,
      };
      const guest = {
        inbox: createMessageInbox(guestSocket),
        socket: guestSocket,
      };
      const replacement = {
        inbox: createMessageInbox(replacementSocket),
        socket: replacementSocket,
      };
      const outsider = {
        inbox: createMessageInbox(outsiderSocket),
        socket: outsiderSocket,
      };

      async function errorFor(peer, message) {
        peer.socket.send(JSON.stringify(message));
        const reply = await peer.inbox.next((m) => m.type === 'error');
        observedErrors.push(reply.message);
        return reply.message;
      }

      const current = started.host.gameStart.yourTurn ? host : guest;
      const waiting = started.host.gameStart.yourTurn ? guest : host;

      // Baseline: inside a playing room both seats resolve to a member, so the
      // error comes from AFTER the `getPlayerData` guard.
      await expect(
        errorFor(current, { type: 'action', action: { action: 'notAnAction' } }),
      ).resolves.toBe('Unknown action');
      await expect(
        errorFor(waiting, { type: 'action', action: { action: 'attack' } }),
      ).resolves.toBe('Not your turn');

      // Escape 1: leave explicitly, keeping the socket open. `handleLeave`
      // nulls `roomCode` together with removing the player, so the next
      // message is refused before any room lookup.
      guest.socket.send(JSON.stringify({ type: 'leave' }));
      await host.inbox.next((m) => m.type === 'opponentLeft');
      await expect(
        errorFor(guest, { type: 'action', action: { action: 'attack' } }),
      ).resolves.toBe('Not in a room');
      await expect(errorFor(guest, { type: 'endTurn' })).resolves.toBe(
        'Not in a room',
      );

      // Leaving twice is silent and still leaves nothing to escape with.
      guest.socket.send(JSON.stringify({ type: 'leave' }));
      await expect(
        errorFor(guest, { type: 'action', action: { action: 'attack' } }),
      ).resolves.toBe('Not in a room');

      // The survivor was reindexed into a waiting room, so its own next
      // action is refused on room status, never on membership.
      await expect(
        errorFor(host, { type: 'action', action: { action: 'attack' } }),
      ).resolves.toBe('Game not in progress');

      // Escape 2: a full room refuses the join without rebinding roomCode.
      await expect(
        sendAndReceive(outsiderSocket, {
          type: 'join',
          roomCode: started.roomCode,
        }),
      ).resolves.toEqual({ type: 'roomJoined', roomCode: started.roomCode });
      const overflowSocket = await openWebSocket(endpoint);
      try {
        await expect(
          sendAndReceive(overflowSocket, {
            type: 'join',
            roomCode: started.roomCode,
          }),
        ).resolves.toEqual({ type: 'error', message: 'Room is full' });
        await expect(
          sendAndReceive(overflowSocket, {
            type: 'action',
            action: { action: 'attack' },
          }),
        ).resolves.toEqual({ type: 'error', message: 'Not in a room' });
      } finally {
        await closeWebSocket(overflowSocket);
      }
      await host.inbox.next((m) => m.type === 'opponentJoined');

      // Escape 3: the reindexed room restarts with a different second seat.
      // Both seats must still resolve, which is exactly the state the
      // defensive branch exists to guard.
      const hostRestart = host.inbox.next((m) => m.type === 'gameStart');
      const outsiderRestart = outsider.inbox.next((m) => m.type === 'gameStart');
      outsider.socket.send(
        JSON.stringify({ type: 'deckSelect', deckId: 'venom' }),
      );
      await Promise.all([hostRestart, outsiderRestart]);
      for (const peer of [host, outsider]) {
        const message = await errorFor(peer, {
          type: 'action',
          action: { action: 'notAnAction' },
        });
        expect(['Not your turn', 'Unknown action']).toContain(message);
      }

      // Escape 4: creating a second room moves roomCode to a room the socket
      // IS in, so the old playing room becomes unreachable rather than
      // membership-less.
      host.socket.send(JSON.stringify({ type: 'create' }));
      const created = await host.inbox.next((m) => m.type === 'roomCreated');
      expect(created.roomCode).not.toBe(started.roomCode);
      await expect(
        errorFor(host, { type: 'action', action: { action: 'attack' } }),
      ).resolves.toBe('Game not in progress');
      await expect(errorFor(host, { type: 'endTurn' })).resolves.toBe(
        'Game not in progress',
      );

      // Escape 5: a socket that joins its own room occupies both seats and
      // still resolves as a member of the room its roomCode names.
      const ownRoom = await sendAndReceive(replacementSocket, {
        type: 'create',
      });
      expect(ownRoom.type).toBe('roomCreated');
      replacement.socket.send(
        JSON.stringify({ type: 'join', roomCode: ownRoom.roomCode }),
      );
      await replacement.inbox.next((m) => m.type === 'roomJoined');
      await expect(
        errorFor(replacement, {
          type: 'action',
          action: { action: 'attack' },
        }),
      ).resolves.toBe('Game not in progress');

      expect(observedErrors).not.toContain('Player not found');
      expect(observedErrors).toHaveLength(11);
    } finally {
      await Promise.all([
        closeWebSocket(outsiderSocket),
        closeWebSocket(replacementSocket),
        closeWebSocket(guestSocket),
        closeWebSocket(hostSocket),
      ]);
    }
  }, 20_000);

  it('notifies the survivor, reindexes it, and immediately deletes empty rooms', async () => {
    const port = await findAvailablePort();
    const { child, output } = startServer(port);
    await waitForHealth(port, child, output);
    const endpoint = `ws://127.0.0.1:${port}`;
    const host = await openWebSocket(endpoint);
    const survivor = await openWebSocket(endpoint);

    const roomCode = await createRoom(host);
    const hostNotice = nextSocketMessage(host);
    await sendAndReceive(survivor, { type: 'join', roomCode });
    await hostNotice;

    const leftNotice = nextSocketMessage(survivor);
    await closeWebSocket(host);
    await expect(leftNotice).resolves.toEqual({ type: 'opponentLeft' });

    const replacement = await openWebSocket(endpoint);
    const survivorNotice = nextSocketMessage(survivor);
    await expect(
      sendAndReceive(replacement, { type: 'join', roomCode }),
    ).resolves.toEqual({ type: 'roomJoined', roomCode });
    await expect(survivorNotice).resolves.toEqual({
      type: 'opponentJoined',
    });

    await Promise.all([
      closeWebSocket(replacement),
      closeWebSocket(survivor),
    ]);

    const lateJoiner = await openWebSocket(endpoint);
    try {
      await expect(
        sendAndReceive(lateJoiner, { type: 'join', roomCode }),
      ).resolves.toEqual({ type: 'error', message: 'Room not found' });
    } finally {
      await closeWebSocket(lateJoiner);
    }
  });
});
