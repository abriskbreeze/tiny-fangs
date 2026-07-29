// STA-09 / STA-10 / STA-11 / OVR-11 (multiplayer halves): the canonical
// two-client terminal journey.
//
// A real match is driven to LP 0 through legal play — the host summons once and
// then attacks an empty rival board, which is the shortest legal route to a
// server-declared winner — and the LETHAL blow is struck through the real
// desktop Attack control. From there the suite proves:
//   STA-09  complementary victory/defeat presented after event playback, with
//           every further action blocked on both clients.
//   OVR-11  the multiplayer result surface itself (title, single Return to
//           Menu control) and the deck-out route.
//   STA-10  Return to Menu disposes the match owner BEFORE navigation and the
//           reloaded page mounts a clean lobby.
//   STA-11  the same exit from the opponent-left route, with state, socket,
//           room and timer assertions.
import { expect, test } from '@playwright/test';
import {
  CANONICAL_DESKTOP,
  armDisposalProbe,
  clientState,
  createAndJoin,
  deterministicServerConfig,
  enterMultiplayer,
  installMpProbe,
  probeSnapshot,
  railDisabledState,
  readDisposalProbe,
  rootStateSnapshot,
  selectDecksAndStart,
  sendProbeMessage,
  startDeterministicServer,
  stopServer,
  waitForInbound,
  waitForServer,
} from './support/mp-harness.js';

test.describe.configure({ mode: 'serial' });

const server = deterministicServerConfig(43);

const ALL_RAIL_DISABLED = Object.freeze({
  '#d-btn-atk': true,
  '#d-btn-cast': true,
  '#d-btn-end': true,
  '#d-btn-retreat': true,
  '#d-btn-set': true,
  '#d-btn-summon': true,
});

const DISPATCH_CALLS = Object.freeze([
  ['summon', { cardUid: 'terminal-uid', target: 'active' }],
  ['cast', { cardUid: 'terminal-uid' }],
  ['set', { cardUid: 'terminal-uid' }],
  ['attack', {}],
  ['retreat', { benchIdx: 0 }],
  ['endTurn', {}],
]);

let serverChild;

test.beforeAll(async () => {
  serverChild = startDeterministicServer(server.port);
  await waitForServer(serverChild, server.port);
});

test.afterAll(async () => {
  if (serverChild) await stopServer(serverChild);
});

async function newPeers(browser) {
  const hostContext = await browser.newContext({ viewport: CANONICAL_DESKTOP });
  const guestContext = await browser.newContext({ viewport: CANONICAL_DESKTOP });
  await Promise.all([
    installMpProbe(hostContext, server.socketUrl),
    installMpProbe(guestContext, server.socketUrl),
  ]);
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  await Promise.all([
    enterMultiplayer(hostPage, server.gameUrl),
    enterMultiplayer(guestPage, server.gameUrl),
  ]);
  return { guestContext, guestPage, hostContext, hostPage };
}

async function waitForClientState(page, predicate, description) {
  let snapshot = null;
  await expect
    .poll(
      async () => {
        snapshot = await clientState(page);
        return predicate(snapshot);
      },
      { message: description, timeout: 25_000 },
    )
    .toBe(true);
  return snapshot;
}

async function passTurn(page, peer) {
  const peerIndex = (await probeSnapshot(peer)).inbound.length;
  await sendProbeMessage(page, { type: 'endTurn' });
  await waitForInbound(
    peer,
    peerIndex,
    (message) => message.type === 'turnChange' && message.yourTurn === true,
    'peer turn handover',
  );
}

/**
 * Legal-play route to a one-life rival: summon once, then attack an empty
 * board on alternating turns. Leaves the host on its own turn with the rival
 * at exactly 1 LP, so the caller can land the lethal blow through the real UI.
 */
