// Fail-silent image asset loader — the image-side sibling of
// audio-director.js, and it keeps the same discipline: resolve a manifest path
// to a bundler-built URL, probe the file exactly once, mark a missing file
// dead forever, never retry, never log, never throw.
//
// Every art asset in this project is placeholder-pending user regeneration, so
// the whole renderer must behave perfectly with zero files present. Nothing
// here may become load-bearing: callers apply art on success and leave their
// procedural rendering untouched on failure.
//
// URLs resolve through import.meta.glob so production builds serve hashed
// asset URLs. A hard-coded '/src/…' path works in dev and 404s in dist — that
// bug has already been paid for once in this codebase.

// Both arguments must be inline literals — vite:import-glob parses this
// statically and rejects an identifier for the options object.
// Note what is absent: cards/faces/*/source.png is the archival master (8 MB
// each, 56 of them) and must never be fetched at runtime, so it is never
// globbed and therefore never emitted into dist.
function collectAssetUrls() {
  try {
    return {
      ...import.meta.glob('../../assets/frames/*.webp', { eager: true, query: '?url', import: 'default' }),
      ...import.meta.glob('../../assets/backs/*.webp', { eager: true, query: '?url', import: 'default' }),
      ...import.meta.glob('../../assets/status/*.webp', { eager: true, query: '?url', import: 'default' }),
      ...import.meta.glob('../../assets/ui/*.webp', { eager: true, query: '?url', import: 'default' }),
      ...import.meta.glob('../../assets/environment/*.webp', { eager: true, query: '?url', import: 'default' }),
      ...import.meta.glob('../../assets/cards/faces/*/thumbnail.webp', { eager: true, query: '?url', import: 'default' }),
      ...import.meta.glob('../../assets/cards/faces/*/detail.webp', { eager: true, query: '?url', import: 'default' }),
      ...import.meta.glob('../../assets/cards/faces/*/fallback.jpg', { eager: true, query: '?url', import: 'default' }),
    };
  } catch {
    // Non-Vite consumers (plain node, some unit runners) get an empty map and
    // every caller degrades to procedural rendering.
    return {};
  }
}

