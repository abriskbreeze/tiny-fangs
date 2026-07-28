// Phase 2 camera bake-off raw capture. Renders both candidates at the exact
// canonical frame, waits on the visual readiness contract, and writes the raw
// (non-anonymized) frames plus calibration/residual reports to
// tests/visual/bakeoff/raw/. Packet assembly, crops, hashing, anonymization,
// and the sealed mapping are performed by scripts/make_bakeoff_packet.py so
// the blind protocol never depends on test-runner state.
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const vitePort = process.env.TINY_FANGS_VITE_PORT ?? '4173';
const RAW_DIR = path.resolve('tests/visual/bakeoff/raw');

test.describe.configure({ mode: 'serial' });

for (const candidate of ['O', 'P']) {
  test(`captures camera candidate ${candidate} at the canonical frame`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1672, height: 941 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(
      `http://127.0.0.1:${vitePort}/graybox.html?candidate=${candidate}`,
    );
    await page.waitForFunction(
      () => window.__TINY_FANGS_VISUAL_READY__ === true,
      undefined,
      { timeout: 30_000 },
    );

    const report = await page.evaluate(() => window.__TINY_FANGS_GRAYBOX_REPORT__);
    expect(report.error, 'graybox build error').toBeUndefined();
    expect(report.candidate).toBe(candidate);
    // Anchor registration is by construction; a nonzero fiducial error means
    // the projection/raycast pipeline is broken, not that composition drifted.
    expect(report.maxFiducialErrorPx).toBeLessThanOrEqual(0.5);
    expect(errors, 'runtime errors during graybox render').toEqual([]);

    fs.mkdirSync(RAW_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(RAW_DIR, `candidate-${candidate}.png`),
      clip: { x: 0, y: 0, width: 1672, height: 941 },
    });
    fs.writeFileSync(
      path.join(RAW_DIR, `candidate-${candidate}-report.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    await context.close();
  });
}