async function driveToLethalThreshold(hostPage, guestPage) {
  const opening = await waitForClientState(
    hostPage,
    (snapshot) => snapshot.myTurn === true && snapshot.me.mana >= 1,
    'host opening projection',
  );
  const creature = opening.me.hand.find(
    (card) => card.cardType === 'creature' && card.cost <= opening.me.mana,
  );
  expect(
    creature,
    'deterministic opener must hold an affordable creature',
  ).toBeTruthy();

  await sendProbeMessage(hostPage, {
    action: { action: 'summon', cardUid: creature.uid, target: 'active' },
    type: 'action',
  });
  await waitForClientState(
    hostPage,
    (snapshot) => snapshot.me.active === creature.uid,
    'host active projection',
  );

  for (let round = 0; round < 6; round += 1) {
    await passTurn(hostPage, guestPage);
    await passTurn(guestPage, hostPage);
    const current = await waitForClientState(
      hostPage,
      (snapshot) => snapshot.myTurn === true,
      'host regains the turn',
    );
    // The rival never summons, so every attack is a direct one-life hit.
    expect(current.opp.active).toBeNull();
    if (current.opp.lp === 1) return current;

    await sendProbeMessage(hostPage, {
      action: { action: 'attack' },
      type: 'action',
    });
    await waitForClientState(
      hostPage,
      (snapshot) => snapshot.opp.lp === current.opp.lp - 1,
      'direct hit projection',
    );
  }

  throw new Error('legal play did not reach a one-life rival');
}

function lastModalOpen(timeline) {
  const entries = timeline.filter((entry) => entry.type === 'modalOpen');
  expect(entries.length).toBeGreaterThan(0);
  return entries[entries.length - 1];
}

function countOccurrences(haystack, needle) {
  return String(haystack ?? '').split(needle).length - 1;
}

async function expectTerminalAndBlocked(page, expectedTitle, label) {
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/, {
    timeout: 30_000,
  });
  await expect(page.locator('#modal-title')).toHaveText(expectedTitle);
  await expect(page.locator('#modal-opts .option')).toHaveCount(1);
  await expect(page.locator('#modal-opts .option .name')).toHaveText(
    'Return to Menu',
  );

  // The multiplayer terminal state lives entirely in the generic modal; the
  // solo `#result` overlay is never mounted for a multiplayer match.
  await expect(page.locator('#result')).not.toHaveClass(/\bopen\b/);

  expect(await railDisabledState(page), `${label} rail`).toEqual(
    ALL_RAIL_DISABLED,
  );

  const before = (await probeSnapshot(page)).outbound.length;
  for (const [type, params] of DISPATCH_CALLS) {
    await page.evaluate(
      ({ type: t, params: p }) => window.dispatchAction(t, p),
      { params, type },
    );
  }
  for (const key of ['s', 'c', 't', 'a', 'r', 'e']) {
    await page.keyboard.press(key);
  }
  await expect
    .poll(
      async () =>
        (await probeSnapshot(page)).outbound
          .slice(before)
          .map((entry) => entry.message),
      { message: `${label} emits no frame after the result` },
    )
    .toEqual([]);
}

