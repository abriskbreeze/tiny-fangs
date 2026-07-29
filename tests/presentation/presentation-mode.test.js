import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_MODE_STORAGE_KEY,
  applyPresentationMode,
  resolvePresentationMode,
} from '../../src/presentation/presentation-mode.js';

function storageReturning(value) {
  const reads = [];
  return {
    reads,
    getItem(key) {
      reads.push(key);
      return value;
    },
  };
}

describe('presentation mode', () => {
  it('defaults to classic when no explicit override exists', () => {
    expect(resolvePresentationMode({ search: '', storage: null })).toBe('classic');
  });

  it('accepts an explicit AAA query mode alongside unrelated query parameters', () => {
    const search = '?ws=wss%3A%2F%2Fexample.test%2Fgame&presentation=aaa&room=ABCD';

    expect(resolvePresentationMode({ search, storage: null })).toBe('aaa');
  });

  it('gives a valid query mode precedence over local storage', () => {
    const storage = storageReturning('aaa');

    expect(resolvePresentationMode({
      search: '?presentation=classic&ws=wss%3A%2F%2Fexample.test',
      storage,
    })).toBe('classic');
    expect(storage.reads).toEqual([]);
  });

  it('reads the namespaced local storage override when the query has no mode', () => {
    const storage = storageReturning('aaa');

    expect(resolvePresentationMode({ search: '?ws=ws%3A%2F%2Flocalhost%3A3001', storage })).toBe('aaa');
    expect(storage.reads).toEqual([PRESENTATION_MODE_STORAGE_KEY]);
    expect(PRESENTATION_MODE_STORAGE_KEY).toBe('tinyFangs.presentation.mode');
  });

  it('ignores an invalid query mode and falls through to a valid stored mode', () => {
    const storage = storageReturning('aaa');

    expect(resolvePresentationMode({
      search: '?presentation=%3Cscript%3E&ws=wss%3A%2F%2Fexample.test',
      storage,
    })).toBe('aaa');
  });

  it('falls back to classic for an invalid stored mode', () => {
    const storage = storageReturning('future-mode');

    expect(resolvePresentationMode({ search: '', storage })).toBe('classic');
  });

  it('falls back to classic when local storage cannot be read', () => {
    const storage = {
      getItem() {
        throw new Error('storage denied');
      },
    };

    expect(resolvePresentationMode({ search: '', storage })).toBe('classic');
  });

  it('applies the resolved mode to the root data attribute', () => {
    const root = { dataset: {} };

    expect(applyPresentationMode({
      root,
      search: '?presentation=aaa',
      storage: null,
    })).toBe('aaa');
    expect(root.dataset.presentation).toBe('aaa');
  });

  it('never applies an invalid mode to the root data attribute', () => {
    const root = { dataset: {} };

    expect(applyPresentationMode({
      root,
      search: '?presentation=unknown',
      storage: storageReturning('also-unknown'),
    })).toBe('classic');
    expect(root.dataset.presentation).toBe('classic');
  });
});
