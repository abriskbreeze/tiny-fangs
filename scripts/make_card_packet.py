#!/usr/bin/env python3
"""Assemble the card-showcase blind packet (plan Phase 2/5 golden samples).

Scope: the four-card showcase ONLY — packetKind `card-showcase` is a
plan-level construct for the pre-board golden-sample review; it reuses the
art bible's §13.2 showcase manifest, §13.3 card crop rows, §13.7.1 index
fields, and §13.7.2 hashing verbatim, and never claims the §13.5
`integrated-art` gate, which requires the Phase 7 populated board.

Steps: recompute the §13.2 manifest hash, capture /showcase.html twice at
1672×941 DPR1 (byte-identical or abort), cut the §13.3 card crops (1× for
cards-full, exact 2× Lanczos for detail crops), and write an index whose
rows carry honest statuses — rows this runner cannot yet evaluate are
`unsupported` with reasons, never silently omitted.

Usage: python3 scripts/make_card_packet.py  (dev server must NOT be running;
the script owns a vite instance on port 5199.)
"""
import hashlib
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests/visual/card-packet"
CAPTURES = OUT / "captures"
CROPS = OUT / "crops"
PORT = 5199

# §13.2 desktop-four-family revision 1 (art bible, accepted hash 84b89838…).
SHOWCASE_MANIFEST = {
    "schema": "tiny-fangs.card-showcase.v1",
    "showcaseId": "desktop-four-family",
    "showcaseRevision": 1,
    "frame": {"width": 1672, "height": 941},
    "colorProfile": "sRGB IEC 61966-2-1 assigned on decode",
    "fontRevision": "alegreya-v37+jetbrains-mono-v24 self-hosted 2026-07-28",
    "assetRevision": "golden-sample-art r4 (task-34)",
    "provenanceRecordSha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "specimens": [
        {
            "presentationFaceId": "duskfang", "renderSide": "face",
            "center": [445, 578], "size": [330, 500], "rotationDeg": -1.5, "z": 3,
            "corners": [[273.5, 332.4], [603.4, 323.8], [616.5, 823.6], [286.6, 832.2]],
            "contactShadowEnvelope": [259, 319, 641, 865],
            "cropId": "card-creature-frame",
        },
        {
            "presentationFaceId": "manaSurge", "renderSide": "face",
            "center": [833, 577], "size": [330, 500], "rotationDeg": 0.0, "z": 4,
            "corners": [[668.0, 327.0], [998.0, 327.0], [998.0, 827.0], [668.0, 827.0]],
            "contactShadowEnvelope": [654, 323, 1022, 859],
            "cropId": "card-cast-frame",
        },
        {
            "presentationFaceId": "phantomWall", "renderSide": "face",
            "center": [1206, 584], "size": [330, 500], "rotationDeg": 1.5, "z": 6,
            "corners": [[1047.6, 329.8], [1377.5, 338.4], [1364.4, 838.2], [1034.5, 829.6]],
            "contactShadowEnvelope": [1020, 325, 1402, 870],
            "cropId": "card-set-frame",
        },
        {
            "presentationFaceId": "soulTrap", "renderSide": "back",
            "center": [1405, 575], "size": [300, 455], "rotationDeg": 6.0, "z": 2,
            "corners": [[1279.6, 333.1], [1578.0, 364.4], [1530.4, 816.9], [1232.0, 785.6]],
            "contactShadowEnvelope": [1218, 329, 1602, 849],
            "cropId": "card-back",
        },
    ],
}

# §13.3 card rows: (crop id, half-open rect, output scale).
CARD_CROPS = [
    ("cards-full", (220, 280, 1620, 890), 1),
    ("card-creature-frame", (240, 300, 650, 875), 2),
    ("card-cast-frame", (635, 300, 1040, 875), 2),
    ("card-set-frame", (1000, 300, 1415, 885), 2),
    ("card-back", (1195, 300, 1620, 870), 2),
    ("card-art", (688, 328, 992, 628), 2),
    ("card-title", (688, 548, 992, 640), 2),
    ("card-rules", (688, 612, 992, 808), 2),
    ("card-stats", (272, 700, 616, 828), 2),
    ("card-contact", (248, 776, 1400, 866), 2),
]


def canonical_bytes(obj) -> bytes:
    # RFC 8785 for this data shape (no floats needing special treatment
    # beyond shortest-form, which json repr already emits for these values).
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sha256_hex(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def hash_manifest(manifest: dict) -> str:
    clone = {k: v for k, v in manifest.items() if k != "manifestSha256"}
    return sha256_hex(canonical_bytes(clone))


def wait_for(url: str, timeout_s: float = 20.0) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.3)
    raise RuntimeError(f"server never came up: {url}")


def capture(path: Path) -> None:
    script = f"""
const {{ chromium }} = require('@playwright/test');
(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage({{
    viewport: {{ width: 1672, height: 941 }},
    deviceScaleFactor: 1,
  }});
  await page.goto('http://127.0.0.1:{PORT}/showcase.html');
  await page.waitForFunction(() => window.__TF_CARDS_READY__ === true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({{
    path: {json.dumps(str(path))},
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  }});
  await browser.close();
}})();
"""
    subprocess.run(["node", "-e", script], check=True, cwd=ROOT)