test('a real lethal attack ends both clients after playback and freezes the unmapped-winner defect that shows DEFEAT to the winner', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { guestContext, guestPage, hostContext, hostPage } =
    await newPeers(browser);

  try {
    await createAndJoin(hostPage, guestPage);
    const started = await selectDecksAndStart(hostPage, guestPage, {
      guestDeck: /Swarm/,
      hostDeck: /Shell/,
    });
    expect(started.host.gameStart).toMatchObject({ you: 'p1', yourTurn: true });

    await driveToLethalThreshold(hostPage, guestPage);
    // `turnChange` flips `state.G.myTurn` synchronously, but the rail only
    // re-enables once the queued authoritative `stateUpdate` renders.
    await expect(hostPage.locator('#d-btn-atk')).toBeEnabled({
      timeout: 25_000,
    });

    const hostInboundIndex = (await probeSnapshot(hostPage)).inbound.length;
    const guestInboundIndex = (await probeSnapshot(guestPage)).inbound.length;

    // ── The lethal blow travels through the REAL desktop Attack control.
    await hostPage.locator('#d-btn-atk').click();

    const isTerminalUpdate = (message) =>
      message.type === 'stateUpdate' &&
      message.events?.some((event) => event.type === 'gameOver');
    const [hostTerminal, guestTerminal] = await Promise.all([
      waitForInbound(
        hostPage,
        hostInboundIndex,
        isTerminalUpdate,
        'winner terminal frame',
      ),
      waitForInbound(
        guestPage,
        guestInboundIndex,
        isTerminalUpdate,
        'loser terminal frame',
      ),
    ]);

    // The server DOES personalize the terminal outcome — `mapEventsForPlayer`
    // rewrites the gameOver event's `winner` into each client's perspective.
    expect(
      hostTerminal.events.find((event) => event.type === 'gameOver'),
    ).toEqual({ reason: 'LP depleted', type: 'gameOver', winner: 'me' });
    expect(
      guestTerminal.events.find((event) => event.type === 'gameOver'),
    ).toEqual({ reason: 'LP depleted', type: 'gameOver', winner: 'opp' });

    // KNOWN GAP, frozen as observed. `getStateForPlayer` copies the engine's
    // `state.winner` through verbatim, so the projected field is the ABSOLUTE
    // player index and is byte-identical in both personalized states, while
    // `src/mp-client.js::showGameOver` decides the outcome with
    // `state.G.winner === 'me'`. A number is never the string 'me', so both
    // clients — including the actual winner — are shown 💀 DEFEAT. The
    // correctly mapped answer arrives in the gameOver event above and is
    // discarded, because `event-playback.js::gameOver` is a no-op (EVT-06).
    expect(typeof hostTerminal.state.winner).toBe('number');
    expect(hostTerminal.state.winner).toBe(0);
    expect(guestTerminal.state.winner).toBe(hostTerminal.state.winner);

    await expectTerminalAndBlocked(hostPage, '💀 DEFEAT', 'winner');
    await expectTerminalAndBlocked(guestPage, '💀 DEFEAT', 'loser');

    await waitForClientState(
      hostPage,
      (snapshot) => snapshot.winner === 0 && snapshot.opp.lp === 0,
      'winner projection',
    );
    await waitForClientState(
      guestPage,
      (snapshot) => snapshot.winner === 0 && snapshot.me.lp === 0,
      'loser projection',
    );

    // ── The result was presented AFTER playback, not during it.
    // Three direct hits were played this match; the rendered battle log
    // captured at the instant the result modal opened must already contain all
    // three, which can only be true if `renderLog()` — and therefore the
    // awaited `playServerEvents` before it — had completed.
    for (const [label, page, ownLp, rivalLp] of [
      ['winner', hostPage, null, '♡♡♡'],
      ['loser', guestPage, '♡♡♡', null],
    ]) {
      const modalOpen = lastModalOpen((await probeSnapshot(page)).timeline);
      expect(
        countOccurrences(modalOpen.battleLog, 'Direct hit! Lost a life!'),
        `${label} presented its result before playback finished`,
      ).toBe(3);
      if (ownLp !== null) expect(modalOpen.myLp).toBe(ownLp);
      if (rivalLp !== null) expect(modalOpen.oppLp).toBe(rivalLp);
      expect(modalOpen.railDisabled['d-btn-end']).toBe(true);
    }

    // ── Hidden information survives the terminal transition: cards still in
    // the winner's hand when the match ended stay absent from every
    // loser-visible surface. Names shared with a card the winner already made
    // public (board, bench, grave, Set slot) are excluded — those are
    // legitimately visible — so only genuinely hidden identities are asserted.
    const hostHidden = await hostPage.evaluate(async () => {
      const { state } = await import('/src/state.js');
      const me = state.G.me;
      const publicNames = new Set(
        [me.active, ...me.bench, ...me.grave, me.setVerse]
          .filter((card) => card && typeof card.name === 'string')
          .map((card) => card.name),
      );
      return {
        names: me.hand
          .map((card) => card.name)
          .filter((name) => !publicNames.has(name)),
        uids: me.hand.map((card) => card.uid),
      };
    });
    expect(hostHidden.uids.length).toBeGreaterThan(0);

    const loserSurfaces = JSON.stringify({
      accessibleSnapshot: await guestPage.locator('body').ariaSnapshot(),
      dom: await guestPage.locator('html').evaluate((el) => el.outerHTML),
      probe: await probeSnapshot(guestPage),
      text: await guestPage.locator('body').innerText(),
    }).toLocaleLowerCase();
    // Match on word boundaries, not raw substrings: short card names like
    // "Brace", "Gloom", and "Alpha" collide with ordinary English inside
    // stylesheet comments and class names ("belt-and-braces"), which makes a
    // plain `toContain` a false-positive generator. Uids are opaque enough to
    // match literally. The privacy assertion itself is unchanged in strength —
    // a real leak renders the name as a word and still trips this.
    for (const uid of hostHidden.uids) {
      expect(
        loserSurfaces,
        `loser surfaces exposed the winner's hidden card uid ${JSON.stringify(uid)}`,
      ).not.toContain(uid.toLocaleLowerCase());
    }
    for (const name of hostHidden.names) {
      const wordMatch = new RegExp(
        `\\b${name.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      );
      expect(
        wordMatch.test(loserSurfaces),
        `loser surfaces exposed the winner's hidden card ${JSON.stringify(name)}`,
      ).toBe(false);
    }

    // ── Characterization of the real multiplayer result overlay: unlike the
    // solo `#result` overlay it IS dismissible (Escape and the Close control).
    // Dismissing it does not restore any action: every control stays disabled
    // and the router still refuses every dispatch.
    await hostPage.keyboard.press('Escape');
    await expect(hostPage.locator('#modal')).not.toHaveClass(/\bopen\b/);
    expect(await railDisabledState(hostPage)).toEqual(ALL_RAIL_DISABLED);
    const afterDismiss = (await probeSnapshot(hostPage)).outbound.length;
    await hostPage.evaluate(() => window.dispatchAction('attack', {}));
    await expect
      .poll(async () => (await probeSnapshot(hostPage)).outbound.length)
      .toBe(afterDismiss);
  } finally {
    await Promise.allSettled([guestContext.close(), hostContext.close()]);
  }
});

