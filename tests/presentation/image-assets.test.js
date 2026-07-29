// The graceful-degradation contract for image assets.
//
// Every art file in this project is placeholder-pending user regeneration, so
// the renderer must be fully playable with ZERO files present and improve as
// files land. These tests pin both halves of that: absent art leaves the
// procedural rendering byte-for-byte alone, present art is actually used.

import { describe, expect, it } from 'vitest';

import {
  CARD_ART_VARIANTS,
  ENVIRONMENT_ASSET_PATHS,
  IMAGE_ASSET_URLS,
  STATUS_ASSET_PATHS,
  UI_ASSET_PATHS,
  buildAssetUrlMap,
  cardArtPath,
  createImageAssetLoader,
} from '../../src/presentation/assets/image-assets.js';
import {
  BACK_ASSET_PATHS,
  FRAME_ASSET_PATHS,
  buildCardFace,
  normalizeFaceModel,
} from '../../src/presentation/cards/card-face.js';

// The repo has no DOM library in the unit runner, so this is the same
// hand-rolled-fake approach the other presentation tests use — just enough
// element surface for the chassis builder and a class-selector querySelector.
function makeDoc() {
  const createElement = (tag) => {
    const node = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      innerHTML: '',
      dataset: {},
      children: [],
      // Unset CSS properties read back as '' on a real CSSStyleDeclaration.
      style: {
        backgroundImage: '', backgroundSize: '', backgroundPosition: '',
        backgroundRepeat: '', left: '', top: '', width: '', height: '',
        setProperty(name, value) { this[name] = value; },
        getPropertyValue(name) { return this[name] ?? ''; },
      },
      append(...nodes) { node.children.push(...nodes); },
      appendChild(child) { node.children.push(child); return child; },
      setAttribute() {},
      querySelector(selector) {
        const wanted = selector.replace(/^\./, '');
        const byClass = selector.startsWith('.');
        for (const child of node.children) {
          const hit = byClass
            ? String(child.className).split(/\s+/).includes(wanted)
            : child.tagName === wanted.toUpperCase();
          if (hit) return child;
          const nested = child.querySelector?.(selector);
          if (nested) return nested;
        }
        return null;
      },
    };
    return node;
  };
  return { createElement };
}

// A controllable Image stand-in: records every construction and lets the test
// decide whether the file "exists".
function imageFactory(outcome) {
  const made = [];
  const createImage = () => {
    const img = {
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      set src(value) {
        this._src = value;
        const settle = outcome(value) ? 'load' : 'error';
        // Fire asynchronously, as a real image does.
        queueMicrotask(() => {
          this.listeners[settle]?.();
          if (settle === 'load') this.onload?.(); else this.onerror?.();
        });
      },
      get src() { return this._src; },
    };
    made.push(img);
    return img;
  };
  return { createImage, made };
}

const PRESENT = { 'src/assets/frames/creature.webp': '/assets/creature-abc123.webp' };

describe('missing art degrades to procedural rendering', () => {
  it('reports every slot dead and applies nothing when no files exist', async () => {
    const doc = makeDoc();
    const node = doc.createElement('div');
    const loader = createImageAssetLoader({ urls: {}, createImage: () => null });

    const applied = await loader.applyBackground(node, FRAME_ASSET_PATHS.creature);

    expect(applied).toBe(false);
    expect(node.style.backgroundImage).toBe('');
    expect(node.dataset.assetWired).toBeUndefined();
    expect(loader.status(FRAME_ASSET_PATHS.creature)).toBe('dead');
  });

  it('never throws and never sets a CSS variable for an absent asset', async () => {
    const doc = makeDoc();
    const node = doc.createElement('div');
    const loader = createImageAssetLoader({ urls: {}, createImage: () => null });

    await expect(
      loader.applyCssVar(node, '--tf-ring-selection', UI_ASSET_PATHS.selectionRing),
    ).resolves.toBe(false);
    expect(node.style.getPropertyValue('--tf-ring-selection')).toBe('');
  });

  it('marks a broken file dead on first error and never retries it', async () => {
    const doc = makeDoc();
    const node = doc.createElement('div');
    const { createImage, made } = imageFactory(() => false);
    const loader = createImageAssetLoader({ urls: PRESENT, createImage });

    expect(await loader.applyBackground(node, FRAME_ASSET_PATHS.creature)).toBe(false);
    expect(await loader.applyBackground(node, FRAME_ASSET_PATHS.creature)).toBe(false);
    expect(await loader.load(FRAME_ASSET_PATHS.creature)).toBe(null);

    // One probe total across three calls: dead is permanent, no retry storm.
    expect(made).toHaveLength(1);
    expect(loader.status(FRAME_ASSET_PATHS.creature)).toBe('dead');
    expect(node.style.backgroundImage).toBe('');
  });

  it('keeps the full procedural card chassis when no art loads', () => {
    const doc = makeDoc();
    const deadLoader = createImageAssetLoader({ urls: {}, createImage: () => null });
    const card = {
      id: 'gloom', name: 'Gloom', subtitle: 'Void Mite', cost: 2, atk: 20, hp: 30,
      ability: { text: 'x' }, flavor: 'y',
    };

    const root = buildCardFace(normalizeFaceModel(card, 'creature'), {
      document: doc, assets: deadLoader,
    });

    // The §7.2 frame hierarchy and every content rectangle still render.
    for (const cls of ['__keyline', '__rail', '__inner-keyline', '__panel',
      '__art', '__nameplate', '__rules', '__footer', '__cost', '__attack', '__health']) {
      expect(root.querySelector(`.tf-aaa-card${cls}`), cls).not.toBe(null);
    }
    // The frame plate exists but is unpainted, so CSS keeps the authored frame.
    const frame = root.querySelector('.tf-aaa-card__frame');
    expect(frame).not.toBe(null);
    expect(frame.style.backgroundImage).toBe('');
    expect(frame.dataset.frameWired).toBeUndefined();
  });
});

