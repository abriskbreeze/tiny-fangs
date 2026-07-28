import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventPlayback } from '../../src/event-playback.js';

function createPlayback(Anim, log = vi.fn()) {
  return createEventPlayback({
    Anim,
    log,
    VERSES: {},
    CREATURES: {},
  });
}

function setDebugValue(value) {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => value),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EVT-03 — strict sequential playback', () => {
  it.each([
    ['playEvents'],
    ['playServerEvents'],
  ])('awaits every handler and inter-event wait in %s', async (method) => {
    setDebugValue(null);
    const order = [];
    let releaseDamage;
    const damageGate = new Promise((resolve) => {
      releaseDamage = resolve;
    });
    const Anim = {
      damage: vi.fn(async () => {
        order.push('damage:start');
        await damageGate;
        order.push('damage:end');
      }),
      heal: vi.fn(async () => {
        order.push('heal');
      }),
      wait: vi.fn(async (duration) => {
        order.push(`wait:${duration}`);
      }),
    };
    const playback = createPlayback(Anim);

    const pending = playback[method]([
      { type: 'damage', side: 'p1', amount: 5 },
      { type: 'heal', side: 'p1', amount: 5 },
    ]);

    await vi.waitFor(() => {
      expect(Anim.damage).toHaveBeenCalledOnce();
    });
    expect(order).toStrictEqual(['damage:start']);
    expect(Anim.heal).not.toHaveBeenCalled();
    expect(Anim.wait).not.toHaveBeenCalled();

    releaseDamage();
    await pending;

    expect(order).toStrictEqual([
      'damage:start',
      'damage:end',
      'wait:50',
      'heal',
      'wait:50',
    ]);
  });
});

describe('EVT-07 — handler failure containment', () => {
  it.each([
    ['playEvents', 'throws', () => { throw new Error('private-card-uid'); }],
    ['playEvents', 'rejects', () => Promise.reject(new Error('private-card-uid'))],
    ['playServerEvents', 'throws', () => { throw new Error('private-card-uid'); }],
    ['playServerEvents', 'rejects', () => Promise.reject(new Error('private-card-uid'))],
  ])(
    '%s logs a redacted %s handler failure, waits, and continues',
    async (method, _mode, fail) => {
      setDebugValue(null);
      const order = [];
      const Anim = {
        damage: vi.fn(() => {
          order.push('damage');
          return fail();
        }),
        heal: vi.fn(async () => {
          order.push('heal');
        }),
        wait: vi.fn(async (duration) => {
          order.push(`wait:${duration}`);
        }),
      };
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const playback = createPlayback(Anim);

      await expect(playback[method]([
        { type: 'damage', side: 'p1', amount: 5 },
        { type: 'heal', side: 'p1', amount: 5 },
      ])).resolves.toBeUndefined();

      expect(order).toStrictEqual([
        'damage',
        'wait:50',
        'heal',
        'wait:50',
      ]);
      expect(error).toHaveBeenCalledExactlyOnceWith(
        'Error playing event damage',
      );
      expect(JSON.stringify(error.mock.calls)).not.toContain('private-card-uid');
    },
  );
});

describe('EVT-08 — privacy-safe debug diagnostics', () => {
  it('enables debug only for the exact value "1" and emits an allowlisted summary', async () => {
    setDebugValue('1');
    const secrets = [
      'Hidden Fang',
      'card-uid-secret',
      'pending-secret',
      'source-secret',
      'unknown-secret-type',
    ];
    const Anim = {
      damage: vi.fn(() => Promise.resolve()),
      wait: vi.fn(() => Promise.resolve()),
    };
    const debug = vi.spyOn(console, 'log').mockImplementation(() => {});
    const playback = createPlayback(Anim);

    await playback.playServerEvents([
      {
        type: 'damage',
        side: 'p1',
        amount: 0,
        source: 'source-secret',
        creature: 'Hidden Fang',
        uid: 'card-uid-secret',
        pendingAction: { context: 'pending-secret' },
      },
      {
        type: 'unknown-secret-type',
        name: 'Hidden Fang',
        uid: 'card-uid-secret',
        pendingAction: { context: 'pending-secret' },
      },
    ]);

    expect(debug.mock.calls).toStrictEqual([
      [
        '[DEBUG] Playing events:',
        ['damage(0)[source]', 'unknown'],
      ],
      ['[DEBUG] Unknown event type'],
    ]);
    const serialized = JSON.stringify(debug.mock.calls);
    for (const secret of secrets) {
      expect(serialized).not.toContain(secret);
    }
  });

  it.each([
    null,
    '',
    '0',
    'false',
    'true',
  ])('keeps debug disabled for %j', async (debugValue) => {
    setDebugValue(debugValue);
    const debug = vi.spyOn(console, 'log').mockImplementation(() => {});
    const playback = createPlayback({
      damage: vi.fn(() => Promise.resolve()),
      wait: vi.fn(() => Promise.resolve()),
    });

    await playback.playServerEvents([
      { type: 'damage', side: 'p1', amount: 5 },
    ]);

    expect(debug).not.toHaveBeenCalled();
  });

  it('redacts unknown local event diagnostics regardless of payload', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const playback = createPlayback({
      wait: vi.fn(() => Promise.resolve()),
    });

    await playback.playEvents([
      {
        type: 'unknown-secret-type',
        name: 'Hidden Fang',
        uid: 'card-uid-secret',
        pendingAction: { context: 'pending-secret' },
      },
    ]);

    expect(warn).toHaveBeenCalledExactlyOnceWith('Unknown event type');
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /Hidden Fang|card-uid-secret|pending-secret|unknown-secret-type/,
    );
  });
});
