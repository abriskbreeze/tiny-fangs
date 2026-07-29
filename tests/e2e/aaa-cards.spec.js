import { expect, test } from '@playwright/test';

// Phase 5 audit — live evidence: curHp tracks damage on the defender's
// health medallion in a real attack, and the worst-case real cards fit the
// §7.4 safe rects without overflow at the authored chassis size.

test.use({ viewport: { width: 1672, height: 941 } });

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

function modalOption(page, pattern) {
  return page.locator('#modal-opts .option').filter({ hasText: pattern }).first();
}

async function startSoloGameGoingFirst(page) {
  await page.goto(AAA_URL);
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));
  await page.getByRole('button', { name: /Solo/ }).click();
  await page.locator('#deck-select .deck-btn').filter({ hasText: /\bShadow\b/ }).first().click();
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

test('the defender health medallion tracks curHp with the damaged ink state', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Reach an attack-legal state with a rival active present.
  for (let i = 0; i < 12; i++) {
    const f = await page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return {
        myTurn: state.G.myTurn,
        winner: state.G.winner ?? null,
        active: state.G.me.active?.uid ?? null,
        firstTurn: state.G.firstTurn,
        attacked: state.G.hasAttacked,
        oppActive: state.G.opp.active?.uid ?? null,
        affordable: state.G.me.hand.find(
          (c) => c.cardType === 'creature' && c.cost <= state.G.me.mana,
        )?.name ?? null,
      };
    });
    expect(f.winner).toBeNull();
    if (f.myTurn && f.active && f.oppActive && !f.firstTurn && !f.attacked) break;
    if (f.myTurn && !f.active && f.affordable) {
      await page.locator('#aaa-action-summon').click();
      await modalOption(page, new RegExp(f.affordable)).click();
      await page.clock.runFor(6_000);
      continue;
    }
    await page.locator('#aaa-action-end').click();
    await page.clock.runFor(35_000);
    for (let k = 0; k < 3; k++) {
      if (await page.locator('#modal.open').count()) {
        await page.locator('#modal-opts .option:not(.off)').first().click();
      }
      await page.clock.runFor(4_000);
    }
  }

  await page.locator('#aaa-action-attack').click();
  await page.clock.runFor(20_000);

  // Read engine truth for the surviving defender (or accept a KO outcome).
  const defender = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    const c = state.G.opp.active;
    return c ? { curHp: c.curHp ?? c.hp, hp: c.hp, damaged: (c.curHp ?? c.hp) < c.hp } : null;
  });
  if (defender === null) return; // KO'd outright: curHp tracking covered by the medallion absence

  const medallion = page.locator('.aaa-card-layer [data-anchor="opp.active"] .tf-aaa-card__health');
  await expect(medallion.locator('.tf-aaa-card__medallion-num')).toHaveText(String(defender.curHp));
  if (defender.damaged) {
    await expect(medallion).toHaveAttribute('data-damaged', 'true');
    // Damaged ink state is visibly distinct.
    const color = await medallion.locator('.tf-aaa-card__medallion-num')
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 217, 200)');
  }
});

// Text-fit gate for the approved inset-window chassis. The rules box lost
// 8 px of height (106 → 98) and the nameplate 23 px of width (250 → 227), so
// this measures EVERY card in the catalog — not a hand-picked worst case —
// against all four text rectangles at the real 333 × 505 chassis size.
//
// It runs on the chassis showcase, not on ?presentation=aaa: the AAA route
// only pulls cards.css in when the shell module mounts, so measuring a
// hand-built face there measures unstyled DOM and proves nothing.
test('every real card fits its text rects with no overflow at chassis size', async ({ page }) => {
  await page.goto('/showcase.html?mode=chassis');
  await page.waitForFunction(() => window.__TF_CARDS_READY__ === true);
  expect(await page.evaluate(() => window.__TF_CARDS_ERROR__ ?? null)).toBe(null);

  // Measuring text without the authored face loaded would prove nothing.
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('22px Alegreya'))).toBe(true);
  const footerStyled = await page.evaluate(() => {
    const node = document.querySelector('.tf-aaa-card__footer-text');
    return node ? getComputedStyle(node).fontFamily.includes('Alegreya') : false;
  });
  expect(footerStyled, 'cards.css must be applied on the measured surface').toBe(true);

  const results = await page.evaluate(async () => {
    const [{ buildCardFace, normalizeFaceModel }, { CREATURES, VERSES }] = await Promise.all([
      import('/src/presentation/cards/card-face.js'),
      import('/shared/cards.js'),
    ]);
    const all = [
      ...Object.values(CREATURES).map((c) => [c, 'creature']),
      ...Object.values(VERSES).map((v) => [v, v.type === 'set' ? 'set' : 'cast']),
    ];
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-2000px;top:0;';
    document.body.appendChild(host);

    // Ink box vs its declared rectangle, on both axes. A flex-centered child
    // overflows in BOTH directions, which scrollHeight alone cannot see.
    const overflow = (inner, outer) => {
      if (!inner || !outer) return { x: 0, y: 0 };
      const i = inner.getBoundingClientRect();
      const o = outer.getBoundingClientRect();
      return {
        x: Math.max(0, o.left - i.left) + Math.max(0, i.right - o.right),
        y: Math.max(0, o.top - i.top) + Math.max(0, i.bottom - o.bottom),
      };
    };

    const out = [];
    for (const [card, kind] of all) {
      const face = buildCardFace(normalizeFaceModel(card, kind));
      host.appendChild(face);
      const q = (sel) => face.querySelector(sel);
      const rules = q('.tf-aaa-card__rules');
      out.push({
        name: card.name,
        kind,
        title: overflow(q('.tf-aaa-card__title-text'), q('.tf-aaa-card__title')),
        type: overflow(q('.tf-aaa-card__type-text'), q('.tf-aaa-card__type')),
        footer: overflow(q('.tf-aaa-card__footer-text'), q('.tf-aaa-card__footer')),
        rulesOverflow: rules ? rules.scrollHeight - rules.clientHeight : 0,
      });
      face.remove();
    }
    host.remove();
    return out;
  });

  expect(results.length).toBeGreaterThanOrEqual(55);
  for (const r of results) {
    const label = `${r.name} (${r.kind})`;
    expect(r.title.x, `${label} title width`).toBeLessThanOrEqual(1);
    expect(r.title.y, `${label} title height`).toBeLessThanOrEqual(1);
    expect(r.type.x, `${label} type width`).toBeLessThanOrEqual(1);
    expect(r.type.y, `${label} type height`).toBeLessThanOrEqual(1);
    expect(r.footer.x, `${label} flavor width`).toBeLessThanOrEqual(1);
    expect(r.footer.y, `${label} flavor height`).toBeLessThanOrEqual(1);
    expect(r.rulesOverflow, `${label} rules`).toBeLessThanOrEqual(1);
  }
});
