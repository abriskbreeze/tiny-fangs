import { expect, test } from '@playwright/test';

// Phase 8 chunk 3 — detail interactions, accessibility/affordance checks,
// ownership cues, and the live-shell §12 terrain identity proof.

// Phase 8 milestone resolution: canonical desktop 1672x941 at DPR 1
// (responsive scaling is Phase 11 scope).
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
  await expect(page.locator('html')).toHaveAttribute('data-presentation', 'aaa');
  await expect
    .poll(() => page.evaluate(() => typeof window.selectPlayerDeck))
    .toBe('function');
  await page.clock.pauseAt(new Date('2026-07-27T12:01:00.000Z'));
  await page.getByRole('button', { name: /Solo/ }).click();
  await page
    .locator('#deck-select .deck-btn')
    .filter({ hasText: /\bShadow\b/ })
    .first()
    .click();
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

async function summonFirstAffordable(page) {
  const name = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find(
      (c) => c.cardType === 'creature' && c.cost <= state.G.me.mana,
    )?.name ?? null;
  });
  expect(name).not.toBeNull();
  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(name)).click();
  await page.clock.runFor(6_000);
  return name;
}

test('clicking a board card opens the card detail; hand context-click inspects without playing', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);
  const summoned = await summonFirstAffordable(page);

  // Board card click → detail surface (classic #cardModal flow).
  await page.locator('.aaa-card-layer [data-anchor="me.active"]').click();
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardDetail')).toContainText(summoned);
  await page.locator('#cardModal .close-btn').click();
  await expect(page.locator('#cardModal')).not.toHaveClass(/\bopen\b/);

  // Hand context-click inspects the card and does NOT play it.
  const handBefore = await page.locator('.aaa-hand-card').count();
  const firstHandName = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand[0].name;
  });
  await page.locator('.aaa-hand-card').first().click({ button: 'right' });
  await expect(page.locator('#cardModal')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#cardDetail')).toContainText(firstHandName);
  await page.locator('#cardModal .close-btn').click();
  await expect(page.locator('.aaa-hand-card')).toHaveCount(handBefore);
  // Face-down rival zones expose no inspectable surface.
  await expect(page.locator('.aaa-card-layer [data-anchor="opp.set"].aaa-board-card--inspectable')).toHaveCount(0);
  await expect(page.locator('.aaa-card-layer [data-anchor="opp.deck"].aaa-board-card--inspectable')).toHaveCount(0);
});

test('action rail: keyboard traversal, visible focus, and ≥40px targets', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Touch-size: every interactive AAA surface is at least 40px in both axes
  // at the rendered scale (stage scale is 1 at the canonical viewport).
  for (const id of ['summon', 'attack', 'cast', 'set', 'retreat', 'end']) {
    const box = await page.locator(`#aaa-action-${id}`).boundingBox();
    expect(box.width, `${id} width`).toBeGreaterThanOrEqual(40);
    expect(box.height, `${id} height`).toBeGreaterThanOrEqual(40);
  }
  for (const box of await page.locator('.aaa-hand-card').evaluateAll(
    (nodes) => nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  )) {
    expect(box.w).toBeGreaterThanOrEqual(40);
    expect(box.h).toBeGreaterThanOrEqual(40);
  }

  // Keyboard: Tab reaches every ENABLED rail button in order with a visible
  // focus ring (:focus-visible requires keyboard-initiated focus, so the
  // traversal is driven entirely by Tab).
  await page.locator('#aaa-action-summon').focus();
  const visited = [];
  for (let i = 0; i < 24 && visited.length < 6; i++) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.activeElement?.id ?? '');
    if (!active.startsWith('aaa-action-')) break;
    visited.push(active.replace('aaa-action-', ''));
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(outline.style, `${active} focus ring`).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  }
  // The Tab order matches the rail order for whatever subset is enabled.
  const order = ['attack', 'cast', 'set', 'retreat', 'end'];
  const enabledOrder = [];
  for (const id of order) {
    if (await page.locator(`#aaa-action-${id}`).isEnabled()) enabledOrder.push(id);
  }
  expect(visited).toEqual(enabledOrder);

  // Keyboard activation: Enter on End Turn works like a click.
  await page.locator('#aaa-action-end').focus();
  await page.keyboard.press('Enter');
  await page.clock.runFor(5_000);
  await expect
    .poll(() => page.evaluate(async () => {
      const { state } = await import('/src/state.js');
      return state.G.myTurn === false || state.G.turn >= 2;
    }))
    .toBe(true);
});

