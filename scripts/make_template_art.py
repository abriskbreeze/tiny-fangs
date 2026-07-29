#!/usr/bin/env python3
"""Phase 6 TEMPLATE MODE (user decision 2026-07-28): render the six faction
template art pieces and produce the four manifest variants for each.

One shared cel-scene structure (sky band, tree line, meadow ground, one
faction motif) in the art bible §5 palette keeps the set style-consistent.
Outputs per template under src/assets/cards/templates/<key>/:
  source.png 2048x1536, detail.webp 1600x1200, thumbnail.webp 800x600,
  fallback.jpg 800x600 — matching the CARD_ART_VARIANTS specs exactly.

These are placeholder-tier assets: no provenance claim is recorded, and the
strict-release validator is expected to stay red on duplicate hashes and
missing provenance until the user's real per-card art exists.
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/assets/cards/templates"

SHARED_FOOTER = """
  <path d="M0 268 L26 240 L48 268 L76 232 L102 268 L128 244 L150 268 L180 238 L206 268 L236 242 L262 268 L292 236 L318 268 L348 246 L370 268 L398 240 L424 268 L456 244 L478 268 L512 250 L512 384 L0 384 Z"
        fill="{tree}" opacity="0.9"/>
  <path d="M0 292 Q128 272 256 286 Q384 298 512 280 L512 384 L0 384 Z" fill="{groundHi}"/>
  <rect y="320" width="512" height="64" fill="{groundLo}"/>
  <path d="M0 322 Q160 312 512 324 L512 330 L0 330 Z" fill="{groundHi}" opacity="0.6"/>
