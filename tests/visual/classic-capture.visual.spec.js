import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createPublicFixtureMetadata } from '../../src/presentation/testing/fixture-activation.js';
import { createVisualFixture } from '../../src/presentation/testing/fixture-registry.js';
import { listVisualFixtureNames } from '../../src/presentation/testing/visual-fixture-names.js';

const BASELINE_ID = 'classic-v1';
const CANONICAL_VIEWPORT = Object.freeze({ width: 1672, height: 941 });
const CANONICAL_DPR = 1;
const UPDATE_BASELINES = process.env.UPDATE_CLASSIC_BASELINES === '1';
const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIRECTORY = path.join(
  TEST_DIRECTORY,
  'baselines',
  BASELINE_ID,
);
const SCREENSHOT_DIRECTORY = path.join(BASELINE_DIRECTORY, 'screenshots');
const MANIFEST_PATH = path.join(BASELINE_DIRECTORY, 'manifest.json');
const FIXTURE_NAMES = Object.freeze(listVisualFixtureNames());
const PRIVATE_RESPONSE_KEYS = Object.freeze([
  'benchOptions',
  'pendingAction',
]);
const UNCONSUMED_CLASSIC_PRESENTATION_METADATA = Object.freeze([
  'presentation.camera',
  'presentation.multiplayer',
  'presentation.overlay',
  'presentation.overlays',
  'presentation.response',
  'presentation.result',
  'presentation.statusLegend',
  'presentation.transition',
]);

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function pngDimensions(buffer) {
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error('Classic baseline is not a PNG');
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function fixtureInventoryHash() {
  return sha256(FIXTURE_NAMES.join('\n'));
}

function fixtureRoute(name) {
  return `/?presentation=classic&visualQa=1&fixture=${encodeURIComponent(name)}`;
}

function collectPrivateUidSentinels(fixture) {
  const opponent = fixture.G.players[1];
  const cards = [
    ...opponent.deck,
    ...opponent.hand,
    opponent.setVerse,
  ].filter(Boolean);

  if (fixture.privacy?.hiddenPaths?.includes('G.players.0.setVerse')) {
    cards.push(fixture.G.players[0].setVerse);
  }

  return [...new Set(cards.map((card) => card.uid).filter(Boolean))].sort();
}

function privacyEvidence(fixture, fixtureHashInput) {
  const privateUidSentinels = collectPrivateUidSentinels(fixture);
  const leakedPrivateUids = privateUidSentinels.filter((uid) => (
    fixtureHashInput.includes(uid)
  ));
  const ownerOnlyResponse = fixture.privacy?.hiddenPaths?.includes(
    'presentation.response',
  ) === true;
  const leakedResponseKeys = ownerOnlyResponse
    ? PRIVATE_RESPONSE_KEYS.filter((key) => fixtureHashInput.includes(`"${key}"`))
    : [];

  return {
    privateUidSentinelsTested: privateUidSentinels.length,
    ownerOnlyResponseKeysTested: ownerOnlyResponse
      ? [...PRIVATE_RESPONSE_KEYS]
      : [],
    leakedPrivateUids,
    leakedResponseKeys,
  };
}

async function readManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
}

function assertCanonicalRecord(record, fixtureName, browserProvenance) {
  expect(record.fixture).toBe(fixtureName);
  expect(record.viewport).toEqual(CANONICAL_VIEWPORT);
  expect(record.dpr).toBe(CANONICAL_DPR);
  expect(record.presentationMode).toBe('classic');
  expect(record.browser).toEqual(browserProvenance);
  expect(record.route).toEqual({
    path: '/',
    search: `?presentation=classic&visualQa=1&fixture=${fixtureName}`,
  });
  expect(record.readiness).toEqual({
    activationError: null,
    globalReady: true,
    lastResetReason: 'route',
    qaReady: true,
  });
  expect(record.fonts).toEqual({
    status: 'loaded',
  });
  expect(record.assets).toEqual({
    failedImages: [],
    failedRequests: [],
    httpErrors: [],
  });
  expect(record.runtimeErrors).toEqual({
    console: [],
    page: [],
  });
  expect(record.privacy.leakedPrivateUids).toEqual([]);
  expect(record.privacy.leakedResponseKeys).toEqual([]);
  expect(record.screenshot.dimensions).toEqual(CANONICAL_VIEWPORT);
  expect(record.screenshot.file).toBe(`screenshots/${fixtureName}.png`);
  expect(record.capturedAt).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
}

