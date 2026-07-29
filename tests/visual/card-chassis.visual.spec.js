import { expect, test } from '@playwright/test';
import {
  ART_WINDOW_RATIO,
  CHASSIS_HEIGHT,
  CHASSIS_WIDTH,
  FRAME_INSET_RANGE,
  NAMEPLATE,
  NAMEPLATE_FIXTURES,
  SAFE_RECTS,
} from '../../src/presentation/cards/chassis-geometry.js';

// Art bible §7 chassis gates measured on the real rendered DOM (accepted
// hash 84b89838…, retargeted to the approved 2026-07-29 inset-window layout).
// These are objective geometry gates — the aesthetic golden-sample verdict
// belongs to the §13 blind critics, not this spec.

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
  titleText: '.tf-aaa-card__title',
  artFocalSafe: '.tf-aaa-card__art',
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

// §7.2 frame construction: 21 → 15 → 13 → 3 → 1 at insets 6 / 2 / 10 / 2,
// cumulative 20 px = 6.006% per side.
const FRAME_LAYERS = [
  { selector: '.tf-aaa-card', inset: 0, radius: 21 },
  { selector: '.tf-aaa-card__keyline', inset: 6, radius: 15 },
  { selector: '.tf-aaa-card__rail', inset: 2, radius: 13 },
  { selector: '.tf-aaa-card__inner-keyline', inset: 10, radius: 3 },
  { selector: '.tf-aaa-card__panel', inset: 2, radius: 1 },
];

test('§7.2 frame layers stay concentric and inset 5.5–7.0% per side', async ({ page }) => {
  await openChassis(page);
  for (const { id } of FRONT_SPECIMENS) {
    const cardBox = await page
      .locator(`[data-specimen="${id}"] .tf-aaa-card`)
      .boundingBox();

    // Each layer's radius is its parent's minus that layer's own inset, so
    // every corner is a true offset of the 21 px physical corner.
    let cumulative = 0;
    let parentRadius = null;
    for (const layer of FRAME_LAYERS) {
      const locator = page.locator(`[data-specimen="${id}"] ${layer.selector}`);
      const box = await locator.boundingBox();
      cumulative += layer.inset;
      expect(box.x - cardBox.x, `${id} ${layer.selector} inset`).toBeCloseTo(
        cumulative,
        0,
      );
      const radius = await locator.evaluate(
        (node) => parseFloat(getComputedStyle(node).borderTopLeftRadius),
      );
      expect(radius, `${id} ${layer.selector} radius`).toBeCloseTo(layer.radius, 1);
      if (parentRadius !== null) {
        expect(
          parentRadius - layer.inset,
          `${id} ${layer.selector} is concentric with its parent`,
        ).toBeCloseTo(layer.radius, 1);
      }
      parentRadius = layer.radius;
    }

    const panelBox = await page
      .locator(`[data-specimen="${id}"] .tf-aaa-card__panel`)
      .boundingBox();
    const leftInset = panelBox.x - cardBox.x;
    const rightInset = cardBox.x + cardBox.width - (panelBox.x + panelBox.width);
    for (const inset of [leftInset, rightInset]) {
      expect(inset / cardBox.width, id).toBeGreaterThanOrEqual(
        FRAME_INSET_RANGE.min,
      );
      expect(inset / cardBox.width, id).toBeLessThanOrEqual(
        FRAME_INSET_RANGE.max,
      );
    }
  }
});

test('§7.3 inset art window proportions hold at 7:5', async ({ page }) => {
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
    expect(artBox.width / artBox.height, id).toBeCloseTo(ART_WINDOW_RATIO, 2);
    expect(widthFrac, id).toBeGreaterThanOrEqual(0.83);
    expect(widthFrac, id).toBeLessThanOrEqual(0.85);
    expect(heightFrac, id).toBeGreaterThanOrEqual(0.385);
    expect(heightFrac, id).toBeLessThanOrEqual(0.405);
    expect(topFrac, id).toBeGreaterThanOrEqual(0.145);
    expect(topFrac, id).toBeLessThanOrEqual(0.165);
    expect(endFrac, id).toBeGreaterThanOrEqual(0.54);
    expect(endFrac, id).toBeLessThanOrEqual(0.56);

    // The frame is opaque and visible all the way around the window: the art
    // must sit strictly inside the parchment panel on every side.
    const panelBox = await page
      .locator(`[data-specimen="${id}"] .tf-aaa-card__panel`)
      .boundingBox();
    expect(artBox.x, `${id} art left inside panel`).toBeGreaterThan(panelBox.x);
    expect(artBox.y, `${id} art top inside panel`).toBeGreaterThan(panelBox.y);
    expect(
      artBox.x + artBox.width,
      `${id} art right inside panel`,
    ).toBeLessThan(panelBox.x + panelBox.width);
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

test('nameplate fixtures render unclipped at locked 22 px type', async ({ page }) => {
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
    // 211 × 36 text box with ≥2 px horizontal clearance each side. Vertical
    // containment allows the full single-line block (24.5 px) whose leading
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

    // One line maximum at the fixed 24.5 px line height.
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
