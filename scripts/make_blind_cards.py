#!/usr/bin/env python3
"""Assemble the anonymized A/B card comparison set and sealed mapping.

For every §13.3 reference-comparable card row, cut the SAME rectangle from
R1 and from the challenger capture, resize detail rows exactly 2x Lanczos,
assign one sealed random A/B mapping for the whole set (as the camera
bake-off did), and write the commitment row into the packet index. The
mapping file lives OUTSIDE the packet; critics receive only labels.
"""
import hashlib
import json
import random
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PACKET = ROOT / "tests/visual/card-packet"
BLIND = PACKET / "blind"
SEALED = ROOT / "tests/visual/card-packet-sealed"
R1 = ROOT / "docs/exec-50304c60-4218-4f0b-b73f-27b218d4b941.png"
CAPTURE = PACKET / "captures/showcase-run1.png"

CARD_ROWS = [
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


def sha256_file(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def cut(source: Image.Image, rect, scale) -> Image.Image:
    image = source.crop(rect)
    if scale != 1:
        image = image.resize(
            (image.width * scale, image.height * scale), Image.Resampling.LANCZOS
        )
    return image


def main() -> int:
    reference = Image.open(R1).convert("RGB")
    challenger = Image.open(CAPTURE).convert("RGB")

    BLIND.mkdir(parents=True, exist_ok=True)
    SEALED.mkdir(parents=True, exist_ok=True)

    # One sealed mapping for the whole set.
    rng = random.SystemRandom()
    challenger_label = rng.choice(["A", "B"])
    reference_label = "B" if challenger_label == "A" else "A"

    for crop_id, rect, scale in CARD_ROWS:
        directory = BLIND / crop_id
        directory.mkdir(exist_ok=True)
        cut(reference, rect, scale).save(directory / f"{reference_label}.png")
        cut(challenger, rect, scale).save(directory / f"{challenger_label}.png")

    mapping = {
        "schema": "tiny-fangs.blind-mapping.v1",
        "set": "card-showcase-r1",
        "challenger": challenger_label,
        "reference": reference_label,
        "challengerCaptureSha256": sha256_file(CAPTURE),
        "referenceSha256": sha256_file(R1),
    }
    mapping_path = SEALED / "card-mapping.json"
    mapping_path.write_text(json.dumps(mapping, indent=2, sort_keys=True) + "\n")

    commitment = {
        "artifactId": "blind-mapping",
        "role": "13.7 sealed A/B commitment",
        "path": "",
        "sha256": sha256_file(mapping_path),
        "required": True,
        "status": "sealed-external",
        "reason": "mapping stored outside the packet; critics verify only this commitment row",
    }
    (PACKET / "blind-commitment.json").write_text(
        json.dumps(commitment, indent=2, sort_keys=True) + "\n"
    )
    print("blind set ready; commitment:", commitment["sha256"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
