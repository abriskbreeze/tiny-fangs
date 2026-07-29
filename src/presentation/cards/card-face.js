// AAA card chassis builder — art bible §7 (accepted hash 84b89838…).
// Builds one card face DOM subtree from a normalized face view-model at the
// 333 × 505 unprojected chassis. Rendering at other sizes is the caller's
// per-axis transform (§7.4 scaling rule); this module never reads game state
// and fails closed on unknown families.

import {
  CHASSIS_HEIGHT,
  CHASSIS_WIDTH,
  SAFE_RECTS,
} from './chassis-geometry.js';
import { GOLDEN_SAMPLE_ART } from './art/golden-sample-art.js';
import { imageAssets } from '../assets/image-assets.js';
import { PRESENTATION_FACE_INVENTORY } from '../../../shared/face-registry.js';

// Frame artwork per face family (ART-SPEC §1). Frames are opaque plates with a
// transparent art aperture; they paint over the art window and under the text,
// so the DOM keeps compositing name, rules and medallion numerals on top.
export const FRAME_ASSET_PATHS = Object.freeze({
  creature: 'src/assets/frames/creature.webp',
  cast: 'src/assets/frames/verse-cast.webp',
  set: 'src/assets/frames/verse-set.webp',
  token: 'src/assets/frames/token.webp',
});

// ART-SPEC §2. `standard` is the deck back; `set-hidden` is the face-down set
// verse, which must stay identity-free — every hidden set card renders the
// identical file, so two different set verses are pixel-identical from behind.
export const BACK_ASSET_PATHS = Object.freeze({
  standard: 'src/assets/backs/standard.webp',
  setHidden: 'src/assets/backs/set-hidden.webp',
});

// Token creatures carry the token frame rather than the creature frame.
const TOKEN_FACE_IDS = new Set(
  PRESENTATION_FACE_INVENTORY
    .filter((face) => face.kind === 'token')
    .map((face) => face.presentationFaceId),
);

export function frameAssetPathFor(model) {
  if (!model || model.kind === 'back') return null;
  if (model.kind === 'creature' && TOKEN_FACE_IDS.has(model.faceId)) {
    return FRAME_ASSET_PATHS.token;
  }
  return FRAME_ASSET_PATHS[model.kind] ?? null;
}

const FAMILY_LABEL = {
  creature: null, // creature subtype comes from the card's own subtitle
  cast: 'Cast Verse',
  set: 'Set Verse',
};

export function normalizeFaceModel(card, kind) {
  if (kind === 'back') {
    // 'setHidden' selects the face-down set-verse back. It carries no card
    // identity by construction: the variant is chosen from the slot, never
    // from the card, so two different set verses render the same file.
    const backVariant = card?.backVariant === 'setHidden' ? 'setHidden' : 'standard';
    return { kind: 'back', backVariant };
  }
  if (!FAMILY_LABEL.hasOwnProperty(kind)) {
    throw new Error(`Unknown card face kind: ${kind}`);
  }
  if (!card || typeof card.name !== 'string' || !card.name) {
    throw new Error('Card face requires a named card');
  }
  const model = {
    kind,
    faceId: card.id ?? null,
    name: card.name,
    typeLabel: kind === 'creature' ? (card.subtitle ?? '') : FAMILY_LABEL[kind],
    cost: Number.isFinite(card.cost) ? card.cost : null,
    rulesText: card.text ?? (kind === 'creature' ? card.ability?.text ?? '' : ''),
    flavor: card.flavor ?? '',
  };
  if (kind === 'creature') {
    // Phase 5: medallions show CURRENT values. displayAtk is the effective
    // attack computed by the caller (presentation-only, from the projected
    // state); curHp is engine-authored damage state. Base stats remain the
    // fallback and the damaged/boosted flags drive ink-state styling only.
    const baseAtk = Number.isFinite(card.atk) ? card.atk : null;
    const baseHp = Number.isFinite(card.hp) ? card.hp : null;
    model.atk = Number.isFinite(card.displayAtk) ? card.displayAtk : baseAtk;
    model.hp = Number.isFinite(card.curHp) ? card.curHp : baseHp;
    model.maxHp = baseHp;
    model.damaged = Number.isFinite(card.curHp) && baseHp !== null && card.curHp < baseHp;
    model.atkBoosted = Number.isFinite(card.displayAtk) && baseAtk !== null && card.displayAtk > baseAtk;
    model.atkReduced = Number.isFinite(card.displayAtk) && baseAtk !== null && card.displayAtk < baseAtk;
    if (model.atk === null || model.hp === null) {
      throw new Error(`Creature face ${card.name} is missing atk/hp`);
    }
  }
  if (model.cost === null) {
    throw new Error(`Card face ${card.name} is missing cost`);
  }
  return model;
}

function el(doc, className, rect) {
  const node = doc.createElement('div');
  node.className = className;
  if (rect) {
    node.style.left = `${rect.left}px`;
    node.style.top = `${rect.top}px`;
    node.style.width = `${rect.right - rect.left}px`;
    node.style.height = `${rect.bottom - rect.top}px`;
  }
  return node;
}

