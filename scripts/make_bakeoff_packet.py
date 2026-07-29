#!/usr/bin/env python3
"""Assemble the blind camera bake-off packet from raw graybox captures.

Reads tests/visual/bakeoff/raw/candidate-{O,P}.png and their reports, then
writes an anonymized packet (labels A/B, random mapping) to
tests/visual/bakeoff/packet/ and the sealed mapping to
tests/visual/bakeoff/sealed/ (outside the packet). Crops follow the art
bible's camera packet list; detail crops are resized exactly 2x with Lanczos;
the packet index follows tiny-fangs.critic-packet-index.v1 with the sealed
mapping represented only by its commitment row.
"""
import hashlib
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tests/visual/bakeoff/raw"
PACKET = ROOT / "tests/visual/bakeoff/packet"
SEALED = ROOT / "tests/visual/bakeoff/sealed"

# (crop id, half-open rect, scale) — field-full stays 1x; detail crops are 2x.
CAMERA_CROPS = [
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

BOARD_ANCHOR_CENTERS = {
    "opp.deck": (361, 264), "opp.bench.a": (655, 264), "opp.bench.b": (833, 264),
    "opp.active": (1065, 252), "opp.set": (1278, 270), "opp.grave": (1420, 270),
    "me.deck": (344, 576), "me.active": (520, 572), "me.bench.a": (729, 570),
    "me.bench.b": (912, 568), "me.set": (1092, 568), "me.grave": (1306, 580),
}
ACTIVE_ENVELOPE = (432, 453, 608, 691)
HAND_ENVELOPE = (528, 683, 1152, 911)


def sha256_file(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_json_bytes(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n")


def anonymize_report(report: dict) -> dict:
    out = dict(report)
    out.pop("camera", None)
    out.pop("candidate", None)
    return out


def fiducial_overlay(image: Image.Image) -> Image.Image:
    overlay = image.copy()
    draw = ImageDraw.Draw(overlay)
    for anchor_id, (x, y) in BOARD_ANCHOR_CENTERS.items():
        draw.line([(x - 12, y), (x + 12, y)], fill=(30, 200, 255), width=2)
        draw.line([(x, y - 12), (x, y + 12)], fill=(30, 200, 255), width=2)
        draw.text((x + 14, y - 14), anchor_id, fill=(30, 200, 255))
    return overlay


def gap_overlay(image, gap=None):
    overlay = image.copy()
    draw = ImageDraw.Draw(overlay)
    draw.rectangle(ACTIVE_ENVELOPE, outline=(255, 120, 40), width=3)
    draw.rectangle(HAND_ENVELOPE, outline=(40, 160, 255), width=3)
    ix = (max(ACTIVE_ENVELOPE[0], HAND_ENVELOPE[0]), max(ACTIVE_ENVELOPE[1], HAND_ENVELOPE[1]),
          min(ACTIVE_ENVELOPE[2], HAND_ENVELOPE[2]), min(ACTIVE_ENVELOPE[3], HAND_ENVELOPE[3]))
    draw.rectangle(ix, outline=(255, 40, 40), width=2)
    draw.text((ix[0], ix[3] + 6),
              f"envelope intersection {ix[2]-ix[0]}x{ix[3]-ix[1]} px (allocation only)",
              fill=(255, 40, 40))
    if gap:
        vis = gap["visibleSilhouetteGapPx"]
        sem = gap["semanticHitPolygonGapPx"]
        ok = "PASS" if gap["passesMinimum4Px"] else "FAIL"
        y0, y1 = gap["activeBottomY"], gap["handTopY"]
        draw.line([(560, y0), (700, y0)], fill=(255, 255, 0), width=2)
        draw.line([(560, y1), (700, y1)], fill=(255, 255, 0), width=2)
        draw.text((560, y1 + 8),
                  f"measured visible silhouette gap {vis:.1f}px / semantic {sem:.1f}px (>=4px {ok})",
                  fill=(255, 255, 0))
    return overlay


def is_field_pixel(rgb) -> bool:
    """Playable-meadow detector: the field renders in the warm gold family and
    is robust to Lambert lighting shifts, unlike matching exact foliage
    constants. Environment depth = distance from the frame edge to the first
    field pixel."""
    r, g, b = rgb
    return r > 130 and g > 110 and r > b + 35 and g > b + 25


def environment_frame_occupancy(image: Image.Image) -> dict:
    """§12 environment-frame row (§2.4 derivation): median depth from each
    edge to the first playable-field pixel, as a percentage of the relevant
    frame dimension. Bottom band scans only outside the hand columns per
    §2.4's behind-the-hand rule."""
    w, h = image.size
    px = image.load()
    step = 8

    def median(values):
        values = sorted(values)
        return values[len(values) // 2] if values else 0

    def depth_from_left(y):
        for x in range(0, w // 3):
            if is_field_pixel(px[x, y]):
                return x
        return w // 3

    def depth_from_right(y):
        for x in range(w - 1, 2 * w // 3, -1):
            if is_field_pixel(px[x, y]):
                return w - 1 - x
        return w // 3

    def depth_from_top(x):
        for y in range(0, h // 3):
            if is_field_pixel(px[x, y]):
                return y
        return h // 3

    def depth_from_bottom(x):
        for y in range(h - 1, 2 * h // 3, -1):
            if is_field_pixel(px[x, y]):
                return h - 1 - y
        return h // 3

    left = median([depth_from_left(y) for y in range(0, h, step)]) / w * 100
    right = median([depth_from_right(y) for y in range(0, h, step)]) / w * 100
    top = median([depth_from_top(x) for x in range(0, w, step)]) / h * 100
    bottom_cols = [x for x in range(0, w, step) if x < 470 or x > 1210]
    bottom = median([depth_from_bottom(x) for x in bottom_cols]) / h * 100
    return {
        "method": "median edge-to-first-field-pixel depth; field = warm-gold classifier; bottom band excludes hand columns (470-1210) per section 2.4",
        "medianIntrusionPct": {"left": round(left, 2), "right": round(right, 2),
                               "top": round(top, 2), "bottom": round(bottom, 2)},
        "targets": {"left": [10, 15], "right": [10, 15], "top": [10, 15], "bottom": [8, 12]},
        "targetSource": "section 2.4: sides/top 10-15%; bottom 8-12% behind the hand",
        "passes": {
            "left": 10 <= left <= 15, "right": 10 <= right <= 15,
            "top": 10 <= top <= 15, "bottom": 8 <= bottom <= 12,
        },
    }


def main() -> int:
    for candidate in ("O", "P"):
        if not (RAW / f"candidate-{candidate}.png").exists():
            print(f"missing raw capture for {candidate}", file=sys.stderr)
            return 1

    PACKET.mkdir(parents=True, exist_ok=True)
    SEALED.mkdir(parents=True, exist_ok=True)
    for stale in PACKET.glob("**/*"):
        if stale.is_file():
            stale.unlink()

    labels = ["A", "B"]
    random.shuffle(labels)
    mapping = {"O": labels[0], "P": labels[1]}

    mapping_path = SEALED / "mapping.json"
    write_json(mapping_path, {"schema": "tiny-fangs.blind-mapping.v1", "mapping": mapping})
    mapping_commitment = sha256_file(mapping_path)

    rows = []

    def add_row(artifact_id: str, role: str, path: Path) -> None:
        rows.append({
            "artifactId": artifact_id,
            "role": role,
            "path": str(path.relative_to(PACKET)),
            "sha256": sha256_file(path),
            "required": True,
            "status": "present",
        })

    for candidate in ("O", "P"):
        label = mapping[candidate]
        label_dir = PACKET / f"candidate-{label}"
        label_dir.mkdir(parents=True, exist_ok=True)
        image = Image.open(RAW / f"candidate-{candidate}.png").convert("RGB")

        for crop_id, rect, scale in CAMERA_CROPS:
            crop = image.crop(rect)
            if scale != 1:
                crop = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.LANCZOS)
            out = label_dir / f"{crop_id}.png"
            crop.save(out)
            add_row(f"{label}-{crop_id}", f"section-13.7 camera crop {crop_id}", out)

        report = json.loads((RAW / f"candidate-{candidate}-report.json").read_text())

        fid = fiducial_overlay(image)
        fid_path = label_dir / "fiducial-overlay.png"
        fid.save(fid_path)
        add_row(f"{label}-fiducial-overlay", "section-3.4 fiducial overlay", fid_path)

        gap = gap_overlay(image, report.get("activeHandGap"))
        gap_path = label_dir / "active-hand-gap-overlay.png"
        gap.save(gap_path)
        add_row(f"{label}-gap-overlay", "section-2.5 active/hand gap overlay", gap_path)

        anon = anonymize_report(report)
        anon["environmentFrameOccupancy"] = environment_frame_occupancy(image)
        anon["rawCaptureSha256"] = sha256_file(RAW / f"candidate-{candidate}.png")
        report_path = label_dir / "residual-report.json"
        write_json(report_path, anon)
        add_row(f"{label}-residual-report", "section-3.1.1 residual report", report_path)

    determinism_src = RAW / "determinism.json"
    if determinism_src.exists():
        determinism_path = PACKET / "determinism.json"
        determinism_path.write_text(determinism_src.read_text())
        add_row("determinism-evidence", "section-12 determinism row evidence", determinism_path)

    index = {
        "schema": "tiny-fangs.critic-packet-index.v1",
        "revision": 4,
        "packetId": "camera-bakeoff-4",
        "packetKind": "camera-graybox",
        "colorSpace": "IEC 61966-2-1 sRGB (manifest-declared; captures are untagged PNG)",
        "artifacts": rows + [{
            "artifactId": "sealed-op-mapping",
            "role": "section-3.4 sealed O/P mapping commitment",
            "path": "",
            "sha256": mapping_commitment,
            "required": True,
            "status": "sealed-external",
            "reason": "blind mapping stored outside the packet; revealed after scores",
        }],
    }
    body = dict(index)
    index["indexSha256"] = "sha256:" + hashlib.sha256(canonical_json_bytes(body)).hexdigest()
    write_json(PACKET / "packet-index.json", index)

    print(f"packet: {PACKET}")
    print(f"sealed mapping commitment: {mapping_commitment}")
    print(f"artifacts: {len(index['artifacts'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
