import { expect, test } from '@playwright/test';

// Phase 7 exit harness: the populated board — live meadow + DOM card faces
// homography-mapped onto the camera-lock golden quadrilaterals.

async function openBoard(page) {
  await page.goto('/board.html');
  await page.waitForFunction(
    () => window.__TF_BOARD_READY__ === true || window.__TF_BOARD_ERROR__,
    null,
    { timeout: 40000 },
  );
  const pageError = await page.evaluate(() => window.__TF_BOARD_ERROR__ ?? null);
  expect(pageError).toBe(null);
  return page.evaluate(() => window.__TF_BOARD_REPORT__);
}

test('all board anchors and hand cards place with ≤2px registration', async ({ page }) => {
  const report = await openBoard(page);
  expect(report.anchorsPlaced).toBe(11); // 12 anchors minus the authored empty slot
  expect(report.handPlaced).toBe(4);
  // §12 projected-registration row: ≤2 CSS px at every ordered corner.
  expect(report.maxCornerError).toBeLessThanOrEqual(2);
});

test('populated board renders deterministically across loads', async ({ page }) => {
  await openBoard(page);
  await page.waitForTimeout(600); // template aperture images settle
  const first = await page.screenshot();
  await page.reload();
  await page.waitForFunction(() => window.__TF_BOARD_READY__ === true);
  await page.waitForTimeout(600);
  const second = await page.screenshot();
  expect(first.equals(second)).toBe(true);
});
