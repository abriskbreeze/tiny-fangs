import { expect, test } from '@playwright/test';

// Status-effect and reveal coverage on the AAA chassis (behavior matrix rows
// STA-01..STA-04, STA-08, OVR-10): poison application + the exact 10-damage
// tick at the owner's end turn, trapped blocking retreat and clearing at end
// turn, fortified and unbreakable charms, the Last Breath browser reveal, and
// the reveal auto-timeout path (no key dismissal).

test.use({ viewport: { width: 1672, height: 941 } });

const AAA_URL = '/?presentation=aaa';
const STATUS_FIXTURE_URL = '/?presentation=aaa&visualQa=1&behaviorQa=1&fixture=dense-board-statuses';
const COIN_FLIP_DURATION_MS = 1_780;
const BEGIN_DURATION_MS = 1_330;
// showCastReveal auto-dismisses on its own hardcoded 2500ms timer;
// showTriggerReveal uses ANIM_TIMING.TRIGGER_REVEAL = 5000.
const CAST_REVEAL_TIMEOUT_MS = 2_500;
const TRIGGER_REVEAL_TIMEOUT_MS = 5_000;
// dismissTriggerReveal resolves the reveal Promise on a 300ms close-animation
// delay after the modal's open class is removed.
const REVEAL_SETTLE_DELAY_MS = 300;

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

function modalOption(page, pattern) {
  return page.locator('#modal-opts .option').filter({ hasText: pattern }).first();
}

async function startSoloGameGoingFirst(page, myDeck = 'Shadow') {
  await page.goto(AAA_URL);
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));
  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: new RegExp(`\\b${myDeck}\\b`) }).first().click();
  await modalOption(page, /\bShadow\b/).click();
  await modalOption(page, /HEADS/).click();
  await page.clock.runFor(COIN_FLIP_DURATION_MS);
  await modalOption(page, /Go First/).click();
  await page.clock.runFor(BEGIN_DURATION_MS + 2_000);
  await expect
    .poll(() => page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G?.myTurn ?? null;
    }))
    .toBe(true);
}

// The classic action entries silently no-op while state.animating is true;
// step the fake clock until the playback settles before pressing anything.
async function settleAnimations(page) {
  for (let i = 0; i < 20; i++) {
    const animating = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.animating === true;
    });
    if (!animating) return;
    await page.clock.runFor(2_000);
  }
}

async function summonByName(page, name) {
  await settleAnimations(page);
  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(name)).click();
  await page.clock.runFor(6_000);
}

async function castByName(page, name) {
  await settleAnimations(page);
  await page.locator('#aaa-action-cast').click();
  await modalOption(page, new RegExp(name)).click();
  await page.clock.runFor(8_000);
}

// End my turn and drive the fake clock until the rival's turn has fully
// played out (state.G.turn advances when the turn returns to me). Re-clicks
// the end button if the animating guard swallowed it, and answers any
// pending prompt modals along the way.
async function endTurnAndRunRival(page) {
  const before = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.turn;
  });
  for (let attempt = 0; attempt < 40; attempt++) {
    const st = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return {
        turn: state.G.turn,
        myTurn: state.G.myTurn,
        winner: state.G.winner ?? null,
        animating: state.animating === true,
      };
    });
    if (st.winner !== null) return;
    if (st.turn > before && st.myTurn) return;
    if (await page.locator('#modal.open').count()) {
      await page.locator('#modal-opts .option:not(.off)').first().click();
    } else if (st.myTurn && st.turn === before && !st.animating) {
      await page.locator('#aaa-action-end').click();
    }
    await page.clock.runFor(4_000);
  }
  throw new Error('rival turn did not complete under the fake clock');
}

// Move the named cards (in draw order) to the top of my deck. The shared
// engine draws with deck.pop(), so the first id listed is the next card
// drawn. This only reorders the deterministic shuffle — every application
// of a status below still travels the real summon/cast/attack pipeline.
async function stackMyDeckTop(page, ids) {
  await page.evaluate(async (wanted) => {
    const { state } = await import('/src/state.js');
    const me = state.G.me;
    const need = [...wanted];
    const keep = [];
    const pulled = [];
    for (const card of me.deck) {
      const at = need.indexOf(card.id);
      if (at >= 0) {
        need.splice(at, 1);
        pulled.push(card);
      } else {
        keep.push(card);
      }
    }
    pulled.sort((a, b) => wanted.indexOf(a.id) - wanted.indexOf(b.id));
    me.deck = [...keep, ...pulled.reverse()];
  }, ids);
}

// ─────────────────────────────────────────────────────────────────
// STA-01 / STA-02 / STA-04 — fixture-mounted charms over engine truth
// ─────────────────────────────────────────────────────────────────

