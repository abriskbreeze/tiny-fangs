import { expect, test } from '@playwright/test';
import {
  APERTURE_INSET_RANGE,
  CHASSIS_HEIGHT,
  CHASSIS_WIDTH,
  NAMEPLATE,
  NAMEPLATE_FIXTURES,
  SAFE_RECTS,
} from '../../src/presentation/cards/chassis-geometry.js';

// Art bible §7 chassis gates measured on the real rendered DOM (accepted
// hash 84b89838…). These are objective geometry gates — the aesthetic
// golden-sample verdict belongs to the §13 blind critics, not this spec.

const CHASSIS_URL = '/showcase.html?mode=chassis';
const GEOMETRY_TOLERANCE_PX = 1;

async function openChassis(page) {
  await page.goto(CHASSIS_URL);
  await page.waitForFunction(() => window.__TF_CARDS_READY__ === true);
  const pageError = await page.evaluate(() => window.__TF_CARDS_ERROR__ ?? null);
  expect(pageError).toBe(null);
}

function relativeRect(cardBox, box) {
  return {
    left: box.x - cardBox.x,
    top: box.y - cardBox.y,
    right: box.x - cardBox.x + box.width,
    bottom: box.y - cardBox.y + box.height,
  };
}

const FRONT_SPECIMENS = [
  { id: 'card-creature-frame', family: 'creature' },
  { id: 'card-cast-frame', family: 'cast' },
  { id: 'card-set-frame', family: 'set' },
];

const MEASURED_RECTS = {
  cost: '.tf-aaa-card__cost',
  nameplateOuter: '.tf-aaa-card__nameplate',
  typeSubtitle: '.tf-aaa-card__type',
  familySeal: '.tf-aaa-card__seal',
  rulesText: '.tf-aaa-card__rules',
  footer: '.tf-aaa-card__footer',
  attack: '.tf-aaa-card__attack',
  health: '.tf-aaa-card__health',
};

test('front chassis renders at exactly 333 × 505 with the authored ratio', async ({ page }) => {
  await openChassis(page);
  for (const { id } of FRONT_SPECIMENS) {
    const card = page.locator(`[data-specimen="${id}"] .tf-aaa-card`);
    const box = await card.boundingBox();
    expect(box.width, id).toBeCloseTo(CHASSIS_WIDTH, 0);
    expect(box.height, id).toBeCloseTo(CHASSIS_HEIGHT, 0);
  }
});

test('§7.2 cumulative aperture inset stays within 10.5–12.5% per side', async ({ page }) => {
  await openChassis(page);
  for (const { id } of FRONT_SPECIMENS) {
    const cardBox = await page
      .locator(`[data-specimen="${id}"] .tf-aaa-card`)
      .boundingBox();
    const panelBox = await page
      .locator(`[data-specimen="${id}"] .tf-aaa-card__panel`)
      .boundingBox();
    const leftInset = panelBox.x - cardBox.x;
    const rightInset = cardBox.x + cardBox.width - (panelBox.x + panelBox.width);
    for (const inset of [leftInset, rightInset]) {
      expect(inset / cardBox.width, id).toBeGreaterThanOrEqual(
        APERTURE_INSET_RANGE.min,
      );
      expect(inset / cardBox.width, id).toBeLessThanOrEqual(
        APERTURE_INSET_RANGE.max,
      );
    }
  }
});

test('§7.3 physical art aperture proportions hold', async ({ page }) => {
  await openChassis(page);
  for (const { id } of FRONT_SPECIMENS) {
    const cardBox = await page
      .locator(`[data-specimen="${id}"] .tf-aaa-card`)
      .boundingBox();
    const artBox = await page
      .locator(`[data-specimen="${id}"] .tf-aaa-card__art`)
      .boundingBox();
    const widthFrac = artBox.width / cardBox.width;
    const heightFrac = artBox.height / cardBox.height;
    const topFrac = (artBox.y - cardBox.y) / cardBox.height;
    const endFrac = (artBox.y - cardBox.y + artBox.height) / cardBox.height;
    expect(widthFrac, id).toBeGreaterThanOrEqual(0.75);
    expect(widthFrac, id).toBeLessThanOrEqual(0.79);
    expect(heightFrac, id).toBeGreaterThanOrEqual(0.5);
    expect(heightFrac, id).toBeLessThanOrEqual(0.55);
    expect(topFrac, id).toBeGreaterThanOrEqual(0.03);
    expect(topFrac, id).toBeLessThanOrEqual(0.06);
    expect(endFrac, id).toBeGreaterThanOrEqual(0.55);
    expect(endFrac, id).toBeLessThanOrEqual(0.59);
  }
});