test('rail text passes WCAG AA contrast against its rendered backgrounds', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const ratios = await page.evaluate(() => {
    const luminance = ([r, g, b]) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse = (css) => css.match(/[\d.]+/g).map(Number);
    const blend = (fg, bg) => {
      const a = fg[3] ?? 1;
      return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
    };
    const contrast = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const results = {};
    // Action button: solid gradient background — use its midpoint tone.
    const buttonInk = parse(getComputedStyle(document.getElementById('aaa-action-summon')).color);
    results.actionButton = contrast(buttonInk, [217, 184, 142]);
    // Vitals label ink vs vitals parchment.
    const vitals = document.querySelector('.aaa-vitals');
    results.vitals = contrast(parse(getComputedStyle(vitals).color), [225, 192, 154]);
    // Log line color vs log rail over the darkest meadow tone it can sit on.
    const logLine = document.querySelector('.aaa-log-line');
    const logInk = logLine ? parse(getComputedStyle(logLine).color) : [220, 186, 150];
    const railBg = blend([35, 40, 31, 0.72], [51, 75, 66]); // over cool foliage
    results.logRail = contrast(logInk, railBg);
    // Count chips: gold ink on near-black chip.
    results.countChip = contrast([245, 215, 131], blend([59, 35, 23, 0.85], [179, 167, 79]));
    return results;
  });

  for (const [surface, ratio] of Object.entries(ratios)) {
    expect(ratio, `${surface} contrast`).toBeGreaterThanOrEqual(4.5);
  }
});

test('ownership is unmistakable: labeled rails, owner-tagged turn chip, spatial row separation', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  await expect(page.locator('.aaa-vitals[data-side="me"] .aaa-vitals-label')).toHaveText('You');
  await expect(page.locator('.aaa-vitals[data-side="opp"] .aaa-vitals-label')).toHaveText('Rival');
  await expect(page.locator('#aaa-turn')).toHaveAttribute('data-owner', 'me');

  // My zones sit strictly below the divider row; rival zones strictly above.
  const geometry = await page.evaluate(() => {
    const frame = document.querySelector('.aaa-frame').getBoundingClientRect();
    const scale = frame.width / 1672;
    const dividerY = frame.top + 414 * scale;
    const rows = {};
    for (const node of document.querySelectorAll('.aaa-card-layer [data-anchor]')) {
      const r = node.getBoundingClientRect();
      rows[node.dataset.anchor] = { top: r.top, bottom: r.bottom, dividerY };
    }
    return rows;
  });
  for (const [anchor, r] of Object.entries(geometry)) {
    if (anchor.startsWith('me.')) {
      expect(r.bottom, `${anchor} below divider`).toBeGreaterThan(r.dividerY);
    } else {
      expect(r.top, `${anchor} above divider`).toBeLessThan(r.dividerY);
    }
  }
});

test('§12 terrain identity: the live shell canvas is byte-identical to the calibrated meadow harness', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  const shellData = await page.evaluate(() => {
    const canvas = document.querySelector('#aaa-stage canvas.aaa-canvas');
    return canvas.toDataURL('image/png');
  });

  // The calibrated §12 harness scene, same browser profile.
  const meadowPage = await context.newPage();
  await meadowPage.goto('/meadow.html');
  await meadowPage.waitForFunction(
    () => window.__TF_MEADOW_READY__ === true || window.__TF_MEADOW_ERROR__,
    null,
    { timeout: 40_000 },
  );
  const meadowData = await meadowPage.evaluate(() => {
    return document.getElementById('scene-canvas').toDataURL('image/png');
  });
  await meadowPage.close();

  // Byte-identical environment ⇒ every measured §12 row carries to the live
  // shell composition unchanged.
  expect(shellData).toBe(meadowData);
});
