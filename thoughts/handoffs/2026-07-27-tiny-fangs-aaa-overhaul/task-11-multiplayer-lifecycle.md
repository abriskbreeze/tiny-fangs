# Task 11 — Multiplayer lifecycle, protocol, disconnect, and authority

Status: complete for the reachable public protocol and UI contracts described
below. No commit or staging was performed.

## Scope delivered

- Real raw-WebSocket process coverage for room normalization, protocol errors,
  capacity, pre-game action rejection, deck readiness, personalized game start,
  illegal turn/action rejection, disconnect recovery, survivor reindexing, and
  immediate empty-room deletion.
- Real Chromium coverage with two isolated browser contexts for every lobby
  transition, invalid client room-code validation with no gameplay frame, Back
  cleanup/re-entry, lobby and in-game disconnect handling, closed-client frame
  isolation, a visible Summon, an illegal non-turn action, and held End Turn.
- Focused client-unit coverage for the two error presentation surfaces:
  lobby errors update status; in-game errors append to the battle log without a
  blocking modal.

## Production defects proven RED, then fixed minimally

1. Server join normalization
   - RED: a raw client joining with surrounding whitespace and lowercase
     received `{ type: "error", message: "Room not found" }`.
   - Fix: validate a nonblank string and normalize once with
     `trim().toUpperCase()` before lookup, socket association, response, and
     logging.
   - GREEN: raw server suite 14/14.

2. Back lifecycle cleanup
   - RED: after Back closed the gameplay socket, its asynchronous close handler
     replaced the cleared status with `Disconnected from server`; room code,
     input, and waiting presentation also remained stale.
   - Fix: leave multiplayer mode before closing, clear host/deck/room state,
     clear the input and code display, and restore the initial waiting message.
   - GREEN: focused Back test and full Task 11 browser suite.

## Files changed

- `server/index.js`
  - Task 11 owns only the join validation/normalization changes. The configurable
    HTTP/WebSocket topology already present in the shared dirty diff belongs to
    Task 02.
- `src/mp-client.js`
  - Back lifecycle cleanup only.
- `tests/server/server-process.test.js`
  - Added five real raw-WebSocket protocol/lifecycle tests to the existing
    process topology suite.
- `tests/e2e/multiplayer/lifecycle-authority.spec.js`
  - New four-test, two-context browser regression lane.
- `tests/presentation/mp-error-surface.test.js`
  - New two-test exact error-surface contract.

## Behavior-matrix rows directly proven

Recommend marking these covered:

- `MP-03`
  - Browser and raw protocol both prove padded lowercase input resolves to the
    exact canonical room code.
- `MP-04`
  - Proves create, join, opponent joined, both deck-select screens, host waiting,
    guest opponent-ready, both personalized `gameStart` messages, and post-coin
    game route.
- `MP-05`
  - Proves Back closes/removes the room at the server, clears lobby UI/state,
    and later mode selection has exactly one fresh gameplay socket.
- `MP-06`
  - Proves empty, three-character, five-character, and whitespace-only values
    display the exact validation message and emit no outbound gameplay frame.
- `MP-08`
  - Proves safe exact lobby status and nonblocking in-game log behavior.
- `MP-09`
  - Proves lobby survivor status, in-game `Opponent Left` / `Return to Menu`
    modal, and that a deliberately closed client receives no later room frames.
- `MP-10`
  - Proves survivor notification/reindexing, successful replacement join, and
    immediate deletion after the final socket closes; a late join gets exact
    `Room not found`.
- `MP-11`
  - Proves correct initial enabled/disabled controls from projected state, a
    visible Summon emitting the exact action UID, matching owner/opponent active
    projections, illegal non-turn action with no state broadcast/desync, and a
    visible held End Turn flipping both projections and controls.
- `SET-12`
  - Proves exactly one `yourTurn: true`, matching state projection, and exact
    complementary `you: "p1"` / `you: "p2"` identities.

Recommend keeping `MP-07` partial rather than marking the whole row covered:

- Direct raw protocol assertions cover exact `Missing roomCode`,
  `Room not found`, `Room is full`, `Not in a room`,
  `Game not in progress`, `Not your turn`, `Unknown action`,
  `Unknown: notAProtocolMessage`, and `Invalid message`.
- `Player not found` is structurally unreachable through the public protocol:
  a live socket can reference a playing room only by create/join membership,
  and leave/close clears that reference. Testing this branch without a network
  backdoor requires extracting the handler behind a dependency-injected room
  registry or deleting the dead defensive branch. No production test command
  was added.

Keep `MP-15` missing. Exact future setup:

- Optional trigger: deterministically start a game where the owner has an
  optional Set such as Brace or Phantom Wall, place it through the public action
  path, then attack into its trigger. Capture both `stateUpdate` payloads and
  assert `pendingAction`, prompt, Verse identity, and context exist only for the
  owner.
- Skitter: deterministically summon Skitter with at least one legal bench
  target, damage it through an opposing public action, then assert the
  `skitterSwap` pending action and bench options exist only in the owner's
  payload for both p1/p2 perspectives.
- This needs a deterministic deck/order seed or a narrow authoritative game
  fixture seam; random live hands are not a stable regression setup.

`SET-13` was traversed but not promoted to covered: tests wait until the
multiplayer coin animation has resolved and setup is hidden, but do not yet
assert a frame-by-frame negative condition that the board route cannot appear
before the animation Promise resolves.

## Verification evidence

- RED raw run:
  - 13/14 passed; padded lowercase normalization failed with exact
    `Room not found`.
- GREEN raw server process suite:
  - 1 file, 14/14 passed.
- Focused Task 11 error unit suite plus endpoint regression:
  - 2 files, 5/5 passed.
- Focused Task 11 Chromium suite on isolated ports 4281/3281:
  - 4/4 passed in 23.0 seconds.
- Complete multiplayer Playwright project on isolated ports 4282/3282:
  - 6/6 passed in 32.6 seconds, including existing room smoke and Set privacy.
- Isolated production build:
  - `npx vite build --outDir /private/tmp/tiny-fangs-task11-build-20260727-1659 --emptyOutDir`
  - 33 modules transformed; exit code 0.
- Syntax:
  - `node --check` passed on both production files and all three Task 11 test
    files.
- Diff hygiene:
  - `git diff --check` passed for all Task 11 paths.
- Diagnostics:
  - `tldr diagnostics` reported 0 errors and 0 warnings on all five Task 11
    paths.
- Integrated Vitest run during concurrent Task 12 RED:
  - 443/445 passed.
  - The only two failures were Task 12 fixture-privacy assertions in
    `tests/presentation/visual-fixtures.test.js` for
    `optional-trigger-pending` and `skitter-response-pending`.
  - Root confirmed those are concurrent Task 12 REDs and will rerun the
    integrated suite after that lane turns green. Task 11 did not touch them.

## Notes

- The browser WebSocket probe explicitly filters the gameplay endpoint so the
  Vite hot-reload socket cannot inflate lifecycle counts.
- No protected visual files, package/config/workflow files, shared engine,
  face registry, behavior matrix, or living goal ledger were edited.
