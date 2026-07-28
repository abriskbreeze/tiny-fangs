import { afterEach, describe, expect, it, vi } from 'vitest';
import { Anim } from '../src/anim.js';

function createElement({ removed = false } = {}) {
  const element = {
    className: '',
    textContent: '',
    innerHTML: '',
    style: {},
    offsetParent: removed ? null : {},
    offsetWidth: removed ? 0 : 100,
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
    },
    getBoundingClientRect: vi.fn(() => ({
      left: 10,
      top: 20,
      width: 30,
      height: 40,
    })),
    remove: vi.fn(),
  };
  return element;
}

function installDocument(targetMode) {
  const bodyChildren = [];
  const target = createElement({ removed: true });
  const document = {
    querySelectorAll: vi.fn(() => (
      targetMode === 'removed' ? [target] : []
    )),
    createElement: vi.fn(() => {
      const element = createElement();
      element.remove.mockImplementation(() => {
        const index = bodyChildren.indexOf(element);
        if (index !== -1) bodyChildren.splice(index, 1);
      });
      return element;
    }),
    body: {
      appendChild: vi.fn((element) => {
        bodyChildren.push(element);
        return element;
      }),
    },
  };
  vi.stubGlobal('document', document);
  return { bodyChildren };
}

const facadeCases = [
  ['summon', ['me']],
  ['summonBench', ['me', 0]],
  ['damage', ['me', 5]],
  ['benchDamage', ['me', 0, 5]],
  ['lpDamage', ['me', 1]],
  ['attackDirect', ['me']],
  ['attack', ['me', 'opp', 5]],
  ['ko', ['me']],
  ['benchKo', ['me', 0]],
  ['heal', ['me', 5]],
  ['manaGain', []],
  ['benchToActive', ['me']],
  ['setVerse', ['me']],
  ['castVerse', ['me']],
  ['playOn', ['.missing-target', 'anim-test', 10]],
  ['wait', [10]],
  ['getAnimPosition', ['me']],
  ['floatText', ['SAFE', 'gold', null]],
  ['negateX', []],
];

afterEach(() => {
  Anim.cachedPositions = {};
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EVT-07 — Anim facade missing-target safety', () => {
  it.each(
    facadeCases.flatMap(([method, args]) => [
      [method, args, 'missing'],
      [method, args, 'removed'],
    ]),
  )(
    '%s resolves safely with a %s target',
    async (method, args, targetMode) => {
      vi.useFakeTimers();
      const { bodyChildren } = installDocument(targetMode);
      Anim.cachedPositions = {};
      const cachedBefore = structuredClone(Anim.cachedPositions);
      let result;

      expect(() => {
        result = Anim[method](...args);
      }).not.toThrow();

      const settled = Promise.resolve(result);
      await vi.runAllTimersAsync();
      await expect(settled).resolves.not.toBeInstanceOf(Error);

      expect(Anim.cachedPositions).toStrictEqual(cachedBefore);
      expect(bodyChildren).toStrictEqual([]);
    },
  );
});
