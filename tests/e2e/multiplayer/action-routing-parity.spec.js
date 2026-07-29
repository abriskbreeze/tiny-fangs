// ACT-14 (multiplayer half): the six action controls route through the one
// unified dispatcher, and the multiplayer sink emits exactly one frame per
// control containing only the action name plus selected uids / action data.
//
// The solo half of ACT-14 is already direct in
// `tests/e2e/classic-input-regression.spec.js` (INP-11: visible-control parity
// for Summon/Cast/Set/Retreat, the semantic attack payload, legal End Turn and
// the editable/animating/wrong-turn/open-overlay guards through the same
// router). This suite closes the multiplayer side of the same router: every
// control is driven through the REAL desktop rail button or the REAL keyboard
// key against two live browser contexts and a real server.
import { expect, test } from '@playwright/test';
import {
  CANONICAL_DESKTOP,
  createAndJoin,
  clientState,
  deterministicServerConfig,
  enterMultiplayer,
  identitySentinels,
  probeSnapshot,
  installMpProbe,
  railDisabledState,
  selectDecksAndStart,
  sendProbeMessage,
  startDeterministicServer,
  stopServer,
  waitForInbound,
  waitForServer,
} from './support/mp-harness.js';

test.describe.configure({ mode: 'serial' });

// Owned deterministic server on a private port so the shared Playwright
// WebSocket server keeps its real shuffle for the suites that need it.
const server = deterministicServerConfig(41);

