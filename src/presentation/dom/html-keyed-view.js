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
      for (const name of node.getAttributeNames()) {
        if (name !== 'data-uid' && !fresh.hasAttribute(name)) {
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
      appliedHtml.set(uid, viewModel.html);
    },
    onRemove(uid) {
      appliedHtml.delete(uid);
    },
  });
}
