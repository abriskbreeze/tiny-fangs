// Phase 3 DOM/Three compositing spike. Renders the locked camera's graybox
// scene on the canvas, then places DOM card faces over it using the golden
// quadrilaterals via the matrix3d homography contract. Drift between each
// DOM face's projected corners and the scene's own quad is measured
// numerically and exposed for the Playwright gate: ≤2 CSS px at the canonical
// frame, ≤4 CSS px across the resize matrix (the stage scales uniformly, so
// drift is measured in canonical CSS px). No post-processing (plan Phase 3:
// first spike must keep projection, color, and alignment errors observable).
import * as THREE from 'three';
import { CANONICAL_FRAME } from '../board-layout.js';
import { createVisualReadinessController } from '../testing/visual-readiness.js';
import { buildGraybox } from './graybox-scene.js';
import { applyQuadTransform, projectRectCorners } from '../dom/quad-transform.js';

const readiness = createVisualReadinessController();

const LABELS = {
  'opp.deck': 'DECK', 'opp.bench.a': '', 'opp.bench.b': 'BENCH',
  'opp.active': 'ACTIVE', 'opp.set': 'SET', 'opp.grave': 'GRAVE',
  'me.deck': 'DECK', 'me.active': 'ACTIVE', 'me.bench.a': 'BENCH',
  'me.bench.b': 'BENCH', 'me.set': '', 'me.grave': 'GRAVE',
};

async function main() {
  const canvas = document.getElementById('scene-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(CANONICAL_FRAME.dpr);
  renderer.setSize(CANONICAL_FRAME.width, CANONICAL_FRAME.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const ready = readiness.register((async () => {
    await document.fonts.ready;
    // The locked camera: candidate P won the §13.4 bake-off.
    const { report } = buildGraybox('P', renderer);

    const layer = document.getElementById('dom-layer');
    const drift = [];
    for (const [anchorId, quads] of Object.entries(report.allAnchorQuads)) {
      const corners = quads.face;
      const el = document.createElement('div');
      el.className = 'dom-card';
      el.dataset.anchor = anchorId;
      el.textContent = LABELS[anchorId] ?? '';
      // Element pixel box: use the quad's mean edge lengths so the content
      // renders near 1:1 scale before the homography.
      const edge = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      const width = Math.round((edge(corners[0], corners[1]) + edge(corners[3], corners[2])) / 2);
      const height = Math.round((edge(corners[0], corners[3]) + edge(corners[1], corners[2])) / 2);
      applyQuadTransform(el, width, height, corners);
      layer.appendChild(el);

      // Numeric drift: the homography's own forward projection of the element
      // corners against the scene quad (measures the transform contract), and
      // will differ from zero only if the mapping math is wrong.
      const projected = projectRectCorners(width, height, corners);
      const maxCornerError = Math.max(
        ...projected.map((p, i) => Math.hypot(p[0] - corners[i][0], p[1] - corners[i][1])),
      );

      // Layout drift: the browser's actual rendered quad via
      // getBoundingClientRect of 1x1 probe points is unreliable under
      // matrix3d; instead sample the element's transformed corner positions
      // through the DOMMatrix the browser actually applied.
      const style = getComputedStyle(el);
      const matrix = new DOMMatrix(style.transform);
      const stage = document.getElementById('stage');
      const stageScale = stage.getBoundingClientRect().width / CANONICAL_FRAME.width;
      const applyDom = (x, y) => {
        const p = matrix.transformPoint(new DOMPoint(x, y, 0, 1));
        return [p.x / p.w, p.y / p.w];
      };
      const domCorners = [
        applyDom(0, 0), applyDom(width, 0), applyDom(width, height), applyDom(0, height),
      ];
      const maxDomError = Math.max(
        ...domCorners.map((p, i) => Math.hypot(p[0] - corners[i][0], p[1] - corners[i][1])),
      );
      drift.push({
        anchorId,
        maxCornerError,
        maxDomError,
        stageScale,
      });

      const dot = document.createElement('div');
      dot.className = 'fiducial';
      dot.style.left = `${(corners[0][0] + corners[2][0]) / 2}px`;
      dot.style.top = `${(corners[0][1] + corners[2][1]) / 2}px`;
      layer.appendChild(dot);
    }

    window.__TINY_FANGS_COMPOSITE_REPORT__ = {
      camera: report.camera,
      anchorCount: drift.length,
      drift,
      maxCornerError: Math.max(...drift.map((d) => d.maxCornerError)),
      maxDomError: Math.max(...drift.map((d) => d.maxDomError)),
    };
  })());
  await ready;
  await readiness.waitUntilReady();
}

function fitStage() {
  // Uniform scale-to-fit for the resize matrix: the canonical stage scales as
  // one unit, so DOM/scene alignment is scale-invariant and drift stays
  // measured in canonical CSS px.
  const stage = document.getElementById('stage');
  const scale = Math.min(
    window.innerWidth / CANONICAL_FRAME.width,
    window.innerHeight / CANONICAL_FRAME.height,
    1,
  );
  stage.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', fitStage);
fitStage();
main().catch((error) => {
  window.__TINY_FANGS_COMPOSITE_REPORT__ = { error: String(error?.message ?? error) };
});
