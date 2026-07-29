// Capability detection and quality-tier selection (plan Phase 3). The scene
// is decorative and optional: any failure here selects the static tier and
// the game remains fully playable. Detection never throws.

export const QUALITY_TIERS = Object.freeze(['desktop-high', 'desktop-low', 'static']);

export function detectCapabilities(options = {}) {
  const win = options.window ?? globalThis.window ?? {};
  const nav = options.navigator ?? win.navigator ?? {};
  const doc = options.document ?? win.document;

  let webgl = false;
  let webglReason = 'not-attempted';
  try {
    if (options.forceNoWebgl || win.__TINY_FANGS_FORCE_NO_WEBGL__) {
      webglReason = 'forced-off';
    } else if (doc) {
      const canvas = doc.createElement('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      webgl = Boolean(gl);
      webglReason = webgl ? 'ok' : 'context-create-failed';
      if (gl?.getExtension) gl.getExtension('WEBGL_lose_context')?.loseContext();
    } else {
      webglReason = 'no-document';
    }
  } catch (error) {
    webgl = false;
    webglReason = `error:${error?.message ?? error}`;
  }

  const reducedMotion = (() => {
    try {
      return win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    } catch {
      return false;
    }
  })();

  const saveData = Boolean(nav.connection?.saveData);
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4;

  let qualityTier;
  if (!webgl) qualityTier = 'static';
  else if (saveData || lowMemory) qualityTier = 'desktop-low';
  else qualityTier = 'desktop-high';

  return Object.freeze({
    webgl,
    webglReason,
    reducedMotion,
    saveData,
    lowMemory,
    qualityTier,
  });
}
