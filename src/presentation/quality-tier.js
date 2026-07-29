// Phase 13 — adaptive quality selection plus an explicit user override.
//
// Resolution mirrors presentation-mode.js exactly: an explicit query parameter
// wins, then the namespaced localStorage override, then automatic capability
// detection. Every step is total — an invalid, hostile, or unreadable value is
// ignored rather than thrown, and a detection failure lands on `static`, the
// tier that is always playable because it renders nothing at all.
//
// These functions are pure with respect to their injected `search`/`storage`,
// so the resolution order is unit-testable without a browser.

import { QUALITY_TIERS, detectCapabilities } from './capabilities.js';

export const QUALITY_TIER_STORAGE_KEY = 'tinyFangs.presentation.quality';

export const QUALITY_TIER_LABELS = Object.freeze({
  'desktop-high': 'High',
  'desktop-low': 'Low',
  static: 'Static',
});

// The rendering budget each tier buys. `static` never mounts a scene, so its
// numbers exist only so callers can read a complete profile for any tier.
const QUALITY_PROFILES = Object.freeze({
  'desktop-high': Object.freeze({ scene: true, antialias: true, particleMax: 48, lightSpill: true }),
  'desktop-low': Object.freeze({ scene: true, antialias: false, particleMax: 16, lightSpill: false }),
  static: Object.freeze({ scene: false, antialias: false, particleMax: 0, lightSpill: false }),
});

const VALID_QUALITY_TIERS = new Set(QUALITY_TIERS);

export function normalizeQualityTier(value) {
  return typeof value === 'string' && VALID_QUALITY_TIERS.has(value) ? value : null;
}

export function qualityProfile(tier) {
  return QUALITY_PROFILES[normalizeQualityTier(tier) ?? 'static'];
}

/** Next tier in the canonical QUALITY_TIERS order, wrapping at the end. */
export function nextQualityTier(tier) {
  const current = normalizeQualityTier(tier);
  const index = current === null ? -1 : QUALITY_TIERS.indexOf(current);
  return QUALITY_TIERS[(index + 1) % QUALITY_TIERS.length];
}

function getDefaultSearch() {
  try {
    return globalThis.location?.search ?? '';
  } catch {
    return '';
  }
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getQueryTier(search) {
  try {
    return normalizeQualityTier(new URLSearchParams(search).get('quality'));
  } catch {
    return null;
  }
}

function getStoredTier(storage) {
  try {
    return normalizeQualityTier(storage?.getItem(QUALITY_TIER_STORAGE_KEY));
  } catch {
    return null;
  }
}

function getDetectedTier(detect) {
  try {
    return normalizeQualityTier(detect()?.qualityTier);
  } catch {
    return null;
  }
}

/**
 * Resolve the active quality tier.
 *
 * Precedence: an explicit in-process `tier` (the HUD chip's session pick) →
 * `?quality=` → localStorage → `detectCapabilities()` → `static`.
 */
export function resolveQualityTier({
  tier = null,
  search = getDefaultSearch(),
  storage = getDefaultStorage(),
  detect = detectCapabilities,
} = {}) {
  return normalizeQualityTier(tier)
    ?? getQueryTier(search)
    ?? getStoredTier(storage)
    ?? getDetectedTier(detect)
    ?? 'static';
}

/** Persist an explicit user pick. Returns whether the write landed. */
export function persistQualityTier(tier, storage = getDefaultStorage()) {
  const value = normalizeQualityTier(tier);
  if (!value) return false;
  try {
    storage?.setItem(QUALITY_TIER_STORAGE_KEY, value);
    return Boolean(storage);
  } catch {
    return false;
  }
}
