/**
 * Shell selection viewport rules — single source of truth (RSP-02).
 *
 * `DESKTOP_MIN_WIDTH` mirrors the `@media (min-width: 900px)` shell queries in
 * `src/styles.css` that flip `.mobile`/`.desktop` between `display: none` and
 * `display: flex`. Any JS that decides which shell to reveal must go through
 * here so the DOM can never disagree with the stylesheet.
 */
export const DESKTOP_MIN_WIDTH = 900;

/** The exact query the shell rules in `src/styles.css` are written against. */
export const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;

/**
 * True when CSS is laying out the narrow (mobile) shell.
 *
 * Prefers `matchMedia` so the answer is the CSS query itself rather than a
 * re-derivation of it; falls back to `innerWidth` for environments without
 * `matchMedia` (unit-test window stubs).
 *
 * @param {Window} [win]
 * @returns {boolean}
 */
export function isMobileViewport(win = globalThis.window) {
  if (!win) return false;
  const query = win.matchMedia?.(DESKTOP_MEDIA_QUERY);
  if (query) return !query.matches;
  return win.innerWidth < DESKTOP_MIN_WIDTH;
}
