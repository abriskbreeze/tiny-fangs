// Phase 10c — the audio director. Maps semantic event slots to audio files,
// unlocks on the first user gesture (browser autoplay policy), persists
// mute/volume in localStorage, and FAILS SILENT on missing files: every
// audio asset is placeholder-pending user regeneration, so the director must
// behave perfectly with zero files present and say nothing about it.

export const AUDIO_SLOTS = Object.freeze({
  summon: 'summon.ogg',
  attack: 'attack.ogg',
  damage: 'damage.ogg',
  heal: 'heal.ogg',
  ko: 'ko.ogg',
  cast: 'cast.ogg',
  set: 'set.ogg',
  draw: 'draw.ogg',
  turn: 'turn.ogg',
  coin: 'coin.ogg',
  victory: 'victory.ogg',
  defeat: 'defeat.ogg',
});

export const AUDIO_STORAGE_KEY = 'tinyFangs.audio.v1';

export function createAudioDirector({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  storage = null,
  createAudio = null,
  basePath = '/src/assets/audio/',
  slots = AUDIO_SLOTS,
} = {}) {
  const store = storage ?? (() => {
    try { return win?.localStorage ?? null; } catch { return null; }
  })();
  const makeAudio = createAudio ?? ((src) => {
    const AudioCtor = win?.Audio ?? globalThis.Audio;
    return AudioCtor ? new AudioCtor(src) : null;
  });

  let settings = { muted: false, volume: 0.8 };
  try {
    const raw = store?.getItem(AUDIO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.muted === 'boolean') settings.muted = parsed.muted;
      if (Number.isFinite(parsed.volume)) settings.volume = Math.min(1, Math.max(0, parsed.volume));
    }
  } catch { /* corrupted settings fall back to defaults, silently */ }

  function persist() {
    try { store?.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings)); } catch { /* silent */ }
  }

  let unlocked = false;
  const elements = new Map(); // slot -> HTMLAudio | 'dead'
  let gestureBound = false;
  let unbindGesture = null;

  function unlock() { unlocked = true; }

  function bindFirstGesture() {
    if (gestureBound || !doc?.addEventListener) return;
    gestureBound = true;
    const onGesture = () => { unlock(); unbind(); };
    const unbind = () => {
      doc.removeEventListener('pointerdown', onGesture, true);
      doc.removeEventListener('keydown', onGesture, true);
    };
    doc.addEventListener('pointerdown', onGesture, true);
    doc.addEventListener('keydown', onGesture, true);
    unbindGesture = unbind;
  }

  function elementFor(slot) {
    const existing = elements.get(slot);
    if (existing) return existing === 'dead' ? null : existing;
    const file = slots[slot];
    if (!file) { elements.set(slot, 'dead'); return null; }
    let audio = null;
    try {
      audio = makeAudio(`${basePath}${file}`);
    } catch { /* constructor unavailable */ }
    if (!audio) { elements.set(slot, 'dead'); return null; }
    // A missing file surfaces as an error event: mark the slot dead forever,
    // never retry, never log — fail-silent is the contract.
    try {
      audio.addEventListener?.('error', () => elements.set(slot, 'dead'));
    } catch { /* stub audio without listeners is fine */ }
    elements.set(slot, audio);
    return audio;
  }

  function play(slot) {
    if (settings.muted || !unlocked) return false;
    const audio = elementFor(slot);
    if (!audio) return false;
    try {
      audio.volume = settings.volume;
      audio.currentTime = 0;
      const result = audio.play?.();
      // Autoplay rejection or decode failure: swallow, mark dead on repeat
      // failures via the error listener. Never propagate.
      result?.catch?.(() => { elements.set(slot, 'dead'); });
      return true;
    } catch {
      elements.set(slot, 'dead');
      return false;
    }
  }

  return Object.freeze({
    bindFirstGesture,
    unlock,
    play,
    get unlocked() { return unlocked; },
    get muted() { return settings.muted; },
    get volume() { return settings.volume; },
    setMuted(value) { settings.muted = Boolean(value); persist(); },
    toggleMute() { settings.muted = !settings.muted; persist(); return settings.muted; },
    setVolume(value) {
      settings.volume = Math.min(1, Math.max(0, Number(value) || 0));
      persist();
    },
    dispose() { unbindGesture?.(); elements.clear(); },
  });
}
