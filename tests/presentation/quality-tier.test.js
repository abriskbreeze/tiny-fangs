import { describe, expect, it } from 'vitest';
import { QUALITY_TIERS } from '../../src/presentation/capabilities.js';
import {
  QUALITY_TIER_STORAGE_KEY,
  nextQualityTier,
  normalizeQualityTier,
  persistQualityTier,
  qualityProfile,
  resolveQualityTier,
} from '../../src/presentation/quality-tier.js';

// Phase 13 contracts: query → storage → detection precedence, hostile values
// ignored rather than thrown, and a per-tier rendering budget the shell reads.

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

function detecting(qualityTier) {
  const calls = [];
  return {
    calls,
    detect() {
      calls.push(true);
      return { qualityTier };
    },
  };
}

describe('quality tier resolution', () => {
  it('falls back to the detected tier when nothing is overridden', () => {
    const detector = detecting('desktop-high');

    expect(resolveQualityTier({ search: '', storage: null, detect: detector.detect }))
      .toBe('desktop-high');
    expect(detector.calls.length).toBe(1);
  });

  it('accepts an explicit query tier alongside unrelated query parameters', () => {
    const detector = detecting('desktop-high');
    const search = '?ws=wss%3A%2F%2Fexample.test%2Fgame&quality=desktop-low&presentation=aaa';

    expect(resolveQualityTier({ search, storage: null, detect: detector.detect }))
      .toBe('desktop-low');
    expect(detector.calls).toEqual([]); // detection is never even attempted
  });

  it('gives a valid query tier precedence over local storage', () => {
    const storage = storageReturning('static');

    expect(resolveQualityTier({
      search: '?quality=desktop-low&presentation=aaa',
      storage,
      detect: detecting('desktop-high').detect,
    })).toBe('desktop-low');
    expect(storage.reads).toEqual([]);
  });

  it('reads the namespaced local storage override when the query has no tier', () => {
    const storage = storageReturning('desktop-low');
    const detector = detecting('desktop-high');

    expect(resolveQualityTier({
      search: '?presentation=aaa', storage, detect: detector.detect,
    })).toBe('desktop-low');
    expect(storage.reads).toEqual([QUALITY_TIER_STORAGE_KEY]);
    expect(QUALITY_TIER_STORAGE_KEY).toBe('tinyFangs.presentation.quality');
    expect(detector.calls).toEqual([]);
  });

  it('ignores an invalid query tier and falls through to a valid stored tier', () => {
    expect(resolveQualityTier({
      search: '?quality=%3Cscript%3E&presentation=aaa',
      storage: storageReturning('static'),
      detect: detecting('desktop-high').detect,
    })).toBe('static');
  });

  it('ignores an invalid stored tier and falls through to detection', () => {
    expect(resolveQualityTier({
      search: '',
      storage: storageReturning('ultra-nightmare'),
      detect: detecting('desktop-low').detect,
    })).toBe('desktop-low');
  });

  it('falls back to static when storage throws and detection is unavailable', () => {
    const storage = {
      getItem() {
        throw new Error('storage denied');
      },
    };
    const detect = () => {
      throw new Error('no document');
    };

    expect(resolveQualityTier({ search: '', storage, detect })).toBe('static');
  });

  it('falls back to static when detection returns an unknown tier', () => {
    expect(resolveQualityTier({
      search: '', storage: null, detect: () => ({ qualityTier: 'holodeck' }),
    })).toBe('static');
  });

  it('lets an explicit in-process tier win over every persisted source', () => {
    expect(resolveQualityTier({
      tier: 'desktop-high',
      search: '?quality=static',
      storage: storageReturning('desktop-low'),
      detect: detecting('static').detect,
    })).toBe('desktop-high');
  });

  it('ignores an invalid in-process tier rather than trusting it', () => {
    expect(resolveQualityTier({
      tier: 'desktop-ultra',
      search: '?quality=desktop-low',
      storage: null,
      detect: detecting('desktop-high').detect,
    })).toBe('desktop-low');
  });
});

describe('quality tier cycling and persistence', () => {
  it('cycles through every canonical tier and wraps', () => {
    expect(nextQualityTier('desktop-high')).toBe('desktop-low');
    expect(nextQualityTier('desktop-low')).toBe('static');
    expect(nextQualityTier('static')).toBe('desktop-high');
    expect(QUALITY_TIERS).toEqual(['desktop-high', 'desktop-low', 'static']);
  });

  it('cycles from an unknown tier to the first canonical tier', () => {
    expect(nextQualityTier('nonsense')).toBe('desktop-high');
    expect(nextQualityTier(null)).toBe('desktop-high');
  });

  it('persists only valid tiers, under the namespaced key', () => {
    const writes = [];
    const storage = { setItem: (k, v) => writes.push([k, v]) };

    expect(persistQualityTier('desktop-low', storage)).toBe(true);
    expect(persistQualityTier('nonsense', storage)).toBe(false);
    expect(writes).toEqual([[QUALITY_TIER_STORAGE_KEY, 'desktop-low']]);
  });

  it('reports failure instead of throwing when storage refuses the write', () => {
    const storage = {
      setItem() {
        throw new Error('quota exceeded');
      },
    };

    expect(persistQualityTier('static', storage)).toBe(false);
    expect(persistQualityTier('static', null)).toBe(false);
  });
});

describe('quality profiles', () => {
  it('keeps desktop-high at the full budget', () => {
    expect(qualityProfile('desktop-high'))
      .toEqual({ scene: true, antialias: true, particleMax: 48, lightSpill: true });
  });

  it('reduces antialiasing, particle headroom, and the light spill on desktop-low', () => {
    const high = qualityProfile('desktop-high');
    const low = qualityProfile('desktop-low');

    expect(low.scene).toBe(true); // still a real 3D scene
    expect(low.antialias).toBe(false);
    expect(low.particleMax).toBeLessThan(high.particleMax);
    expect(low.lightSpill).toBe(false);
  });

  it('mounts no scene at all on static, including for unknown tiers', () => {
    expect(qualityProfile('static').scene).toBe(false);
    expect(qualityProfile('nonsense').scene).toBe(false);
  });

  it('normalizes only the canonical tiers', () => {
    for (const tier of QUALITY_TIERS) expect(normalizeQualityTier(tier)).toBe(tier);
    expect(normalizeQualityTier('DESKTOP-HIGH')).toBeNull();
    expect(normalizeQualityTier(undefined)).toBeNull();
    expect(normalizeQualityTier(42)).toBeNull();
  });
});
