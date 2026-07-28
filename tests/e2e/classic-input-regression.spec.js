import { expect, test } from '@playwright/test';

const CLOCK_START = new Date('2026-07-27T12:00:00.000Z');
const CLOCK_PAUSE = new Date('2026-07-27T12:01:00.000Z');
const CLASSIC_FIXTURE_URL = (fixture) =>
  `/?presentation=classic&visualQa=1&fixture=${fixture}`;

async function openFixture(page, fixture, viewport) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  await page.clock.install({ time: CLOCK_START });
  await page.goto(CLASSIC_FIXTURE_URL(fixture));
  await expect(page.locator('html')).toHaveAttribute(
    'data-presentation',
    'classic',
  );
  await expect(page.locator('#setup')).toBeHidden();
  if (viewport?.width < 900) {
    await expect(page.locator('#mobile')).toBeVisible();
  } else {
    await expect(page.locator('#desktop')).toBeVisible();
  }
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const qa = window.__TINY_FANGS_VISUAL_QA__;
        return Boolean(qa && (await qa.ready) && qa.currentFixture);
      }),
    )
    .toBe(true);
  await page.clock.pauseAt(CLOCK_PAUSE);
}

async function gameSnapshot(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const summarizePlayer = (player) => ({
      active: player.active?.uid ?? null,
      bench: player.bench.map((card) => card.uid),
      grave: player.grave.map((card) => card.uid),
      hand: player.hand.map((card) => card.uid),
      lp: player.lp,
      mana: player.mana,
      setVerse: player.setVerse?.uid ?? player.setVerse ?? null,
    });

    return {
      me: summarizePlayer(state.G.me),
      opp: summarizePlayer(state.G.opp),
      firstTurn: state.G.firstTurn,
      hasAttacked: state.G.hasAttacked,
      hasRetreated: state.G.hasRetreated,
      log: state.G.log.map((entry) => entry.t),
      myTurn: state.G.myTurn,
      selectedCard: state.selectedCard,
      turn: state.G.turn,
      winner: state.G.winner,
    };
  });
}

async function interactionSnapshot(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return {
      cardModalOpen: document
        .getElementById('cardModal')
        .classList.contains('open'),
      dragActive: state.drag?.active ?? false,
      dragPresent: Boolean(state.drag),
      ghostCount: document.querySelectorAll('.dragging').length,
      highlights: document.querySelectorAll('.drop-target, .drop-hover').length,
      longPressPending: state.longPressTimer !== null,
    };
  });
}

async function prepareFullMana(page, overrides = {}) {
  await page.evaluate(async (next) => {
    const { state } = await import('/src/state.js');
    state.G.me.maxMana = 5;
    state.G.me.mana = 5;
    Object.assign(state.G, next);
    window.forcePlayerTurn();
  }, overrides);
}

async function handCardDescriptor(page, surface, predicate) {
  const index = await page.evaluate(async (serializedPredicate) => {
    const { state } = await import('/src/state.js');
    const matcher = new Function('card', `return (${serializedPredicate})(card);`);
    return state.G.me.hand.findIndex((card) => matcher(card));
  }, predicate.toString());

  expect(index, `hand card for ${predicate.toString()}`).toBeGreaterThanOrEqual(0);
  const handSelector = surface === 'mobile' ? '#m-hand' : '#d-hand';
  const cardSelector =
    surface === 'mobile' ? '.hand-card' : '.d-hand-card';
  const locator = page.locator(`${handSelector} ${cardSelector}`).nth(index);
  const card = await page.evaluate(async (cardIndex) => {
    const { state } = await import('/src/state.js');
    const value = state.G.me.hand[cardIndex];
    return {
      cardType: value.cardType,
      cost: value.cost,
      id: value.id,
      name: value.name,
      type: value.type ?? null,
      uid: value.uid,
    };
  }, index);

  return { card, index, locator };
}

