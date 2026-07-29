import { expect, test } from '@playwright/test';

const CLASSIC_URL = '/?presentation=classic';
const COIN_FLIP_DURATION_MS = 1_780;
const RIVAL_DECISION_DURATION_MS = 1_500;
const BEGIN_DURATION_MS = 1_330;

const DECKS = [
  {
    id: 'shadow',
    label: 'Shadow',
    call: 'HEADS',
    coin: 0.1,
    turnChoice: 'Go First',
    myTurn: true,
    difficulty: 1,
  },
  {
    id: 'fang',
    label: 'Fang',
    call: 'TAILS',
    coin: 0.9,
    turnChoice: 'Go Second',
    myTurn: false,
    difficulty: 2,
  },
  {
    id: 'venom',
    label: 'Venom',
    call: 'HEADS',
    coin: 0.1,
    turnChoice: 'Go Second',
    myTurn: false,
    difficulty: 2,
  },
  {
    id: 'swarm',
    label: 'Swarm',
    call: 'TAILS',
    coin: 0.9,
    turnChoice: 'Go First',
    myTurn: true,
    difficulty: 2,
  },
  {
    id: 'shell',
    label: 'Shell',
    call: 'HEADS',
    coin: 0.1,
    turnChoice: 'Go First',
    myTurn: true,
    difficulty: 2,
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function installDeterministicBrowser(context, page, randomValues = []) {
  await context.addInitScript(
    ({ values, fallbackSeed }) => {
      let cursor = 0;
      let seed = fallbackSeed >>> 0;
      const trace = [];

      Object.defineProperty(window, '__tinyFangsRandomTrace', {
        configurable: false,
        enumerable: false,
        value: trace,
        writable: false,
      });

      Math.random = () => {
        let value;
        if (cursor < values.length) {
          value = values[cursor];
        } else {
          seed = (seed + 0x6d2b79f5) | 0;
          let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
          value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
        }

        trace.push(value);
        cursor += 1;
        return value;
      };
    },
    {
      values: randomValues,
      fallbackSeed: 0x54464e47,
    },
  );

  await page.clock.install({
    time: new Date('2026-07-27T12:00:00.000Z'),
  });
}

async function openClassic(page) {
  await page.goto(CLASSIC_URL);
  await expect(page.locator('html')).toHaveAttribute(
    'data-presentation',
    'classic',
  );
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(
    new Date('2026-07-27T12:01:00.000Z'),
  );
}

async function openSoloDeckSelect(page, input = 'click') {
  const solo = page.getByRole('button', { name: /Solo/ });
  if (input === 'keyboard') {
    await solo.focus();
    await page.keyboard.press('Enter');
  } else if (input === 'tap') {
    await solo.tap();
  } else {
    await solo.click();
  }

  await expect(page.locator('#deck-select')).toBeVisible();
  await expect(page.locator('#mode-select')).toBeHidden();
  await expect(page.locator('#mp-lobby')).toBeHidden();
}

function deckControl(page, label) {
  return page
    .locator('#deck-select .deck-btn')
    .filter({ hasText: new RegExp(`\\b${escapeRegExp(label)}\\b`) })
    .first();
}

function modalOption(page, label) {
  return page
    .locator('#modal-opts .option')
    .filter({ hasText: new RegExp(`\\b${escapeRegExp(label)}\\b`) })
    .first();
}

async function chooseDecks(page, playerDeck, rivalDeck, input = 'click') {
  const playerControl = deckControl(page, playerDeck);
  if (input === 'tap') {
    await playerControl.tap();
  } else {
    await playerControl.click();
  }

  await expect(page.locator('#setup')).toHaveClass(/\bhidden\b/);
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Choose Rival Deck');
  await expect(page.locator('#modal-opts .option')).toHaveCount(6);

  const rivalControl = modalOption(page, rivalDeck);
  if (input === 'tap') {
    await rivalControl.tap();
  } else {
    await rivalControl.click();
  }

  await expect(page.locator('#modal-title')).toHaveText('Coin Flip');
  await expect(page.locator('#modal-opts .option')).toHaveCount(2);
}

async function readGame(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    if (!state.G) return null;

    return {
      aiDifficulty: state.G.aiDifficulty,
      firstTurn: state.G.firstTurn,
      hasAttacked: state.G.hasAttacked,
      myTurn: state.G.myTurn,
      log: state.G.log.map((entry) => entry.t),
    };
  });
}

async function readDeckInventories(page) {
  return page.evaluate(async () => {
    const [{ state }, { DECKS: definitions }] = await Promise.all([
      import('/src/state.js'),
      import('/src/cards.js'),
    ]);

    const inventory = (player) =>
      [...player.hand, ...player.deck].map((card) => card.id).sort();
    const expected = (deckId) =>
      [
        ...definitions[deckId].creatures,
        ...definitions[deckId].verses,
      ].sort();

    return {
      me: inventory(state.G.me),
      opp: inventory(state.G.opp),
      expected: Object.fromEntries(
        Object.keys(definitions).map((deckId) => [
          deckId,
          expected(deckId),
        ]),
      ),
    };
  });
}

