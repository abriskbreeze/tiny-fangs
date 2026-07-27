/**
 * Map engine side (0/1, p1/p2) to client side key (me/opp).
 */
export function sideKey(side) {
  if (side === 0 || side === 'p1') return 'me';
  if (side === 1 || side === 'p2') return 'opp';
  return side;
}
