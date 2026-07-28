import { describe, expect, it } from 'vitest';
import {
  CAPTURE_BROWSER_PLACEHOLDER,
  CAPTURE_HASH_PLACEHOLDER,
  createCaptureManifestRecord,
} from '../../src/presentation/testing/capture-manifest.js';

const fixture = {
  name: 'dense-board-statuses',
  stableHashInput: '{"fixture":"stable"}',
};

describe('visual capture manifest record', () => {
  it('creates a deterministic browser-independent capture record', () => {
    const input = {
      viewport: { width: 1672, height: 941 },
      dpr: 2,
      mode: 'classic',
      fixture,
    };

    const first = createCaptureManifestRecord(input);
    const second = createCaptureManifestRecord(input);

    expect(first).toEqual({
      schemaVersion: 1,
      viewport: { width: 1672, height: 941 },
      dpr: 2,
      mode: 'classic',
      fixture: 'dense-board-statuses',
      fixtureHash: CAPTURE_HASH_PLACEHOLDER,
      fixtureHashInput: '{"fixture":"stable"}',
      browser: CAPTURE_BROWSER_PLACEHOLDER,
    });
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.viewport)).toBe(true);
  });

  it('accepts finalized fixture hash and browser provenance from a later capture runner', () => {
    const record = createCaptureManifestRecord({
      viewport: { width: 390, height: 844 },
      dpr: 3,
      mode: 'aaa',
      fixture,
      fixtureHash: 'sha256:abc123',
      browser: 'chromium-140.0.0',
    });

    expect(record.fixtureHash).toBe('sha256:abc123');
    expect(record.browser).toBe('chromium-140.0.0');
  });

  it.each([
    [{ viewport: { width: 0, height: 941 }, dpr: 1, mode: 'classic', fixture }, 'viewport'],
    [{ viewport: { width: 1672, height: 941 }, dpr: 0, mode: 'classic', fixture }, 'DPR'],
    [{ viewport: { width: 1672, height: 941 }, dpr: 1, mode: '', fixture }, 'mode'],
    [{ viewport: { width: 1672, height: 941 }, dpr: 1, mode: 'classic', fixture: null }, 'fixture metadata'],
  ])('rejects invalid capture input %#', (input, message) => {
    expect(() => createCaptureManifestRecord(input)).toThrow(message);
  });
});
