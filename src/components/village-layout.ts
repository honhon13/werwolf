/**
 * Where the players sit around the fire. Seat i is the player's place in the
 * room's player list, which the server keeps for the whole game; the same
 * order decides who sits next to whom for Fuchs, Bärenführer and Ritter.
 * All sizes are percentages of the scene's width (the scene is square).
 */

/** Distance of the seats from the fire. */
export const RING = 40;
/** From this many players on, every second one sits a little closer to the fire, to make room. */
export const STAGGER_FROM = 13;
const OUTER = 42;
const INNER = 31;
/** Height of the name under a figure. */
export const LABEL = 3.6;
/** A figure is this much taller than wide. */
export const ASPECT = 1.1;
/** Figures never get bigger than this, however few players there are. */
const BIGGEST = 19;

/** How far seat i of n sits from the fire. */
export function seatRadius(i: number, n: number): number {
  if (n < STAGGER_FROM) return RING;
  return i % 2 === 0 ? OUTER : INNER;
}

/** The centre of seat i of n, starting at the top and going clockwise, all at equal angles. */
export function seatPosition(i: number, n: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
  const r = seatRadius(i, n);
  return { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle) };
}

/** Whether figures of this width, each with its name below, keep clear of each other. */
function fitsAll(n: number, width: number): boolean {
  const height = width * ASPECT + LABEL;
  const seats = Array.from({ length: n }, (_, i) => seatPosition(i, n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = Math.abs(seats[i].x - seats[j].x);
      const dy = Math.abs(seats[i].y - seats[j].y);
      if (dx < width && dy < height) return false;
    }
  }
  return true;
}

const sizes = new Map<number, number>();

/** The width of a figure and its name for n players: as big as possible without any overlap. */
export function seatSize(n: number): number {
  let size = sizes.get(n);
  if (size === undefined) {
    let low = 0;
    let high = BIGGEST;
    for (let step = 0; step < 24; step++) {
      const mid = (low + high) / 2;
      if (fitsAll(n, mid)) low = mid;
      else high = mid;
    }
    size = low;
    sizes.set(n, size);
  }
  return size;
}

/** A small, stable number from a player id, so every device draws the same figure. */
export function look(id: string, kinds: number): number {
  let h = 7;
  for (const ch of id) h = (h * 33 + ch.codePointAt(0)!) % 9973;
  return h % kinds;
}
