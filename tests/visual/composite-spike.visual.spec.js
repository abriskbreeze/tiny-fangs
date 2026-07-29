// Phase 3 compositing-spike alignment gate: DOM card faces mapped by the
// matrix3d homography must land on the locked camera's quads within 2 CSS px
// at the canonical frame and 4 CSS px across the resize matrix. Also proves
// repeated navigation (mount/unmount) leaves no runtime errors.
import { expect, test } from '@playwright/test';

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const url = `http://127.0.0.1:${vitePort}/composite.html`;

test.describe.configure({ mode: 'serial' });

const VIEWPORTS = [
  { name: 'canonical', width: 1672, height: 941, budgetPx: 2 },
  { name: '2560x1440', width: 2560, height: 1440, budgetPx: 4 },
  { name: '1440x900', width: 1440, height: 900, budgetPx: 4 },
  { name: '1280x720', width: 1280, height: 720, budgetPx: 4 },
  { name: '1024x768', width: 1024, height: 768, budgetPx: 4 },
];

for (const viewport of VIEWPORTS) {
  test(`DOM/Three alignment within ${viewport.budgetPx}px at ${viewport.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(url);
    await page.waitForFunction(() => window.__TINY_FANGS_VISUAL_READY__ === true, undefined, {
      timeout: 30_000,
    });
    const report = await page.evaluate(() => window.__TINY_FANGS_COMPOSITE_REPORT__);
    expect(report.error, 'composite build error').toBeUndefined();
    expect(report.anchorCount).toBe(12);
    expect(
      report.maxCornerError,
      'homography forward-projection error',
    ).toBeLessThanOrEqual(0.1);
    expect(
      report.maxDomError,
      `browser-applied matrix drift at ${viewport.name}`,
    ).toBeLessThanOrEqual(viewport.budgetPx);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('repeated mount/unmount stays clean', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1672, height: 941 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (let i = 0; i < 3; i += 1) {
    await page.goto(url);
    await page.waitForFunction(() => window.__TINY_FANGS_VISUAL_READY__ === true, undefined, {
      timeout: 30_000,
    });
  }
  const report = await page.evaluate(() => window.__TINY_FANGS_COMPOSITE_REPORT__);
  expect(report.maxDomError).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
  await context.close();
});
