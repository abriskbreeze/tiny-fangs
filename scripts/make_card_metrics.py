#!/usr/bin/env python3
"""Emit the card-scope §12 metric report for the card-showcase packet.

Every row is machine-evaluated here or bound to a named green suite run.
Rows that fail are recorded failed — the report never rounds up.

Usage: python3 scripts/make_card_metrics.py   (owns vite on port 5199)
"""
import json
import math
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests/visual/card-packet"
PORT = 5199

# ── color math ──────────────────────────────────────────────────────

def srgb_to_lab(rgb):
    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def ciede2000(lab1, lab2):
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1 = math.hypot(a1, b1)
    C2 = math.hypot(a2, b2)
    Cbar = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp = L2 - L1
    dCp = C2p - C1p
    if C1p * C2p == 0:
        dhp = 0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    elif h2p - h1p > 180:
        dhp = h2p - h1p - 360
    else:
        dhp = h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp = (L1 + L2) / 2
    Cbp = (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30))
         + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6))
         - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dTheta = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTheta)) * Rc
    return math.sqrt(
        (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
        + Rt * (dCp / Sc) * (dHp / Sh)
    )


def rel_luminance(rgb):
    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(rgb1, rgb2):
    l1, l2 = sorted((rel_luminance(rgb1), rel_luminance(rgb2)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# ── geometry: card-local → stage coordinates (§13.2 transforms) ─────

SPECIMENS = {
    "card-creature-frame": {"center": (445, 578), "size": (330, 500), "rot": -1.5},
    "card-cast-frame": {"center": (833, 577), "size": (330, 500), "rot": 0.0},
    "card-set-frame": {"center": (1206, 584), "size": (330, 500), "rot": 1.5},
    "card-back": {"center": (1405, 575), "size": (300, 455), "rot": 6.0},
}

def to_stage(spec_id, local_xy):
    spec = SPECIMENS[spec_id]
    sx = spec["size"][0] / 333.0
    sy = spec["size"][1] / 505.0
    theta = math.radians(spec["rot"])
    dx = (local_xy[0] - 166.5) * sx
    dy = (local_xy[1] - 252.5) * sy
    return (
        spec["center"][0] + dx * math.cos(theta) - dy * math.sin(theta),
        spec["center"][1] + dx * math.sin(theta) + dy * math.cos(theta),
    )


def median_window(image, xy, half=2):
    xs, ys = int(round(xy[0])), int(round(xy[1]))
    pixels = [
        image.getpixel((x, y))[:3]
        for x in range(xs - half, xs + half + 1)
        for y in range(ys - half, ys + half + 1)
    ]
    channels = list(zip(*pixels))
    return tuple(sorted(c)[len(c) // 2] for c in channels)

# ── capture helpers ─────────────────────────────────────────────────

def wait_for(url, timeout_s=20.0):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.3)
    raise RuntimeError(f"server never came up: {url}")


def capture(url_suffix, path, wait_ready=True):
    ready = ("await page.waitForFunction(() => window.__TF_CARDS_READY__ === true);"
             if wait_ready else "await page.waitForTimeout(400);")
    script = f"""
const {{ chromium }} = require('@playwright/test');
(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage({{ viewport: {{ width: 1672, height: 941 }}, deviceScaleFactor: 1 }});
  await page.goto('http://127.0.0.1:{PORT}/showcase.html{url_suffix}');
  {ready}
  await page.screenshot({{ path: {json.dumps(str(path))}, animations: 'disabled', caret: 'hide', scale: 'css' }});
  await browser.close();
}})();
"""
    subprocess.run(["node", "-e", script], check=True, cwd=ROOT)


def measure_radii():
    script = """
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  await page.goto('http://127.0.0.1:%d/showcase.html?mode=chassis');
  await page.waitForFunction(() => window.__TF_CARDS_READY__ === true);
  const data = await page.evaluate(() => {
    const card = document.querySelector('[data-specimen="card-creature-frame"] .tf-aaa-card');
    const layers = ['', '__keyline', '__rail', '__inner-keyline', '__panel'];
    const out = [];
    let node = card;
    for (const layer of layers) {
      const el = layer ? card.querySelector('.tf-aaa-card' + layer) : card;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      out.push({ layer: layer || 'root', radius: parseFloat(cs.borderTopLeftRadius), left: rect.left });
    }
    return out;
  });
  console.log(JSON.stringify(data));
  await browser.close();
})();
""" % PORT
    result = subprocess.run(["node", "-e", script], check=True, capture_output=True, text=True, cwd=ROOT)
    return json.loads(result.stdout.strip().splitlines()[-1])


def main() -> int:
    rows = []

    def row(row_id, method, measured, tolerance, ok):
        rows.append({
            "rowId": row_id, "method": method, "measured": measured,
            "tolerance": tolerance, "pass": bool(ok),
        })

    server = subprocess.Popen(
        ["npx", "vite", "--host", "127.0.0.1", "--strictPort", "--port", str(PORT)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        wait_for(f"http://127.0.0.1:{PORT}/showcase.html")

        showcase_png = OUT / "captures/metric-showcase.png"
        capture("", showcase_png)
        shadow_masks = {}
        for spec_id in SPECIMENS:
            mask_path = OUT / f"captures/metric-shadow-{spec_id}.png"
            capture(f"?mode=shadow-mask&only={spec_id}", mask_path, wait_ready=False)
            shadow_masks[spec_id] = mask_path

        image = Image.open(showcase_png).convert("RGB")
        row("canonical-capture", "screenshot dimensions / DPR1 / sRGB declared in manifest",
            {"size": list(image.size)}, "exactly 1672x941 / 1 / sRGB",
            image.size == (1672, 941))

        # Palette: family base roles, 5x5 medians at rail/panel sample points.
        family_samples = {
            "creatureAmber": ("card-creature-frame", (25, 252), "#B47015"),
            "castTeal": ("card-cast-frame", (25, 252), "#277A79"),
            "setPlum": ("card-set-frame", (25, 252), "#6A5A66"),
            "cardBackNavy": ("card-back", (60, 90), "#372F3F"),
        }
        family_measured = {}
        palette_ok = True
        palette_out = {}
        for name, (spec, local, target) in family_samples.items():
            median = median_window(image, to_stage(spec, local))
            family_measured[name] = median
            delta = ciede2000(srgb_to_lab(median), srgb_to_lab(hex_rgb(target)))
            palette_out[name] = {"median": list(median), "deltaE00": round(delta, 2)}
            palette_ok &= delta <= 5.0
        row("palette-family-roles", "5x5 median at family rail/panel sample vs section 5 target",
            palette_out, "CIEDE2000 <= 5 (final)", palette_ok)

        separation = ciede2000(
            srgb_to_lab(family_measured["castTeal"]),
            srgb_to_lab(family_measured["setPlum"]),
        )
        row("cast-set-separation", "CIEDE2000 between measured cast/set rail medians",
            round(separation, 2), ">= 12", separation >= 12)

        parchment = median_window(image, to_stage("card-cast-frame", (166, 430)))
        ink_contrast = contrast(hex_rgb("#3B2317"), parchment)
        row("text-contrast", "authored ink vs sampled parchment median",
            {"parchmentMedian": list(parchment), "contrast": round(ink_contrast, 2)},
            ">= 4.5:1 body", ink_contrast >= 4.5)

        # Corner construction: computed radii concentric with cumulative inset.
        layers = measure_radii()
        conc_ok = True
        conc_out = []
        outer_r = layers[0]["radius"]
        outer_left = layers[0]["left"]
        for layer in layers[1:]:
            inset = layer["left"] - outer_left
            expected = max(outer_r - inset, 0.0)
            error = abs(layer["radius"] - expected)
            conc_out.append({"layer": layer["layer"], "inset": round(inset, 2),
                            "radius": layer["radius"], "expected": round(expected, 2),
                            "error": round(error, 2)})
            conc_ok &= error <= 1.0
        row("corner-construction", "computed border radii vs outer radius minus cumulative inset",
            conc_out, "concentric error <= 1 px at 333 px width", conc_ok)

        # Showcase contact shadows: alpha-mass centroid from the shadow-only mask.
        shadow_ok = True
        shadow_out = {}
        envelopes = {
            "card-creature-frame": (259, 319, 641, 865),
            "card-cast-frame": (654, 323, 1022, 859),
            "card-set-frame": (1020, 325, 1402, 870),
            "card-back": (1218, 329, 1602, 849),
        }
        for spec_id, (left, top, right, bottom) in envelopes.items():
            shadow = Image.open(shadow_masks[spec_id]).convert("RGB")
            bg_lum = rel_luminance(shadow.getpixel((10, 10)))
            total = 0.0
            mx = 0.0
            my = 0.0
            for y in range(top, bottom, 2):
                for x in range(left, right, 2):
                    weight = bg_lum - rel_luminance(shadow.getpixel((x, y)))
                    if weight > 0.01:
                        total += weight
                        mx += weight * x
                        my += weight * y
            center = SPECIMENS[spec_id]["center"]
            cx = mx / total - center[0]
            cy = my / total - center[1]
            direction = math.degrees(math.atan2(cy, cx))
            ok = (20 <= cx <= 100) and (50 <= cy <= 90) and (55 <= direction <= 75)
            # Envelope containment: darkness must vanish before edges.
            edge_leak = max(
                bg_lum - rel_luminance(shadow.getpixel((left, (top + bottom) // 2))),
                bg_lum - rel_luminance(shadow.getpixel((right - 1, (top + bottom) // 2))),
                bg_lum - rel_luminance(shadow.getpixel(((left + right) // 2, top))),
                bg_lum - rel_luminance(shadow.getpixel(((left + right) // 2, bottom - 1))),
            )
            ok &= edge_leak <= 0.02
            shadow_out[spec_id] = {"offset": [round(cx, 1), round(cy, 1)],
                                   "directionDeg": round(direction, 1),
                                   "edgeLeak": round(edge_leak, 4)}
            shadow_ok &= ok
        row("showcase-shadow", "shadow-only mask centroid offset/direction per specimen",
            shadow_out, "x +20..100, y +50..90, 55..75 deg, contained", shadow_ok)

        # Critic-r1 coverage extension 1: shadows must be VISIBLE in the real
        # composed capture, not only present in isolation masks. Compare
        # luminance in the shadow band (below-right of each card, inside the
        # envelope) against unshadowed ground just outside the envelope's
        # opposite corner.
        vis_ok = True
        vis_out = {}
        corner_pairs = {
            "card-creature-frame": ((634, 841), (252, 312)),
            "card-cast-frame": ((1016, 845), (648, 318)),
            "card-set-frame": ((1382, 852), (1028, 322)),
            "card-back": ((1548, 830), (1226, 326)),
        }
        for spec_id, (shadow_pt, clear_pt) in corner_pairs.items():
            shadow_lum = rel_luminance(median_window(image, shadow_pt))
            clear_lum = rel_luminance(median_window(image, clear_pt))
            delta = clear_lum - shadow_lum
            ok = delta >= 0.03
            vis_out[spec_id] = {"shadowLum": round(shadow_lum, 3),
                                "clearLum": round(clear_lum, 3),
                                "delta": round(delta, 3)}
            vis_ok &= ok
        row("shadow-visibility-in-context",
            "luminance delta between in-envelope shadow band and unshadowed ground in the composed capture",
            vis_out, "delta >= 0.03 per specimen", vis_ok)

        # Critic-r1 coverage extension 2: footer/flavor contrast measured on
        # the footer's own sampled ground per family card, not only the
        # generic parchment sample.
        footer_ok = True
        footer_out = {}
        for spec_id, local in {
            "card-creature-frame": (166, 476),
            "card-cast-frame": (166, 476),
            "card-set-frame": (166, 476),
        }.items():
            ground = median_window(image, to_stage(spec_id, local))
            ratio = contrast(hex_rgb("#3B2317"), ground)
            footer_out[spec_id] = {"ground": list(ground), "contrast": round(ratio, 2)}
            footer_ok &= ratio >= 4.5
        row("footer-contrast-on-ground",
            "authored footer ink vs sampled footer-region ground per family card",
            footer_out, ">= 4.5:1", footer_ok)
    finally:
        server.terminate()
        server.wait()

    # Suite-bound rows (executed fresh here, results recorded verbatim).
    unit = subprocess.run(
        ["npx", "vitest", "--run", "tests/presentation/chassis-geometry.test.js"],
        capture_output=True, text=True, cwd=ROOT,
    )
    unit_pass = unit.returncode == 0
    row("chassis-geometry-units", "vitest tests/presentation/chassis-geometry.test.js",
        "pass" if unit_pass else "fail", "16/16 contracts green", unit_pass)

    browser = subprocess.run(
        ["npx", "playwright", "test", "--project=visual", "card-chassis"],
        capture_output=True, text=True, cwd=ROOT,
    )
    browser_pass = browser.returncode == 0
    row("chassis-browser-gates",
        "playwright visual card-chassis (ratio, insets, aperture, 7.4 rects, nameplate fixtures, back privacy, showcase centers)",
        "pass" if browser_pass else "fail", "7/7 gates green", browser_pass)

    prov = subprocess.run(["node", "scripts/verify_provenance.mjs"],
                          capture_output=True, text=True, cwd=ROOT)
    row("provenance", "verify_provenance.mjs registry/signature verification",
        json.loads(prov.stdout) if prov.returncode == 0 else prov.stderr[:200],
        "all records verified", prov.returncode == 0)

    report = {
        "schema": "tiny-fangs.card-metric-report.v1",
        "scope": "card-showcase (pre-board golden-sample review)",
        "rows": rows,
        "allPass": all(r["pass"] for r in rows),
    }
    (OUT / "metric-report.json").write_text(json.dumps(report, indent=2) + "\n")
    for r in rows:
        print(("PASS " if r["pass"] else "FAIL "), r["rowId"])
    print("allPass:", report["allPass"])
    return 0 if report["allPass"] else 1


if __name__ == "__main__":
    sys.exit(main())
