import { describe, expect, it } from "vitest";
import { ASPECT, LABEL, look, RING, STAGGER_FROM, seatPosition, seatRadius, seatSize } from "./village-layout";

/** The box a seat takes on screen: the figure and its name below. */
function box(i: number, n: number) {
  const { x, y } = seatPosition(i, n);
  const width = seatSize(n);
  const height = width * ASPECT + LABEL;
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

describe("seats around the fire", () => {
  it("are spread at equal angles, the first at the top, going clockwise", () => {
    for (let n = 3; n <= 18; n++) {
      expect(seatPosition(0, n).x).toBeCloseTo(50, 9);
      expect(seatPosition(0, n).y).toBeLessThan(50);
      expect(seatPosition(1, n).x).toBeGreaterThan(50);
      for (let i = 0; i < n; i++) {
        const { x, y } = seatPosition(i, n);
        const angle = Math.atan2(y - 50, x - 50);
        const expected = -Math.PI / 2 + (2 * Math.PI * i) / n;
        expect(Math.cos(angle - expected)).toBeCloseTo(1, 9);
        expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(seatRadius(i, n), 9);
      }
    }
  });

  it("sit on one ring up to 12 players and make room by sitting staggered from 13 on", () => {
    for (let n = 3; n < STAGGER_FROM; n++) {
      for (let i = 0; i < n; i++) expect(seatRadius(i, n)).toBe(RING);
    }
    for (let n = STAGGER_FROM; n <= 18; n++) expect(new Set(Array.from({ length: n }, (_, i) => seatRadius(i, n))).size).toBe(2);
    expect(seatSize(18)).toBeGreaterThan(10);
  });

  it("never overlap, figure and name included, for 3 to 18 players", () => {
    for (let n = 3; n <= 18; n++) {
      expect(seatSize(n)).toBeGreaterThan(7);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = box(i, n);
          const b = box(j, n);
          const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          expect(apart, `seats ${i} and ${j} of ${n}`).toBe(true);
        }
      }
    }
  });

  it("leave the fire in the middle free", () => {
    for (let n = 3; n <= 18; n++) {
      for (let i = 0; i < n; i++) {
        const b = box(i, n);
        const nearest = Math.max(Math.abs(Math.max(b.left, Math.min(50, b.right)) - 50), Math.abs(Math.max(b.top, Math.min(50, b.bottom)) - 50));
        expect(nearest, `seat ${i} of ${n}`).toBeGreaterThan(13);
      }
    }
  });

  it("draw the same figure for a player on every device", () => {
    expect(look("abc123", 5)).toBe(look("abc123", 5));
    const kinds = new Set(Array.from({ length: 40 }, (_, i) => look(`player-${i}`, 5)));
    expect(kinds.size).toBe(5);
  });
});
