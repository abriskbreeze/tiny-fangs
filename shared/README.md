# Shared Game Logic

Single source of truth for Tiny Fangs game rules.

## Usage

### Browser (ES Module)
```javascript
import { attack, CREATURES } from './shared/index.js';
```

### Node.js (Server)
```javascript
import { attack, CREATURES } from './shared/index.js';
```

## Modules

- **cards.js** - Card definitions (CREATURES, VERSES, DECKS)
- **effects.js** - Effect primitives (damage, heal, etc.)
- **triggers.js** - Trigger matching system
- **engine.js** - Core game operations (attack, summon, etc.)

## Design Principles

1. **Pure functions** - No side effects, no mutations
2. **No browser dependencies** - Works in Node.js
3. **Event-based** - Returns events for caller to animate
4. **Single source** - One definition, works everywhere
