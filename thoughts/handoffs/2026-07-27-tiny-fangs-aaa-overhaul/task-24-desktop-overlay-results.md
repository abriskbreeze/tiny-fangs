# Task 24 — Desktop overlay, decision, reveal, and result behavior

Date: 2026-07-27  
Scope: canonical desktop `1672×941`, solo behavior only  
Status: implemented and verified, with explicit remaining gaps below

## Files changed

- `src/main.js`
- `tests/e2e/desktop-overlay-results.spec.js`

No visual styling, card rendering, HTML structure, multiplayer client/server,
shared engine/effects, fixture registry, baseline manifest, matrix, plan, or goal
ledger was edited by this task.

## RED evidence

The first canonical Playwright run failed all `10/10` initial contracts:

- the desktop behavior QA seam did not exist;
- target helpers were not browser-addressable;
- response/result fixture metadata was ignored;
- `Escape` closed semantic target/response choices;
- result fixtures showed no result;
- deck-out had no distinct result copy;
- terminal buttons remained enabled;
- restart had no clear-before-navigation seam.

Two failing expectations were corrected as characterization, not product fixes:

- dense-board Shellkin is `20/20`, not `10/35`;
- Brace copy is `Reduce damage by 15.`

The real deck-out journey then exposed a production bug: shared-engine player-one
wins use numeric `0`, while root truthy winner guards interpreted `0` as “no
winner.”

## Implementation

- Added nullability-based terminal guards, including numeric winner `0`.
- Normalized real solo deck-out winner ownership before presentation.
- Presents end-turn deck-out only after `dispatchLocalAction` and its event
  playback finish; no AI continuation is scheduled after terminal state.
- Differentiates `[ VICTORY ]`, `[ DEFEAT ]`, and
  `[ VICTORY/DEFEAT — DECK OUT ]` and records public outcome/reason data.
- Disables all root action controls in real terminal state and blocks direct
  action/keyboard dispatch.
- Makes modal close re-entrancy safe by consuming `onClose` before invocation.
- Clears stale modal actions and refuses modal actions while closed.
- Adds explicit semantic-modal Escape policy: target and owner response modals
  stay open; safe generic/Rules/detail/reveal overlays retain their intended
  dismissal behavior; terminal result is inert.
- Gives solo pending responses a dedicated semantic/no-cancel modal adapter.
  The multiplayer runtime continues to receive the ordinary modal function.
- Consumes response/result fixture metadata only with the explicit
  `behaviorQa=1` test opt-in. Ordinary `classic-v1` fixture routes remain
  byte-for-byte visually unchanged.
- Adds a clear-before-navigation `restartGame` owner and captures the existing
  Play Again button before its legacy inline reload.
- Exposes a frozen, visual-QA-only desktop behavior contract. It contains
  functions only and no card/state identities.

## Canonical behavior evidence

`tests/e2e/desktop-overlay-results.spec.js` passed `13/13` at `1672×941`:

1. generic enabled/disabled/no-cancel/onClose/double-close;
2. friendly-board, any-board, and friendly-grave target modes plus explicit
   cancel;
3. Optional trigger Yes;
4. Optional trigger No;
5. Skitter legal bench swap;
6. Skitter decline;
7. Rules, hand/active/bench/grave/own-Set detail, active stats/effects,
   own/opponent grave ordering/empty state, and hidden-opponent privacy;
8. trigger/cast/set/creature reveal public identity, text, and exactly-once
   settling;
9. victory result and terminal blocking;
10. defeat result and terminal blocking;
11. deck-out distinction and terminal blocking;
12. real solo victory/deck-out presentation after playback;
13. restart clear-before-navigation seam plus clean post-reload mount.

Affected desktop input/timer checkpoint passed `27/27`:

- Task 14 input suite `12/12`;
- Task 24 desktop overlay/result suite `13/13`;
- Task 20 timer lifecycle suite `2/2`.