def provenance_row() -> dict:
    """Run live §13.8/§13.8.1/§13.8.2 verification; the row is `present`
    only when every signature verifies against the committed registry."""
    result = subprocess.run(
        ["node", "scripts/verify_provenance.mjs"],
        capture_output=True, text=True, cwd=ROOT,
    )
    if result.returncode != 0:
        return {
            "artifactId": "provenance-index",
            "role": "13.8 signed motif/provenance index",
            "path": "",
            "sha256": "",
            "required": True,
            "status": "unsupported",
            "reason": f"verification failed: {result.stderr.strip()[:400]}",
        }
    verified = json.loads(result.stdout)
    index_path = OUT / "provenance/provenance-index.json"
    return {
        "artifactId": "provenance-index",
        "role": "13.8 signed motif/provenance index",
        "path": "provenance/provenance-index.json",
        "sha256": sha256_hex(index_path.read_bytes()),
        "required": True,
        "status": "present",
        "verification": verified,
    }


def main() -> int:
    manifest = dict(SHOWCASE_MANIFEST)
    manifest["manifestSha256"] = hash_manifest(manifest)

    for directory in (OUT, CAPTURES, CROPS):
        directory.mkdir(parents=True, exist_ok=True)

    server = subprocess.Popen(
        ["npx", "vite", "--host", "127.0.0.1", "--strictPort", "--port", str(PORT)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        wait_for(f"http://127.0.0.1:{PORT}/showcase.html")
        # §13.2 rule 4: recompute the hash before every screenshot.
        assert manifest["manifestSha256"] == hash_manifest(manifest)
        first = CAPTURES / "showcase-run1.png"
        second = CAPTURES / "showcase-run2.png"
        capture(first)
        assert manifest["manifestSha256"] == hash_manifest(manifest)
        capture(second)
    finally:
        server.terminate()
        server.wait()

    digest_first = sha256_hex(first.read_bytes())
    digest_second = sha256_hex(second.read_bytes())
    if digest_first != digest_second:
        print("DETERMINISM FAIL: consecutive captures differ", file=sys.stderr)
        print(digest_first, digest_second, file=sys.stderr)
        return 1

    source = Image.open(first).convert("RGB")
    crop_rows = []
    for crop_id, (left, top, right, bottom), scale in CARD_CROPS:
        image = source.crop((left, top, right, bottom))
        if scale != 1:
            image = image.resize(
                (image.width * scale, image.height * scale), Image.LANCZOS
            )
        path = CROPS / f"{crop_id}.png"
        image.save(path)
        crop_rows.append((crop_id, path))

    index = {
        "schema": "tiny-fangs.critic-packet-index.v1",
        "schemaRevision": 1,
        "packetId": "card-showcase-r1",
        "packetKind": "card-showcase",
        "packetKindNote": (
            "Plan-level pre-board golden-sample review of the four-card "
            "showcase; reuses the art bible 13.2 manifest, 13.3 card crops, "
            "and 13.7.2 hashing. This is NOT the 13.5 integrated-art packet, "
            "which requires the Phase 7 populated board."
        ),
        "buildRevision": subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT
        ).stdout.strip(),
        "showcaseManifest": manifest,
        "determinism": {
            "runs": 2,
            "sha256": digest_first,
            "byteIdentical": True,
        },
        "artifacts": [
            {
                "artifactId": "showcase-capture",
                "role": "13.2 showcase capture, 1672x941 DPR1",
                "path": "captures/showcase-run1.png",
                "sha256": digest_first,
                "required": True,
                "status": "present",
            },
            *[
                {
                    "artifactId": f"crop-{crop_id}",
                    "role": f"13.3 crop {crop_id}",
                    "path": f"crops/{path.name}",
                    "sha256": sha256_hex(path.read_bytes()),
                    "required": True,
                    "status": "present",
                }
                for crop_id, path in crop_rows
            ],
            provenance_row(),
            {
                "artifactId": "metric-report",
                "role": "12/13.5 mandatory measurement report (card rows)",
                "path": "",
                "sha256": "",
                "required": True,
                "status": "unsupported",
                "reason": (
                    "Automated card-row metric report not yet emitted by the "
                    "runner. Chassis geometry rows are covered by the unit/"
                    "browser suites (16 + 7 green contracts) but are not yet "
                    "attached in packet form; row counts as failed for gate "
                    "math until attached."
                ),
            },
            {
                "artifactId": "blind-mapping",
                "role": "13.7 sealed A/B commitment",
                "path": "",
                "sha256": "",
                "required": True,
                "status": "unsupported",
                "reason": (
                    "Single-challenger card review has no A/B pair until the "
                    "R1 comparison assets are prepared; sealed commitment "
                    "lands with the critic run."
                ),
            },
        ],
    }
    index_clone = {k: v for k, v in index.items() if k != "indexSha256"}
    index["indexSha256"] = sha256_hex(canonical_bytes(index_clone))
    (OUT / "packet-index.json").write_text(
        json.dumps(index, indent=2, sort_keys=True) + "\n"
    )

    print("manifestSha256:", manifest["manifestSha256"])
    print("captureSha256:", digest_first)
    print("indexSha256:", index["indexSha256"])
    print("crops:", len(crop_rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
