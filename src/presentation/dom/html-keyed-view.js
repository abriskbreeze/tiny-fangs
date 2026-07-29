// HTML-string adapter over the uid-keyed reconciler (plan Phase 4). Classic
// zones already produce their markup as template strings (src/render.js); this
// adapter keeps that markup byte-for-byte while giving each card one stable
// DOM node: create parses the string once, patch syncs attributes and inner
// content in place so identity (and FLIP measurement) survives re-renders.

import { createKeyedListView } from './keyed-board-view.js';

function defaultParseHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild;
}

// Syncs an existing element to freshly rendered markup in place: attributes
// mirror the fresh element exactly (minus `preservedAttributes`), children are
// replaced only when they differ. Preserves the node's DOM identity, so id
// selectors, captured references, and future FLIP measurements stay valid.
export function syncElementToHtml(node, fresh, { preservedAttributes = [] } = {}) {
  for (const name of node.getAttributeNames()) {
    if (!preservedAttributes.includes(name) && !fresh.hasAttribute(name)) {
      node.removeAttribute(name);
    }
  }
  for (const name of fresh.getAttributeNames()) {
    const value = fresh.getAttribute(name);
    if (node.getAttribute(name) !== value) {
      node.setAttribute(name, value);
    }
  }
  if (node.innerHTML !== fresh.innerHTML) {
    node.innerHTML = fresh.innerHTML;
  }
}

export function createHtmlKeyedView(container, { parseHtml = defaultParseHtml } = {}) {
  // uid -> last applied html, so unchanged view-models skip parsing entirely.
  const appliedHtml = new Map();

  const parse = (html) => {
    const node = parseHtml(html);
    if (!node) {
      throw new Error('html keyed view-model produced no element');
    }
    return node;
  };

  return createKeyedListView(container, {
    create(viewModel) {
      appliedHtml.set(String(viewModel.uid), viewModel.html);
      return parse(viewModel.html);
    },
    patch(node, viewModel) {
      const uid = String(viewModel.uid);
      if (appliedHtml.get(uid) === viewModel.html) return;
      const fresh = parse(viewModel.html);
      // data-uid is reconciler-owned identity; everything else mirrors the
      // freshly rendered markup exactly.
      syncElementToHtml(node, fresh, { preservedAttributes: ['data-uid'] });
      appliedHtml.set(uid, viewModel.html);
    },
    onRemove(uid) {
      appliedHtml.delete(uid);
    },
  });
}