test('dense-board-statuses fixture shows poison, trapped, and ward charms over engine truth', async ({ page }) => {
  await page.goto(STATUS_FIXTURE_URL);
  await expect(page.locator('#aaa-stage .aaa-frame')).toBeVisible({ timeout: 15_000 });

  // Engine truth mounted by the fixture.
  const truth = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return {
      myActiveStatus: state.G.me.active?.status ?? null,
      oppActiveStatus: state.G.opp.active?.status ?? null,
      myUnbreakable: state.G.me.unbreakable === true,
      oppUnbreakable: state.G.opp.unbreakable === true,
    };
  });
  expect(truth).toEqual({
    myActiveStatus: 'poison',
    oppActiveStatus: 'trapped',
    myUnbreakable: true,
    oppUnbreakable: false,
  });

  // Charms rendered on the status rails next to the active quads.
  const poison = page.locator('.aaa-status-charm[aria-label="poisoned"]');
  await expect(poison).toBeVisible();
  await expect(poison).toHaveText('psn');
  const trapped = page.locator('.aaa-status-charm[aria-label="trapped"]');
  await expect(trapped).toBeVisible();
  await expect(trapped).toHaveText('trp');

  // Ward charm sits on MY vitals only (the fixture's rival is not warded).
  const myWard = page.locator('.aaa-vitals[data-side="me"] .aaa-ward-charm');
  await expect(myWard).toBeVisible();
  await expect(myWard).toHaveText('ward');
  await expect(page.locator('.aaa-vitals[data-side="opp"] .aaa-ward-charm')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────
// STA-01 — live poison via Hexweaver, exact 10 tick at owner end turn
// ─────────────────────────────────────────────────────────────────

test('hexweaver applies poison visibly and it ticks exactly 10 at the owner end turn', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page, 'Venom');
  // Surface both Hexweavers early; the poison itself is applied by a real
  // attack through the shared trigger pipeline.
  await stackMyDeckTop(page, ['hexweaver', 'hexweaver']);

  let poisoned = null;
  for (let i = 0; i < 10 && !poisoned; i++) {
    const f = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      const G = state.G;
      return {
        myTurn: G.myTurn,
        winner: G.winner ?? null,
        firstTurn: G.firstTurn,
        attacked: G.hasAttacked,
        activeId: G.me.active?.id ?? null,
        oppActive: G.opp.active
          ? { uid: G.opp.active.uid, status: G.opp.active.status ?? null, curHp: G.opp.active.curHp }
          : null,
        hexAffordable: G.me.hand.some((c) => c.id === 'hexweaver' && c.cost <= G.me.mana),
        blocker: G.me.hand.find(
          (c) => c.cardType === 'creature' && c.id !== 'hexweaver' && c.cost <= G.me.mana,
        )?.name ?? null,
      };
    });
    expect(f.winner).toBeNull();
    if (f.oppActive?.status === 'poison') {
      poisoned = { uid: f.oppActive.uid, curHp: f.oppActive.curHp };
      break;
    }
    if (f.myTurn && f.activeId === 'hexweaver' && f.oppActive && !f.firstTurn && !f.attacked) {
      await settleAnimations(page);
      await page.locator('#aaa-action-attack').click();
      await page.clock.runFor(9_000);
      continue;
    }
    if (f.myTurn && !f.activeId && f.hexAffordable) {
      await summonByName(page, 'Hexweaver');
      continue;
    }
    if (f.myTurn && !f.activeId && f.blocker) {
      await summonByName(page, f.blocker);
      continue;
    }
    await endTurnAndRunRival(page);
  }
  expect(poisoned).not.toBeNull();

  // Poison is applied VISIBLY: the psn charm hangs on the rival active quad.
  const charm = page.locator('.aaa-status-charm[aria-label="poisoned"]');
  await expect(charm).toBeVisible();
  await expect(charm).toHaveText('psn');

  // The owner of the poisoned creature is the rival; their end turn is when
  // the tick lands. Hand the turn over, let the AI play out and end it, then
  // do exact curHp accounting over the rival's turn: the ONLY hp changes to
  // the poisoned creature must be the single 10-damage poison tick, netted
  // against any logged heals its own plays caused (e.g. lifesteal attacks).
  await endTurnAndRunRival(page);

  const after = await page.evaluate(async ({ uid }) => {
    const { state } = await import('/src/state.js');
    const G = state.G;
    const zones = [
      ['active', G.opp.active ? [G.opp.active] : []],
      ['bench', G.opp.bench ?? []],
      ['grave', G.opp.grave ?? []],
    ];
    let found = null;
    for (const [zone, cards] of zones) {
      const card = cards.find((c) => c?.uid === uid);
      if (card) found = { zone, curHp: card.curHp, status: card.status ?? null };
    }
    const lines = G.log.map((entry) => entry.t);
    const rivalTurnStart = lines.lastIndexOf('-- Rival turn --');
    const suffix = lines.slice(rivalTurnStart + 1);
    const damageLines = suffix.filter((t) => /: \d+ damage$/.test(t));
    const healedHp = suffix
      .map((t) => /^Healed (\d+) HP!$/.exec(t))
      .filter(Boolean)
      .reduce((sum, m) => sum + Number(m[1]), 0);
    return { ...found, damageLines, healedHp };
  }, { uid: poisoned.uid });

  // Exactly one poison tick of exactly 10 landed at the owner's end turn,
  // and no other damage source touched the board during the rival's turn.
  expect(after.damageLines).toEqual(['Poison: 10 damage']);
  expect(after.status).toBe('poison');
  expect(after.zone).toBe('active');
  expect(after.curHp).toBe(poisoned.curHp + after.healedHp - 10);
});