Final non-browser verification:

- full Vitest: `33` files, `545/545` tests passed;
- isolated Vite production build: exit `0`, `33` modules transformed;
- `tldr diagnostics src/main.js`: `0` errors, `0` warnings;
- `tldr diagnostics tests/e2e/desktop-overlay-results.spec.js`: `0` errors,
  `0` warnings.

Immutable visual evidence:

- classic capture manifest test passed;
- all 17 real classic fixture routes matched their recorded screenshot hashes;
- classic visual suite passed `2/2` after behavior-QA isolation.

## Privacy evidence

For `multiplayer-hidden`, the browser test derives the actual private opponent
hand and Set UIDs from the source fixture, then asserts none occur in:

- rendered body text;
- projected runtime state;
- visual readiness/debug contract;
- desktop behavior QA contract.

The projected opponent hand is empty and the opponent Set exposes only the
`faceDown` marker. Optional/Skitter response controls are rendered only through
the owner-local solo behavior route.

## Matrix row dispositions

These are exact Task 24 dispositions for the parent to merge into the shared
matrix:

| Row | Task 24 disposition | Evidence / boundary |
|---|---|---|
| OVR-01 | covered on canonical desktop | Enabled/disabled, cancel/no-cancel, re-entrant and repeated close, stale action guard |
| OVR-02 | partial | Own newest-first/empty/detail and opponent newest-first/empty are direct; opponent grave hold-to-detail is not separately clicked |
| OVR-03 | covered on canonical desktop | Rules link, content, close button, backdrop, Escape |
| OVR-04 | covered on canonical desktop | Hand, active, bench, grave, own Set, current HP/effects; opponent hidden hand/Set absent |
| OVR-05 | covered on canonical desktop | Friendly board, any board with ownership labels, friendly grave, explicit cancel; Escape inert |
| OVR-06 | covered on canonical desktop solo | Yes and No each resume once; closed modal cannot replay |
| OVR-08 | covered on canonical desktop solo | Legal first bench swap and explicit decline each resume once |
| OVR-10 | partial | Trigger/cast/set/ability identity and text plus explicit settle-once are direct; the automatic timeout path is not independently asserted |
| OVR-11 | partial | Victory/defeat/deck-out, terminal block, restart seam, and clean reload mount direct; solo menu return is not implemented |
| STA-07 | covered on canonical desktop solo | Real authoritative end-turn deck-out gives winner, deck-out reason, and post-playback result |
| STA-09 | partial | Solo post-playback result and terminal blocking covered; multiplayer result remains outside Task 24 |
| STA-10 | partial | Clear-before-navigation seam and clean post-reload mount covered separately; a single coupled active-match → actual button click → fresh mount journey remains |
| STA-11 | missing for solo | `toggleMenu()` is an unused `alert('Menu: Coming soon!')`; no supported route exists |
| INP-12 | covered on canonical desktop | Safe overlays dismiss; target/optional/Skitter/result do not confirm, cancel, or dismiss via Escape |

## Honest remaining gaps

- Solo Return to Menu is not a product-supported flow. This task did not invent
  a route.
- The fully coupled active-match → terminal result → real Play Again click →
  fresh setup journey remains a STA-10 follow-up. The clear-order seam and fresh
  reload mount are independently direct.
- Opponent grave hold-to-detail and reveal auto-timeout deserve small additional
  browser assertions before marking their strict matrix rows globally covered.
- Multiplayer result, restart, response ownership, and room cleanup remain with
  the multiplayer lane/Task 25.
- Mobile/tablet/touch-specific overlay evidence remains deferred by the
  desktop-first delivery scope.

## Execution limitation at the end

An attempted strengthening of the coupled Play Again browser journey could not
be rerun because the local-server escalation quota was exhausted. That
unverified test expansion was reverted. The delivered test file is the last
verified `13/13` version; no unverified expansion remains.
