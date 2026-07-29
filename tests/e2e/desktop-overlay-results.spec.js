import { expect, test } from '@playwright/test';

const VIEWPORT = { width: 1672, height: 941 };
const FIXTURE_URL = (fixture) =>
  `/?presentation=classic&visualQa=1&behaviorQa=1&fixture=${fixture}`;

async function openFixture(page, fixture) {
  await page.goto(FIXTURE_URL(fixture));
  await expect(page.locator('#desktop')).toBeVisible();
  await expect(page.locator('#setup')).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const qa = window.__TINY_FANGS_VISUAL_QA__;
        return Boolean(qa && (await qa.ready) && qa.currentFixture?.name);
      }),
    )
    .toBe(true);
}

async function desktopBehaviorQa(page) {
  return page.evaluate(() =>
    Boolean(window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__),
  );
}

async function stateSnapshot(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const summarize = (player) => ({
      active: player.active?.uid ?? null,
      bench: player.bench.map((card) => card.uid),
      grave: player.grave.map((card) => card.uid),
      hand: player.hand.map((card) => card.uid),
      setVerse: player.setVerse?.uid ?? player.setVerse ?? null,
    });
    return {
      me: summarize(state.G.me),
      opp: summarize(state.G.opp),
      turn: state.G.turn,
      winner: state.G.winner,
    };
  });
}