test('§7.4 content rectangles land on their authored coordinates', async ({ page }) => {
  await openChassis(page);
  for (const { id, family } of FRONT_SPECIMENS) {
    const cardBox = await page
      .locator(`[data-specimen="${id}"] .tf-aaa-card`)
      .boundingBox();
    for (const [rectName, selector] of Object.entries(MEASURED_RECTS)) {
      const authored = SAFE_RECTS[family][rectName];
      const locator = page.locator(`[data-specimen="${id}"] ${selector}`);
      if (!authored) {
        await expect(locator, `${family}.${rectName} must not render`).toHaveCount(0);
        continue;
      }
      const box = await locator.boundingBox();
      const rect = relativeRect(cardBox, box);
      for (const edge of ['left', 'top', 'right', 'bottom']) {
        expect(
          Math.abs(rect[edge] - authored[edge]),
          `${family}.${rectName}.${edge}: rendered ${rect[edge]} vs authored ${authored[edge]}`,
        ).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
      }
    }
  }
});

test('§7.4 nameplate fixtures render unclipped at locked 22 px type', async ({ page }) => {
  await openChassis(page);
  const alegreyaLoaded = await page.evaluate(() =>
    document.fonts.check('22px Alegreya'),
  );
  expect(alegreyaLoaded).toBe(true);

  for (const fixture of NAMEPLATE_FIXTURES) {
    const scope = `[data-nameplate-fixture="${fixture.id}"]`;
    const titleBox = await page
      .locator(`${scope} .tf-aaa-card__title`)
      .boundingBox();
    const text = page.locator(`${scope} .tf-aaa-card__title-text`);
    await expect(text).toHaveText(fixture.name);
    const textBox = await text.boundingBox();

    const fontSize = await text.evaluate(
      (node) => getComputedStyle(node).fontSize,
    );
    expect(fontSize, fixture.id).toBe(`${NAMEPLATE.fontSizePx}px`);

    // No compression/clipping: the rendered text must sit fully inside the
    // 230 × 50 text box with ≥2 px horizontal clearance each side. Vertical
    // containment allows the full two-line block (2 × 24.5 px) whose leading
    // itself provides the ink clearance.
    expect(textBox.x - titleBox.x, fixture.id).toBeGreaterThanOrEqual(
      NAMEPLATE.minClearancePx,
    );
    expect(
      titleBox.x + titleBox.width - (textBox.x + textBox.width),
      fixture.id,
    ).toBeGreaterThanOrEqual(NAMEPLATE.minClearancePx);
    expect(textBox.y, fixture.id).toBeGreaterThanOrEqual(titleBox.y - 0.5);
    expect(
      textBox.y + textBox.height,
      fixture.id,
    ).toBeLessThanOrEqual(titleBox.y + titleBox.height + 0.5);

    // Two lines maximum at the fixed 24.5 px line height.
    expect(textBox.height, fixture.id).toBeLessThanOrEqual(
      NAMEPLATE.maxLines * NAMEPLATE.lineHeightPx + 0.5,
    );

    // No scroll/ellipsis truncation.
    const overflow = await text.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));
    expect(overflow.scrollWidth, fixture.id).toBeLessThanOrEqual(
      overflow.clientWidth + 1,
    );
  }
});

test('card back renders no face data and keeps its sigil inside art-safe', async ({ page }) => {
  await openChassis(page);
  const scope = '[data-specimen="card-back"]';
  for (const selector of Object.values(MEASURED_RECTS)) {
    await expect(page.locator(`${scope} ${selector}`)).toHaveCount(0);
  }
  await expect(page.locator(`${scope} .tf-aaa-card__title-text`)).toHaveCount(0);

  const cardBox = await page.locator(`${scope} .tf-aaa-card`).boundingBox();
  const sigilBox = await page
    .locator(`${scope} .tf-aaa-card__back-sigil`)
    .boundingBox();
  const rect = relativeRect(cardBox, sigilBox);
  const artSafe = SAFE_RECTS.back.artFocalSafe;
  expect(rect.left).toBeGreaterThanOrEqual(artSafe.left - GEOMETRY_TOLERANCE_PX);
  expect(rect.top).toBeGreaterThanOrEqual(artSafe.top - GEOMETRY_TOLERANCE_PX);
  expect(rect.right).toBeLessThanOrEqual(artSafe.right + GEOMETRY_TOLERANCE_PX);
  expect(rect.bottom).toBeLessThanOrEqual(artSafe.bottom + GEOMETRY_TOLERANCE_PX);
});

test('§13.2 showcase mode places all four specimens at manifest centers', async ({ page }) => {
  await page.goto('/showcase.html');
  await page.waitForFunction(() => window.__TF_CARDS_READY__ === true);
  const expected = {
    'card-creature-frame': { x: 445, y: 578, w: 330, h: 500 },
    'card-cast-frame': { x: 833, y: 577, w: 330, h: 500 },
    'card-set-frame': { x: 1206, y: 584, w: 330, h: 500 },
    'card-back': { x: 1405, y: 575, w: 300, h: 455 },
  };
  for (const [id, target] of Object.entries(expected)) {
    const box = await page.locator(`[data-specimen="${id}"]`).boundingBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    expect(Math.abs(centerX - target.x), id).toBeLessThanOrEqual(1);
    expect(Math.abs(centerY - target.y), id).toBeLessThanOrEqual(1);
  }
});