"""

TEMPLATES = {
    "shadow": {
        "sky": ["#241F2C", "#372F3F", "#4C4150"],
        "tree": "#241F2C", "groundHi": "#3E3A4A", "groundLo": "#2B2834",
        "motif": """
  <circle cx="388" cy="88" r="44" fill="#DCBA96" opacity="0.85"/>
  <circle cx="372" cy="78" r="40" fill="{sky1}"/>
  <g fill="#9C8AA0">
    <circle cx="150" cy="150" r="10" opacity="0.8"/>
    <circle cx="196" cy="118" r="7" opacity="0.7"/>
    <circle cx="118" cy="196" r="6" opacity="0.6"/>
    <circle cx="238" cy="164" r="5" opacity="0.65"/>
  </g>
  <g stroke="#9C8AA0" stroke-width="2" fill="none" opacity="0.5">
    <path d="M150 160 C146 180 152 198 162 210"/>
    <path d="M196 125 C192 140 198 152 206 162"/>
  </g>""",
    },
    "fang": {
        "sky": ["#372F3F", "#6A4A38", "#B47015"],
        "tree": "#334B42", "groundHi": "#4E5638", "groundLo": "#3A422C",
        "motif": """
  <circle cx="400" cy="84" r="40" fill="#F5D783"/>
  <circle cx="400" cy="84" r="52" fill="#EDC674" opacity="0.35"/>
  <g fill="#241B18">
    <path d="M170 236 C164 196 176 162 200 146 C212 138 220 124 226 108 L238 122 C250 118 260 122 264 132 L254 138 C258 148 254 158 244 164 C250 186 248 212 240 236 Z"/>
    <path d="M170 226 C158 224 150 214 150 202 C158 209 165 213 172 215 Z"/>
  </g>
  <path d="M226 108 L238 122 C250 118 260 122 264 132 L254 138 C256 130 248 126 240 129 L232 118 Z"
        fill="#EDC674" opacity="0.9"/>""",
    },
    "venom": {
        "sky": ["#1E3B3A", "#277A79", "#3E9C94"],
        "tree": "#28443C", "groundHi": "#3E4A2E", "groundLo": "#2B3327",
        "motif": """
  <g stroke="#8FD8CB" stroke-width="4" fill="none" opacity="0.75">
    <path d="M120 260 C112 210 124 168 150 140"/>
    <path d="M180 268 C176 224 186 188 206 164"/>
  </g>
  <path d="M150 140 C168 122 196 116 216 124 C204 128 192 136 184 148 C174 144 160 142 150 140 Z"
        fill="#8FD8CB" opacity="0.85"/>
  <path d="M330 150 C330 120 352 96 352 96 C352 96 374 120 374 150 C374 172 364 186 352 186 C340 186 330 172 330 150 Z"
        fill="#8FD8CB"/>
  <path d="M340 148 C340 128 352 112 352 112 C352 112 348 136 348 152 C348 164 344 170 342 168 C340 164 340 156 340 148 Z"
        fill="#F5D783" opacity="0.8"/>""",
    },
    "swarm": {
        "sky": ["#918751", "#C2AB4D", "#EDC674"],
        "tree": "#4E5638", "groundHi": "#B3A74F", "groundLo": "#8A8A45",
        "motif": """
  <g fill="#3B2317">
    <circle cx="256" cy="140" r="7"/>
    <circle cx="292" cy="122" r="5.5"/><circle cx="222" cy="120" r="5.5"/>
    <circle cx="316" cy="150" r="5"/><circle cx="198" cy="152" r="5"/>
    <circle cx="300" cy="184" r="4.5"/><circle cx="212" cy="186" r="4.5"/>
    <circle cx="256" cy="200" r="4"/>
    <circle cx="276" cy="96" r="4"/><circle cx="234" cy="94" r="4"/>
    <circle cx="342" cy="126" r="3.5"/><circle cx="172" cy="128" r="3.5"/>
    <circle cx="330" cy="196" r="3"/><circle cx="184" cy="210" r="3"/>
  </g>
  <g stroke="#3B2317" stroke-width="1.5" fill="none" opacity="0.4">
    <path d="M256 147 C270 160 288 168 300 180"/>
    <path d="M256 147 C242 160 224 170 214 182"/>
  </g>""",
    },
    "shell": {
        "sky": ["#334B42", "#57604F", "#918751"],
        "tree": "#28443C", "groundHi": "#6B7458", "groundLo": "#4A5346",
        "motif": """
  <path d="M180 250 C180 200 216 164 262 164 C300 164 328 190 328 224 C328 252 306 272 280 272 C258 272 242 256 242 236 C242 220 254 208 268 208 C278 208 286 216 286 226 C286 233 281 238 275 238 L275 230 C277 230 279 229 279 226 C279 220 274 215 268 215 C258 215 249 224 249 236 C249 252 262 265 280 265 C302 265 321 248 321 224 C321 194 296 171 262 171 C220 171 187 204 187 250 Z"
        fill="#DCBA96"/>
  <path d="M180 250 C180 200 216 164 262 164 C240 172 214 190 202 216 C192 234 187 244 187 250 Z"
        fill="#EEC34E" opacity="0.5"/>""",
    },
    "token": {
        "sky": ["#8A8A45", "#B3A74F", "#C2AB4D"],
        "tree": "#4E5638", "groundHi": "#B3A74F", "groundLo": "#8A8A45",
        "motif": """
  <g opacity="0.55">
    <circle cx="256" cy="170" r="72" fill="none" stroke="#3B2317" stroke-width="3"/>
    <circle cx="256" cy="170" r="62" fill="none" stroke="#3B2317" stroke-width="1.5"/>
    <g fill="#3B2317">
      <path d="M236 138 C232 162 235 186 246 202 C247 184 247 160 245 144 Z"/>
      <path d="M276 138 C280 162 277 186 266 202 C265 184 265 160 267 144 Z"/>
      <path d="M233 136 Q256 128 279 136 L276 141 Q256 134 236 141 Z"/>
    </g>
  </g>""",
    },
}


def build_svg(key: str, spec: dict) -> str:
    sky0, sky1, sky2 = spec["sky"]
    motif = spec["motif"].replace("{sky1}", sky1)
    footer = SHARED_FOOTER.format(
        tree=spec["tree"], groundHi=spec["groundHi"], groundLo=spec["groundLo"]
    )
    return f"""<svg viewBox="0 0 512 384" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky-{key}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{sky0}"/>
      <stop offset="0.55" stop-color="{sky1}"/>
      <stop offset="1" stop-color="{sky2}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="384" fill="url(#sky-{key})"/>
{motif}
{footer}
</svg>"""


def render_png(svg: str, path: Path) -> None:
    html = f"<!DOCTYPE html><html><body style='margin:0'>{svg}</body></html>"
    html_path = path.parent / "_render.html"
    html_path.write_text(html.replace(
        '<svg viewBox="0 0 512 384"',
        '<svg viewBox="0 0 512 384" width="2048" height="1536"',
    ))
    script = f"""
const {{ chromium }} = require('@playwright/test');
(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage({{ viewport: {{ width: 2048, height: 1536 }} }});
  await page.goto('file://{html_path}');
  await page.screenshot({{ path: {json.dumps(str(path))} }});
  await browser.close();
}})();
"""
    subprocess.run(["node", "-e", script], check=True, cwd=ROOT)
    html_path.unlink()


def main() -> int:
    for key, spec in TEMPLATES.items():
        directory = OUT / key
        directory.mkdir(parents=True, exist_ok=True)
        source = directory / "source.png"
        render_png(build_svg(key, spec), source)
        image = Image.open(source).convert("RGB")
        assert image.size == (2048, 1536), image.size
        image.resize((1600, 1200), Image.Resampling.LANCZOS).save(
            directory / "detail.webp", quality=88
        )
        image.resize((800, 600), Image.Resampling.LANCZOS).save(
            directory / "thumbnail.webp", quality=86
        )
        image.resize((800, 600), Image.Resampling.LANCZOS).save(
            directory / "fallback.jpg", quality=84
        )
        sizes = {f.name: f.stat().st_size for f in sorted(directory.iterdir())}
        print(key, sizes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
