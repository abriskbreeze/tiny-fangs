# Tiny Fangs

**ASCII Card Battler** — Pokemon TCG meets Yu-Gi-Oh with original mythical tiny predators.

🦷 https://abriskbreeze.github.io/tiny-fangs/

## Features

- **5 Decks**: Fang, Shadow, Storm, Swarm, Shell (each with unique playstyle)
- **30+ Creatures**: Each with unique abilities
- **20+ Verses**: Cast spells and set traps
- **Hunter AI**: Score-based decision making with Pup (easy) and Hunter (normal) difficulties
- **Drag-to-Play**: Mobile-friendly touch controls
- **Full Animations**: Attack coils, damage shakes, KO effects, turn transitions

## How to Play

**Online:** https://abriskbreeze.github.io/tiny-fangs/

**Local:**
```bash
cd ~/clawd/tiny-fangs
npm install
npm run dev
# Open http://localhost:5173
```

## Win Conditions

- Reduce opponent LP to 0 (start with 3 hearts)
- Deck out opponent

## Card Types

- **Creatures**: Summon to active/bench, attack enemy
- **Cast Verses**: Immediate effect, goes to graveyard
- **Set Verses**: Trap-style, triggers on condition

## Tech Stack

- Vanilla HTML/CSS/JS
- Vite + Vitest for build/test
- Font: JetBrains Mono (ASCII aesthetic)
- Deploy: GitHub Pages (`docs/` folder)

## Development

```bash
npm test          # Run 190 tests
npm run build     # Build to docs/
npm run dev       # Dev server
```

## Version

Current: **v0.2.48**

See `MEMORY.md` for full changelog and session history.

---

*Built with 🦷 by Rico & Neve*
