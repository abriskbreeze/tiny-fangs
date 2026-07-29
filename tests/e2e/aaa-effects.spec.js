import { expect, test } from '@playwright/test';

// Phase 10b — event-driven effect accents on the AAA chassis: the classic
// event-playback pipeline resolves its semantic targets into the AAA shell,
// damage/heal/KO accents land on the chassis faces, the Anim Promise
// contract survives missing targets, and reduced motion suppresses
// displacement while keeping the color-flash communication.

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

test('semantic targets resolve into the AAA shell and accents land on the chassis', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Summon so me.active exists.
  const name = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find((c) => c.cardType === 'creature' && c.cost <= state.G.me.mana).name;
  });
  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(name)).click();
  await page.clock.runFor(6_000);

  // The Anim facade resolves me.active to the AAA chassis face.
  const resolved = await page.evaluate(() => {
    const el = window.Anim.activeCardEl('me');
    return el
      ? { inAaa: Boolean(el.closest('#aaa-stage')), isChassis: el.classList.contains('tf-aaa-card') }
      : null;
  });
  expect(resolved).toEqual({ inAaa: true, isChassis: true });

  // Fire a damage accent through the SAME pipeline entry and watch the
  // classes land on the chassis (fake clock drives the timers).
  await page.evaluate(() => {
    window.__tfDamageDone = false;
    window.Anim.damage('me', 10).then(() => { window.__tfDamageDone = true; });
  });
  const flashed = await page.evaluate(() => {
    const el = window.Anim.activeCardEl('me');
    return el.classList.contains('anim-flash-red') && el.classList.contains('anim-shake');
  });
  expect(flashed).toBe(true);
  await page.clock.runFor(1_200);
  expect(await page.evaluate(() => window.__tfDamageDone)).toBe(true);
  // Accent classes cleaned up after their duration.
  expect(await page.evaluate(() => {
    const el = window.Anim.activeCardEl('me');
    return el.classList.contains('anim-flash-red') || el.classList.contains('anim-shake');
  })).toBe(false);

  // Heal accent lands green on the same chassis.
  await page.evaluate(() => { window.Anim.heal('me', 10); });
  expect(await page.evaluate(() =>
    window.Anim.activeCardEl('me').classList.contains('anim-flash-green'))).toBe(true);
  await page.clock.runFor(600);
});

test('a real attack plays a damage accent on the defender chassis during playback', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // Build to an attack-legal state with a defender present.
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

  // Attack, then step the fake clock in small increments watching for the
  // accent to land on the DEFENDER chassis mid-playback.
  await page.locator('#aaa-action-attack').click();
  let sawAccent = false;
  for (let i = 0; i < 60 && !sawAccent; i++) {
    sawAccent = await page.evaluate(() => {
      const el = window.Anim.activeCardEl('opp');
      return Boolean(el && (
        el.classList.contains('anim-flash-red')
        || el.classList.contains('anim-shake')
        || el.classList.contains('anim-ko')
      ));
    });
    if (!sawAccent) await page.clock.runFor(100);
  }
  expect(sawAccent).toBe(true);
  await page.clock.runFor(15_000);
});

test('every accent resolves even when its target is missing (Promise contract)', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await startSoloGameGoingFirst(page);

  // No opp active exists at game start; every facade call must still resolve.
  await page.evaluate(() => {
    window.__tfResolved = 0;
    const track = (p) => p.then(() => { window.__tfResolved += 1; });
    track(window.Anim.damage('opp', 5));
    track(window.Anim.heal('opp', 5));
    track(window.Anim.ko('opp'));
    track(window.Anim.benchDamage('opp', 1, 5));
    track(window.Anim.benchKo('opp', 1));
  });
  await page.clock.runFor(3_000);
  expect(await page.evaluate(() => window.__tfResolved)).toBe(5);
});

test('reduced motion keeps the color flash but suppresses displacement', async ({ context, page }) => {
  await installDeterministicBrowser(context, page, [0.1]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startSoloGameGoingFirst(page);

  const name = await page.evaluate(async () => {
    const { state } = await import('/src/state.js');
    return state.G.me.hand.find((c) => c.cardType === 'creature' && c.cost <= state.G.me.mana).name;
  });
  await page.locator('#aaa-action-summon').click();
  await modalOption(page, new RegExp(name)).click();
  await page.clock.runFor(6_000);

  await page.evaluate(() => { window.Anim.damage('me', 10); });
  const styles = await page.evaluate(() => {
    const el = window.Anim.activeCardEl('me');
    el.classList.add('anim-shake'); // ensure class present for the style probe
    const computed = getComputedStyle(el);
    return {
      hasFlash: el.classList.contains('anim-flash-red'),
      shakeAnimation: computed.animationName,
    };
  });
  // Flash class still applied (communication); shake animation suppressed.
  expect(styles.hasFlash).toBe(true);
  expect(styles.shakeAnimation).toBe('none');
  await page.clock.runFor(1_200);
});
