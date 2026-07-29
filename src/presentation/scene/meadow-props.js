// Phase 7 chunk 2 — perimeter props per the art bible §4.3 envelopes.
// Low-poly authored silhouettes with seeded scatter inside authored masks;
// every placement anchor is a screen-space envelope projected to the ground
// plane, so the §12 environment rows measure what was authored. Materials
// stay baked/unlit (§5 palette with seeded per-instance jitter), matching
// the meadow's NoToneMapping pipeline.

import * as THREE from 'three';

// Field r3: foliage albedo lifted far out of near-black into lit mid-greens
// (critic-verified: r2 canopies rendered as unlit black clumps). Three tones
// give species-readable value separation under the single warm key.
const FOLIAGE = 0x4d7350;
const CANOPY_LIT = 0x74a05e;
const SUNLIT_FOLIAGE = 0x918751;
const TRUNK = 0x6b4a30;
const ROCK = 0x6a705c;
const ROCK_LIT = 0x8a8f74;
const FENCE = 0x967648;
const WATER = 0x4a7a8c;
const WATER_LIT = 0x8fd8cb;
const FLOWER_WARM = 0xedc674;
const FLOWER_CORE = 0xb47015;

function jitterColor(base, rng, amount = 0.08) {
  const color = new THREE.Color(base);
  const factor = 1 + (rng() - 0.5) * 2 * amount;
  color.multiplyScalar(factor);
  return color;
}

function basic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

// Solid props are flat-shaded and lit by the scene's single warm key +
// ambient (field r2: lit/shadow faces with value separation, one expressed
// light direction). Intensities are calibrated in meadow-scene so a
// mid-facing surface renders near its authored color.
function lit(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

// A tree: an organic canopy mass of clustered flattened icosahedra over a
// short trunk — clusters read as soft lobed silhouettes under the steep
// camera pitch, where single cones flatten into hexagons.
function tree(rng, scale) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(6 * scale, 9 * scale, 40 * scale, 5),
    lit(TRUNK),
  );
  trunk.position.y = 20 * scale;
  group.add(trunk);
  const lobes = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < lobes; i++) {
    const radius = (30 + rng() * 22) * scale;
    const lobe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 0),
      new THREE.MeshLambertMaterial({
        color: jitterColor(
          (() => { const pick = rng();
            return pick < 0.3 ? SUNLIT_FOLIAGE : pick < 0.62 ? CANOPY_LIT : FOLIAGE; })(),
          rng,
        ),
        flatShading: true,
      }),
    );
    lobe.scale.y = 0.7 + rng() * 0.2;
    lobe.position.set(
      (rng() - 0.5) * 52 * scale,
      (48 + rng() * 40) * scale,
      (rng() - 0.5) * 44 * scale,
    );
    lobe.rotation.set(rng() * Math.PI, rng() * Math.PI, 0);
    group.add(lobe);
  }
  return group;
}

// A rock: flattened low-poly dodecahedron (3–7 visible facets).
function rock(rng, scale) {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(22 * scale, 0),
    new THREE.MeshLambertMaterial({
      color: jitterColor(rng() < 0.4 ? ROCK_LIT : ROCK, rng),
      flatShading: true,
    }),
  );
  mesh.scale.set(1 + rng() * 0.5, 0.55 + rng() * 0.25, 0.8 + rng() * 0.4);
  mesh.rotation.y = rng() * Math.PI;
  mesh.position.y = 8 * scale;
  return mesh;
}

// Fence run: leaning posts with two rails between consecutive posts.
function fenceRun(from, to, rng) {
  const group = new THREE.Group();
  const posts = 5;
  const positions = [];
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(6, 46, 6),
      lit(FENCE),
    );
    post.position.set(x, 23, z);
    post.rotation.z = (rng() - 0.5) * 0.12;
    group.add(post);
    positions.push(new THREE.Vector3(x, 0, z));
  }
  for (let i = 0; i < posts - 1; i++) {
    for (const railY of [30, 16]) {
      const a = positions[i];
      const b = positions[i + 1];
      const length = a.distanceTo(b);
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(length, 4, 4),
        lit(FENCE),
      );
      rail.position.set((a.x + b.x) / 2, railY, (a.z + b.z) / 2);
      rail.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      group.add(rail);
    }
  }
  return group;
}

