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

const FAMILY_LABEL = {
  creature: null, // creature subtype comes from the card's own subtitle
  cast: 'Cast Verse',
  set: 'Set Verse',
};

export function normalizeFaceModel(card, kind) {
  if (kind === 'back') {
    return { kind: 'back' };
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
    model.atk = Number.isFinite(card.atk) ? card.atk : null;
    model.hp = Number.isFinite(card.hp) ? card.hp : null;
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

export function buildCardFace(model, { document: doc = globalThis.document } = {}) {
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
  // lip 11.5 (3.45%), keyline 3 (0.9%), family rail 21 (6.3%), inner
  // keyline 3 (0.9%) — cumulative 38.5 px = 11.56% per side.
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
    const sigil = el(doc, 'tf-aaa-card__back-sigil', rects.artFocalSafe);
    sigil.innerHTML = GOLDEN_SAMPLE_ART.backSigil;
    content.append(sigil);
    return root;
  }

  // Physical art aperture (§7.3): authored aperture art when the face has a
  // golden-sample piece; painterly placeholder ground otherwise.
  const art = el(doc, 'tf-aaa-card__art');
  const aperture = model.faceId ? GOLDEN_SAMPLE_ART[model.faceId] : null;
  if (aperture) {
    art.innerHTML = aperture;
  } else if (model.faceId) {
    // Phase 6 template mode: the face registry maps every renderable face to
    // its faction template at the canonical manifest path.
    art.style.backgroundImage =
      `url('/src/assets/cards/faces/${model.faceId}/thumbnail.webp')`;
    art.style.backgroundSize = 'cover';
    art.style.backgroundPosition = 'center';
    art.dataset.artTier = 'template-placeholder';
  } else {
    art.dataset.artPending = 'true';
  }
  content.append(art);

  const typeRow = el(doc, 'tf-aaa-card__type', rects.typeSubtitle);
  const typeChip = doc.createElement('span');
  typeChip.textContent = model.typeLabel;
  typeRow.append(typeChip);
  content.append(typeRow);

  const nameplate = el(doc, 'tf-aaa-card__nameplate', rects.nameplateOuter);
  const title = doc.createElement('div');
  title.className = 'tf-aaa-card__title';
  const titleInner = doc.createElement('span');
  titleInner.className = 'tf-aaa-card__title-text';
  titleInner.textContent = model.name;
  title.append(titleInner);
  nameplate.append(title);
  content.append(nameplate);

  const seal = el(doc, 'tf-aaa-card__seal', rects.familySeal);
  content.append(seal);

  const rules = el(doc, 'tf-aaa-card__rules', rects.rulesText);
  rules.textContent = model.rulesText;
  content.append(rules);

  const footer = el(doc, 'tf-aaa-card__footer', rects.footer);
  footer.textContent = model.flavor;
  content.append(footer);

  const cost = el(doc, 'tf-aaa-card__cost', rects.cost);
  cost.innerHTML = `<span class="tf-aaa-card__medallion-num">${model.cost}</span>`;
  content.append(cost);

  if (kind === 'creature') {
    const attack = el(doc, 'tf-aaa-card__attack', rects.attack);
    attack.innerHTML =
      `<span class="tf-aaa-card__medallion-num">${model.atk}</span>`;
    const health = el(doc, 'tf-aaa-card__health', rects.health);
    health.innerHTML =
      `<span class="tf-aaa-card__medallion-num">${model.hp}</span>`;
    content.append(attack, health);
  }

  return root;
}
