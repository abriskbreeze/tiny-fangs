import { expect, test } from '@playwright/test';

// Phase 7 chunk 1 — §12 field rows measured live on the rendered meadow
// under the locked camera (perspective FOV 30°, pitch 24.5°, distance 1950).
// The harness computes every metric in-page with the same operators applied
// to the render and to R2 (art bible §2.1/§4.1/§12).

async function openMeadow(page) {
  await page.goto('/meadow.html');
  await page.waitForFunction(
    () => window.__TF_MEADOW_READY__ === true || window.__TF_MEADOW_ERROR__,
    null,
    { timeout: 30000 },
  );
  const pageError = await page.evaluate(() => window.__TF_MEADOW_ERROR__ ?? null);
  expect(pageError).toBe(null);
  return page.evaluate(() => window.__TF_MEADOW_METRICS__);
}

test('§12 divider row: center, slope, span, core, diamond', async ({ page }) => {
  const metrics = await openMeadow(page);
  const divider = metrics.divider;
  expect(divider.centerY).toBeGreaterThanOrEqual(411);
  expect(divider.centerY).toBeLessThanOrEqual(417);
  expect(divider.slope).toBeLessThanOrEqual(1);
  expect(divider.bandSpanFraction).toBeGreaterThanOrEqual(0.68);
  expect(divider.bandSpanFraction).toBeLessThanOrEqual(0.8);
  expect(divider.coreThicknessMedian).toBeGreaterThanOrEqual(6);
  expect(divider.coreThicknessMedian).toBeLessThanOrEqual(12);
  expect(divider.diamond).not.toBe(null);
  expect(Math.abs(divider.diamond.centerX - 836)).toBeLessThanOrEqual(3);
  expect(divider.diamond.width).toBeGreaterThanOrEqual(33);
  expect(divider.diamond.width).toBeLessThanOrEqual(45);
  expect(divider.diamond.height).toBeGreaterThanOrEqual(38);
  expect(divider.diamond.height).toBeLessThanOrEqual(50);
});

test('§12 palette row: aligned region medians within final CIEDE2000 ≤ 5', async ({ page }) => {
  const metrics = await openMeadow(page);
  for (const [name, region] of Object.entries(metrics.palette)) {
    expect(region.deltaE00, name).toBeLessThanOrEqual(5);
  }
});

test('§12 perimeter/center value: luminance ratio inside 0.14–0.25', async ({ page }) => {
  const metrics = await openMeadow(page);
  expect(metrics.perimeterCenterRatio).toBeGreaterThanOrEqual(0.14);
  expect(metrics.perimeterCenterRatio).toBeLessThanOrEqual(0.25);
});

test('§12 environment rows: frame extent, quiet zone, prop intrusion', async ({ page }) => {
  const metrics = await openMeadow(page);
  const environment = metrics.environment;
  for (const [side, extent] of Object.entries(environment.frameExtent)) {
    expect(extent, side).toBeGreaterThanOrEqual(0.1);
    expect(extent, side).toBeLessThanOrEqual(0.15);
  }
  // §4.1: at least 70% of the central zone stays grass/slot/shadow/card.
  expect(environment.quietZonePropShare).toBeLessThanOrEqual(0.3);
  // §12: no prop intrudes more than 42 px into a resting card envelope.
  expect(environment.propIntrusion.worstPx).toBeLessThanOrEqual(42);
});

test('deterministic: two loads render byte-identical frames', async ({ page }) => {
  await openMeadow(page);
  const first = await page.locator('#scene-canvas').screenshot();
  await page.reload();
  await page.waitForFunction(() => window.__TF_MEADOW_READY__ === true);
  const second = await page.locator('#scene-canvas').screenshot();
  expect(first.equals(second)).toBe(true);
});
