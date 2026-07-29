// Shared board-card mounting for the AAA presentation: card-stock extrusion,
// directional grounded shadows, and the homography that maps the 333 × 505
// chassis onto a camera-lock golden quadrilateral. Extracted from the Phase 7
// board harness so the harness and the real shell render cards identically.

import { applyQuadTransform } from './quad-transform.js';

export const CHASSIS_W = 333;
export const CHASSIS_H = 505;

// Directional grounded shadow under the scene's single sun (upper-left key
// => shadow offset down-right): tight dark core, longer soft tail, and a
// warm light spill on the sun side. `lightSpill: false` drops the third,
// purely additive layer (Phase 13 desktop-low budget); the two grounding
// layers — the ones that actually seat the card — always render.
export function addBoardShadow(layer, corners, {
  document: doc = globalThis.document,
  lightSpill = true,
} = {}) {
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const pad = 14;
  const make = (dx, dy, extraW, background) => {
    const node = doc.createElement('div');
    node.className = 'card-shadow';
    node.style.position = 'absolute';
    node.style.pointerEvents = 'none';
    node.style.left = `${left - pad + dx}px`;
    node.style.top = `${top - pad + dy}px`;
    node.style.width = `${width + pad * 2 + extraW}px`;
    node.style.height = `${height + pad * 2}px`;
    node.style.background = background;
    layer.appendChild(node);
    return node;
  };
  const nodes = [
    make(15, 21, 0,
      'radial-gradient(50% 50% at 46% 44%, rgba(26,16,8,0.52) 0%, rgba(26,16,8,0.3) 50%, rgba(26,16,8,0) 72%)'),
    make(34, 44, 26,
      'radial-gradient(52% 48% at 50% 48%, rgba(30,22,10,0.2) 0%, rgba(30,22,10,0) 68%)'),
  ];
  if (lightSpill) {
    nodes.push(make(-9, -11, 0,
      'radial-gradient(44% 44% at 40% 36%, rgba(245,215,131,0.15) 0%, rgba(245,215,131,0) 68%)'));
  }
  return nodes;
}

// Scale-aware stepped card-stock extrusion: offsets are authored in final
// screen px and divided by the render scale so the edge survives homography.
export function addCardStock(wrapper, isStack, renderScale = 1, { document: doc = globalThis.document } = {}) {
  const screenSteps = isStack
    ? [[13, 18, '#7E6248'], [9, 12.5, '#CBA87E'], [5, 7, '#8F7355'], [2.2, 3, '#C4A47A']]
    : [[5.5, 7.5, '#7E6248'], [3.6, 5, '#B99977'], [1.8, 2.5, '#C4A47A']];
  for (const [dx, dy, tint] of screenSteps) {
    const slab = doc.createElement('div');
    slab.style.position = 'absolute';
    slab.style.width = `${CHASSIS_W}px`;
    slab.style.height = `${CHASSIS_H}px`;
    slab.style.borderRadius = '21px';
    slab.style.background = `linear-gradient(150deg, ${tint} 0%, #96795B 100%)`;
    slab.style.transform =
      `translate(${(dx / renderScale).toFixed(2)}px, ${(dy / renderScale).toFixed(2)}px)`;
    wrapper.appendChild(slab);
  }
}

export function quadRenderScale(corners) {
  const xs = corners.map((c) => c[0]);
  return (Math.max(...xs) - Math.min(...xs)) / CHASSIS_W;
}

/**
 * Mount one card face onto a golden quad: wrapper with stock slabs + the
 * chassis face, homography-transformed, plus grounded shadows on the shadow
 * layer. Returns { wrapper, shadows } so callers can clear/replace them.
 */
export function mountBoardCard({
  layer,
  shadowLayer,
  corners,
  face,
  isStack = false,
  anchorId = null,
  lightSpill = true,
  document: doc = globalThis.document,
}) {
  const shadows = shadowLayer
    ? addBoardShadow(shadowLayer, corners, { document: doc, lightSpill })
    : [];
  const wrapper = doc.createElement('div');
  wrapper.className = 'board-card';
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.transformOrigin = '0 0';
  if (anchorId) wrapper.dataset.anchor = anchorId;
  addCardStock(wrapper, isStack, quadRenderScale(corners), { document: doc });
  face.style.position = 'absolute';
  wrapper.appendChild(face);
  applyQuadTransform(wrapper, CHASSIS_W, CHASSIS_H, corners);
  layer.appendChild(wrapper);
  return { wrapper, shadows };
}