export function buildCardFace(model, {
  document: doc = globalThis.document,
  // Which card-art derivative to request. 'thumbnail' is the board/hand size;
  // the card-detail overlay asks for 'detail'. `source.png` is an archival
  // master and is never a runtime option.
  artVariant = 'thumbnail',
  assets = imageAssets,
} = {}) {
  const kind = model.kind;
  const rects = SAFE_RECTS[kind];
  if (!rects) {
    throw new Error(`Unknown card face kind: ${kind}`);
  }

  const root = doc.createElement('article');
  root.className = `tf-aaa-card tf-aaa-card--${kind}`;
  root.style.width = `${CHASSIS_WIDTH}px`;
  root.style.height = `${CHASSIS_HEIGHT}px`;

  // §7.2 frame hierarchy, outside-in. Insets are authored px at 333 width:
  // lip 6 (1.8%), keyline 2 (0.6%), family rail 10 (3.0%), inner keyline 2
  // (0.6%) — cumulative 20 px = 6.006% per side. The frame is opaque: the art
  // window is inset a further 6 px inside the parchment field.
  const keyline = el(doc, 'tf-aaa-card__keyline');
  const rail = el(doc, 'tf-aaa-card__rail');
  const innerKeyline = el(doc, 'tf-aaa-card__inner-keyline');
  const panel = el(doc, 'tf-aaa-card__panel');
  root.append(keyline);
  keyline.append(rail);
  rail.append(innerKeyline);
  innerKeyline.append(panel);

  const content = el(doc, 'tf-aaa-card__content');
  root.append(content);

  if (kind === 'back') {
    // The inline sigil is the procedural floor and always renders; the back
    // plate paints over it if and only if the file actually loads.
    const sigil = el(doc, 'tf-aaa-card__back-sigil', rects.artFocalSafe);
    sigil.innerHTML = GOLDEN_SAMPLE_ART.backSigil;
    content.append(sigil);

    const plate = el(doc, 'tf-aaa-card__back-plate');
    content.append(plate);
    assets.applyBackground(plate, BACK_ASSET_PATHS[model.backVariant ?? 'standard']);
    return root;
  }

  // DOM order follows the approved reading order: nameplate band first, then
  // the inset art window beneath it.
  const nameplate = el(doc, 'tf-aaa-card__nameplate', rects.nameplateOuter);
  const title = doc.createElement('div');
  title.className = 'tf-aaa-card__title';
  const titleInner = doc.createElement('span');
  titleInner.className = 'tf-aaa-card__title-text';
  titleInner.textContent = model.name;
  title.append(titleInner);
  nameplate.append(title);
  content.append(nameplate);

  // Inset art window (§7.3): a 7:5 window carried by the authored
  // artFocalSafe rectangle, with the opaque frame visible all around it.
  // Authored aperture art when the face has a golden-sample piece; painterly
  // placeholder ground otherwise.
  const art = el(doc, 'tf-aaa-card__art', rects.artFocalSafe);
  const aperture = model.faceId ? GOLDEN_SAMPLE_ART[model.faceId] : null;
  if (aperture) {
    art.innerHTML = aperture;
    // Golden-sample pieces were authored for the old 256 × 267 aperture. The
    // window is now a crop, so they fill it the same way a real 7:5 raster
    // does (cover), rather than letterboxing inside it.
    const apertureSvg = art.querySelector('svg');
    if (apertureSvg) apertureSvg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  } else if (model.faceId) {
    // Card art at the requested derivative, falling back to the JPEG when
    // WebP is unsupported or the WebP slot is dead. The painterly CSS ground
    // underneath stays put until a file genuinely loads.
    art.dataset.artTier = 'template-placeholder';
    art.dataset.artVariant = artVariant;
    assets.applyCardArt(art, model.faceId, artVariant, { flag: 'artWired' });
  } else {
    art.dataset.artPending = 'true';
  }
  content.append(art);

  // The frame plate: an opaque image with a transparent art aperture, painted
  // over the art window and the procedural §7.2 frame stack, and under every
  // text and medallion rectangle (z-order lives in cards.css). When the file
  // is missing this layer stays empty and the CSS frame hierarchy shows
  // through unchanged.
  const framePath = frameAssetPathFor(model);
  if (framePath) {
    const frame = el(doc, 'tf-aaa-card__frame');
    content.append(frame);
    assets.applyBackground(frame, framePath, { size: '100% 100%', flag: 'frameWired' });
  }

  // The seal stamps the art window's bottom edge, so it is appended after the
  // art to paint over it.
  const seal = el(doc, 'tf-aaa-card__seal', rects.familySeal);
  content.append(seal);

  const typeRow = el(doc, 'tf-aaa-card__type', rects.typeSubtitle);
  const typeChip = doc.createElement('span');
  typeChip.className = 'tf-aaa-card__type-text';
  typeChip.textContent = model.typeLabel;
  typeRow.append(typeChip);
  content.append(typeRow);

  const rules = el(doc, 'tf-aaa-card__rules', rects.rulesText);
  rules.textContent = model.rulesText;
  content.append(rules);

  // The flavor line is wrapped so its rendered ink box can be measured
  // against the footer rectangle (a centered flex child can overflow in both
  // directions, which scrollHeight alone would miss).
  const footer = el(doc, 'tf-aaa-card__footer', rects.footer);
  const footerText = doc.createElement('span');
  footerText.className = 'tf-aaa-card__footer-text';
  footerText.textContent = model.flavor;
  footer.append(footerText);
  content.append(footer);

  const cost = el(doc, 'tf-aaa-card__cost', rects.cost);
  cost.innerHTML = `<span class="tf-aaa-card__medallion-num">${model.cost}</span>`;
  content.append(cost);

  if (kind === 'creature') {
    const attack = el(doc, 'tf-aaa-card__attack', rects.attack);
    attack.innerHTML =
      `<span class="tf-aaa-card__medallion-num">${model.atk}</span>`;
    if (model.atkBoosted) attack.dataset.boosted = 'true';
    if (model.atkReduced) attack.dataset.reduced = 'true';
    const health = el(doc, 'tf-aaa-card__health', rects.health);
    health.innerHTML =
      `<span class="tf-aaa-card__medallion-num">${model.hp}</span>`;
    if (model.damaged) health.dataset.damaged = 'true';
    content.append(attack, health);
  }

  return root;
}
