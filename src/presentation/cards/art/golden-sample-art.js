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
    <!-- seated howl profile: raised muzzle, distinct ear, deep chest, tail -->
    <path d="M94 176
             C92 158 97 142 108 132
             C116 125 122 116 126 104
             C129 96 133 88 138 82
             L143 70
             L151 81
             C158 79 164 82 167 88
             L160 92
             C163 98 161 106 155 110
             C149 114 145 121 143 129
             C155 138 161 152 159 176
             L146 176 C146 163 142 152 135 146
             C127 152 120 162 118 176 Z"
          fill="#241B18"/>
    <path d="M138 82 L134 68 L144 69 Z" fill="#241B18"/>
    <path d="M94 172 C82 171 73 163 72 151 C80 158 88 161 96 163 Z" fill="#241B18"/>
    <!-- moonward rim light: muzzle, throat, shoulder line -->
    <path d="M143 70 L151 81 C158 79 164 82 167 88 L160 92
             C162 88 157 84 151 86 L146 76 Z" fill="#EDC674" opacity="0.92"/>
    <path d="M126 104 C122 116 116 125 108 132 C112 126 118 118 121 110
             C124 104 126 98 128 94 Z" fill="#B47015" opacity="0.9"/>
    <path d="M143 129 C155 138 161 152 159 176 L155 176
             C156 154 150 140 141 132 Z" fill="#B47015" opacity="0.7"/>
    <circle cx="147" cy="94" r="2.2" fill="#F5D783"/>
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
      <stop offset="0" stop-color="#EEC34E" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#EEC34E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="142.5" cy="214" rx="128" ry="150" fill="url(#bk-glow)"/>
  <g fill="none" stroke="#EEC34E">
    <!-- framing border pair with corner breaks -->
    <path d="M34 16 L251 16" stroke-width="1.2"/>
    <path d="M34 441 L251 441" stroke-width="1.2"/>
    <path d="M14 36 L14 421" stroke-width="1.2"/>
    <path d="M271 36 L271 421" stroke-width="1.2"/>
    <path d="M22 24 L48 24 M22 24 L22 50" stroke-width="1.8"/>
    <path d="M263 24 L237 24 M263 24 L263 50" stroke-width="1.8"/>
    <path d="M22 433 L48 433 M22 433 L22 407" stroke-width="1.8"/>
    <path d="M263 433 L237 433 M263 433 L263 407" stroke-width="1.8"/>
    <!-- corner filigree hooks, deliberately asymmetric -->
    <path d="M30 60 Q56 50 68 70 Q60 58 42 62" stroke-width="1"/>
    <path d="M255 60 Q229 50 217 70 Q225 58 243 62" stroke-width="1"/>
    <path d="M30 397 Q56 407 68 387 Q60 399 44 396" stroke-width="1"/>
    <path d="M255 399 Q230 407 218 389 Q226 399 242 395" stroke-width="1"/>
    <!-- ring set: outer pair, tick ring, inner band -->
    <circle cx="142.5" cy="214" r="102" stroke-width="1.6"/>
    <circle cx="142.5" cy="214" r="94" stroke-width="1"/>
    <circle cx="142.5" cy="214" r="70" stroke-width="1"/>
    <!-- radial ticks between the ring pairs -->
    <g stroke-width="1">
      <path d="M142.5 116 L142.5 126"/><path d="M142.5 302 L142.5 312"/>
      <path d="M44.5 214 L54.5 214"/><path d="M230.5 214 L240.5 214"/>
      <path d="M73 145 L80 152"/><path d="M212 145 L205 152"/>
      <path d="M73 283 L80 276"/><path d="M213 284 L206 277"/>
      <path d="M108 122 L111 131"/><path d="M177 122 L174 131"/>
      <path d="M108 306 L111 297"/><path d="M178 307 L175 298"/>
    </g>
    <!-- compass points -->
    <path d="M142.5 88 L142.5 112" stroke-width="1.8"/>
    <path d="M142.5 316 L142.5 342" stroke-width="1.8"/>
    <path d="M14 214 L40 214" stroke-width="1.8"/>
    <path d="M245 214 L271 214" stroke-width="1.8"/>
  </g>
  <!-- twin fangs, separated, tips inward -->
  <g fill="#EEC34E">
    <path d="M116 168 C110 202 114 236 130 260 C132 234 132 200 128 176 Z"/>
    <path d="M169 168 C175 202 171 236 155 260 C153 234 153 200 157 176 Z"/>
    <path d="M112 166 Q142.5 154 173 166 L169 172 Q142.5 162 116 172 Z"/>
  </g>
  <!-- moth-star accents inside the inner band -->
  <g fill="#EEC34E">
    <path d="M142.5 136 l2.2 4.4 4.6 0.6 -3.4 3.2 0.9 4.6 -4.3 -2.3 -4.3 2.3 0.9 -4.6 -3.4 -3.2 4.6 -0.6 Z" opacity="0.9"/>
    <circle cx="100" cy="252" r="1.8" opacity="0.8"/>
    <circle cx="186" cy="252" r="1.8" opacity="0.8"/>
    <circle cx="120" cy="286" r="1.4" opacity="0.7"/>
    <circle cx="166" cy="286" r="1.4" opacity="0.7"/>
  </g>
</svg>`,
};
