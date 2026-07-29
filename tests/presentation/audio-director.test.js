import { describe, expect, it } from 'vitest';
import {
  AUDIO_SLOTS,
  AUDIO_STORAGE_KEY,
  createAudioDirector,
} from '../../src/presentation/audio-director.js';

// Phase 10c contracts: gesture-gated unlock, persisted mute/volume, and
// fail-silent behavior with zero audio files present.

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => Object.fromEntries(map),
  };
}

function makeStubAudioFactory({ failOnPlay = false, errorOnCreate = false } = {}) {
  const created = [];
  return {
    created,
    factory: (src) => {
      if (errorOnCreate) throw new Error('no audio backend');
      const listeners = {};
      const audio = {
        src,
        volume: 1,
        currentTime: 0,
        played: 0,
        addEventListener: (name, fn) => { listeners[name] = fn; },
        fireError: () => listeners.error?.(),
        play() {
          this.played += 1;
          return failOnPlay
            ? Promise.reject(new Error('NotSupportedError'))
            : Promise.resolve();
        },
      };
      created.push(audio);
      return audio;
    },
  };
}

function makeStubDocument() {
  const handlers = new Map();
  return {
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: (name) => handlers.delete(name),
    fire: (name) => handlers.get(name)?.(),
    handlerCount: () => handlers.size,
  };
}

describe('audio director', () => {
  it('does not play before the first gesture, plays after unlock', () => {
    const { factory, created } = makeStubAudioFactory();
    const doc = makeStubDocument();
    const director = createAudioDirector({
      document: doc, storage: makeStorage(), createAudio: factory,
    });
    director.bindFirstGesture();

    expect(director.play('summon')).toBe(false);
    expect(created.length).toBe(0);

    doc.fire('pointerdown'); // first gesture unlocks and unbinds
    expect(director.unlocked).toBe(true);
    expect(doc.handlerCount()).toBe(0);
    expect(director.play('summon')).toBe(true);
    expect(created.length).toBe(1);
    expect(created[0].src).toContain(AUDIO_SLOTS.summon);
  });

  it('persists mute and volume, and restores them on construction', () => {
    const storage = makeStorage();
    const a = createAudioDirector({ document: makeStubDocument(), storage, createAudio: makeStubAudioFactory().factory });
    a.toggleMute();
    a.setVolume(0.25);
    expect(JSON.parse(storage.dump()[AUDIO_STORAGE_KEY])).toEqual({ muted: true, volume: 0.25 });

    const b = createAudioDirector({ document: makeStubDocument(), storage, createAudio: makeStubAudioFactory().factory });
    expect(b.muted).toBe(true);
    expect(b.volume).toBe(0.25);
    b.unlock();
    expect(b.play('summon')).toBe(false); // muted blocks playback
  });

  it('fails silent when files are missing: error marks the slot dead, no retries, no throw', () => {
    const { factory, created } = makeStubAudioFactory();
    const director = createAudioDirector({
      document: makeStubDocument(), storage: makeStorage(), createAudio: factory,
    });
    director.unlock();
    expect(director.play('ko')).toBe(true);
    created[0].fireError(); // 404: the placeholder-pending file does not exist
    expect(director.play('ko')).toBe(false);
    expect(director.play('ko')).toBe(false);
    expect(created.length).toBe(1); // never re-created, never retried
  });

  it('survives a rejecting play() and an unavailable Audio constructor', async () => {
    const rejecting = makeStubAudioFactory({ failOnPlay: true });
    const a = createAudioDirector({
      document: makeStubDocument(), storage: makeStorage(), createAudio: rejecting.factory,
    });
    a.unlock();
    expect(a.play('attack')).toBe(true); // the rejection is swallowed async
    await Promise.resolve();
    expect(a.play('attack')).toBe(false); // slot dead after rejection

    const broken = createAudioDirector({
      document: makeStubDocument(), storage: makeStorage(),
      createAudio: makeStubAudioFactory({ errorOnCreate: true }).factory,
    });
    broken.unlock();
    expect(broken.play('summon')).toBe(false); // silent, no throw
  });

  it('corrupted persisted settings fall back to defaults silently', () => {
    const storage = makeStorage({ [AUDIO_STORAGE_KEY]: '{not json' });
    const director = createAudioDirector({
      document: makeStubDocument(), storage, createAudio: makeStubAudioFactory().factory,
    });
    expect(director.muted).toBe(false);
    expect(director.volume).toBe(0.8);
  });
});
