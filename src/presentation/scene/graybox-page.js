// Standalone graybox page driver. Renders one camera candidate selected by
// ?candidate=O|P at the exact canonical frame, exposes the calibration report
// on window.__TINY_FANGS_GRAYBOX_REPORT__, and honors the visual readiness
// contract so the capture runner can wait deterministically.
import * as THREE from 'three';
import { CANONICAL_FRAME } from '../board-layout.js';
import { createVisualReadinessController } from '../testing/visual-readiness.js';
import { buildGraybox } from './graybox-scene.js';

const params = new URLSearchParams(window.location.search);
const candidate = params.get('candidate');

const readiness = createVisualReadinessController();

async function main() {
  if (candidate !== 'O' && candidate !== 'P') {
    document.body.textContent = 'graybox: pass ?candidate=O or ?candidate=P';
    window.__TINY_FANGS_GRAYBOX_REPORT__ = { error: 'missing candidate' };
    return;
  }

  const canvas = document.getElementById('graybox-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(CANONICAL_FRAME.dpr);
  renderer.setSize(CANONICAL_FRAME.width, CANONICAL_FRAME.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const ready = readiness.register((async () => {
    await document.fonts.ready;
    const { report } = buildGraybox(candidate, renderer);
    window.__TINY_FANGS_GRAYBOX_REPORT__ = report;
  })());
  await ready;
  await readiness.waitUntilReady();
}

main().catch((error) => {
  window.__TINY_FANGS_GRAYBOX_REPORT__ = { error: String(error?.message ?? error) };
});