async function callCoinAndReachPlayerChoice(page, call, expectedResult) {
  await modalOption(page, call).click();

  const overlay = page.locator('#coin-flip-overlay');
  await expect(overlay).toBeVisible();
  await expect.poll(() => readGame(page)).toBeNull();

  await page.clock.runFor(COIN_FLIP_DURATION_MS - 1);
  await expect(overlay).toBeVisible();
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
  await expect.poll(() => readGame(page)).toBeNull();

  await page.clock.runFor(1);
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('#modal-title')).toHaveText(
    `${expectedResult}! You won the toss`,
  );
  await expect(modalOption(page, 'Go First')).toBeVisible();
  await expect(modalOption(page, 'Go Second')).toBeVisible();
}

async function chooseTurnAndReachBoard(page, turnChoice) {
  await modalOption(page, turnChoice).click();

  const beginOverlay = page.locator(
    'body > div[style*="z-index: 9999"]',
  );
  await expect(beginOverlay).toHaveCount(1);
  await expect.poll(() => readGame(page)).toBeNull();
  await expect(page.locator('#d-hand')).toBeEmpty();

  await page.clock.runFor(BEGIN_DURATION_MS - 1);
  await expect(beginOverlay).toHaveCount(1);
  await expect.poll(() => readGame(page)).toBeNull();
  await expect(page.locator('#d-hand')).toBeEmpty();

  await page.clock.runFor(1);
  await expect(beginOverlay).toHaveCount(0);
  await expect.poll(() => readGame(page)).not.toBeNull();
  await expect(page.locator('#d-hand .tf-card--hand')).toHaveCount(5);
}

async function assertFirstTurnAttackIsBlocked(page) {
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    let creatureIndex = state.G.me.hand.findIndex(
      (card) => card.cardType === 'creature',
    );
    let source = state.G.me.hand;

    if (creatureIndex < 0) {
      source = state.G.me.deck;
      creatureIndex = source.findIndex(
        (card) => card.cardType === 'creature',
      );
    }

    const [active] = source.splice(creatureIndex, 1);
    state.G.me.active = active;
    state.G.myTurn = true;
    state.G._playerSetupDone = true;
    window.startPlayerTurn();
  });

  await expect(page.locator('#d-btn-atk')).toBeDisabled();

  const before = await readGame(page);
  await page.evaluate(() => window.dispatchAction('attack'));
  const after = await readGame(page);

  expect(after.firstTurn).toBe(true);
  expect(after.hasAttacked).toBe(false);
  expect(after.log).toEqual([
    ...before.log,
    'Cannot attack on first turn',
  ]);
}

async function assertSecondPlayerCanAttackAfterOpeningTurn(page) {
  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    state.G.opp.hand = [];
    state.G._aiSetupDone = true;
  });

  await page.clock.runFor(10_000);
  await expect
    .poll(() => readGame(page))
    .toMatchObject({
      firstTurn: false,
      myTurn: true,
    });

  await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    let creatureIndex = state.G.me.hand.findIndex(
      (card) => card.id === 'emberfang',
    );
    let source = state.G.me.hand;

    if (creatureIndex < 0) {
      source = state.G.me.deck;
      creatureIndex = source.findIndex(
        (card) => card.id === 'emberfang',
      );
    }

    const [active] = source.splice(creatureIndex, 1);
    state.G.me.active = active;
    state.G.myTurn = true;
    state.G._playerSetupDone = true;
    window.startPlayerTurn();
  });

  await expect(page.locator('#d-btn-atk')).toBeEnabled();
  await page.locator('#d-btn-atk').click();
  await page.clock.runFor(2_000);
  await expect
    .poll(() => readGame(page))
    .toMatchObject({
      firstTurn: false,
      hasAttacked: true,
      myTurn: true,
    });
}