test.describe('canonical desktop overlays, semantic decisions, and results', () => {
  test.use({ viewport: VIEWPORT });

  test('generic modal owns enabled, disabled, no-cancel, and exactly-once close semantics', async ({
    page,
  }) => {
    await openFixture(page, 'opening-hand-triad');
    expect(await desktopBehaviorQa(page)).toBe(true);

    await page.evaluate(() => {
      window.__TASK24_CLOSE_COUNT__ = 0;
      window.__TASK24_ACTIONS__ = [];
      window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__.showModal(
        'Contract modal',
        [
          {
            name: 'Enabled',
            sub: 'Can act',
            action: () => window.__TASK24_ACTIONS__.push('enabled'),
          },
          {
            name: 'Disabled',
            sub: 'Cannot act',
            disabled: true,
            action: () => window.__TASK24_ACTIONS__.push('disabled'),
          },
        ],
        {
          onClose: () => {
            window.__TASK24_CLOSE_COUNT__ += 1;
            window.closeModal();
          },
        },
      );
    });

    const modal = page.locator('#modal');
    await expect(modal).toHaveClass(/open/);
    await expect(page.locator('#modal-opts .option')).toHaveCount(2);
    await expect(page.locator('#modal-opts .option').nth(1)).toHaveClass(/off/);
    await page.locator('#modal-opts .option').nth(1).click({ force: true });
    await expect
      .poll(() => page.evaluate(() => window.__TASK24_ACTIONS__))
      .toEqual([]);

    await page.locator('#modal .cancel').click();
    await page.evaluate(() => window.closeModal());
    await expect(modal).not.toHaveClass(/open/);
    await expect
      .poll(() => page.evaluate(() => window.__TASK24_CLOSE_COUNT__))
      .toBe(1);

    await page.evaluate(() => {
      window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__.showModal(
        'Required choice',
        [{ name: 'Choose', sub: 'Required', action: () => {} }],
        { noCancel: true, semantic: true },
      );
    });
    await expect(page.locator('#modal .cancel')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveClass(/open/);
  });

  test('target selection covers friendly board, any board, friendly grave, and explicit cancel without action', async ({
    page,
  }) => {
    await openFixture(page, 'dense-board-statuses');

    const cases = [
      {
        config: {
          filter: 'friendly',
          location: 'board',
          prompt: 'Choose your creature',
        },
        expected: ['Shellkin', 'Pebbleback', 'Ironhide'],
      },
      {
        config: {
          filter: 'any',
          location: 'board',
          prompt: 'Choose any creature',
        },
        expected: [
          '[ENEMY] ★ Hexweaver',
          '[ENEMY] Thornling',
          '[ENEMY] Leechling',
          '[YOURS] ★ Shellkin',
          '[YOURS] Pebbleback',
          '[YOURS] Ironhide',
        ],
      },
    ];

    for (const entry of cases) {
      await page.evaluate((config) => {
        window.__TASK24_SELECTION_RESULT__ = 'pending';
        window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__
          .showTargetSelection(config)
          .then((result) => {
            window.__TASK24_SELECTION_RESULT__ = result;
          });
      }, entry.config);
      await expect(page.locator('#modal')).toHaveClass(/open/);
      await expect(page.locator('#modal-opts .option .name')).toHaveText(
        entry.expected,
      );
      await page.keyboard.press('Escape');
      await expect(page.locator('#modal')).toHaveClass(/open/);
      await page.locator('#modal .cancel').click();
      await expect
        .poll(() =>
          page.evaluate(() => window.__TASK24_SELECTION_RESULT__),
        )
        .toBeNull();
    }

    await openFixture(page, 'ko-promotion');
    await page.evaluate(() => {
      window.__TASK24_SELECTION_RESULT__ = 'pending';
      window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__
        .showTargetSelection({
          filter: 'friendly',
          location: 'grave',
          prompt: 'Choose from grave',
        })
        .then((result) => {
          window.__TASK24_SELECTION_RESULT__ = result;
        });
    });
    await expect(page.locator('#modal-opts .option .name')).toHaveText([
      'Fangpup',
    ]);
    await page.locator('#modal-opts .option').click();
    await expect
      .poll(() => page.evaluate(() => window.__TASK24_SELECTION_RESULT__))
      .toMatchObject({ uid: expect.stringContaining('fangpup') });
  });

  for (const { fixture, choice } of [
    { fixture: 'optional-trigger-pending', choice: 'first' },
    { fixture: 'optional-trigger-pending', choice: 'last' },
    { fixture: 'skitter-response-pending', choice: 'first' },
    { fixture: 'skitter-response-pending', choice: 'last' },
  ]) {
    test(`${fixture} ${choice} choice keeps Escape inert and resolves exactly once`, async ({
      page,
    }) => {
      await openFixture(page, fixture);
      const before = await stateSnapshot(page);

      await expect(page.locator('#modal')).toHaveClass(/open/);
      await page.keyboard.press('Escape');
      await expect(page.locator('#modal')).toHaveClass(/open/);

      const optionCount = await page.locator('#modal-opts .option').count();
      expect(optionCount).toBeGreaterThanOrEqual(2);
      await page.locator(
        choice === 'first'
          ? '#modal-opts .option:first-child'
          : '#modal-opts .option:last-child',
      ).click();
      await expect(page.locator('#modal')).not.toHaveClass(/open/);
      const after = await stateSnapshot(page);
      expect(after).not.toEqual(before);

      await page.evaluate(() => window.modalAction(0));
      await expect.poll(() => stateSnapshot(page)).toEqual(after);
    });
  }

  test('grave, rules, detail, and hidden-opponent contracts stay privacy-safe', async ({
    page,
  }) => {
    await page.clock.install({
      time: new Date('2026-07-27T12:00:00.000Z'),
    });
    await openFixture(page, 'dense-board-statuses');

    await page.locator('.d-rules-link').click();
    await expect(page.locator('#rulesModal')).toHaveClass(/open/);
    await expect(page.locator('#rulesModal .rules-content')).toContainText(
      'Turn Structure',
    );
    await page.locator('#rulesModal .rules-header button').click();
    await expect(page.locator('#rulesModal')).not.toHaveClass(/open/);
    await page.locator('.d-rules-link').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#rulesModal')).not.toHaveClass(/open/);
    await page.locator('.d-rules-link').click();
    await page.locator('#rulesModal').click({ position: { x: 4, y: 4 } });
    await expect(page.locator('#rulesModal')).not.toHaveClass(/open/);

    const hand = page.locator('#d-hand .d-hand-card').first();
    const handName = (await hand.locator('.tf-card__name').textContent()).trim();
    await hand.dispatchEvent('pointerdown', {
      bubbles: true,
      clientX: 50,
      clientY: 50,
      pointerId: 90,
      pointerType: 'mouse',
    });
    await page.clock.runFor(400);
    await expect(page.locator('#cardModal')).toHaveClass(/open/);
    await expect(page.locator('#cardDetail')).toContainText(handName);
    await page.keyboard.press('Escape');

    const active = page.locator('#d-my-active .card-active');
    await active.dispatchEvent('pointerdown', {
      bubbles: true,
      pointerId: 91,
      pointerType: 'mouse',
    });
    await page.clock.runFor(400);
    await expect(page.locator('#cardModal')).toHaveClass(/open/);
    await expect(page.locator('#cardDetail')).toContainText('20/20');
    await expect(page.locator('#cardDetail')).toContainText('Poisoned');
    await expect(page.locator('#cardDetail')).toContainText('Unbreakable');
    await page.keyboard.press('Escape');

    const bench = page.locator('#d-my-bench .card-mini').first();
    const benchName = (
      await bench.locator('.tf-card__name').textContent()
    ).trim();
    await bench.dispatchEvent('pointerdown', {
      bubbles: true,
      pointerId: 94,
      pointerType: 'mouse',
    });
    await page.clock.runFor(400);
    await expect(page.locator('#cardModal')).toHaveClass(/open/);
    await expect(page.locator('#cardDetail')).toContainText(benchName);
    await page.keyboard.press('Escape');

    await page.locator('#d-my-set').dispatchEvent('pointerdown', {
      bubbles: true,
      pointerId: 92,
      pointerType: 'mouse',
    });
    await page.clock.runFor(400);
    await expect(page.locator('#cardModal')).toHaveClass(/open/);
    await expect(page.locator('#cardDetail')).toContainText('Brace');
    await page.keyboard.press('Escape');

    await openFixture(page, 'ko-promotion');
    await page.evaluate(() => window.showGraveyard('me'));
    await expect(page.locator('#modal-title')).toHaveText('Your Graveyard');
    await expect(page.locator('#modal-opts .option .name')).toHaveText([
      'Fangpup',
    ]);
    await page.locator('#modal-opts .option').dispatchEvent('pointerdown', {
      bubbles: true,
      pointerId: 93,
      pointerType: 'mouse',
    });
    await page.clock.runFor(400);
    await expect(page.locator('#cardModal')).toHaveClass(/open/);
    await expect(page.locator('#cardDetail')).toContainText('Fangpup');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.closeModal());

    await openFixture(page, 'dense-board-statuses');
    await page.evaluate(() => window.showGraveyard('opp'));
    await expect(page.locator('#modal-opts')).toContainText(
      'No cards in graveyard',
    );
    await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      state.G.opp.grave = [
        state.G.opp.active,
        ...state.G.opp.bench.slice(0, 2),
      ];
      window.showGraveyard('opp');
    });
    await expect(page.locator('#modal-title')).toHaveText(
      "Rival's Graveyard",
    );
    await expect(page.locator('#modal-opts .option .name')).toHaveText([
      'Leechling',
      'Thornling',
      'Hexweaver',
    ]);

    await openFixture(page, 'multiplayer-hidden');
    const privacy = await page.evaluate(async () => {
      const { createVisualFixture } = await import(
        '/src/presentation/testing/fixture-registry.js'
      );
      const { state } = await import('/src/state.js');
      const source = createVisualFixture('multiplayer-hidden');
      const privateValues = [
        ...source.G.players[1].hand.map((card) => card.uid),
        source.G.players[1].setVerse.uid,
      ];
      const exposed = JSON.stringify({
        body: document.body.innerText,
        qa: window.__TINY_FANGS_VISUAL_QA__,
        behaviorQa: window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__,
        runtimeState: state.G,
      });
      return {
        exposedPrivateValues: privateValues.filter((value) =>
          exposed.includes(value),
        ),
        opponentHandArrayLength: state.G.opp.hand.length,
        opponentSetKeys: Object.keys(state.G.opp.setVerse ?? {}),
      };
    });
    expect(privacy).toEqual({
      exposedPrivateValues: [],
      opponentHandArrayLength: 0,
      opponentSetKeys: ['faceDown'],
    });
  });

  test('trigger, cast, set, and creature reveals identify their public source and settle once', async ({
    page,
  }) => {
    await page.clock.install({
      time: new Date('2026-07-27T12:00:00.000Z'),
    });
    await openFixture(page, 'dense-board-statuses');

    const revealCases = [
      {
        method: 'showTriggerReveal',
        cardKind: 'set',
        id: 'brace',
        header: 'TRIGGERED!',
        text: ['Brace', 'Set Verse Triggered!', 'Reduce damage by 15.'],
      },
      {
        method: 'showCastReveal',
        cardKind: 'cast',
        id: 'ignite',
        header: 'CAST!',
        text: ['Ignite', 'Cast Verse'],
      },
      {
        method: 'showTriggerReveal',
        cardKind: 'creature',
        id: 'shellkin',
        header: 'TRIGGERED!',
        text: ['Shellkin', 'Ability Triggered!', 'Harden'],
      },
    ];

    for (const entry of revealCases) {
      await page.evaluate(async (item) => {
        const { CREATURES, VERSES } = await import('/src/cards.js');
        const card =
          item.cardKind === 'creature'
            ? CREATURES[item.id]
            : VERSES[item.id];
        window.__TASK24_REVEAL_SETTLES__ = 0;
        window[item.method](card).then(() => {
          window.__TASK24_REVEAL_SETTLES__ += 1;
        });
      }, entry);
      await expect(page.locator('#triggerModal')).toHaveClass(/open/);
      await expect(page.locator('#triggerHeaderText')).toHaveText(entry.header);
      for (const text of entry.text) {
        await expect(page.locator('#triggerContent')).toContainText(text);
      }
      await page.locator('#triggerModal').click({ position: { x: 4, y: 4 } });
      await page.clock.runFor(300);
      await expect
        .poll(() => page.evaluate(() => window.__TASK24_REVEAL_SETTLES__))
        .toBe(1);
      await page.evaluate(() => window.dismissTriggerReveal());
      await page.clock.runFor(300);
      await expect
        .poll(() => page.evaluate(() => window.__TASK24_REVEAL_SETTLES__))
        .toBe(1);
    }

    await page.evaluate(() => {
      window.__TASK24_REVEAL_SETTLES__ = 0;
      window.showSetReveal().then(() => {
        window.__TASK24_REVEAL_SETTLES__ += 1;
      });
    });
    await expect(page.locator('#triggerContent')).toContainText('Verse Set!');
    await expect(page.locator('#triggerContent')).toContainText('Face-down');
    await expect(page.locator('#triggerContent')).not.toContainText('Brace');
    await page.keyboard.press('Escape');
    await page.clock.runFor(300);
    await expect
      .poll(() => page.evaluate(() => window.__TASK24_REVEAL_SETTLES__))
      .toBe(1);
  });

  for (const [fixture, outcome, reasonText] of [
    ['victory', 'victory', '[ VICTORY ]'],
    ['defeat', 'defeat', '[ DEFEAT ]'],
    ['deck-out', 'defeat', '[ DEFEAT — DECK OUT ]'],
  ]) {
    test(`${fixture} presents a differentiated terminal result and blocks actions`, async ({
      page,
    }) => {
      await openFixture(page, fixture);
      await expect(page.locator('#result')).toHaveClass(/open/);
      await expect(page.locator('#result')).toHaveAttribute(
        'data-outcome',
        outcome,
      );
      await expect(page.locator('#result-text')).toHaveText(reasonText);
      await expect(page.locator('#d-btn-summon')).toBeDisabled();
      await expect(page.locator('#d-btn-cast')).toBeDisabled();
      await expect(page.locator('#d-btn-set')).toBeDisabled();
      await expect(page.locator('#d-btn-atk')).toBeDisabled();
      await expect(page.locator('#d-btn-retreat')).toBeDisabled();
      await expect(page.locator('#d-btn-end')).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(page.locator('#result')).toHaveClass(/open/);
      await page.evaluate(() => window.doSummon());
      await expect(page.locator('#modal')).not.toHaveClass(/open/);
    });
  }

  test('solo terminal presentation waits for playback and distinguishes real deck-out', async ({
    page,
  }) => {
    await page.clock.install({
      time: new Date('2026-07-27T12:00:00.000Z'),
    });
    await page.goto('/?visualQa=1&behaviorQa=1');
    await page.evaluate(() => {
      window.__TASK24_START__ = window.startGame('fang', true);
    });
    await page.clock.runFor(1_400);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { state } = await import('/src/state.js');
          return Boolean(state.G);
        }),
      )
      .toBe(true);

    await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      // Deterministic creature choice: the shuffled deck order decided which
      // creature attacked, and multi-event attackers (Frenzy's double attack,
      // Sonic Strike's extra trigger) have playback longer than the 2 500 ms
      // clock budget below. Emberfang is always in the Fang deck and plays a
      // single attack + lpDamage sequence.
      const creature = [...state.G.me.hand, ...state.G.me.deck].find(
        (card) => card.cardType === 'creature' && card.id === 'emberfang',
      );
      state.G.me.active = creature;
      state.G.me.hand = state.G.me.hand.filter(
        (card) => card.uid !== creature.uid,
      );
      state.G.me.deck = state.G.me.deck.filter(
        (card) => card.uid !== creature.uid,
      );
      state.G.opp.active = null;
      state.G.opp.lp = 1;
      state.G.firstTurn = false;
      state.G.myTurn = true;
      window.forcePlayerTurn();
      window.__TASK24_ATTACK__ = window.doAttack();
    });
    await expect(page.locator('#result')).not.toHaveClass(/open/);
    await page.clock.runFor(2_500);
    await expect(page.locator('#result')).toHaveClass(/open/);
    await expect(page.locator('#result-text')).toHaveText('[ VICTORY ]');

    await page.reload();
    await page.evaluate(() => {
      window.__TASK24_START__ = window.startGame('fang', true);
    });
    await page.clock.runFor(1_400);
    await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      state.G.opp.deck = [];
      state.G.firstTurn = false;
      state.G.myTurn = true;
      window.forcePlayerTurn();
      window.__TASK24_END__ = window.endTurn();
    });
    await expect(page.locator('#result')).not.toHaveClass(/open/);
    await page.clock.runFor(2_500);
    await expect(page.locator('#result')).toHaveClass(/open/);
    await expect(page.locator('#result-text')).toHaveText(
      '[ VICTORY — DECK OUT ]',
    );
  });

  // STA-10 (solo half). The test below this one proves clear-before-navigate
  // through the injected `restartGame(navigate)` seam with a stubbed navigate,
  // and a separately-issued `page.reload()` proves a clean mount. This test
  // couples the three into one product journey: a REAL solo match reaches a
  // REAL result overlay, the REAL Play Again button is clicked, and the page
  // that comes back is proven clean and able to start a fresh match. A
  // `pagehide` listener captures the owner's disposal state at the last
  // instant before navigation, so "cleared before the reload" is observed
  // rather than inferred; sessionStorage carries it across the reload.
  const DISPOSAL_KEY = '__TINY_FANGS_SOLO_DISPOSAL_AT_UNLOAD__';

  test('a real match, the real Play Again button, and a fresh mount form one coupled restart journey', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/?visualQa=1&behaviorQa=1');
    expect(await desktopBehaviorQa(page)).toBe(true);

    await page.evaluate(() => {
      window.__RESTART_START__ = window.startGame('fang', true);
    });
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const { state } = await import('/src/state.js');
            return Boolean(state.G);
          }),
        { timeout: 20_000 },
      )
      .toBe(true);
    await expect(page.locator('#desktop')).toBeVisible();

    // Reach a real terminal state through a real attack. Emberfang is always
    // in the Fang deck and plays a single attack + lpDamage sequence.
    await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      const creature = [...state.G.me.hand, ...state.G.me.deck].find(
        (card) => card.cardType === 'creature' && card.id === 'emberfang',
      );
      state.G.me.active = creature;
      state.G.me.hand = state.G.me.hand.filter(
        (card) => card.uid !== creature.uid,
      );
      state.G.me.deck = state.G.me.deck.filter(
        (card) => card.uid !== creature.uid,
      );
      state.G.opp.active = null;
      state.G.opp.lp = 1;
      state.G.firstTurn = false;
      state.G.myTurn = true;
      window.forcePlayerTurn();
      window.__RESTART_ATTACK__ = window.doAttack();
    });
    await expect(page.locator('#result')).toHaveClass(/open/, {
      timeout: 20_000,
    });
    await expect(page.locator('#result-text')).toHaveText('[ VICTORY ]');

    // A real match owner exists at the moment Play Again is pressed.
    const beforeRestart = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return {
        hasGame: state.G !== null,
        startTime: state.startTime,
      };
    });
    expect(beforeRestart.hasGame).toBe(true);
    expect(beforeRestart.startTime).not.toBeNull();

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

    await page.locator('#result button').click();

    await expect(page.locator('#setup')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#result')).not.toHaveClass(/open/);
    await expect(page.locator('#mode-select')).toBeVisible();

    expect(
      await page.evaluate(
        (key) => JSON.parse(sessionStorage.getItem(key) ?? 'null'),
        DISPOSAL_KEY,
      ),
    ).toEqual({
      gameCleared: true,
      longPressTimerCleared: true,
      selectedCardCleared: true,
      startTimeCleared: true,
      timerIntervalCleared: true,
    });
    expect(
      await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        return {
          game: state.G,
          longPressTimer: state.longPressTimer,
          selectedCard: state.selectedCard,
          startTime: state.startTime,
          timerInt: state.timerInt,
        };
      }),
    ).toEqual({
      game: null,
      longPressTimer: null,
      selectedCard: null,
      startTime: null,
      timerInt: null,
    });

    // The fresh mount really starts a clean match, not a resumed one.
    await page.evaluate(() => {
      window.__RESTART_SECOND__ = window.startGame('venom', true);
    });
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const { state } = await import('/src/state.js');
            if (!state.G) return null;
            return {
              graves: state.G.me.grave.length + state.G.opp.grave.length,
              myLp: state.G.me.lp,
              oppLp: state.G.opp.lp,
              timerRunning: state.timerInt !== null && state.startTime !== null,
              turn: state.G.turn,
              winner: state.G.winner,
            };
          }),
        { timeout: 20_000 },
      )
      .toEqual({
        graves: 0,
        myLp: 3,
        oppLp: 3,
        timerRunning: true,
        turn: 1,
        winner: null,
      });
  });

  test('Play Again clears the old owner before navigation and mounts a clean setup', async ({
    page,
  }) => {
    await page.goto('/?visualQa=1&behaviorQa=1');
    expect(await desktopBehaviorQa(page)).toBe(true);
    await page.evaluate(() => {
      window.__TASK24_RESTART_ORDER__ = [];
      window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__.showResult('victory');
      window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__.restartGame(() => {
        window.__TASK24_RESTART_ORDER__.push(
          window.__TINY_FANGS_DESKTOP_BEHAVIOR_QA__.hasGame()
            ? 'not-cleared'
            : 'clear',
        );
        window.__TASK24_RESTART_ORDER__.push('navigate');
      });
    });
    await expect
      .poll(() => page.evaluate(() => window.__TASK24_RESTART_ORDER__))
      .toEqual(['clear', 'navigate']);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { state } = await import('/src/state.js');
          return state.G;
        }),
      )
      .toBeNull();

    await page.reload();
    await expect(page.locator('#setup')).toBeVisible();
    await expect(page.locator('#result')).not.toHaveClass(/open/);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { state } = await import('/src/state.js');
          return state.G;
        }),
      )
      .toBeNull();
  });
});
