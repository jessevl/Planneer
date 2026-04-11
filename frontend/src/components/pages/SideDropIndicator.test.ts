/**
 * @file SideDropIndicator.test.ts
 * @description Unit tests for the detectEdge helper from SideDropIndicator.
 *              Tests edge zone detection logic used for creating new columns.
 */
import { describe, it, expect } from 'vitest';
import { detectEdge } from './SideDropIndicator';

/** Create a mock DOMRect */
function makeRect(left: number, right: number, top = 0, bottom = 100): DOMRect {
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

describe('detectEdge', () => {
  describe('with a standard-width block (700px)', () => {
    const rect = makeRect(100, 800); // 700px wide

    it('returns null when pointer is inside the block (no inner edge zone)', () => {
      expect(detectEdge(100, rect)).toBeNull(); // at left edge (on boundary)
      expect(detectEdge(105, rect)).toBeNull(); // 5px inside
      expect(detectEdge(155, rect)).toBeNull(); // 55px inside
      expect(detectEdge(450, rect)).toBeNull(); // center
      expect(detectEdge(745, rect)).toBeNull(); // 55px from right
      expect(detectEdge(795, rect)).toBeNull(); // 5px from right
      expect(detectEdge(800, rect)).toBeNull(); // at right edge (on boundary)
    });

    it('detects left edge in the outer margin area', () => {
      expect(detectEdge(99, rect)).toBe('left');   // 1px outside
      expect(detectEdge(80, rect)).toBe('left');   // 20px outside
      expect(detectEdge(41, rect)).toBe('left');   // 59px outside
    });

    it('detects right edge in the outer margin area', () => {
      expect(detectEdge(801, rect)).toBe('right'); // 1px outside
      expect(detectEdge(820, rect)).toBe('right'); // 20px outside
      expect(detectEdge(859, rect)).toBe('right'); // 59px outside
    });

    it('returns null when far outside the block', () => {
      expect(detectEdge(30, rect)).toBeNull();  // 70px left of block
      expect(detectEdge(870, rect)).toBeNull(); // 70px right of block
    });
  });

  describe('with a narrow column block (200px)', () => {
    const rect = makeRect(300, 500); // 200px wide

    it('returns null when pointer is inside the block', () => {
      expect(detectEdge(300, rect)).toBeNull(); // at left edge
      expect(detectEdge(319, rect)).toBeNull(); // 19px inside
      expect(detectEdge(400, rect)).toBeNull(); // center
      expect(detectEdge(481, rect)).toBeNull(); // 19px from right
      expect(detectEdge(500, rect)).toBeNull(); // at right edge
    });

    it('detects left edge in the outer margin', () => {
      expect(detectEdge(299, rect)).toBe('left');  // 1px outside
      expect(detectEdge(260, rect)).toBe('left');  // 40px outside
      expect(detectEdge(241, rect)).toBe('left');  // 59px outside
    });

    it('detects right edge in the outer margin', () => {
      expect(detectEdge(501, rect)).toBe('right'); // 1px outside
      expect(detectEdge(540, rect)).toBe('right'); // 40px outside
      expect(detectEdge(559, rect)).toBe('right'); // 59px outside
    });
  });

  describe('outer margin zone (beyond block bounds)', () => {
    const rect = makeRect(100, 800); // block from x=100 to x=800

    it('detects left edge when pointer is outside the left boundary by up to 60px', () => {
      expect(detectEdge(99, rect)).toBe('left');   // 1px outside
      expect(detectEdge(60, rect)).toBe('left');   // 40px outside
      expect(detectEdge(41, rect)).toBe('left');   // 59px outside
    });

    it('detects right edge when pointer is outside the right boundary by up to 60px', () => {
      expect(detectEdge(801, rect)).toBe('right'); // 1px outside
      expect(detectEdge(840, rect)).toBe('right'); // 40px outside
      expect(detectEdge(859, rect)).toBe('right'); // 59px outside
    });

    it('returns null when pointer is more than 60px outside the block', () => {
      expect(detectEdge(39, rect)).toBeNull();  // 61px to the left
      expect(detectEdge(861, rect)).toBeNull(); // 61px to the right
    });
  });
});