async function pointerPoint(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function pointerPayload(point, pointerType, pointerId, extras = {}) {
  return {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    isPrimary: true,
    pointerId,
    pointerType,
    ...extras,
  };
}

async function beginPointer(page, locator, pointerType, pointerId) {
  const start = await pointerPoint(locator);
  await locator.dispatchEvent(
    'pointerdown',
    pointerPayload(start, pointerType, pointerId),
  );
  return start;
}

async function movePointer(page, point, pointerType, pointerId) {
  await page.locator('body').dispatchEvent(
    'pointermove',
    pointerPayload(point, pointerType, pointerId),
  );
}

async function finishPointer(
  page,
  eventName,
  point,
  pointerType,
  pointerId,
) {
  await page.locator('body').dispatchEvent(
    eventName,
    pointerPayload(point, pointerType, pointerId, { buttons: 0 }),
  );
}

async function fieldCenter(page, surface) {
  const field =
    surface === 'mobile'
      ? page.locator('#mobile .m-field-half.you').first()
      : page.locator('#desktop .d-field').first();
  return pointerPoint(field);
}

async function dragCardTo(
  page,
  locator,
  end,
  {
    eventName = 'pointerup',
    pointerId = 31,
    pointerType = 'mouse',
  } = {},
) {
  const start = await beginPointer(page, locator, pointerType, pointerId);
  await movePointer(page, end, pointerType, pointerId);
  await finishPointer(page, eventName, end, pointerType, pointerId);
  return start;
}

async function modalContract(page) {
  return {
    options: await page
      .locator('#modal-opts .option')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          className: element.className,
          text: element.textContent.replace(/\s+/g, ' ').trim(),
        })),
      ),
    title: await page.locator('#modal-title').textContent(),
  };
}

async function assertNoInputResidue(page) {
  await expect
    .poll(() => interactionSnapshot(page))
    .toMatchObject({
      dragActive: false,
      dragPresent: false,
      ghostCount: 0,
      highlights: 0,
      longPressPending: false,
    });
}