test('Return to Menu on a real result disposes the match owner before reload and mounts a clean lobby', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { guestContext, guestPage, hostContext, hostPage } =
    await newPeers(browser);

  try {
    await createAndJoin(hostPage, guestPage);
    await selectDecksAndStart(hostPage, guestPage, {
      guestDeck: /Swarm/,
      hostDeck: /Shell/,
    });
    await driveToLethalThreshold(hostPage, guestPage);
    await hostPage.locator('#d-btn-atk').click();
    // Both titles read DEFEAT today — see the unmapped-winner defect frozen in
    // the first test. The exit journey below is independent of that gap.
    await expect(hostPage.locator('#modal-title')).toHaveText('💀 DEFEAT', {
      timeout: 30_000,
    });
    await expect(guestPage.locator('#modal-title')).toHaveText('💀 DEFEAT', {
      timeout: 30_000,
    });

    // A live timer owns the match before the exit.
    const beforeExit = await rootStateSnapshot(hostPage);
    expect(beforeExit.game).not.toBeNull();
    expect(beforeExit.startTime).not.toBeNull();

    await armDisposalProbe(hostPage);
    const guestInboundIndex = (await probeSnapshot(guestPage)).inbound.length;

    await hostPage
      .locator('#modal-opts .option')
      .filter({ hasText: 'Return to Menu' })
      .click();

    // ── The reloaded page mounts a clean setup route.
    await expect(hostPage.locator('#mode-select')).toBeVisible({
      timeout: 30_000,
    });
    await expect(hostPage.locator('#setup')).toBeVisible();
    // `#desktop` is intentionally NOT asserted hidden: the stylesheet keeps the
    // desktop shell laid out behind the setup overlay on a fresh mount, and
    // `startMultiplayerGame` is what makes the shell choice explicit.
    await expect(hostPage.locator('#modal')).not.toHaveClass(/\bopen\b/);
    await expect(hostPage.locator('#mp-lobby')).toBeHidden();
    await expect(hostPage.locator('#room-info')).toBeHidden();
    await expect(hostPage.locator('#room-code-display')).toHaveText('');
    await expect(hostPage.locator('#room-code-input')).toHaveValue('');
    await expect(hostPage.locator('#mp-status')).toHaveText('');

    // ── The owner was disposed BEFORE navigation, not merely lost to it.
    expect(await readDisposalProbe(hostPage)).toEqual({
      gameCleared: true,
      longPressTimerCleared: true,
      selectedCardCleared: true,
      startTimeCleared: true,
      timerIntervalCleared: true,
    });
    expect(await rootStateSnapshot(hostPage)).toEqual({
      game: null,
      longPressTimer: null,
      selectedCard: null,
      startTime: null,
      timerInt: null,
    });

    // ── The room association really ended: the server observed the departure
    // and told the surviving client, and the reloaded page holds no socket.
    await waitForInbound(
      guestPage,
      guestInboundIndex,
      (message) => message.type === 'opponentLeft',
      'surviving client is told the winner left the room',
    );
    expect(await probeSnapshot(hostPage)).toMatchObject({
      openSockets: 0,
      totalSockets: 0,
    });

    // ── A clean subsequent match start is available from the fresh mount.
    const reconnected = hostPage.waitForEvent(
      'console',
      (message) => message.text().includes('Connected to server'),
    );
    await hostPage.getByRole('button', { name: /Multiplayer/ }).click();
    await reconnected;
    await expect
      .poll(async () => {
        const snapshot = await probeSnapshot(hostPage);
        return {
          open: snapshot.openSockets,
          total: snapshot.totalSockets,
        };
      })
      .toEqual({ open: 1, total: 1 });
    await hostPage.getByRole('button', { name: /Create Room/ }).click();
    await expect(hostPage.locator('#room-code-display')).toHaveText(
      /^[A-HJ-NP-Z2-9]{4}$/,
    );
    expect((await rootStateSnapshot(hostPage)).game).toBeNull();
  } finally {
    await Promise.allSettled([guestContext.close(), hostContext.close()]);
  }
});

