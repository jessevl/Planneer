/**
 * @file treeUtils.test.ts
 * @description Unit tests for tree utility functions
 */

import { describe, it, expect } from 'vitest';
import { isRootLevel, ROOT_KEY } from './treeUtils';

describe('treeUtils', () => {
  describe('isRootLevel', () => {
    it('returns true for null', () => {
      expect(isRootLevel(null)).toBe(true);
    });

    it('returns true for undefined', () => {
      expect(isRootLevel(undefined)).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(isRootLevel('')).toBe(true);
    });

    it('returns false for valid parent ID', () => {
      expect(isRootLevel('abc123')).toBe(false);
    });

    it('returns false for any non-empty string', () => {
      expect(isRootLevel('parent-id')).toBe(false);
      expect(isRootLevel('0')).toBe(false);
      expect(isRootLevel(' ')).toBe(false); // Space is not empty
    });
  });

  describe('ROOT_KEY', () => {
    it('is defined as ROOT', () => {
      expect(ROOT_KEY).toBe('ROOT');
    });
  });
});