// Glob keys are module-relative ('../../assets/frames/creature.webp'); the
// manifest speaks in repo paths ('src/assets/frames/creature.webp'). Callers
// use manifest paths so the manifest stays the single vocabulary.
function toManifestPath(globKey) {
  return globKey.replace(/^\.\.\/\.\.\/assets\//, 'src/assets/');
}

export function buildAssetUrlMap(globResult = collectAssetUrls()) {
  const byManifestPath = {};
  for (const [key, url] of Object.entries(globResult)) {
    byManifestPath[toManifestPath(key)] = url;
  }
  return byManifestPath;
}

export const IMAGE_ASSET_URLS = buildAssetUrlMap();

// Card-art variants, in the order the ART-SPEC assigns them. `source` is
// deliberately unlisted — see collectAssetUrls above.
export const CARD_ART_VARIANTS = Object.freeze({
  thumbnail: 'thumbnail.webp', // board + hand
  detail: 'detail.webp',       // card-detail overlay
  fallback: 'fallback.jpg',    // WebP unsupported
});

// ART-SPEC §4 — status charms. Keys match the charm text the shell already
// renders, which stays in the DOM as the procedural floor and for a11y.
export const STATUS_ASSET_PATHS = Object.freeze({
  poison: 'src/assets/status/poison.webp',
  trapped: 'src/assets/status/trapped.webp',
  fortified: 'src/assets/status/fortified.webp',
  unbreakable: 'src/assets/status/unbreakable.webp',
});

// ART-SPEC §5 — UI pieces.
export const UI_ASSET_PATHS = Object.freeze({
  lifeToken: 'src/assets/ui/life-token.webp',
  manaToken: 'src/assets/ui/mana-token.webp',
  turnMarker: 'src/assets/ui/turn-marker.webp',
  dividerRune: 'src/assets/ui/divider-rune.webp',
  selectionRing: 'src/assets/ui/selection-ring.webp',
  legalTargetRing: 'src/assets/ui/legal-target-ring.webp',
  coinHeads: 'src/assets/ui/coin-heads.webp',
  coinTails: 'src/assets/ui/coin-tails.webp',
});

// ART-SPEC §6 — environment textures.
export const ENVIRONMENT_ASSET_PATHS = Object.freeze({
  meadowBackdrop: 'src/assets/environment/meadow-backdrop.webp',
  terrainColor: 'src/assets/environment/terrain-color.webp',
  terrainNormal: 'src/assets/environment/terrain-normal.webp',
  waterNormal: 'src/assets/environment/water-normal.webp',
  propsAtlas: 'src/assets/environment/props-atlas.webp',
  contactShadow: 'src/assets/environment/contact-shadow.webp',
});

export function cardArtPath(faceId, variant = 'thumbnail') {
  const file = CARD_ART_VARIANTS[variant];
  if (!faceId || !file) return null;
  return `src/assets/cards/faces/${faceId}/${file}`;
}

/**
 * One-shot WebP support probe. Returns true when undetectable, because the
 * fallback path is only worth taking on a browser that positively cannot
 * decode WebP; guessing "unsupported" would swap every card to the JPEG.
 */
export function detectWebpSupport(doc = globalThis.document) {
  try {
    const canvas = doc?.createElement?.('canvas');
    if (!canvas?.toDataURL) return true;
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return true;
  }
}

export function createImageAssetLoader({
  urls = IMAGE_ASSET_URLS,
  createImage = null,
  window: win = globalThis.window,
  document: doc = globalThis.document,
  webpSupported = null,
} = {}) {
  const makeImage = createImage ?? (() => {
    const ImageCtor = win?.Image ?? globalThis.Image;
    return ImageCtor ? new ImageCtor() : null;
  });

  // path -> 'ok' | 'dead' | Promise<string|null>
  const state = new Map();
  let webp = webpSupported;

  function supportsWebp() {
    if (webp === null) webp = detectWebpSupport(doc);
    return webp;
  }

  function url(path) {
    return (path && urls[path]) || null;
  }

  function status(path) {
    const entry = state.get(path);
    if (entry === 'ok' || entry === 'dead') return entry;
    if (entry) return 'pending';
    return url(path) ? 'unknown' : 'dead';
  }

  /**
   * Resolve a manifest path to a usable URL, or null. Never rejects: a missing
   * or broken file is a dead slot, permanently, with no retry and no log.
   */
  function load(path) {
    const cached = state.get(path);
    if (cached === 'ok') return Promise.resolve(url(path));
    if (cached === 'dead') return Promise.resolve(null);
    if (cached) return cached;

    const href = url(path);
    if (!href) {
      state.set(path, 'dead');
      return Promise.resolve(null);
    }

    const pending = new Promise((resolve) => {
      let img = null;
      try {
        img = makeImage();
      } catch {
        img = null;
      }
      if (!img) {
        // No Image constructor (jsdom without one, SSR): the URL resolved, so
        // trust the bundler rather than blocking art on an absent probe.
        state.set(path, 'ok');
        resolve(href);
        return;
      }
      const settle = (ok) => {
        state.set(path, ok ? 'ok' : 'dead');
        resolve(ok ? href : null);
      };
      try {
        img.addEventListener?.('load', () => settle(true));
        img.addEventListener?.('error', () => settle(false));
        img.onload = () => settle(true);
        img.onerror = () => settle(false);
        img.src = href;
      } catch {
        settle(false);
      }
    });

    state.set(path, pending);
    return pending;
  }

  /**
   * Paint a resolved asset as a node's background image, leaving the node's
   * procedural styling alone until (and unless) the file actually loads.
   * Returns a promise resolving true when the art was applied.
   */
  function applyBackground(node, path, {
    size = 'cover',
    position = 'center',
    repeat = 'no-repeat',
    flag = 'assetWired',
  } = {}) {
    if (!node) return Promise.resolve(false);
    return load(path).then((href) => {
      if (!href) return false;
      node.style.backgroundImage = `url("${href}")`;
      node.style.backgroundSize = size;
      node.style.backgroundPosition = position;
      node.style.backgroundRepeat = repeat;
      if (flag) node.dataset[flag] = path;
      return true;
    });
  }

  /**
   * Card art with variant fallback: prefer the requested variant, drop to the
   * JPEG when WebP is unsupported or the WebP slot is dead.
   */
  function applyCardArt(node, faceId, variant = 'thumbnail', options = {}) {
    if (!node || !faceId) return Promise.resolve(false);
    const chain = supportsWebp()
      ? [cardArtPath(faceId, variant), cardArtPath(faceId, 'fallback')]
      : [cardArtPath(faceId, 'fallback')];
    const tryNext = (index) => {
      if (index >= chain.length) return Promise.resolve(false);
      return applyBackground(node, chain[index], options)
        .then((ok) => (ok ? true : tryNext(index + 1)));
    };
    return tryNext(0);
  }

  /**
   * Publish a loaded asset as a CSS custom property (`--name: url("…")`) so
   * stylesheets can consume bundler-hashed URLs. The property is only ever set
   * on success, so `var(--name, <procedural fallback>)` in CSS is exactly the
   * degradation path — no file, no property, fallback stands.
   */
  function applyCssVar(node, varName, path) {
    if (!node?.style?.setProperty) return Promise.resolve(false);
    return load(path).then((href) => {
      if (!href) return false;
      node.style.setProperty(varName, `url("${href}")`);
      return true;
    });
  }

  function preload(paths = []) {
    return Promise.all(paths.map((p) => load(p))).then(() => undefined);
  }

  return Object.freeze({
    url,
    load,
    status,
    applyBackground,
    applyCardArt,
    applyCssVar,
    preload,
    get webpSupported() { return supportsWebp(); },
    reset() { state.clear(); },
  });
}

export const imageAssets = createImageAssetLoader();