test('Return to Menu on the opponent-left modal leaves the match cleanly', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { guestContext, guestPage, hostContext, hostPage } =
    await newPeers(browser);

  try {
    await createAndJoin(hostPage, guestPage);
    await selectDecksAndStart(hostPage, guestPage, {
      guestDeck: /Swarm/,
      hostDeck: /Shell/,
    });
    await waitForClientState(
      hostPage,
      (snapshot) => snapshot.turn >= 1,
      'host board projection',
    );
    expect((await rootStateSnapshot(hostPage)).startTime).not.toBeNull();

    await guestPage.evaluate(() => {
      window.__TINY_FANGS_MP_PROBE__.closeOpen();
    });
    await expect(hostPage.locator('#modal')).toHaveClass(/\bopen\b/);
    await expect(hostPage.locator('#modal-title')).toHaveText('Opponent Left');
    await expect(hostPage.locator('#modal-opts .option .name')).toHaveText(
      'Return to Menu',
    );

    // The match timer stops the moment the room dies, before any exit click.
    expect((await rootStateSnapshot(hostPage)).timerInt).toBeNull();

    await armDisposalProbe(hostPage);
    await hostPage
      .locator('#modal-opts .option')
      .filter({ hasText: 'Return to Menu' })
      .click();

    await expect(hostPage.locator('#mode-select')).toBeVisible({
      timeout: 30_000,
    });
    expect(await readDisposalProbe(hostPage)).toEqual({
      gameCleared: true,
      longPressTimerCleared: true,
      selectedCardCleared: true,
      startTimeCleared: true,
      timerIntervalCleared: true,
    });
    expect(await rootStateSnapshot(hostPage)).toEqual({
      game: null,
      longPressTimer: null,
      selectedCard: null,
      startTime: null,
      timerInt: null,
    });
    await expect(hostPage.locator('#mp-lobby')).toBeHidden();
    await expect(hostPage.locator('#room-code-display')).toHaveText('');
    await expect(hostPage.locator('#mp-status')).toHaveText('');
    expect(await probeSnapshot(hostPage)).toMatchObject({
      openSockets: 0,
      totalSockets: 0,
    });

    const reconnected = hostPage.waitForEvent(
      'console',
      (message) => message.text().includes('Connected to server'),
    );
    await hostPage.getByRole('button', { name: /Multiplayer/ }).click();
    await reconnected;
    await expect
      .poll(async () => (await probeSnapshot(hostPage)).openSockets)
      .toBe(1);
  } finally {
    await Promise.allSettled([guestContext.close(), hostContext.close()]);
  }
});

