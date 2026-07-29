import { expect, test } from '@playwright/test';

// Phase 8 chunk 1 — the AAA shell runs the REAL solo game: meadow scene
// behind live projected state, cards on the camera-lock quads, quiet edge
// rails, and actions delegating to the classic dispatch path (engine stays
// the only rules authority).

const AAA_URL = '/?presentation=aaa';
const COIN_FLIP_DURATION_MS = 1_780;
const BEGIN_DURATION_MS = 1_330;

async function installDeterministicBrowser(context, page, randomValues = []) {
  await context.addInitScript(
    ({ values, fallbackSeed }) => {
      let cursor = 0;
      let seed = fallbackSeed >>> 0;
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
        cursor += 1;
        return value;
      };
    },
    { values: randomValues, fallbackSeed: 0x54464e47 },
  );
  await page.clock.install({ time: new Date('2026-07-27T12:00:00.000Z') });
}

function modalOption(page, label) {
  return page
    .locator('#modal-opts .option')
    .filter({ hasText: new RegExp(label) })
    .first();
}

async function startSoloGameGoingFirst(page) {
  await page.goto(AAA_URL);
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));

  await page.getByRole('button', { name: /Solo/ }).click();
  await expect(page.locator('#deck-select')).toBeVisible();
  await page
    .locator('#deck-select .deck-btn')
    .filter({ hasText: /\bShadow\b/ })
    .first()
    .click();
  await expect(page.locator('#modal-title')).toHaveText('Choose Rival Deck');
  await modalOption(page, '\\bShadow\\b').click();
  await expect(page.locator('#modal-title')).toHaveText('Coin Flip');
  await modalOption(page, 'HEADS').click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, 'Go First').click();
  await page.clock.runFor(BEGIN_DURATION_MS);
  await page.clock.runFor(2_000);
  await expect
    .poll(() => page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G?.myTurn ?? null;
    }))
    .toBe(true);
}

async function readGameFacts(page) {
  return page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    if (!state.G) return null;
    return {
      myTurn: state.G.myTurn,
      turn: state.G.turn,
      handCount: state.G.me.hand.length,
      handNames: state.G.me.hand.map((c) => c.name),
      activeName: state.G.me.active?.name ?? null,
      myMana: state.G.me.mana,
      myDeck: state.G.me.deckCount ?? state.G.me.deck?.length ?? 0,
      firstAffordableCreature:
        state.G.me.hand.find(
          (c) => c.cardType === 'creature' && c.cost <= state.G.me.mana,
        )?.name ?? null,
    };
  });
}

test('AAA shell mounts the live game: meadow, quad cards, hand fan, rails', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Stage and scene.
  await expect(page.locator('#aaa-stage .aaa-frame')).toBeVisible();
  await expect(page.locator('#aaa-stage canvas.aaa-canvas')).toBeVisible();
  // Classic shells hidden; modals still usable.
  await expect(page.locator('#desktop')).toBeHidden();
  await expect(page.locator('#mobile')).toBeHidden();

  const facts = await readGameFacts(page);
  expect(facts.myTurn).toBe(true);

  // Both decks render as face-down stacks on their quads with count chips.
  await expect(page.locator('.aaa-card-layer [data-anchor="me.deck"]')).toHaveCount(1);
  await expect(page.locator('.aaa-card-layer [data-anchor="opp.deck"]')).toHaveCount(1);
  await expect(page.locator('[data-chip="me.deck"]')).toHaveText(String(facts.myDeck));

  // Hand fan mirrors the projected hand exactly.
  await expect(page.locator('.aaa-hand-card')).toHaveCount(facts.handCount);

  // Information surfaces: hearts, mana, rival hand, turn chip, log, actions.
  await expect(page.locator('#aaa-my-lp')).toHaveText('♥♥♥');
  await expect(page.locator('#aaa-opp-lp')).toHaveText('♥♥♥');
  await expect(page.locator('#aaa-my-mana')).toContainText('●');
  await expect(page.locator('#aaa-opp-hand')).toContainText('hand');
  await expect(page.locator('#aaa-turn')).toContainText('You');
  await expect(page.locator('#aaa-log')).toBeAttached();
  for (const id of ['summon', 'attack', 'cast', 'set', 'retreat', 'end']) {
    await expect(page.locator(`#aaa-action-${id}`)).toBeAttached();
  }

  // Affordance mirroring: attack is impossible on the very first turn, and
  // the shell rail must mirror the classic single-source computation.
  await expect(page.locator('#aaa-action-attack')).toBeDisabled();
  await expect(page.locator('#aaa-action-end')).toBeEnabled();
});

test('summon via the AAA action rail reaches the engine and the active quad', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const before = await readGameFacts(page);
  expect(before.firstAffordableCreature).not.toBeNull();

  await page.locator('#aaa-action-summon').click();
  await expect(page.locator('#modal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#modal-title')).toHaveText('Summon Creature');
  await modalOption(page, before.firstAffordableCreature).click();
  await page.clock.runFor(6_000);

  const after = await readGameFacts(page);
  expect(after.activeName).toBe(before.firstAffordableCreature);
  expect(after.handCount).toBe(before.handCount - 1);

  // The summoned creature stands on the active quad as a chassis face.
  const active = page.locator('.aaa-card-layer [data-anchor="me.active"]');
  await expect(active).toHaveCount(1);
  await expect(active.locator('.tf-aaa-card__title-text'))
    .toHaveText(before.firstAffordableCreature);
});

test('end turn hands control to the rival and returns', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  await page.locator('#aaa-action-end').click();
  // The rival turn runs on the fake clock; give it generous room.
  await page.clock.runFor(30_000);

  await expect
    .poll(async () => (await readGameFacts(page)).myTurn, { timeout: 15_000 })
    .toBe(true);
  const facts = await readGameFacts(page);
  expect(facts.turn).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#aaa-turn')).toContainText('You');
  await expect(page.locator('#aaa-action-end')).toBeEnabled();
});
