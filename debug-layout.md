# Layout Debug - Systematic Investigation

## Problem
Desktop layout scrolls at 100% zoom when it shouldn't.

## What I've tried (all failed)
- max-height on .d-main
- overflow: hidden on .d-main, .d-left, .d-right  
- html, body { height: 100vh; overflow: hidden } in desktop media query
- Removed zoom: 1.2 rule

## Questions to answer
1. Is the scroll on html, body, or a container element?
2. What is the ACTUAL computed height of each element in the chain?
3. Is there content that has intrinsic minimum size forcing expansion?
4. Are there conflicting constraints (flex-grow vs max-height)?
5. Is the CSS actually being applied? (caching issue?)

## Full layout chain to trace
html → body → .desktop → .d-main → children

## Hypothesis tracking
- [ ] Zoom rule - REMOVED, still broken
- [ ] Body overflow - ADDED overflow:hidden, still broken
- [ ] ???