test.describe('classic pointer, touch, keyboard, and developer inputs', () => {
  test.use({
    hasTouch: true,
    viewport: { width: 1672, height: 941 },
  });

  test('click and tap toggle the exact selected hand-card identity', async ({
    page,
  }) => {
    await openFixture(page, 'opening-hand-triad');

    const desktopCards = page.locator('#d-hand .d-hand-card');
    const firstUid = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G.me.hand[0].uid;
    });
    const secondUid = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G.me.hand[1].uid;
    });

    await desktopCards.nth(0).click();
    expect((await gameSnapshot(page)).selectedCard).toBe(firstUid);
    await expect(desktopCards.nth(0)).toHaveClass(/\bselected\b/);

    await desktopCards.nth(0).click();
    expect((await gameSnapshot(page)).selectedCard).toBeNull();
    await expect(desktopCards.nth(0)).not.toHaveClass(/\bselected\b/);

    await desktopCards.nth(1).click();
    expect((await gameSnapshot(page)).selectedCard).toBe(secondUid);
    await expect(desktopCards.nth(1)).toHaveClass(/\bselected\b/);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileCards = page.locator('#m-hand .hand-card');
    await mobileCards.nth(0).tap();
    expect((await gameSnapshot(page)).selectedCard).toBe(firstUid);
    await expect(mobileCards.nth(0)).toHaveClass(/\bselected\b/);
  });

  for (const variant of [
    {
      name: 'desktop mouse',
      pointerType: 'mouse',
      surface: 'desktop',
      viewport: { width: 1672, height: 941 },
    },
    {
      name: '390x844 touch',
      pointerType: 'touch',
      surface: 'mobile',
      viewport: { width: 390, height: 844 },
    },
  ]) {
    test(`15 px is the inclusive drag boundary for ${variant.name}`, async ({
      page,
    }) => {
      await openFixture(page, 'opening-hand-triad', variant.viewport);
      await prepareFullMana(page);
      const { locator } = await handCardDescriptor(
        page,
        variant.surface,
        (card) => card.cardType === 'creature',
      );

      const pressStart = await beginPointer(
        page,
        locator,
        variant.pointerType,
        41,
      );
      const belowThreshold = {
        x: pressStart.x + 14.99,
        y: pressStart.y,
      };
      await movePointer(
        page,
        belowThreshold,
        variant.pointerType,
        41,
      );
      expect((await interactionSnapshot(page)).dragPresent).toBe(true);
      expect((await interactionSnapshot(page)).dragActive).toBe(false);
      await page.clock.runFor(399);
      await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
      await page.clock.runFor(1);
      await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
      await finishPointer(
        page,
        'pointerup',
        belowThreshold,
        variant.pointerType,
        41,
      );
      await page.evaluate(() => window.closeCardModal(new Event('click'), true));

      const dragStart = await beginPointer(
        page,
        locator,
        variant.pointerType,
        42,
      );
      const exactThreshold = {
        x: dragStart.x + 15,
        y: dragStart.y,
      };
      await movePointer(
        page,
        exactThreshold,
        variant.pointerType,
        42,
      );
      await expect(page.locator('body > .dragging')).toHaveCount(1);
      expect((await interactionSnapshot(page)).dragActive).toBe(true);
      await page.clock.runFor(400);
      await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
      await finishPointer(
        page,
        'pointercancel',
        exactThreshold,
        variant.pointerType,
        42,
      );
      await assertNoInputResidue(page);
    });
  }

  test('cancelled and invalid drops mutate no state and remove every interaction artifact', async ({
    page,
  }) => {
    await openFixture(page, 'opening-hand-triad');
    await prepareFullMana(page);
    const { locator } = await handCardDescriptor(
      page,
      'desktop',
      (card) => card.cardType === 'creature',
    );
    const field = await fieldCenter(page, 'desktop');
    const beforeCancel = await gameSnapshot(page);

    const start = await beginPointer(page, locator, 'mouse', 51);
    await movePointer(page, field, 'mouse', 51);
    await expect(page.locator('body > .dragging')).toHaveCount(1);
    await expect(page.locator('#desktop .d-field')).toHaveClass(
      /\bdrop-target\b/,
    );
    await finishPointer(page, 'pointercancel', field, 'mouse', 51);
    await assertNoInputResidue(page);
    expect(await gameSnapshot(page)).toEqual(beforeCancel);
    await page.clock.runFor(400);
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);

    const beforeOutside = await gameSnapshot(page);
    const outside = { x: start.x, y: 1 };
    await beginPointer(page, locator, 'mouse', 52);
    await movePointer(page, outside, 'mouse', 52);
    await finishPointer(page, 'pointerup', outside, 'mouse', 52);
    await assertNoInputResidue(page);
    expect(await gameSnapshot(page)).toEqual(beforeOutside);

    await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      state.G.me.mana = 0;
      window.forcePlayerTurn();
      state.G.me.mana = 0;
    });
    const unaffordable = await handCardDescriptor(
      page,
      'desktop',
      (card) => card.cost > 0,
    );
    const beforeUnaffordable = await gameSnapshot(page);
    await beginPointer(page, unaffordable.locator, 'mouse', 53);
    await movePointer(page, field, 'mouse', 53);
    await expect(page.locator('body > .dragging')).toHaveClass(
      /\bunaffordable\b/,
    );
    await expect(page.locator('#desktop .d-field')).not.toHaveClass(
      /\bdrop-target\b/,
    );
    await finishPointer(page, 'pointerup', field, 'mouse', 53);
    await assertNoInputResidue(page);
    expect(await gameSnapshot(page)).toEqual(beforeUnaffordable);
  });

  test('drag drop routes creature active, creature bench, Cast, Set, and full-zone rejection', async ({
    browser,
  }) => {
    async function withFixture(fixture, run) {
      const page = await browser.newPage();
      try {
        await openFixture(page, fixture);
        await prepareFullMana(page, { firstTurn: false, actionLock: false });
        await run(page);
      } finally {
        await page.close();
      }
    }

    await withFixture('opening-hand-triad', async (page) => {
      const creature = await handCardDescriptor(
        page,
        'desktop',
        (card) => card.cardType === 'creature',
      );
      const before = await gameSnapshot(page);
      await dragCardTo(
        page,
        creature.locator,
        await fieldCenter(page, 'desktop'),
      );
      await expect
        .poll(() => gameSnapshot(page))
        .toMatchObject({
          me: {
            active: creature.card.uid,
            hand: before.me.hand.filter((uid) => uid !== creature.card.uid),
          },
        });
      await assertNoInputResidue(page);
    });

    await withFixture('dense-board-statuses', async (page) => {
      await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        state.G.me.bench.pop();
        window.forcePlayerTurn();
      });
      const creature = await handCardDescriptor(
        page,
        'desktop',
        (card) => card.cardType === 'creature',
      );
      const before = await gameSnapshot(page);
      await dragCardTo(
        page,
        creature.locator,
        await fieldCenter(page, 'desktop'),
      );
      await expect
        .poll(() => gameSnapshot(page))
        .toMatchObject({
          me: {
            active: before.me.active,
            bench: [...before.me.bench, creature.card.uid],
          },
        });
      await assertNoInputResidue(page);
    });

    await withFixture('opening-hand-triad', async (page) => {
      const cast = await handCardDescriptor(
        page,
        'desktop',
        (card) => card.cardType === 'verse' && card.type === 'cast',
      );
      const before = await gameSnapshot(page);
      await dragCardTo(
        page,
        cast.locator,
        await fieldCenter(page, 'desktop'),
      );
      await page.clock.runFor(2_000);
      await expect
        .poll(() => gameSnapshot(page))
        .toMatchObject({
          me: {
            grave: [...before.me.grave, cast.card.uid],
            hand: before.me.hand.filter((uid) => uid !== cast.card.uid),
          },
        });
      await assertNoInputResidue(page);
    });

    await withFixture('opening-hand-triad', async (page) => {
      const set = await handCardDescriptor(
        page,
        'desktop',
        (card) => card.cardType === 'verse' && card.type === 'set',
      );
      await dragCardTo(
        page,
        set.locator,
        await fieldCenter(page, 'desktop'),
      );
      await expect
        .poll(() => gameSnapshot(page))
        .toMatchObject({
          me: {
            setVerse: set.card.uid,
          },
        });
      await assertNoInputResidue(page);
    });

    await withFixture('dense-board-statuses', async (page) => {
      const creature = await handCardDescriptor(
        page,
        'desktop',
        (card) => card.cardType === 'creature',
      );
      const before = await gameSnapshot(page);
      await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        state.G.me.bench.push({
          ...state.G.me.bench[0],
          uid: 'visual-input-full-bench-probe',
        });
        window.forcePlayerTurn();
      });
      const fullBefore = await gameSnapshot(page);
      expect(fullBefore.me.bench).toHaveLength(3);
      await dragCardTo(
        page,
        creature.locator,
        await fieldCenter(page, 'desktop'),
      );
      await assertNoInputResidue(page);
      expect(await gameSnapshot(page)).toEqual(fullBefore);
      expect(before.me.active).toBe(fullBefore.me.active);
    });
  });

  test('400 ms inspection is exact and release or cancel leaves no stale modal', async ({
    page,
  }) => {
    await openFixture(page, 'dense-board-statuses');
    await prepareFullMana(page);

    const hand = await handCardDescriptor(
      page,
      'desktop',
      (card) => card.cardType === 'creature',
    );
    const handStart = await beginPointer(page, hand.locator, 'mouse', 61);
    await page.clock.runFor(399);
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
    await page.clock.runFor(1);
    await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
    await finishPointer(page, 'pointerup', handStart, 'mouse', 61);
    await page.evaluate(() => window.closeCardModal(new Event('click'), true));

    for (const [selector, pointerId] of [
      ['#d-my-active .card-active', 62],
      ['#d-my-bench .card-mini', 63],
    ]) {
      const card = page.locator(selector).first();
      const start = await beginPointer(page, card, 'mouse', pointerId);
      await page.clock.runFor(399);
      await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
      await page.clock.runFor(1);
      await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
      await finishPointer(page, 'pointerup', start, 'mouse', pointerId);
      await page.evaluate(() =>
        window.closeCardModal(new Event('click'), true),
      );
    }

    const active = page.locator('#d-my-active .card-active').first();
    const cancelStart = await beginPointer(page, active, 'mouse', 64);
    await page.clock.runFor(399);
    await finishPointer(
      page,
      'pointercancel',
      cancelStart,
      'mouse',
      64,
    );
    await page.clock.runFor(1);
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
    await assertNoInputResidue(page);
  });

  test('grave hold and owner Set hold cancel cleanly while opponent Set stays opaque', async ({
    page,
  }) => {
    await openFixture(page, 'inspection-overlays', {
      width: 390,
      height: 844,
    });

    await page.evaluate(() => window.showGraveyard('me'));
    const graveCard = page.locator('#modal-opts .option[data-uid]').first();
    const graveStart = await beginPointer(page, graveCard, 'touch', 71);
    await page.clock.runFor(399);
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
    await page.clock.runFor(1);
    await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
    await finishPointer(page, 'pointerup', graveStart, 'touch', 71);
    await page.evaluate(() => window.closeCardModal(new Event('click'), true));

    const cancelStart = await beginPointer(page, graveCard, 'touch', 72);
    await page.clock.runFor(399);
    await finishPointer(
      page,
      'pointercancel',
      cancelStart,
      'touch',
      72,
    );
    await page.clock.runFor(1);
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
    await page.evaluate(() => window.closeModal());

    await page.evaluate(() => {
      const qa = window.__TINY_FANGS_VISUAL_QA__;
      window.__inputFixtureActivation =
        qa.activateFixture('dense-board-statuses');
    });
    await page.clock.runFor(100);
    await page.evaluate(() => window.__inputFixtureActivation);
    const ownerSet = page.locator('#m-my-set');
    const ownerStart = await beginPointer(page, ownerSet, 'touch', 73);
    await page.clock.runFor(399);
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
    await page.clock.runFor(1);
    await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
    await finishPointer(page, 'pointerup', ownerStart, 'touch', 73);
    await page.evaluate(() => window.closeCardModal(new Event('click'), true));

    const ownerCancel = await beginPointer(page, ownerSet, 'touch', 74);
    await page.clock.runFor(399);
    await finishPointer(
      page,
      'pointercancel',
      ownerCancel,
      'touch',
      74,
    );
    await page.clock.runFor(1);
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);

    const opponentSet = page.locator('#m-opp-set');
    expect(
      await opponentSet.evaluate((element) => ({
        down: element.getAttribute('onpointerdown'),
        up: element.getAttribute('onpointerup'),
      })),
    ).toEqual({ down: null, up: null });
    const opponentStart = await beginPointer(
      page,
      opponentSet,
      'touch',
      75,
    );
    await page.clock.runFor(400);
    await finishPointer(
      page,
      'pointerup',
      opponentStart,
      'touch',
      75,
    );
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
    await expect(page.locator('#cardDetail')).not.toContainText('Soul Trap');
  });

  for (const variant of [
    {
      name: 'desktop pointer',
      button: '#d-btn-end',
      pointerType: 'mouse',
      viewport: { width: 1672, height: 941 },
    },
    {
      name: '390x844 touch',
      button: '#m-btn-end',
      pointerType: 'touch',
      viewport: { width: 390, height: 844 },
    },
  ]) {
    test(`End Turn dispatches once at exactly 500 ms for ${variant.name}`, async ({
      page,
    }) => {
      await openFixture(page, 'opening-hand-triad', variant.viewport);
      const button = page.locator(variant.button);
      const before = await gameSnapshot(page);
      const point = await beginPointer(
        page,
        button,
        variant.pointerType,
        81,
      );

      await page.clock.runFor(499);
      expect(await gameSnapshot(page)).toEqual(before);
      await expect(button).toHaveClass(/\bholding\b/);

      await page.clock.runFor(1);
      await expect
        .poll(() => gameSnapshot(page))
        .toMatchObject({ myTurn: false });
      const afterThreshold = await gameSnapshot(page);

      await finishPointer(
        page,
        'pointerup',
        point,
        variant.pointerType,
        81,
      );
      await finishPointer(
        page,
        'pointercancel',
        point,
        variant.pointerType,
        81,
      );
      expect(await gameSnapshot(page)).toEqual(afterThreshold);
      await expect(button).not.toHaveClass(/\bholding\b/);
    });
  }

  test('gameplay keys match controls and obey overlay, editable, animation, and turn guards', async ({
    browser,
  }) => {
    const modalPage = await browser.newPage();
    try {
      await openFixture(modalPage, 'opening-hand-triad');
      for (const [key, selector] of [
        ['s', '#d-btn-summon'],
        ['c', '#d-btn-cast'],
        ['t', '#d-btn-set'],
      ]) {
        await modalPage.locator(selector).click();
        const buttonContract = await modalContract(modalPage);
        await modalPage.keyboard.press('Escape');
        await expect(modalPage.locator('#modal')).not.toHaveClass(/\bopen\b/);

        await modalPage.keyboard.press(key);
        await expect(modalPage.locator('#modal')).toHaveClass(/\bopen\b/);
        expect(await modalContract(modalPage)).toEqual(buttonContract);
        await modalPage.keyboard.press('Escape');
      }

      const beforeModalGuard = await gameSnapshot(modalPage);
      await modalPage.keyboard.press('s');
      await expect(modalPage.locator('#modal')).toHaveClass(/\bopen\b/);
      for (const key of ['s', 'c', 't', 'a', 'r', 'e']) {
        await modalPage.keyboard.press(key);
        expect(await gameSnapshot(modalPage)).toEqual(beforeModalGuard);
        await expect(modalPage.locator('#modal')).toHaveClass(/\bopen\b/);
      }
      await modalPage.keyboard.press('Escape');

      await modalPage.evaluate(() => {
        const input = document.createElement('input');
        input.id = 'input-regression-probe';
        document.body.appendChild(input);
        input.focus();
      });
      await modalPage.keyboard.press('s');
      await expect(modalPage.locator('#modal')).not.toHaveClass(/\bopen\b/);

      await modalPage.evaluate(async () => {
        const { state } = await import('/src/state.js');
        document.getElementById('input-regression-probe').blur();
        state.animating = true;
      });
      await modalPage.keyboard.press('s');
      await expect(modalPage.locator('#modal')).not.toHaveClass(/\bopen\b/);
      await modalPage.evaluate(async () => {
        const { state } = await import('/src/state.js');
        state.animating = false;
        state.G.myTurn = false;
      });
      await modalPage.keyboard.press('s');
      await expect(modalPage.locator('#modal')).not.toHaveClass(/\bopen\b/);
    } finally {
      await modalPage.close();
    }

    const endPage = await browser.newPage();
    try {
      await openFixture(endPage, 'opening-hand-triad');
      await endPage.keyboard.press('e');
      await expect
        .poll(() => gameSnapshot(endPage))
        .toMatchObject({ myTurn: false });
    } finally {
      await endPage.close();
    }

    const combatPage = await browser.newPage();
    try {
      await openFixture(combatPage, 'dense-board-statuses');
      await prepareFullMana(combatPage, {
        actionLock: false,
        firstTurn: false,
        hasAttacked: false,
        hasRetreated: false,
      });

      await combatPage.locator('#d-btn-retreat').click();
      const retreatContract = await modalContract(combatPage);
      await combatPage.keyboard.press('Escape');
      await combatPage.keyboard.press('r');
      expect(await modalContract(combatPage)).toEqual(retreatContract);
      await combatPage.keyboard.press('Escape');

      await combatPage.keyboard.press('a');
      await expect(combatPage.locator('.float-text.damage').first()).toHaveText(
        '-10',
      );
      await expect(
        combatPage.locator('#d-my-active .card-active'),
      ).toHaveClass(/\banim-lunge-up\b/);
      await expect(combatPage.locator('.screen-flash-red')).toBeAttached();
    } finally {
      await combatPage.close();
    }
  });

  test('Escape closes supported overlays without state mutation and trigger keys are consumed', async ({
    page,
  }) => {
    await openFixture(page, 'dense-board-statuses');
    const baseline = await gameSnapshot(page);

    await page.evaluate(() => window.showRules());
    await expect(page.locator('#rulesModal')).toHaveClass(/\bopen\b/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#rulesModal')).not.toHaveClass(/\bopen\b/);
    expect(await gameSnapshot(page)).toEqual(baseline);

    const active = page.locator('#d-my-active .card-active').first();
    const activePoint = await beginPointer(page, active, 'mouse', 91);
    await page.clock.runFor(400);
    await finishPointer(page, 'pointerup', activePoint, 'mouse', 91);
    await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);
    expect(await gameSnapshot(page)).toEqual(baseline);

    for (const key of ['s', 'c', 't', 'a', 'r', 'e']) {
      await page.keyboard.press('Control+0');
      await expect(page.locator('#triggerModal')).toHaveClass(/\bopen\b/);
      await page.keyboard.press(key);
      await expect(page.locator('#triggerModal')).not.toHaveClass(/\bopen\b/);
      await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
      expect((await gameSnapshot(page)).me).toEqual(baseline.me);
      expect((await gameSnapshot(page)).opp).toEqual(baseline.opp);
    }
  });

  test('Ctrl+0 through Ctrl+9 preserve semantic effects and hidden Set privacy', async ({
    page,
  }) => {
    await openFixture(page, 'dense-board-statuses');
    const privateBoundary = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return {
        opponentSet: state.G.opp.setVerse,
        qa: window.__TINY_FANGS_VISUAL_QA__.currentFixture.stableHashInput,
      };
    });
    expect(privateBoundary.opponentSet).toEqual({ faceDown: true });
    expect(JSON.stringify(privateBoundary)).not.toContain('soulTrap');
    expect(JSON.stringify(privateBoundary)).not.toContain('Soul Trap');

    const debugContracts = [
      { key: '1', log: 'TEST: attack', selector: '.float-text.damage' },
      { key: '2', log: 'TEST: damage', selector: '.float-text.damage' },
      { key: '3', log: 'TEST: heal', selector: '.float-text.heal' },
      { key: '4', log: 'TEST: KO', selector: '.float-text.ko' },
      { key: '5', log: 'TEST: verse popup', selector: '.verse-popup' },
      { key: '6', log: 'TEST: negate', selector: '.negate-x' },
      { key: '7', log: 'TEST: LP damage', selector: '.float-text.damage' },
      { key: '8', log: 'TEST: poison', selector: '.float-text.damage' },
      { key: '9', log: 'TEST: summon', selector: '.float-text.gold' },
    ];

    for (const contract of debugContracts) {
      const beforeCount = (await gameSnapshot(page)).log.length;
      await page.keyboard.press(`Control+${contract.key}`);
      await expect(page.locator(contract.selector).last()).toBeAttached();
      await expect
        .poll(() => gameSnapshot(page))
        .toMatchObject({
          log: expect.arrayContaining([contract.log]),
        });
      expect((await gameSnapshot(page)).log).toHaveLength(beforeCount + 1);
      await page.clock.runFor(1_000);
    }

    const beforeReveal = await gameSnapshot(page);
    await page.keyboard.press('Control+0');
    await expect(page.locator('#triggerModal')).toHaveClass(/\bopen\b/);
    await expect(page.locator('#triggerContent')).toContainText('Phantom Wall');
    await expect(page.locator('#triggerContent')).not.toContainText('Soul Trap');
    expect((await gameSnapshot(page)).me).toEqual(beforeReveal.me);
    expect((await gameSnapshot(page)).opp).toEqual(beforeReveal.opp);
    await page.keyboard.press('Escape');
    await expect(page.locator('#triggerModal')).not.toHaveClass(/\bopen\b/);

    await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      state.G.myTurn = false;
    });
    const guardedLogCount = (await gameSnapshot(page)).log.length;
    await page.keyboard.press('Control+1');
    expect((await gameSnapshot(page)).log).toHaveLength(guardedLogCount);
    await expect(page.locator('.float-text')).toHaveCount(0);
    await expect(page.locator('#cardDetail')).not.toContainText('Soul Trap');
  });
});
