import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createKeyedListView } from '../../src/presentation/dom/keyed-board-view.js';

// Minimal faithful DOM stand-in: ordered children, insertBefore-with-move
// semantics (an inserted node is first detached from its current parent),
// and node.remove() — the exact surface the reconciler uses.
function makeElement() {
  const el = {
    children: [],
    parent: null,
    dataset: {},
    textContent: '',
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
    contains(node) {
      return el.children.includes(node);
    },
  };
  return el;
}

function makeView(container, hooks = {}) {
  return createKeyedListView(container, {
    create: (vm) => {
      const el = makeElement();
      el.textContent = vm.name ?? '';
      return el;
    },
    patch: (el, vm) => {
      el.textContent = vm.name ?? '';
    },
    ...hooks,
  });
}

describe('keyed board view', () => {
  let container;
  beforeEach(() => {
    container = makeElement();
  });

  it('creates, patches in place, and preserves DOM identity across moves', () => {
    const view = makeView(container);
    const first = view.reconcile([
      { uid: 'a', name: 'Shellkin' },
      { uid: 'b', name: 'Ironhide' },
    ]);
    expect(first.created).toEqual(['a', 'b']);
    const nodeA = view.nodeFor('a');

    const second = view.reconcile([
      { uid: 'b', name: 'Ironhide' },
      { uid: 'a', name: 'Shellkin+' },
    ]);
    expect(second.created).toEqual([]);
    expect(second.patched).toEqual(['b', 'a']);
    expect(view.nodeFor('a')).toBe(nodeA);
    expect(nodeA.textContent).toBe('Shellkin+');
    expect([...container.children].map((c) => c.dataset.uid)).toEqual(['b', 'a']);
  });

  it('a card keeps one DOM node while moving between zones', () => {
    const hand = makeElement();
    const board = makeElement();
    const handView = makeView(hand);

    handView.reconcile([{ uid: 'c1', name: 'Coilshell' }]);
    const node = handView.nodeFor('c1');
    // Zone move: the transition planner hands the same node to the next zone
    // through create; identity is preserved by adoption, not recreation.
    const adoptingView = createKeyedListView(board, {
      create: () => node,
      patch: (el, vm) => {
        el.textContent = vm.name;
      },
    });
    handView.reconcile([]);
    adoptingView.reconcile([{ uid: 'c1', name: 'Coilshell' }]);
    expect(adoptingView.nodeFor('c1')).toBe(node);
    expect(board.contains(node)).toBe(true);
  });

  it('removes departed nodes and reports them, with onRemove hook', () => {
    const onRemove = vi.fn();
    const view = makeView(container, { onRemove });
    view.reconcile([{ uid: 'a' }, { uid: 'b' }]);
    const result = view.reconcile([{ uid: 'b' }]);
    expect(result.removed).toEqual(['a']);
    expect(onRemove).toHaveBeenCalledWith('a', expect.anything());
    expect(container.children).toHaveLength(1);
  });

  it('rejects duplicate and missing uids', () => {
    const view = makeView(container);
    expect(() => view.reconcile([{ uid: 'a' }, { uid: 'a' }])).toThrow(/duplicate uid/);
    expect(() => view.reconcile([{ name: 'no-uid' }])).toThrow(/no uid/);
  });

  it('reconcile is idempotent for identical input', () => {
    const view = makeView(container);
    view.reconcile([{ uid: 'a' }, { uid: 'b' }]);
    const again = view.reconcile([{ uid: 'a' }, { uid: 'b' }]);
    expect(again.created).toEqual([]);
    expect(again.moved).toEqual([]);
    expect([...container.children].map((c) => c.dataset.uid)).toEqual(['a', 'b']);
  });

  it('computes FLIP deltas only for nodes that actually moved', () => {
    const view = makeView(container);
    view.reconcile([{ uid: 'a' }, { uid: 'b' }]);
    const rects = new Map([
      ['a', { left: 0, top: 0 }],
      ['b', { left: 100, top: 0 }],
    ]);
    const nodeA = view.nodeFor('a');
    const nodeB = view.nodeFor('b');
    nodeA.getBoundingClientRect = () => ({ left: 100, top: 0 });
    nodeB.getBoundingClientRect = () => ({ left: 100, top: 0 });
    const deltas = view.flipDeltas(rects);
    expect(deltas.get('a')).toEqual({ dx: -100, dy: 0 });
    expect(deltas.has('b')).toBe(false);
  });

  it('clear removes everything exactly once', () => {
    const onRemove = vi.fn();
    const view = makeView(container, { onRemove });
    view.reconcile([{ uid: 'a' }, { uid: 'b' }]);
    view.clear();
    expect(container.children).toHaveLength(0);
    expect(view.size()).toBe(0);
    expect(onRemove).toHaveBeenCalledTimes(2);
  });
});
