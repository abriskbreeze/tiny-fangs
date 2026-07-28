export const CAPTURE_HASH_PLACEHOLDER = 'pending';
export const CAPTURE_BROWSER_PLACEHOLDER = 'pending';

function positiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

export function createCaptureManifestRecord({
  viewport,
  dpr,
  mode,
  fixture,
  fixtureHash = CAPTURE_HASH_PLACEHOLDER,
  browser = CAPTURE_BROWSER_PLACEHOLDER,
} = {}) {
  if (
    !viewport
    || !Number.isInteger(viewport.width)
    || !Number.isInteger(viewport.height)
    || viewport.width <= 0
    || viewport.height <= 0
  ) {
    throw new Error('Capture manifest requires a positive integer viewport');
  }

  if (!positiveNumber(dpr)) {
    throw new Error('Capture manifest requires a positive DPR');
  }

  if (typeof mode !== 'string' || mode.length === 0) {
    throw new Error('Capture manifest requires a mode');
  }

  if (
    !fixture
    || typeof fixture.name !== 'string'
    || typeof fixture.stableHashInput !== 'string'
  ) {
    throw new Error('Capture manifest requires fixture metadata');
  }

  return Object.freeze({
    schemaVersion: 1,
    viewport: Object.freeze({
      width: viewport.width,
      height: viewport.height,
    }),
    dpr,
    mode,
    fixture: fixture.name,
    fixtureHash,
    fixtureHashInput: fixture.stableHashInput,
    browser,
  });
}
