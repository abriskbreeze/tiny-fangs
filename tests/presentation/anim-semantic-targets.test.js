import { afterEach, describe, expect, it } from 'vitest';
import { Anim } from '../../src/anim.js';

// Phase 4 acceptance: animation targeting resolves against the active shell
// only. These contracts drive Anim's semantic helpers over a faithful
// document stand-in with both classic shells present and one visible.
function makeStubDocument({ activeShell = 'desktop' } = {}) {
  const elements = new Map();
  const register = (id, extra = {}) => {
    const node = {
      id,
      style: {},
      queries: [],
      child: extra.child ?? null,
      children: extra.children ?? [],
      querySelector(selector) {
        node.queries.push(selector);
        return node.child;
      },
      querySelectorAll(selector) {
        node.queries.push(selector);
        return node.children;
      },
    };
    elements.set(id, node);
    return node;
  };
  register('desktop').style.display = activeShell === 'desktop' ? '' : 'none';
  register('mobile').style.display = activeShell === 'mobile' ? '' : 'none';
  return {
    register,
    byId: (id) => elements.get(id) ?? null,
    getElementById: (id) => elements.get(id) ?? null,
  };
}

const originalDocument = globalThis.document;

afterEach(() => {
  globalThis.document = originalDocument;
});

describe('Anim semantic active-shell targeting', () => {
  it('resolves the exact nth bench card of the desktop shell only', () => {
    const doc = makeStubDocument({ activeShell: 'desktop' });
    const sentinel = { id: 'bench-card' };
    doc.register('d-my-bench', { child: sentinel });
    doc.register('m-my-bench', { child: { id: 'hidden-tree-card' } });
    globalThis.document = doc;

    expect(Anim.benchCardEl('me', 1)).toBe(sentinel);
    expect(doc.byId('d-my-bench').queries).toStrictEqual([
      '.card-mini:nth-child(2)',
    ]);
    expect(doc.byId('m-my-bench').queries).toStrictEqual([]);
  });

  it('resolves the mobile bench when the mobile shell is the visible one', () => {
    const doc = makeStubDocument({ activeShell: 'mobile' });
    const sentinel = { id: 'mobile-bench-card' };
    doc.register('m-opp-bench', { child: sentinel });
    doc.register('d-opp-bench', { child: { id: 'hidden-tree-card' } });
    globalThis.document = doc;

    expect(Anim.benchCardEl('opp', 0)).toBe(sentinel);
    expect(doc.byId('m-opp-bench').queries).toStrictEqual([
      '.card-mini:nth-child(1)',
    ]);
    expect(doc.byId('d-opp-bench').queries).toStrictEqual([]);
  });

  it('resolves the active card inside the active-shell container', () => {
    const doc = makeStubDocument({ activeShell: 'desktop' });
    const card = { id: 'active-card' };
    doc.register('d-my-active', { child: card });
    globalThis.document = doc;

    expect(Anim.activeCardEl('me')).toBe(card);
    expect(doc.byId('d-my-active').queries).toStrictEqual(['.card-active']);
  });

  it('resolves set slots per shell', () => {
    const doc = makeStubDocument({ activeShell: 'mobile' });
    doc.register('m-opp-set');
    doc.register('d-opp-set');
    globalThis.document = doc;

    expect(Anim.setSlotEl('opp')).toBe(doc.byId('m-opp-set'));
  });

  it('animates mana pips only when the desktop shell renders them', () => {
    const desktopDoc = makeStubDocument({ activeShell: 'desktop' });
    desktopDoc.register('d-mana-pips');
    globalThis.document = desktopDoc;
    expect(Anim.manaPipContainer()).toBe(desktopDoc.byId('d-mana-pips'));

    const mobileDoc = makeStubDocument({ activeShell: 'mobile' });
    mobileDoc.register('m-my-mana');
    mobileDoc.register('d-mana-pips');
    globalThis.document = mobileDoc;
    expect(Anim.manaPipContainer()).toBe(null);
  });

  it('resolves nothing without crashing when no document exists', () => {
    globalThis.document = undefined;
    expect(Anim.activeCardEl('me')).toBe(null);
    expect(Anim.benchCardEl('opp', 0)).toBe(null);
    expect(Anim.benchCardEls('me')).toStrictEqual([]);
    expect(Anim.setSlotEl('me')).toBe(null);
    expect(Anim.manaPipContainer()).toBe(null);
  });
});