// ─────────────────────────────────────────────────────────────────
// STA-02 — trapped charm, retreat blocked, cleared at end turn
// ─────────────────────────────────────────────────────────────────

test('trapped shows its charm, blocks retreat at both layers, and clears at end turn', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page, 'Shadow');
  // Surface two cheap creatures so the board is reachable within budget.
  await stackMyDeckTop(page, ['whisper', 'whisper', 'gloom']);

  // Reach a my-turn state with an active creature and a second creature in
  // hand (the bench summon after the status lands re-renders the shell so
  // the trp charm is observable).
  let ready = false;
  let activeUid = null;
  for (let i = 0; i < 8 && !ready; i++) {
    const f = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      const G = state.G;
      return {
        myTurn: G.myTurn,
        winner: G.winner ?? null,
        activeUid: G.me.active?.uid ?? null,
        benchLen: G.me.bench.length,
        affordable: G.me.hand.find(
          (c) => c.cardType === 'creature' && c.cost <= G.me.mana,
        )?.name ?? null,
      };
    });
    expect(f.winner).toBeNull();
    if (f.myTurn && f.activeUid && f.benchLen < 2 && f.affordable) {
      ready = true;
      activeUid = f.activeUid;
      // The trapped status is set directly on the authoritative solo state
      // (the AI applying Bog Grasp to us is not deterministically reachable);
      // everything asserted AFTER this line — the charm render, both retreat
      // rejections, and the end-turn clear — runs the real engine paths.
      await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        state.G.me.active.status = 'trapped';
      });
      await summonByName(page, f.affordable);
      break;
    }
    if (f.myTurn && !f.activeUid && f.affordable) {
      await summonByName(page, f.affordable);
      continue;
    }
    await endTurnAndRunRival(page);
  }
  expect(ready).toBe(true);

  // The trp charm is visible on the chassis.
  const charm = page.locator('.aaa-status-charm[aria-label="trapped"]');
  await expect(charm).toBeVisible();
  await expect(charm).toHaveText('trp');

  // UI layer: the retreat rail refuses to open the replacement modal.
  await settleAnimations(page);
  await page.locator('#aaa-action-retreat').click();
  await page.clock.runFor(1_000);
  await expect(page.locator('#modal')).not.toHaveClass(/\bopen\b/);
  const uiLog = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.log.map((entry) => entry.t);
  });
  expect(uiLog).toContain('Cannot retreat - trapped!');

  // Engine layer: a forced retreat dispatch is rejected and the board holds.
  await page.evaluate(() => window.dispatchAction('retreat', { benchIdx: 0 }));
  await page.clock.runFor(2_000);
  const engine = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return {
      activeUid: state.G.me.active?.uid ?? null,
      status: state.G.me.active?.status ?? null,
      log: state.G.log.map((entry) => entry.t),
    };
  });
  expect(engine.activeUid).toBe(activeUid);
  expect(engine.status).toBe('trapped');
  expect(engine.log).toContain('Active creature is trapped');

  // Trapped clears at the owner's end turn and the charm comes down.
  await endTurnAndRunRival(page);
  const cleared = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const G = state.G;
    const mine = [G.me.active, ...G.me.bench].filter(Boolean);
    return mine.some((c) => c.status === 'trapped');
  });
  expect(cleared).toBe(false);
  await expect(page.locator('.aaa-status-charm[aria-label="trapped"]')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────
// STA-03 / STA-04 — fortified charm and unbreakable ward via real casts
// ─────────────────────────────────────────────────────────────────

test('fortify hangs the frt charm and unbreakable hangs the ward charm via real casts', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page, 'Shell');
  await stackMyDeckTop(page, ['fortify', 'unbreakable']);

  let fortifiedSeen = false;
  let wardSeen = false;
  for (let i = 0; i < 14 && !(fortifiedSeen && wardSeen); i++) {
    const f = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      const G = state.G;
      return {
        myTurn: G.myTurn,
        winner: G.winner ?? null,
        mana: G.me.mana,
        active: G.me.active
          ? { fortified: G.me.active.fortified === true }
          : null,
        unbreakable: G.me.unbreakable === true,
        hasFortify: G.me.hand.some((c) => c.id === 'fortify'),
        hasUnbreakable: G.me.hand.some((c) => c.id === 'unbreakable'),
        affordable: G.me.hand.find(
          (c) => c.cardType === 'creature' && c.cost <= G.me.mana,
        )?.name ?? null,
      };
    });
    expect(f.winner).toBeNull();
    if (!f.myTurn) {
      await page.clock.runFor(8_000);
      continue;
    }
    if (!f.active && f.affordable) {
      await summonByName(page, f.affordable);
      continue;
    }
    if (!fortifiedSeen && f.active && !f.active.fortified && f.hasFortify && f.mana >= 2) {
      await castByName(page, 'Fortify');
      const fortified = await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        return state.G.me.active?.fortified === true;
      });
      expect(fortified).toBe(true);
      const charm = page.locator('.aaa-status-charm[aria-label="fortified"]');
      await expect(charm).toBeVisible();
      await expect(charm).toHaveText('frt');
      fortifiedSeen = true;
      continue;
    }
    if (!wardSeen && !f.unbreakable && f.hasUnbreakable && f.mana >= 3) {
      await castByName(page, 'Unbreakable');
      const unbreakable = await page.evaluate(async () => {
        const { state } = await import('/src/state.js');
        return state.G.me.unbreakable === true;
      });
      expect(unbreakable).toBe(true);
      const ward = page.locator('.aaa-vitals[data-side="me"] .aaa-ward-charm');
      await expect(ward).toBeVisible();
      await expect(ward).toHaveText('ward');
      wardSeen = true;
      continue;
    }
    await endTurnAndRunRival(page);
  }
  expect(fortifiedSeen).toBe(true);
  expect(wardSeen).toBe(true);
});