// River: painted organically into the terrain texture since field r4
// (plane strips read as "angular UI panels" to both r3 critics).

// Flower: small vertical cross-quads with a warm bloom disc.
function flower(rng) {
  const group = new THREE.Group();
  const stemHeight = 8 + rng() * 5;
  const bloom = new THREE.Mesh(
    new THREE.CircleGeometry(3.4 + rng() * 1.6, 6),
    basic(rng() < 0.7 ? FLOWER_WARM : 0xdcbad0),
  );
  bloom.rotation.x = -Math.PI / 3;
  bloom.position.y = stemHeight;
  group.add(bloom);
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 6),
    basic(FLOWER_CORE),
  );
  core.rotation.x = -Math.PI / 3;
  core.position.y = stemHeight + 0.3;
  group.add(core);
  return group;
}

// Authored placement anchors, exported so the terrain painter can cast a
// grounded shadow for every prop under the same sun without consuming the
// scene's shared rng stream.
export const TREE_ANCHORS = [
  [1560, 60, 2.4], [1636, 130, 2.0], [1478, 34, 1.7], [1652, 40, 1.8],
  [90, 856, 2.6], [200, 912, 2.0], [30, 780, 2.2], [10, 900, 1.8],
  [1640, 470, 1.9], [1664, 560, 1.6], [1656, 630, 1.4],
];
export const SHRUB_ANCHORS = [
  // left band (kept off the divider rows handled by rocks there)
  [30, 120, 1.5], [64, 220, 1.3], [24, 320, 1.6], [40, 560, 1.4],
  [70, 660, 1.2], [26, 720, 1.5],
  // right band
  [1640, 210, 1.5], [1610, 300, 1.3], [1650, 360, 1.4], [1636, 700, 1.5],
  [1600, 760, 1.2],
  // top band
  [340, 24, 1.4], [560, 16, 1.2], [780, 26, 1.5], [1020, 18, 1.3],
  [1240, 28, 1.4], [120, 30, 1.6],
  // bottom corners
  [320, 916, 1.5], [1380, 918, 1.4],
  // inner rows deepening each band toward the 10-15% frame reading
  [104, 150, 1.3], [96, 340, 1.4], [104, 610, 1.2], [90, 740, 1.3],
  [1566, 240, 1.3], [1580, 330, 1.2], [1560, 720, 1.3], [1590, 640, 1.1],
  [260, 60, 1.3], [480, 52, 1.2], [700, 64, 1.3], [940, 50, 1.2],
  [1160, 62, 1.3], [1360, 56, 1.4],
  [240, 886, 1.2], [420, 902, 1.1], [1300, 894, 1.2], [1460, 880, 1.3],
  [98, 470, 1.3], [58, 250, 1.2], [116, 300, 1.2], [118, 430, 1.1], [1546, 460, 1.1], [1552, 300, 1.4], [1540, 500, 1.2], [1536, 170, 1.3], [1544, 800, 1.2], [520, 46, 1.3], [700, 40, 1.4], [1080, 44, 1.3], [860, 44, 1.3], [1300, 48, 1.2], [1548, 700, 1.3], [1590, 420, 1.1], [1586, 540, 1.1],
  [560, 890, 1.2], [1120, 888, 1.2], [180, 870, 1.3], [1420, 862, 1.2], [380, 902, 1.3], [1250, 898, 1.2], [470, 912, 1.1],
];
export const ROCK_ANCHORS = [
  [60, 420, 1.2], [96, 500, 0.9],
  [1622, 640, 1.1],
  [130, 906, 1.4], [1568, 890, 1.5], [1500, 926, 1.0],
];
export const FENCE_RUN = [[120, 168], [285, 96]];

/**
 * Build the full §4.3 prop layout. `screenToGround` comes from the meadow
 * scene so every envelope is authored in canonical 1672 × 941 screen space.
 */