test.describe('solo setup regression lane', () => {
  test('Solo reveals exactly five real decks, Random, and Pup/Hunter while hiding multiplayer', async ({
    context,
    page,
  }) => {
    await installDeterministicBrowser(context, page);
    await openClassic(page);
    await openSoloDeckSelect(page, 'keyboard');

    const realDecks = page.locator(
      '#deck-select .deck-btn:not(.random-btn)',
    );
    await expect(realDecks).toHaveCount(5);
    await expect(realDecks.locator('.name')).toHaveText(
      DECKS.map(({ label }) => label),
    );
    await expect(page.locator('#deck-select .random-btn')).toHaveCount(1);
    await expect(page.locator('#deck-select .random-btn .name')).toHaveText(
      'Random',
    );

    await expect(page.locator('#ai-difficulty')).toBeVisible();
    await expect(page.locator('#ai-difficulty .diff-btn')).toHaveCount(2);
    await expect(page.locator('#diff-pup')).toHaveText('Pup');
    await expect(page.locator('#diff-hunter')).toHaveText('Hunter');

    await page.locator('#diff-pup').click();
    await expect(page.locator('#diff-pup')).toHaveClass(/\bactive\b/);
    await expect(page.locator('#diff-hunter')).not.toHaveClass(/\bactive\b/);
    await page.locator('#diff-hunter').click();
    await expect(page.locator('#diff-hunter')).toHaveClass(/\bactive\b/);
    await expect(page.locator('#diff-pup')).not.toHaveClass(/\bactive\b/);
  });

  test('desktop hover opens one real deck preview and leave closes it', async ({
    context,
    page,
  }) => {
    await installDeterministicBrowser(context, page);
    await openClassic(page);
    await openSoloDeckSelect(page);

    const shadow = deckControl(page, 'Shadow');
    await shadow.hover();
    await expect(page.locator('.deck-preview')).toHaveCount(1);
    await expect(page.locator('.deck-preview .name')).toHaveText('Shadow');

    await page.mouse.move(0, 0);
    await expect(page.locator('.deck-preview')).toHaveCount(0);

    const fang = deckControl(page, 'Fang');
    await fang.hover();
    await expect(page.locator('.deck-preview')).toHaveCount(1);
    await expect(page.locator('.deck-preview .name')).toHaveText('Fang');
    await page.mouse.move(0, 0);
    await expect(page.locator('.deck-preview')).toHaveCount(0);
  });

  for (const deck of DECKS) {
    test(`${deck.label} player and rival controls route through the real match setup`, async ({
      context,
      page,
    }) => {
      await installDeterministicBrowser(context, page, [deck.coin]);
      await openClassic(page);
      await openSoloDeckSelect(page);

      if (deck.difficulty === 1) {
        await page.locator('#diff-pup').click();
      }

      await chooseDecks(page, deck.label, deck.label);
      await callCoinAndReachPlayerChoice(page, deck.call, deck.call);
      await chooseTurnAndReachBoard(page, deck.turnChoice);

      const game = await readGame(page);
      expect(game).toMatchObject({
        aiDifficulty: deck.difficulty,
        firstTurn: true,
        hasAttacked: false,
        myTurn: deck.myTurn,
      });

      const inventories = await readDeckInventories(page);
      expect(inventories.me).toEqual(inventories.expected[deck.id]);
      expect(inventories.opp).toEqual(inventories.expected[deck.id]);

      if (deck.id === 'shadow') {
        await assertFirstTurnAttackIsBlocked(page);
      }
      if (deck.id === 'fang') {
        await assertSecondPlayerCanAttackAfterOpeningTurn(page);
      }
    });
  }

  for (const scenario of [
    {
      name: 'Heads loses to Tails and Rival elects to go first',
      call: 'HEADS',
      coin: 0.9,
      result: 'TAILS',
      aiChoice: 0.1,
      announcement: 'Rival goes first',
      myTurn: false,
    },
    {
      name: 'Tails loses to Heads and Rival elects the player to go first',
      call: 'TAILS',
      coin: 0.1,
      result: 'HEADS',
      aiChoice: 0.9,
      announcement: 'You go first',
      myTurn: true,
    },
  ]) {
    test(scenario.name, async ({ context, page }) => {
      await installDeterministicBrowser(context, page, [
        scenario.coin,
        scenario.aiChoice,
      ]);
      await openClassic(page);
      await openSoloDeckSelect(page);
      await chooseDecks(page, 'Shadow', 'Fang');

      await modalOption(page, scenario.call).click();
      const coinOverlay = page.locator('#coin-flip-overlay');
      await expect(coinOverlay).toBeVisible();
      await page.clock.runFor(COIN_FLIP_DURATION_MS - 1);
      await expect(coinOverlay).toBeVisible();
      await expect.poll(() => readGame(page)).toBeNull();

      await page.clock.runFor(1);
      await expect(coinOverlay).toHaveCount(0);
      await expect(
        page.getByText(`${scenario.result}! Rival won`, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(scenario.announcement, { exact: true }),
      ).toBeVisible();
      await expect.poll(() => readGame(page)).toBeNull();

      await page.clock.runFor(RIVAL_DECISION_DURATION_MS - 1);
      await expect(
        page.getByText(scenario.announcement, { exact: true }),
      ).toBeVisible();
      await expect.poll(() => readGame(page)).toBeNull();

      await page.clock.runFor(1);
      const beginOverlay = page.locator(
        'body > div[style*="z-index: 9999"]',
      );
      await expect(beginOverlay).toHaveCount(1);
      await expect.poll(() => readGame(page)).toBeNull();

      await page.clock.runFor(BEGIN_DURATION_MS - 1);
      await expect(beginOverlay).toHaveCount(1);
      await expect.poll(() => readGame(page)).toBeNull();

      await page.clock.runFor(1);
      await expect(beginOverlay).toHaveCount(0);
      const game = await readGame(page);
      expect(game).toMatchObject({
        firstTurn: true,
        myTurn: scenario.myTurn,
      });
      expect(game.log).toContain(
        scenario.myTurn ? 'You go first! Choose a creature to summon' : 'Rival goes first',
      );
    });
  }
});

test.describe('solo setup mobile regression lane', () => {
  test.use({
    hasTouch: true,
    viewport: {
      width: 390,
      height: 844,
    },
  });

  test('touch Solo route keeps the same exact setup controls', async ({
    context,
    page,
  }) => {
    await installDeterministicBrowser(context, page);
    await openClassic(page);
    await openSoloDeckSelect(page, 'tap');

    await expect(
      page.locator('#deck-select .deck-btn:not(.random-btn)'),
    ).toHaveCount(5);
    await expect(page.locator('#deck-select .random-btn')).toHaveCount(1);
    await expect(page.locator('#diff-pup')).toBeVisible();
    await expect(page.locator('#diff-hunter')).toBeVisible();
    await expect(page.locator('#mp-lobby')).toBeHidden();
  });

  test('touch preview opens at 400 ms, closes, cancels, and leaves no stale preview', async ({
    context,
    page,
  }) => {
    await installDeterministicBrowser(context, page);
    await openClassic(page);
    await openSoloDeckSelect(page, 'tap');

    const shadow = deckControl(page, 'Shadow');
    const preview = page.locator('.deck-preview');
    const pointer = {
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 200,
    };

    await shadow.dispatchEvent('pointerdown', pointer);
    await page.clock.runFor(399);
    await expect(preview).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(preview).toHaveCount(1);
    await expect(preview.locator('.name')).toHaveText('Shadow');

    await shadow.dispatchEvent('pointerup', {
      ...pointer,
      button: -1,
      buttons: 0,
    });
    await expect(preview).toHaveCount(0);

    await shadow.dispatchEvent('pointerdown', pointer);
    await page.clock.runFor(200);
    await shadow.dispatchEvent('pointercancel', {
      ...pointer,
      button: -1,
      buttons: 0,
    });
    await page.clock.runFor(200);
    await expect(preview).toHaveCount(0);

    await page.clock.runFor(400);
    await expect(preview).toHaveCount(0);

    const fang = deckControl(page, 'Fang');
    await fang.dispatchEvent('pointerdown', {
      ...pointer,
      pointerId: 8,
    });
    await page.clock.runFor(400);
    await expect(preview).toHaveCount(1);
    await expect(preview.locator('.name')).toHaveText('Fang');
    await fang.dispatchEvent('pointerup', {
      ...pointer,
      pointerId: 8,
      button: -1,
      buttons: 0,
    });
    await expect(preview).toHaveCount(0);
  });

  test('both real Random controls resolve through the mounted browser path', async ({
    context,
    page,
  }) => {
    await installDeterministicBrowser(context, page, [0.61, 0.99, 0.1]);
    await openClassic(page);
    await openSoloDeckSelect(page, 'tap');
    await expect
      .poll(() =>
        page.evaluate(() => window.__tinyFangsRandomTrace.length),
      )
      .toBe(0);

    await deckControl(page, 'Random').tap();
    await expect(page.locator('#modal-title')).toHaveText(
      'Choose Rival Deck',
    );
    await expect
      .poll(() =>
        page.evaluate(() => window.__tinyFangsRandomTrace.length),
      )
      .toBe(1);

    await modalOption(page, 'Random').tap();
    await expect(page.locator('#modal-title')).toHaveText('Coin Flip');
    await expect
      .poll(() =>
        page.evaluate(() => window.__tinyFangsRandomTrace.length),
      )
      .toBe(2);

    await modalOption(page, 'HEADS').tap();
    await expect
      .poll(() =>
        page.evaluate(() => window.__tinyFangsRandomTrace.slice(0, 3)),
      )
      .toEqual([0.61, 0.99, 0.1]);

    await page.clock.runFor(COIN_FLIP_DURATION_MS);
    await expect(page.locator('#modal-title')).toHaveText(
      'HEADS! You won the toss',
    );
    await modalOption(page, 'Go First').tap();
    await page.clock.runFor(BEGIN_DURATION_MS);
    await expect.poll(() => readGame(page)).not.toBeNull();

    const inventories = await readDeckInventories(page);
    expect(inventories.me).toEqual(inventories.expected.swarm);
    expect(inventories.opp).toEqual(inventories.expected.shell);
  });
});