describe('present art is actually used', () => {
  it('paints a loaded frame and flags it', async () => {
    const doc = makeDoc();
    const node = doc.createElement('div');
    const { createImage } = imageFactory(() => true);
    const loader = createImageAssetLoader({ urls: PRESENT, createImage });

    expect(await loader.applyBackground(node, FRAME_ASSET_PATHS.creature)).toBe(true);
    expect(node.style.backgroundImage).toBe('url("/assets/creature-abc123.webp")');
    expect(node.dataset.assetWired).toBe(FRAME_ASSET_PATHS.creature);
    expect(loader.status(FRAME_ASSET_PATHS.creature)).toBe('ok');
  });

  it('wires the frame plate into the chassis when the file loads', async () => {
    const doc = makeDoc();
    const { createImage } = imageFactory(() => true);
    const loader = createImageAssetLoader({ urls: PRESENT, createImage });
    const card = {
      id: 'gloom', name: 'Gloom', subtitle: 'Void Mite', cost: 2, atk: 20, hp: 30,
      ability: { text: 'x' }, flavor: 'y',
    };

    const root = buildCardFace(normalizeFaceModel(card, 'creature'), {
      document: doc, assets: loader,
    });
    await loader.load(FRAME_ASSET_PATHS.creature);
    await Promise.resolve();

    const frame = root.querySelector('.tf-aaa-card__frame');
    expect(frame.dataset.frameWired).toBe(FRAME_ASSET_PATHS.creature);
    expect(frame.style.backgroundImage).toContain('creature-abc123.webp');
  });
});

describe('card-art variants map to their intended uses', () => {
  it('offers thumbnail, detail and fallback but never the archival source', () => {
    expect(Object.keys(CARD_ART_VARIANTS).sort()).toEqual(['detail', 'fallback', 'thumbnail']);
    expect(cardArtPath('gloom', 'source')).toBe(null);
    // source.png is not globbed, so it is never emitted or fetched.
    expect(Object.keys(IMAGE_ASSET_URLS).some((p) => p.endsWith('source.png'))).toBe(false);
  });

  it('requests the large derivative for detail and the small one for board', () => {
    expect(cardArtPath('gloom', 'thumbnail'))
      .toBe('src/assets/cards/faces/gloom/thumbnail.webp');
    expect(cardArtPath('gloom', 'detail'))
      .toBe('src/assets/cards/faces/gloom/detail.webp');
  });

  it('falls back to the JPEG when WebP is unsupported', async () => {
    const doc = makeDoc();
    const node = doc.createElement('div');
    const urls = {
      'src/assets/cards/faces/gloom/thumbnail.webp': '/w.webp',
      'src/assets/cards/faces/gloom/fallback.jpg': '/f.jpg',
    };
    const { createImage } = imageFactory(() => true);
    const loader = createImageAssetLoader({ urls, createImage, webpSupported: false });

    expect(await loader.applyCardArt(node, 'gloom', 'thumbnail')).toBe(true);
    expect(node.style.backgroundImage).toBe('url("/f.jpg")');
  });

  it('falls back to the JPEG when the WebP slot is dead', async () => {
    const doc = makeDoc();
    const node = doc.createElement('div');
    const urls = {
      'src/assets/cards/faces/gloom/thumbnail.webp': '/w.webp',
      'src/assets/cards/faces/gloom/fallback.jpg': '/f.jpg',
    };
    const { createImage } = imageFactory((src) => src === '/f.jpg');
    const loader = createImageAssetLoader({ urls, createImage, webpSupported: true });

    expect(await loader.applyCardArt(node, 'gloom', 'thumbnail')).toBe(true);
    expect(node.style.backgroundImage).toBe('url("/f.jpg")');
  });
});

describe('manifest paths resolve through the bundler', () => {
  // A hard-coded '/src/...' URL works in dev and 404s in dist. These assert the
  // glob actually resolved the files that exist on disk today.
  const wired = [
    ...Object.values(FRAME_ASSET_PATHS),
    ...Object.values(BACK_ASSET_PATHS),
    ...Object.values(STATUS_ASSET_PATHS),
    ...Object.values(UI_ASSET_PATHS),
    ...Object.values(ENVIRONMENT_ASSET_PATHS),
  ];

  it.each(wired)('%s resolves to a built URL', (path) => {
    expect(IMAGE_ASSET_URLS[path]).toBeTruthy();
  });

  it('maps glob keys onto manifest-relative paths', () => {
    expect(buildAssetUrlMap({ '../../assets/frames/creature.webp': '/x.webp' }))
      .toEqual({ 'src/assets/frames/creature.webp': '/x.webp' });
  });
});

describe('face-down set verses stay identity-free', () => {
  it('renders the same back file regardless of which verse is hidden', () => {
    const doc = makeDoc();
    const applied = [];
    const loader = {
      applyBackground: (node, path) => { applied.push(path); return Promise.resolve(true); },
      applyCardArt: () => Promise.resolve(false),
    };

    buildCardFace(normalizeFaceModel({ backVariant: 'setHidden' }, 'back'),
      { document: doc, assets: loader });
    buildCardFace(normalizeFaceModel({ backVariant: 'setHidden' }, 'back'),
      { document: doc, assets: loader });

    expect(applied).toEqual([BACK_ASSET_PATHS.setHidden, BACK_ASSET_PATHS.setHidden]);
  });

  it('uses the standard deck back by default', () => {
    expect(normalizeFaceModel(null, 'back')).toEqual({ kind: 'back', backVariant: 'standard' });
  });
});