test.describe('classic-v1 deterministic visual baselines', () => {
  test('manifest is exhaustive, internally hashed, privacy-safe, and version-locked', async () => {
    test.skip(UPDATE_BASELINES, 'baseline generation validates the new evidence');

    const manifest = await readManifest();
    const browserProvenance = manifest.captureSession.browser;
    const names = manifest.records.map((record) => record.fixture);

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.baselineId).toBe(BASELINE_ID);
    expect(manifest.fixtureInventory).toEqual({
      count: FIXTURE_NAMES.length,
      names: FIXTURE_NAMES,
      sha256: fixtureInventoryHash(),
    });
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(FIXTURE_NAMES);
    expect(manifest.captureSession.viewport).toEqual(CANONICAL_VIEWPORT);
    expect(manifest.captureSession.dpr).toBe(CANONICAL_DPR);
    expect(manifest.captureSession.presentationMode).toBe('classic');
    expect(manifest.captureSession.identityExcludes).toEqual([
      'captureSession.capturedAt',
      'records[*].capturedAt',
    ]);
    expect(
      manifest.limitations.unconsumedClassicPresentationMetadata,
    ).toEqual(UNCONSUMED_CLASSIC_PRESENTATION_METADATA);
    expect(manifest.limitations.visuallyCoveredByThisBaseline).toBe(false);

    for (const [index, fixtureName] of FIXTURE_NAMES.entries()) {
      const record = manifest.records[index];
      const fixture = createVisualFixture(fixtureName);
      const fixtureMetadata = createPublicFixtureMetadata(fixture);
      const expectedPrivacy = privacyEvidence(
        fixture,
        fixtureMetadata.stableHashInput,
      );
      const screenshotPath = path.join(
        BASELINE_DIRECTORY,
        record.screenshot.file,
      );
      const screenshot = await readFile(screenshotPath);

      assertCanonicalRecord(record, fixtureName, browserProvenance);
      expect(record.fixtureHashInput).toBe(fixtureMetadata.stableHashInput);
      expect(record.fixtureHash).toBe(sha256(record.fixtureHashInput));
      expect(record.privacy).toEqual(expectedPrivacy);
      expect(record.screenshot.sha256).toBe(sha256(screenshot));
      expect(pngDimensions(screenshot)).toEqual(CANONICAL_VIEWPORT);
    }
  });

  test('real classic fixture routes match every recorded baseline', async ({
    browser,
    browserName,
    page,
  }) => {
    test.slow();

    const capturedAt = new Date().toISOString();
    const browserProvenance = {
      name: browserName,
      version: browser.version(),
    };
    const actualViewport = page.viewportSize();
    const actualDpr = await page.evaluate(() => window.devicePixelRatio);
    const baselineManifest = UPDATE_BASELINES ? null : await readManifest();
    const records = [];

    expect(actualViewport).toEqual(CANONICAL_VIEWPORT);
    expect(actualDpr).toBe(CANONICAL_DPR);

    for (const fixtureName of FIXTURE_NAMES) {
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      const httpErrors = [];
      const onConsole = (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      };
      const onPageError = (error) => pageErrors.push(error.message);
      const onRequestFailed = (request) => {
        failedRequests.push({
          method: request.method(),
          url: request.url(),
          error: request.failure()?.errorText ?? 'unknown',
        });
      };
      const onResponse = (response) => {
        if (response.status() >= 400) {
          httpErrors.push({
            status: response.status(),
            url: response.url(),
          });
        }
      };

      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      page.on('requestfailed', onRequestFailed);
      page.on('response', onResponse);

      await page.goto(fixtureRoute(fixtureName), {
        waitUntil: 'networkidle',
      });
      await page.waitForFunction(() => (
        window.__TINY_FANGS_VISUAL_READY__ === true
      ));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.fonts.status === 'loaded');

      const runtime = await page.evaluate(() => {
        const qa = window.__TINY_FANGS_VISUAL_QA__;
        const failedImages = [...document.images]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src);

        return {
          fixture: qa.currentFixture,
          presentationMode: document.documentElement.dataset.presentation,
          readiness: {
            activationError: qa.activationError,
            globalReady: window.__TINY_FANGS_VISUAL_READY__,
            lastResetReason: qa.readiness.lastResetReason(),
            qaReady: qa.readiness.isReady(),
          },
          fonts: {
            status: document.fonts.status,
          },
          failedImages,
          dpr: window.devicePixelRatio,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          route: {
            path: window.location.pathname,
            search: window.location.search,
          },
        };
      });
      const screenshot = await page.screenshot({
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
      const fixture = createVisualFixture(fixtureName);
      const fixtureMetadata = createPublicFixtureMetadata(fixture);
      const record = {
        fixture: fixtureName,
        fixtureHashInput: runtime.fixture.stableHashInput,
        fixtureHash: sha256(runtime.fixture.stableHashInput),
        screenshot: {
          file: `screenshots/${fixtureName}.png`,
          sha256: sha256(screenshot),
          dimensions: pngDimensions(screenshot),
        },
        browser: browserProvenance,
        viewport: runtime.viewport,
        dpr: runtime.dpr,
        presentationMode: runtime.presentationMode,
        route: runtime.route,
        readiness: runtime.readiness,
        fonts: runtime.fonts,
        assets: {
          failedImages: runtime.failedImages,
          failedRequests,
          httpErrors,
        },
        runtimeErrors: {
          console: consoleErrors,
          page: pageErrors,
        },
        privacy: privacyEvidence(fixture, runtime.fixture.stableHashInput),
        capturedAt,
      };

      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);

      expect(runtime.fixture.name).toBe(fixtureName);
      expect(runtime.fixture.stableHashInput).toBe(
        fixtureMetadata.stableHashInput,
      );
      assertCanonicalRecord(record, fixtureName, browserProvenance);

      if (UPDATE_BASELINES) {
        await mkdir(SCREENSHOT_DIRECTORY, { recursive: true });
        await writeFile(
          path.join(SCREENSHOT_DIRECTORY, `${fixtureName}.png`),
          screenshot,
        );
      } else {
        const baselineRecord = baselineManifest.records[records.length];
        expect({
          ...record,
          capturedAt: baselineRecord.capturedAt,
        }).toEqual(baselineRecord);
      }

      records.push(record);
    }

    if (UPDATE_BASELINES) {
      const manifest = {
        schemaVersion: 1,
        baselineId: BASELINE_ID,
        fixtureInventory: {
          count: FIXTURE_NAMES.length,
          names: FIXTURE_NAMES,
          sha256: fixtureInventoryHash(),
        },
        captureSession: {
          browser: browserProvenance,
          viewport: CANONICAL_VIEWPORT,
          dpr: CANONICAL_DPR,
          presentationMode: 'classic',
          capturedAt,
          identityExcludes: [
            'captureSession.capturedAt',
            'records[*].capturedAt',
          ],
          screenshotPortability:
            'PNG byte identity is asserted only for the recorded browser version, OS, fonts, and graphics stack.',
        },
        limitations: {
          unconsumedClassicPresentationMetadata:
            UNCONSUMED_CLASSIC_PRESENTATION_METADATA,
          visuallyCoveredByThisBaseline: false,
          explanation:
            'The classic fixture route renders game state but does not consume these presentation metadata paths. Their overlays, transitions, responses, result direction, and camera intent are not visually covered by this baseline.',
        },
        records,
      };

      await mkdir(BASELINE_DIRECTORY, { recursive: true });
      await writeFile(
        MANIFEST_PATH,
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    }
  });
});