// ─────────────────────────────────────────────────────────────────
// OVR-10 / STA-08 — reveal auto-timeout path and Last Breath reveal
// ─────────────────────────────────────────────────────────────────

test('cast reveal auto-dismisses on its own timer with no key pressed', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page, 'Shadow');

  await page.evaluate(() => {
    window.__tfCastRevealDone = false;
    window
      .showCastReveal({ name: 'Soul Siphon', text: 'Drain 20 HP.', cost: 2, type: 'cast' })
      .then(() => { window.__tfCastRevealDone = true; });
  });
  const modal = page.locator('#triggerModal');
  await expect(modal).toHaveClass(/\bopen\b/);

  // No keys, no clicks: still open one tick before the timeout, closed and
  // settled exactly at it.
  await page.clock.runFor(CAST_REVEAL_TIMEOUT_MS - 1);
  await expect(modal).toHaveClass(/\bopen\b/);
  expect(await page.evaluate(() => window.__tfCastRevealDone)).toBe(false);
  await page.clock.runFor(1);
  await expect(modal).not.toHaveClass(/\bopen\b/);
  await page.clock.runFor(REVEAL_SETTLE_DELAY_MS);
  expect(await page.evaluate(() => window.__tfCastRevealDone)).toBe(true);
});

test('last breath trigger reveal displays in the browser and settles on auto-timeout', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page, 'Shadow');

  await page.evaluate(async () => {
    const { VERSES } = await import('/shared/cards.js');
    window.__tfLastBreathDone = false;
    window
      .showTriggerReveal(VERSES.lastBreath)
      .then(() => { window.__tfLastBreathDone = true; });
  });
  const modal = page.locator('#triggerModal');
  await expect(modal).toHaveClass(/\bopen\b/);
  const content = page.locator('#triggerContent');
  await expect(content).toContainText('Last Breath');
  await expect(content).toContainText('When you would lose your last life');
  await expect(content).toContainText('Survive with 1 life instead. Once per game.');

  // Auto-timeout at ANIM_TIMING.TRIGGER_REVEAL with no key pressed.
  await page.clock.runFor(TRIGGER_REVEAL_TIMEOUT_MS - 1);
  await expect(modal).toHaveClass(/\bopen\b/);
  expect(await page.evaluate(() => window.__tfLastBreathDone)).toBe(false);
  await page.clock.runFor(1);
  await expect(modal).not.toHaveClass(/\bopen\b/);
  await page.clock.runFor(REVEAL_SETTLE_DELAY_MS);
  expect(await page.evaluate(() => window.__tfLastBreathDone)).toBe(true);
});
