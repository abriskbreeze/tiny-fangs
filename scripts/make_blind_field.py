#!/usr/bin/env python3
"""Assemble the anonymized A/B field comparison set and sealed mapping.

Cuts the SAME ten camera-packet rectangles from the R2 reference and from
the deterministic populated-board capture, resizes detail rows exactly 2x
Lanczos, assigns one sealed random A/B mapping for the whole set, and
writes the commitment row. The mapping lives OUTSIDE the packet; critics
receive only labels. Pass the revision tag (e.g. field-r2) as argv[1].
"""
import hashlib
import json
import random
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PACKET = ROOT / "tests/visual/field-packet"
BLIND = PACKET / "blind"
SEALED = ROOT / "tests/visual/card-packet-sealed"
REFERENCE = ROOT / "docs/exec-cb613d03-7a77-4266-bd6b-e0d83428f067.png"
CAPTURE = PACKET / "board-run1.png"

# Same rows as the camera bake-off packet (art bible camera packet list).
FIELD_CROPS = [
    ("field-full", (0, 0, 1672, 941), 1),
    ("field-opponent", (232, 112, 1464, 384), 2),
    ("field-divider", (232, 370, 1464, 458), 2),
    ("field-player", (232, 440, 1464, 712), 2),
    ("field-hand", (480, 670, 1200, 925), 2),
    ("field-corner-tl", (0, 0, 320, 240), 2),
    ("field-corner-tr", (1352, 0, 1672, 240), 2),
    ("field-corner-bl", (0, 701, 320, 941), 2),
    ("field-corner-br", (1352, 701, 1672, 941), 2),
    ("field-card-contact", (400, 430, 640, 730), 2),
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
    revision = sys.argv[1] if len(sys.argv) > 1 else "field-r2"
    reference = Image.open(REFERENCE).convert("RGB").resize(
        (1672, 941), Image.Resampling.LANCZOS
    )
    challenger = Image.open(CAPTURE).convert("RGB")
    assert challenger.size == (1672, 941), challenger.size

    BLIND.mkdir(parents=True, exist_ok=True)
    SEALED.mkdir(parents=True, exist_ok=True)

    rng = random.SystemRandom()
    challenger_label = rng.choice(["A", "B"])
    reference_label = "B" if challenger_label == "A" else "A"

    for crop_id, rect, scale in FIELD_CROPS:
        directory = BLIND / crop_id
        directory.mkdir(exist_ok=True)
        cut(reference, rect, scale).save(directory / f"{reference_label}.png")
        cut(challenger, rect, scale).save(directory / f"{challenger_label}.png")

    mapping = {
        "schema": "tiny-fangs.blind-mapping.v1",
        "set": revision,
        "challenger": challenger_label,
        "reference": reference_label,
        "challengerCaptureSha256": sha256_file(CAPTURE),
        "referenceSha256": sha256_file(REFERENCE),
    }
    mapping_path = SEALED / "field-mapping.json"
    mapping_path.write_text(json.dumps(mapping, indent=2, sort_keys=True) + "\n")

    commitment = {
        "role": f"13.7 sealed A/B commitment (field, {revision})",
        "sha256": sha256_file(mapping_path),
        "status": "sealed-external",
    }
    (PACKET / "blind-commitment.json").write_text(
        json.dumps(commitment, indent=2, sort_keys=True) + "\n"
    )
    print("blind field set ready; commitment:", commitment["sha256"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