test('a real multiplayer deck-out reaches both clients with an undifferentiated result', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const { guestContext, guestPage, hostContext, hostPage } =
    await newPeers(browser);

  try {
    await createAndJoin(hostPage, guestPage);
    await selectDecksAndStart(hostPage, guestPage, {
      guestDeck: /Swarm/,
      hostDeck: /Shell/,
    });

    // Neither client ever summons, so the only terminal route left is the
    // draw step: whichever deck empties first decks its owner out.
    let terminal = null;
    for (let turn = 0; turn < 80 && terminal === null; turn += 1) {
      const snapshot = await clientState(hostPage);
      if (snapshot.winner !== null) {
        terminal = snapshot;
        break;
      }
      const actor = snapshot.myTurn ? hostPage : guestPage;
      await sendProbeMessage(actor, { type: 'endTurn' });
      await expect
        .poll(
          async () => {
            const next = await clientState(hostPage);
            return next.winner !== null || next.myTurn !== snapshot.myTurn;
          },
          { message: 'turn handover or terminal state', timeout: 25_000 },
        )
        .toBe(true);
    }
    const hostFinal = terminal ?? (await clientState(hostPage));
    expect(
      typeof hostFinal.winner,
      'a deck-out must arrive inside the turn budget',
    ).toBe('number');

    const guestFinal = await clientState(guestPage);
    // The same unmapped absolute index reaches both clients (see the first
    // test): the projection cannot tell either player that they won.
    expect(guestFinal.winner).toBe(hostFinal.winner);
    // Nobody lost life: this terminal state came from the deck, not damage.
    expect(hostFinal.me.lp).toBe(3);
    expect(hostFinal.opp.lp).toBe(3);

    for (const page of [hostPage, guestPage]) {
      await expect(page.locator('#modal-title')).toHaveText('💀 DEFEAT', {
        timeout: 30_000,
      });
      await expect(page.locator('#modal-opts .option .name')).toHaveText(
        'Return to Menu',
      );
      expect(await railDisabledState(page)).toEqual(ALL_RAIL_DISABLED);
    }

    // Characterization of the real gap: `src/mp-client.js::showGameOver` takes
    // only a boolean, so the multiplayer result cannot say WHY the match ended.
    // Solo distinguishes the same state as `[ VICTORY — DECK OUT ]` through
    // `#result[data-reason="deck-out"]`; multiplayer presents neither.
    for (const page of [hostPage, guestPage]) {
      await expect(page.locator('#result')).not.toHaveClass(/\bopen\b/);
      await expect(page.locator('#result')).not.toHaveAttribute(
        'data-reason',
        'deck-out',
      );
      const modalText = await page.locator('#modal').innerText();
      expect(modalText.toLocaleLowerCase()).not.toContain('deck');
    }
  } finally {
    await Promise.allSettled([guestContext.close(), hostContext.close()]);
  }
});
