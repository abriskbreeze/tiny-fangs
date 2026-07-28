// Original Tiny Fangs golden-sample aperture art (plan Phase 2; art bible
// §5 palette, §7.6 surface constraints, accepted hash 84b89838…).
// Hand-authored cel-style SVG scenes — no traced or reference-derived
// geometry. Each viewBox matches the 256 × 267 physical aperture; the card
// back sigil uses the 285 × 457 back art-safe rectangle.
//
// Palette roles used (§5): sun core #EDC674, upper meadow #C2AB4D, lower
// meadow #B3A74F, cool foliage #334B42, sunlit foliage #918751, divider gold
// #F5D783, creature amber #B47015, cast teal #277A79, set plum #6A5A66,
// back navy #372F3F, parchment #DCBA96, ink #3B2317, filigree #EEC34E.

export const GOLDEN_SAMPLE_ART = {
  // Duskfang, Twilight Wolf — amber dusk over the meadow's tree line, wolf
  // silhouette with warm rim light and a single ember eye.
  duskfang: `
<svg viewBox="0 0 256 267" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="df-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#372F3F"/>
      <stop offset="0.45" stop-color="#6A4A38"/>
      <stop offset="0.78" stop-color="#B47015"/>
      <stop offset="1" stop-color="#EDC674"/>
    </linearGradient>
    <linearGradient id="df-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A4423"/>
      <stop offset="1" stop-color="#2B3327"/>
    </linearGradient>
    <radialGradient id="df-moon" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#F5D783"/>
      <stop offset="0.7" stop-color="#EDC674"/>
      <stop offset="1" stop-color="#EDC674" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="256" height="267" fill="url(#df-sky)"/>
  <circle cx="188" cy="52" r="34" fill="url(#df-moon)" opacity="0.9"/>
  <circle cx="188" cy="52" r="21" fill="#F5D783"/>
  <circle cx="195" cy="46" r="4" fill="#EDC674" opacity="0.6"/>
  <circle cx="181" cy="57" r="3" fill="#EDC674" opacity="0.5"/>
  <!-- far tree line -->
  <path d="M0 150 L18 128 L34 150 L52 118 L70 150 L88 132 L104 150 L124 122 L142 150 L164 130 L180 150 L204 126 L222 150 L240 134 L256 150 L256 172 L0 172 Z"
        fill="#334B42" opacity="0.85"/>
  <!-- mid hills -->
  <path d="M0 176 Q64 156 128 172 Q192 186 256 168 L256 210 L0 210 Z" fill="#4E5638"/>
  <path d="M0 176 Q64 156 128 172 Q60 176 24 182 Z" fill="#918751" opacity="0.5"/>
  <!-- ground -->
  <rect y="204" width="256" height="63" fill="url(#df-ground)"/>
  <path d="M0 206 Q80 198 256 208 L256 214 L0 214 Z" fill="#5A5C30" opacity="0.7"/>
  <!-- howling wolf on the ridge, focal subject centered in art-safe -->
  <g>
    <!-- ridge under the wolf -->
    <path d="M48 176 Q128 158 208 176 L208 190 L48 190 Z" fill="#3A422C"/>
    <!-- body: seated howl profile, muzzle raised to the moon -->
    <path d="M92 176
             C90 156 96 138 110 128
             C118 122 124 112 128 100
             L136 88 L142 72
             L152 84
             C160 82 166 84 170 90
             L162 94 C166 100 164 108 158 112
             C152 116 148 122 146 130
             C158 138 164 152 162 176
             L148 176 C148 162 144 150 136 144
             C128 150 120 160 118 176 Z"
          fill="#241B18"/>
    <!-- ear -->
    <path d="M136 88 L132 74 L142 72 Z" fill="#241B18"/>
    <!-- tail curled by the haunch -->
    <path d="M92 172 C80 170 72 162 72 150 C80 156 88 160 94 162 Z" fill="#241B18"/>
    <!-- warm rim light: moonward edge of muzzle, chest, and back -->
    <path d="M142 72 L152 84 C160 82 166 84 170 90 L162 94
             C164 90 158 87 152 89 L146 78 Z" fill="#EDC674" opacity="0.9"/>
    <path d="M128 100 C124 112 118 122 110 128 C104 132 99 138 96 146
             C101 136 108 129 114 125 C121 119 126 110 130 102 Z"
          fill="#B47015" opacity="0.9"/>
    <path d="M146 130 C158 138 164 152 162 176 L158 176
             C159 154 153 141 144 133 Z" fill="#B47015" opacity="0.7"/>
    <!-- ember eye -->
    <circle cx="146" cy="96" r="2.4" fill="#F5D783"/>
  </g>
  <!-- foreground grass strokes -->
  <g stroke="#5A5C30" stroke-width="2" stroke-linecap="round" opacity="0.85">
    <path d="M28 258 q3 -12 8 -16"/><path d="M40 260 q1 -10 6 -15"/>
    <path d="M216 256 q-2 -12 -8 -16"/><path d="M232 260 q-1 -10 -6 -14"/>
  </g>
</svg>`,

  // Mana Surge — a stone spring in the meadow erupting with teal mana light.
  manaSurge: `
<svg viewBox="0 0 256 267" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1E3B3A"/>
      <stop offset="0.6" stop-color="#277A79"/>
      <stop offset="1" stop-color="#3E9C94"/>
    </linearGradient>
    <radialGradient id="ms-burst" cx="0.5" cy="0.62" r="0.55">
      <stop offset="0" stop-color="#F5D783"/>
      <stop offset="0.35" stop-color="#8FD8CB"/>
      <stop offset="0.75" stop-color="#277A79" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#277A79" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ms-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3E4A2E"/>
      <stop offset="1" stop-color="#2B3327"/>
    </linearGradient>
  </defs>
  <rect width="256" height="267" fill="url(#ms-sky)"/>
  <!-- distant foliage frame -->
  <path d="M0 96 Q40 76 76 92 L76 0 L0 0 Z" fill="#334B42" opacity="0.8"/>
  <path d="M256 88 Q216 70 180 88 L180 0 L256 0 Z" fill="#334B42" opacity="0.8"/>
  <rect y="196" width="256" height="71" fill="url(#ms-ground)"/>
  <!-- mana burst -->
  <ellipse cx="128" cy="166" rx="118" ry="120" fill="url(#ms-burst)"/>
  <!-- rising light column -->
  <path d="M112 196 C108 130 116 78 128 34 C140 78 148 130 144 196 Z"
        fill="#8FD8CB" opacity="0.85"/>
  <path d="M120 196 C118 140 122 96 128 60 C134 96 138 140 136 196 Z"
        fill="#F5D783" opacity="0.9"/>
  <!-- orbiting droplets -->
  <g fill="#8FD8CB">
    <circle cx="88" cy="120" r="5"/><circle cx="170" cy="102" r="4"/>
    <circle cx="74" cy="164" r="3.4"/><circle cx="186" cy="150" r="5"/>
    <circle cx="102" cy="72" r="3"/><circle cx="152" cy="58" r="3.6"/>
  </g>
  <g fill="#F5D783" opacity="0.9">
    <circle cx="96" cy="94" r="2.2"/><circle cx="164" cy="128" r="2.6"/>
    <circle cx="128" cy="26" r="3"/>
  </g>
  <!-- spring stones -->
  <path d="M62 214 Q70 196 92 200 L100 214 Z" fill="#57604F"/>
  <path d="M156 214 Q162 196 186 200 L196 214 Z" fill="#57604F"/>
  <path d="M84 226 Q128 200 172 226 Q128 238 84 226 Z" fill="#6B7458"/>
  <path d="M84 226 Q128 200 172 226 Q128 216 84 226 Z" fill="#8FD8CB" opacity="0.55"/>
  <!-- pool -->
  <ellipse cx="128" cy="238" rx="66" ry="14" fill="#277A79"/>
  <ellipse cx="128" cy="236" rx="50" ry="9" fill="#8FD8CB" opacity="0.7"/>
  <ellipse cx="128" cy="235" rx="28" ry="5" fill="#F5D783" opacity="0.8"/>
</svg>`,

  // Phantom Wall — a spectral rampart materializing across the meadow path.
  phantomWall: `
<svg viewBox="0 0 256 267" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="pw-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2A2430"/>
      <stop offset="0.7" stop-color="#4C4150"/>
      <stop offset="1" stop-color="#6A5A66"/>
    </linearGradient>
    <linearGradient id="pw-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#B9A9BB" stop-opacity="0.25"/>
      <stop offset="0.5" stop-color="#9C8AA0" stop-opacity="0.8"/>
      <stop offset="1" stop-color="#6A5A66" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="pw-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3E4A2E"/>
      <stop offset="1" stop-color="#242B22"/>
    </linearGradient>
  </defs>
  <rect width="256" height="267" fill="url(#pw-sky)"/>
  <!-- wan moon low behind the battlement -->
  <circle cx="72" cy="86" r="20" fill="#DCBA96" opacity="0.4"/>
  <rect y="206" width="256" height="61" fill="url(#pw-ground)"/>
  <!-- spectral wall, coursed masonry fading upward -->
  <g>
    <path d="M28 210 L28 96 Q128 74 228 96 L228 210 Z" fill="url(#pw-wall)"/>
    <!-- battlement -->
    <path d="M28 96 L28 78 L52 74 L52 92 L76 88 L76 72 L100 70 L100 86 L128 84
             L128 68 L156 70 L156 86 L180 88 L180 72 L204 74 L204 92 L228 96
             Q128 74 28 96 Z" fill="#9C8AA0" opacity="0.7"/>
    <!-- mortar courses -->
    <g stroke="#D9CBDB" stroke-width="1.4" opacity="0.5" fill="none">
      <path d="M30 128 Q128 108 226 128"/>
      <path d="M30 156 Q128 138 226 156"/>
      <path d="M30 184 Q128 168 226 184"/>
    </g>
    <g stroke="#D9CBDB" stroke-width="1.2" opacity="0.4">
      <path d="M76 112 L76 128"/><path d="M128 104 L128 122"/><path d="M180 112 L180 128"/>
      <path d="M52 136 L52 154"/><path d="M104 130 L104 148"/><path d="M156 130 L156 148"/><path d="M208 136 L208 154"/>
      <path d="M76 160 L76 180"/><path d="M128 154 L128 174"/><path d="M180 160 L180 180"/>
    </g>
    <!-- spectral shimmer -->
    <path d="M28 96 Q128 74 228 96 L228 108 Q128 86 28 108 Z" fill="#F5D783" opacity="0.28"/>
  </g>
  <!-- drifting wisps -->
  <g fill="#D9CBDB">
    <circle cx="44" cy="150" r="3.4" opacity="0.6"/>
    <circle cx="216" cy="120" r="2.8" opacity="0.55"/>
    <circle cx="196" cy="196" r="3.8" opacity="0.5"/>
    <circle cx="70" cy="102" r="2.4" opacity="0.6"/>
  </g>
  <!-- ground contact glow -->
  <ellipse cx="128" cy="212" rx="104" ry="10" fill="#9C8AA0" opacity="0.4"/>
</svg>`,

  // Card back sigil — original fang-and-ring mark in fine gold line work on
  // the shared navy ground (§7.6: 1–2 px lines at 333 px width, subtle
  // rotational asymmetry, no identity leak).
  backSigil: `
<svg viewBox="0 0 285 457" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <defs>
    <radialGradient id="bk-glow" cx="0.5" cy="0.47" r="0.5">
      <stop offset="0" stop-color="#EEC34E" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#EEC34E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="142.5" cy="214" rx="128" ry="150" fill="url(#bk-glow)"/>
  <g fill="none" stroke="#EEC34E">
    <!-- outer ring pair -->
    <circle cx="142.5" cy="214" r="96" stroke-width="1.6"/>
    <circle cx="142.5" cy="214" r="88" stroke-width="1"/>
    <!-- compass filigree, slightly asymmetric by design -->
    <path d="M142.5 96 L142.5 118" stroke-width="1.6"/>
    <path d="M142.5 310 L142.5 334" stroke-width="1.6"/>
    <path d="M24 214 L46 214" stroke-width="1.6"/>
    <path d="M239 214 L263 214" stroke-width="1.6"/>
    <path d="M63 132 L78 147" stroke-width="1"/>
    <path d="M222 132 L207 147" stroke-width="1"/>
    <path d="M65 294 L80 279" stroke-width="1"/>
    <path d="M219 297 L205 282" stroke-width="1"/>
    <!-- corner filigree hooks -->
    <path d="M38 60 Q60 52 70 68" stroke-width="1"/>
    <path d="M247 60 Q225 52 215 68" stroke-width="1"/>
    <path d="M38 398 Q60 406 70 390" stroke-width="1"/>
    <path d="M247 396 Q226 406 216 392" stroke-width="1"/>
  </g>
  <!-- twin fangs, separated, tips inward -->
  <g fill="#EEC34E">
    <path d="M116 168 C110 202 114 236 130 260 C132 234 132 200 128 176 Z"/>
    <path d="M169 168 C175 202 171 236 155 260 C153 234 153 200 157 176 Z"/>
    <path d="M112 166 Q142.5 154 173 166 L169 172 Q142.5 162 116 172 Z"/>
  </g>
  <!-- small star accents -->
  <g fill="#EEC34E" opacity="0.8">
    <circle cx="142.5" cy="140" r="2.2"/>
    <circle cx="102" cy="250" r="1.8"/>
    <circle cx="184" cy="252" r="1.8"/>
  </g>
</svg>`,
};