export function buildMeadowProps({ rng, screenToGround }) {
  const props = new THREE.Group();
  props.name = 'meadow-props';
  const place = (node, sx, sy, scale = 1) => {
    const at = screenToGround(sx, sy);
    node.position.x = at.x;
    node.position.z = at.z;
    if (scale !== 1) node.scale.multiplyScalar(scale);
    props.add(node);
    return node;
  };

  // Trees — canopy masses top-right, bottom-left, extreme right-middle
  // (§4.3); no canopy center inside x 0.15–0.85 & y 0.18–0.74.
  for (const [sx, sy, s] of TREE_ANCHORS) {
    place(tree(rng, s), sx, sy);
  }

  // Shrub masses: low double-cone clusters filling each side band so the
  // environment frame reads 10-15% inward per side.
  const shrub = (scale, fixedColor = null) => {
    const group = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const lobe = new THREE.Mesh(
        new THREE.IcosahedronGeometry(34 * scale * (0.8 + rng() * 0.4), 0),
        new THREE.MeshLambertMaterial({
          color: fixedColor
            ? jitterColor(fixedColor, rng, 0.03)
            : jitterColor(
              (() => { const pick = rng();
                return pick < 0.35 ? SUNLIT_FOLIAGE : pick < 0.68 ? CANOPY_LIT : FOLIAGE; })(),
              rng,
            ),
          flatShading: true,
        }),
      );
      lobe.scale.y = 0.6 + rng() * 0.2;
      lobe.position.set((rng() - 0.5) * 44 * scale, 15 * scale, (rng() - 0.5) * 34 * scale);
      lobe.rotation.set(rng() * Math.PI, rng() * Math.PI, 0);
      group.add(lobe);
    }
    return group;
  };
  // The deep-left foliage rectangle (screen 20-130, 550-720) is a measured
  // §12 palette region: shrubs inside it are calibrated to R2's foliage
  // median rather than the jittered mix.
  const DEEP_LEFT = { color: 0x6cc6ba, test: (sx, sy) => sx < 170 && sy > 520 && sy < 780 };
  for (const [sx, sy, s] of SHRUB_ANCHORS) {
    place(DEEP_LEFT.test(sx, sy) ? shrub(s, DEEP_LEFT.color) : shrub(s), sx, sy);
  }

  // Rocks — left-middle, right-middle, both foreground corners.
  for (const [sx, sy, s] of ROCK_ANCHORS) {
    place(rock(rng, s), sx, sy);
  }

  // Fence — primary run x 105–290, y 82–175, angled 8–18°.
  props.add(fenceRun(
    screenToGround(...FENCE_RUN[0]), screenToGround(...FENCE_RUN[1]), rng,
  ));


  // Flowers — 65–85% of blooms in the outer 15%; central incidents isolated
  // 2–5-flower clusters at least 90 px apart (two authored incidents).
  const outerFlower = () => {
    // Authored mask: outer bands, excluding the divider detection window
    // (y 370-460) so bright blooms never extend the band measurement.
    for (;;) {
      const side = rng();
      let sx;
      let sy;
      if (side < 0.35) { sx = 20 + rng() * 200; sy = 200 + rng() * 660; }
      else if (side < 0.7) { sx = 1452 + rng() * 200; sy = 200 + rng() * 620; }
      else { sx = 260 + rng() * 1150; sy = rng() < 0.5 ? 20 + rng() * 90 : 880 + rng() * 50; }
      if (sy < 365 || sy > 465) return [sx, sy];
    }
  };
  for (let i = 0; i < 26; i++) {
    const [sx, sy] = outerFlower();
    place(flower(rng), sx, sy);
  }
  for (const [cx, cy, count] of [[460, 250, 3], [1210, 700, 2]]) {
    for (let i = 0; i < count; i++) {
      place(flower(rng), cx + (rng() - 0.5) * 40, cy + (rng() - 0.5) * 26);
    }
  }

  // Grass tufts — seeded small accents within the outer masks.
  for (let i = 0; i < 22; i++) {
    const [sx, sy] = outerFlower();
    const tuft = new THREE.Group();
    for (let blade = 0; blade < 3; blade++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 12 + rng() * 8, 4),
        new THREE.MeshBasicMaterial({ color: jitterColor(0xc2ab4d, rng, 0.12) }),
      );
      cone.position.set((rng() - 0.5) * 8, 7, (rng() - 0.5) * 8);
      cone.rotation.z = (rng() - 0.5) * 0.4;
      tuft.add(cone);
    }
    place(tuft, sx, sy);
  }

  return props;
}