// The complete vocabulary `src/main.js::dispatchAction` may put on the wire for
// the six controls, plus the two owner-response fields the same sink reuses.
const ALLOWED_ACTION_FIELDS = Object.freeze([
  'action',
  'benchIdx',
  'cardUid',
  'confirmed',
  'graveUid',
  'sacrificeUid',
  'target',
  'targetUid',
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

/**
 * Drives one gesture and proves it produced EXACTLY the frames given — no
 * duplicate dispatch, no extra chatter, and no field beyond the expectation.
 */
async function expectFrames(page, gesture, expectedFrames, description) {
  const before = (await probeSnapshot(page)).outbound.length;
  await gesture();
  await expect
    .poll(
      async () =>
        (await probeSnapshot(page)).outbound
          .slice(before)
          .map((entry) => entry.message),
      { message: description, timeout: 10_000 },
    )
    .toEqual(expectedFrames);
}

/**
 * `doSummon`/`doCast`/`doSet` list the matching hand cards in hand order and
 * only mark unaffordable ones disabled, so the modal option index is the
 * card's index inside that filtered list. Decks run duplicate names, so name
 * lookup is ambiguous; the index resolves the exact uid the frame assertions
 * depend on.
 */
async function modalOptionIndex(page, kind, uid) {
  return page.evaluate(async ({ kind: k, uid: wanted }) => {
    const { state } = await import('/src/state.js');
    const filters = {
      cast: (card) => card.cardType === 'verse' && card.type === 'cast',
      set: (card) => card.cardType === 'verse' && card.type === 'set',
      summon: (card) => card.cardType === 'creature',
    };
    return state.G.me.hand
      .filter(filters[k])
      .findIndex((card) => card.uid === wanted);
  }, { kind, uid });
}

async function chooseModalOption(page, index) {
  const option = page.locator('#modal-opts .option').nth(index);
  await expect(option).not.toHaveClass(/\boff\b/);
  await option.click();
}

async function holdEndTurn(page) {
  await page.locator('#d-btn-end').dispatchEvent('pointerdown');
  await page.waitForTimeout(550);
  await page.locator('#d-btn-end').dispatchEvent('pointerup');
}

/** Waits until this client's rendered projection satisfies `predicate`. */
async function waitForClientState(page, predicate, description) {
  let snapshot = null;
  await expect
    .poll(
      async () => {
        snapshot = await clientState(page);
        return predicate(snapshot);
      },
      { message: description, timeout: 20_000 },
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

test('each of the six action controls emits one multiplayer frame carrying only action data and selected uids', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { guestContext, guestPage, hostContext, hostPage } =
    await newPeers(browser);

  try {
    await createAndJoin(hostPage, guestPage);
    const started = await selectDecksAndStart(hostPage, guestPage, {
      guestDeck: /Swarm/,
      hostDeck: /Shell/,
    });

    // The deterministic server always gives the host p1 and the first turn.
    expect(started.host.gameStart).toMatchObject({ you: 'p1', yourTurn: true });
    expect(started.guest.gameStart).toMatchObject({
      you: 'p2',
      yourTurn: false,
    });

    // ── Turn 1 (host, 1 mana): SUMMON via the `S` key, END TURN via the hold
    const turn1 = await waitForClientState(
      hostPage,
      (snapshot) => snapshot.myTurn === true && snapshot.me.mana >= 1,
      'host turn one projection',
    );
    const firstCreature = turn1.me.hand.find(
      (card) => card.cardType === 'creature' && card.cost <= turn1.me.mana,
    );
    expect(
      firstCreature,
      'deterministic Shell opener must hold an affordable creature',
    ).toBeTruthy();

    await expectFrames(
      hostPage,
      async () => {
        await hostPage.keyboard.press('s');
        await expect(hostPage.locator('#modal-title')).toHaveText(
          'Summon Creature',
        );
        await chooseModalOption(
          hostPage,
          await modalOptionIndex(hostPage, 'summon', firstCreature.uid),
        );
      },
      [{
        action: { action: 'summon', cardUid: firstCreature.uid, target: 'active' },
        type: 'action',
      }],
      'S key summons to the empty active slot',
    );
    await waitForClientState(
      hostPage,
      (snapshot) => snapshot.me.active === firstCreature.uid,
      'host active projection after summon',
    );

    const holdIndex = (await probeSnapshot(hostPage)).outbound.length;
    await expectFrames(
      hostPage,
      () => holdEndTurn(hostPage),
      [{ type: 'endTurn' }],
      '500 ms End Turn hold emits one endTurn frame',
    );
    const heldEndTurnFrame = (await probeSnapshot(hostPage)).outbound[holdIndex]
      .payload;

    await waitForClientState(
      guestPage,
      (snapshot) => snapshot.myTurn === true,
      'guest receives turn two',
    );
    await passTurn(guestPage, hostPage);

    // ── Turn 3 (host, 2 mana): SUMMON to bench, ATTACK via `A`, END via `E`
    const turn3 = await waitForClientState(
      hostPage,
      (snapshot) => snapshot.myTurn === true && snapshot.me.mana >= 2,
      'host turn three projection',
    );
    const benchCreature = turn3.me.hand.find(
      (card) => card.cardType === 'creature' && card.cost <= turn3.me.mana,
    );
    expect(
      benchCreature,
      'deterministic Shell turn three must hold a second affordable creature',
    ).toBeTruthy();

    await expectFrames(
      hostPage,
      async () => {
        await hostPage.locator('#d-btn-summon').click();
        await expect(hostPage.locator('#modal-title')).toHaveText(
          'Summon Creature',
        );
        await chooseModalOption(
          hostPage,
          await modalOptionIndex(hostPage, 'summon', benchCreature.uid),
        );
      },
      [{
        action: { action: 'summon', cardUid: benchCreature.uid, target: 'bench' },
        type: 'action',
      }],
      'Summon rail button routes an occupied active slot to the bench',
    );
    await waitForClientState(
      hostPage,
      (snapshot) => snapshot.me.bench.includes(benchCreature.uid),
      'host bench projection after summon',
    );

    await expectFrames(
      hostPage,
      () => hostPage.keyboard.press('a'),
      [{ action: { action: 'attack' }, type: 'action' }],
      'A key emits a bare attack payload',
    );
    await waitForClientState(
      hostPage,
      (snapshot) => snapshot.opp.lp === 2,
      'direct attack projection',
    );

    const keyEndTurnIndex = (await probeSnapshot(hostPage)).outbound.length;
    await expectFrames(
      hostPage,
      () => hostPage.keyboard.press('e'),
      [{ type: 'endTurn' }],
      'E key emits one endTurn frame',
    );
    const keyedEndTurnFrame = (await probeSnapshot(hostPage)).outbound[
      keyEndTurnIndex
    ].payload;

    // Two different input surfaces, one router, one byte-identical payload.
    expect(keyedEndTurnFrame).toBe(heldEndTurnFrame);

    await waitForClientState(
      guestPage,
      (snapshot) => snapshot.myTurn === true,
      'guest receives turn four',
    );
    await passTurn(guestPage, hostPage);

    // ── Turn 5 (host, 3 mana): SET via `T`, CAST via the rail, RETREAT
    const turn5 = await waitForClientState(
      hostPage,
      (snapshot) => snapshot.myTurn === true && snapshot.me.mana >= 3,
      'host turn five projection',
    );
    const setVerse = turn5.me.hand.find(
      (card) =>
        card.cardType === 'verse' &&
        card.type === 'set' &&
        card.cost <= turn5.me.mana,
    );
    expect(
      setVerse,
      'deterministic Shell turn five must hold an affordable Set verse',
    ).toBeTruthy();

    await expectFrames(
      hostPage,
      async () => {
        await hostPage.keyboard.press('t');
        await expect(hostPage.locator('#modal-title')).toHaveText('Set Verse');
        await chooseModalOption(
          hostPage,
          await modalOptionIndex(hostPage, 'set', setVerse.uid),
        );
      },
      [{ action: { action: 'set', cardUid: setVerse.uid }, type: 'action' }],
      'T key emits an identity-free Set payload',
    );
    const afterSet = await waitForClientState(
      hostPage,
      (snapshot) => snapshot.me.setVerse === setVerse.uid,
      'host Set projection',
    );

    const castVerse = afterSet.me.hand.find(
      (card) =>
        card.cardType === 'verse' &&
        card.type === 'cast' &&
        card.cost <= afterSet.me.mana,
    );
    expect(
      castVerse,
      'deterministic Shell turn five must hold an affordable Cast verse',
    ).toBeTruthy();

    await expectFrames(
      hostPage,
      async () => {
        await hostPage.locator('#d-btn-cast').click();
        await expect(hostPage.locator('#modal-title')).toHaveText('Cast Verse');
        await chooseModalOption(
          hostPage,
          await modalOptionIndex(hostPage, 'cast', castVerse.uid),
        );
      },
      [{ action: { action: 'cast', cardUid: castVerse.uid }, type: 'action' }],
      'Cast rail button emits a no-target cast payload',
    );
    await waitForClientState(
      hostPage,
      (snapshot) =>
        !snapshot.me.hand.some((card) => card.uid === castVerse.uid),
      'host hand projection after cast',
    );

    await expectFrames(
      hostPage,
      async () => {
        await hostPage.locator('#d-btn-retreat').click();
        await expect(hostPage.locator('#modal-title')).toHaveText(
          'Choose replacement',
        );
        await chooseModalOption(hostPage, 0);
      },
      [{ action: { action: 'retreat', benchIdx: 0 }, type: 'action' }],
      'Retreat rail button emits the chosen bench index only',
    );
    await waitForClientState(
      hostPage,
      (snapshot) => snapshot.me.active === benchCreature.uid,
      'host retreat projection',
    );

    await expectFrames(
      hostPage,
      () => holdEndTurn(hostPage),
      [{ type: 'endTurn' }],
      'End Turn hold closes turn five',
    );

    // ── Turn 6 (guest): the selection-carrying cast payload.
    const turn6 = await waitForClientState(
      guestPage,
      (snapshot) => snapshot.myTurn === true && snapshot.me.mana >= 3,
      'guest turn six projection',
    );
    const sacrificeVerse = turn6.me.hand.find((card) => card.id === 'sacrifice');
    expect(
      sacrificeVerse,
      'deterministic Swarm hand must hold the selection-bearing Sacrifice cast',
    ).toBeTruthy();
    const guestCreature = turn6.me.hand.find(
      (card) => card.cardType === 'creature' && card.cost <= turn6.me.mana,
    );
    expect(guestCreature).toBeTruthy();

    await sendProbeMessage(guestPage, {
      action: {
        action: 'summon',
        cardUid: guestCreature.uid,
        target: 'active',
      },
      type: 'action',
    });
    await waitForClientState(
      guestPage,
      (snapshot) => snapshot.me.active === guestCreature.uid,
      'guest active projection before the sacrifice cast',
    );

    await expectFrames(
      guestPage,
      async () => {
        await guestPage.locator('#d-btn-cast').click();
        await expect(guestPage.locator('#modal-title')).toHaveText('Cast Verse');
        await chooseModalOption(
          guestPage,
          await modalOptionIndex(guestPage, 'cast', sacrificeVerse.uid),
        );
        await expect(guestPage.locator('#modal-title')).toHaveText(
          'Choose creature to sacrifice',
        );
        await guestPage
          .locator('#modal-opts .option')
          .filter({ hasText: guestCreature.name })
          .first()
          .click();
      },
      [{
        action: {
          action: 'cast',
          cardUid: sacrificeVerse.uid,
          sacrificeUid: guestCreature.uid,
        },
        type: 'action',
      }],
      'a selection-bearing cast carries exactly the selected uid',
    );

    // ── Every gameplay frame carries action data and owned uids, never
    // identity. Checking frame *values* rather than raw payload text keeps the
    // assertion exact: the payload KEY `sacrificeUid` legitimately contains the
    // substring of the `sacrifice` card id, but no frame VALUE may ever be a
    // card id, name, or any other identifying string.
    for (const [label, page, ownCards] of [
      ['host', hostPage, [...turn1.me.hand, ...turn3.me.hand, ...turn5.me.hand]],
      ['guest', guestPage, turn6.me.hand],
    ]) {
      const frames = (await probeSnapshot(page)).outbound
        .filter((entry) => entry.url === server.socketUrl)
        .map((entry) => entry.message)
        .filter((message) => message?.type === 'action');
      expect(frames.length).toBeGreaterThan(0);

      const ownUids = new Set(ownCards.map((card) => card.uid));
      const identity = new Set(
        ownCards
          .flatMap((card) => identitySentinels(card))
          .filter((value) => !ownUids.has(value))
          .map((value) => value.toLocaleLowerCase()),
      );

      for (const frame of frames) {
        expect(
          Object.keys(frame).sort(),
          `${label} frame had unexpected envelope: ${JSON.stringify(frame)}`,
        ).toEqual(['action', 'type']);
        for (const key of Object.keys(frame.action)) {
          expect(
            ALLOWED_ACTION_FIELDS,
            `${label} frame carried unexpected field ${key}`,
          ).toContain(key);
        }
        for (const [key, value] of Object.entries(frame.action)) {
          if (typeof value !== 'string') continue;
          expect(
            identity,
            `${label} frame field ${key} leaked card identity ${JSON.stringify(value)}`,
          ).not.toContain(value.toLocaleLowerCase());
          if (key.endsWith('Uid')) {
            expect(
              ownUids,
              `${label} frame field ${key} referenced a uid the sender does not own`,
            ).toContain(value);
          }
        }
      }
    }
  } finally {
    await Promise.allSettled([guestContext.close(), hostContext.close()]);
  }
});

test('multiplayer dispatch refuses every action type off-turn without emitting a frame', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { guestContext, guestPage, hostContext, hostPage } =
    await newPeers(browser);

  try {
    await createAndJoin(hostPage, guestPage);
    const started = await selectDecksAndStart(hostPage, guestPage, {
      guestDeck: /Swarm/,
      hostDeck: /Shell/,
    });
    const current = started.host.gameStart.yourTurn ? hostPage : guestPage;
    const waiting = started.host.gameStart.yourTurn ? guestPage : hostPage;

    await waitForClientState(
      waiting,
      (snapshot) => snapshot.myTurn === false && snapshot.animating === false,
      'waiting client projection',
    );
    expect(await railDisabledState(waiting)).toEqual({
      '#d-btn-atk': true,
      '#d-btn-cast': true,
      '#d-btn-end': true,
      '#d-btn-retreat': true,
      '#d-btn-set': true,
      '#d-btn-summon': true,
    });

    const dispatchCalls = [
      ['summon', { cardUid: 'forged-uid', target: 'active' }],
      ['cast', { cardUid: 'forged-uid' }],
      ['set', { cardUid: 'forged-uid' }],
      ['attack', {}],
      ['retreat', { benchIdx: 0 }],
      ['endTurn', {}],
    ];

    const before = (await probeSnapshot(waiting)).outbound.length;
    for (const [type, params] of dispatchCalls) {
      await waiting.evaluate(
        ({ type: t, params: p }) => window.dispatchAction(t, p),
        { params, type },
      );
    }

    // The unified router short-circuits every type before the socket sink.
    await expect
      .poll(async () =>
        (await probeSnapshot(waiting)).outbound
          .slice(before)
          .map((entry) => entry.message),
      )
      .toEqual([]);
    const rejectionLog = await waiting.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G.log.filter((entry) => entry.t === 'Not your turn!');
    });
    expect(rejectionLog).toHaveLength(dispatchCalls.length);

    // Contrast: the identical router call on the turn owner does reach the
    // socket, so the refusal above is the turn guard and not a dead control.
    await expectFrames(
      current,
      () => current.evaluate(() => window.dispatchAction('attack', {})),
      [{ action: { action: 'attack' }, type: 'action' }],
      'the turn owner routes the same call to the server',
    );
    await waitForInbound(
      current,
      0,
      (message) =>
        message.type === 'error' && message.message === 'No active creature',
      'server-authoritative rejection of the turn owner attack',
    );
  } finally {
    await Promise.allSettled([guestContext.close(), hostContext.close()]);
  }
});
