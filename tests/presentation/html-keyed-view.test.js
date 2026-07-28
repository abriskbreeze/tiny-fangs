import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHtmlKeyedView } from '../../src/presentation/dom/html-keyed-view.js';

// Minimal faithful DOM stand-in extending the keyed-board-view harness with
// the attribute/innerHTML surface the html adapter patches through.
function makeElement() {
  const attributes = new Map();
  const el = {
    children: [],
    parent: null,
    dataset: {},
    innerHTML: '',
    insertBefore(node, before) {
      if (node.parent) {
        const i = node.parent.children.indexOf(node);
        if (i !== -1) node.parent.children.splice(i, 1);
      }
      const at = before ? el.children.indexOf(before) : el.children.length;
      el.children.splice(at === -1 ? el.children.length : at, 0, node);
      node.parent = el;
    },
    remove() {
      if (el.parent) {
        const i = el.parent.children.indexOf(el);
        if (i !== -1) el.parent.children.splice(i, 1);
        el.parent = null;
      }
    },
    getAttributeNames() {
      return [...attributes.keys()];
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === 'data-uid') el.dataset.uid = String(value);
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === 'data-uid') delete el.dataset.uid;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
  };
  // Keep dataset.uid writes (used by the reconciler) visible as an attribute,
  // matching real DOM reflection.
  el.dataset = new Proxy({}, {
    set(target, key, value) {
      target[key] = value;
      if (key === 'uid') attributes.set('data-uid', String(value));
      return true;
    },
    deleteProperty(target, key) {
      delete target[key];
      if (key === 'uid') attributes.delete('data-uid');
      return true;
    },
  });
  return el;
}

// "html" strings in these tests are JSON specs: { attrs, inner }. The
// injected parser builds a stand-in node from the spec, mirroring what the
// browser template parser does with real markup.
function specParser() {
  return vi.fn((html) => {
    const spec = JSON.parse(html);
    const node = makeElement();
    for (const [name, value] of Object.entries(spec.attrs ?? {})) {
      node.setAttribute(name, value);
    }
    node.innerHTML = spec.inner ?? '';
    return node;
  });
}

const vm = (uid, attrs, inner) => ({ uid, html: JSON.stringify({ attrs, inner }) });

describe('createHtmlKeyedView', () => {
  let container;
  let parseHtml;
  let view;

  beforeEach(() => {
    container = makeElement();
    parseHtml = specParser();
    view = createHtmlKeyedView(container, { parseHtml });
  });

  it('creates parsed nodes in view-model order with reconciler-owned data-uid', () => {
    view.reconcile([
      vm('a', { class: 'hand-card' }, 'A'),
      vm('b', { class: 'hand-card selected' }, 'B'),
    ]);
    expect(container.children.map(n => n.dataset.uid)).toEqual(['a', 'b']);
    expect(container.children[0].getAttribute('class')).toBe('hand-card');
    expect(container.children[1].innerHTML).toBe('B');
    expect(parseHtml).toHaveBeenCalledTimes(2);
  });

  it('skips parsing entirely when a view-model html is unchanged', () => {
    const models = [vm('a', { class: 'hand-card' }, 'A')];
    view.reconcile(models);
    parseHtml.mockClear();
    view.reconcile(models);
    expect(parseHtml).not.toHaveBeenCalled();
  });

  it('patches attributes and inner content in place, preserving node identity', () => {
    view.reconcile([vm('a', { class: 'hand-card', onclick: 'x' }, 'A')]);
    const node = container.children[0];
    view.reconcile([vm('a', { class: 'hand-card selected', onclick: 'x' }, 'A2')]);
    expect(container.children[0]).toBe(node);
    expect(node.getAttribute('class')).toBe('hand-card selected');
    expect(node.getAttribute('onclick')).toBe('x');
    expect(node.innerHTML).toBe('A2');
  });

  it('removes stale attributes but never data-uid', () => {
    view.reconcile([vm('a', { class: 'hand-card', title: 'gone' }, 'A')]);
    const node = container.children[0];
    view.reconcile([vm('a', { class: 'hand-card' }, 'A3')]);
    expect(node.hasAttribute('title')).toBe(false);
    expect(node.dataset.uid).toBe('a');
  });

  it('keeps identity across reorder combined with content change', () => {
    view.reconcile([vm('a', {}, 'A'), vm('b', {}, 'B')]);
    const [nodeA, nodeB] = container.children;
    view.reconcile([vm('b', {}, 'B2'), vm('a', {}, 'A')]);
    expect(container.children).toEqual([nodeB, nodeA]);
    expect(nodeB.innerHTML).toBe('B2');
  });

  it('re-parses a uid that was removed and later recreated', () => {
    const model = vm('a', {}, 'A');
    view.reconcile([model]);
    view.reconcile([]);
    expect(container.children).toEqual([]);
    parseHtml.mockClear();
    view.reconcile([model]);
    expect(parseHtml).toHaveBeenCalledTimes(1);
    expect(container.children[0].innerHTML).toBe('A');
  });

  it('clear empties the container and the applied-html cache', () => {
    const model = vm('a', {}, 'A');
    view.reconcile([model]);
    view.clear();
    expect(container.children).toEqual([]);
    parseHtml.mockClear();
    view.reconcile([model]);
    expect(parseHtml).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the parser produces no element', () => {
    const badParser = vi.fn(() => null);
    const badView = createHtmlKeyedView(makeElement(), { parseHtml: badParser });
    expect(() => badView.reconcile([{ uid: 'a', html: 'whatever' }])).toThrow(
      /produced no element/
    );
  });
});
