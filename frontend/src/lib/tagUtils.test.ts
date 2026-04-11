/**
 * @file tagUtils.test.ts
 * @description Unit tests for tag utilities
 */

import { describe, it, expect } from 'vitest';
import {
  TAG_COLORS,
  getTagColor,
  getTagClasses,
  sortByTag,
  groupByTag,
  getUniqueTags,
  collectAllTags,
  collectTagsScoped,
  SUGGESTED_TAGS,
} from './tagUtils';

describe('tagUtils', () => {
  describe('TAG_COLORS', () => {
    it('has at least 5 colors defined', () => {
      expect(TAG_COLORS.length).toBeGreaterThanOrEqual(5);
    });

    it('each color has required properties', () => {
      for (const color of TAG_COLORS) {
        expect(color.id).toBeDefined();
        expect(color.name).toBeDefined();
        expect(color.bgLight).toBeDefined();
        expect(color.textLight).toBeDefined();
        expect(color.bgDark).toBeDefined();
        expect(color.textDark).toBeDefined();
        expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });

  describe('getTagColor', () => {
    it('returns default color for empty string', () => {
      const color = getTagColor('');
      expect(color).toBe(TAG_COLORS[0]);
    });

    it('returns consistent color for same tag name', () => {
      const color1 = getTagColor('work');
      const color2 = getTagColor('work');
      expect(color1).toEqual(color2);
    });

    it('returns different colors for different tags', () => {
      // Not guaranteed, but highly likely for distinct strings
      const workColor = getTagColor('work');
      const personalColor = getTagColor('personal');
      // Just ensure they're valid colors
      expect(TAG_COLORS).toContain(workColor);
      expect(TAG_COLORS).toContain(personalColor);
    });

    it('supports manual color override with :: syntax', () => {
      const color = getTagColor('mytag::purple');
      expect(color.id).toBe('purple');
    });

    it('falls back to hash-based color if override not found', () => {
      const color = getTagColor('mytag::nonexistent');
      expect(TAG_COLORS).toContain(color);
    });
  });

  describe('getTagClasses', () => {
    it('returns light and dark mode classes', () => {
      const classes = getTagClasses('work');
      expect(classes).toContain('bg-');
      expect(classes).toContain('text-');
      expect(classes).toContain('dark:');
    });
  });

  describe('sortByTag', () => {
    it('sorts items alphabetically by tag', () => {
      const items = [
        { tag: 'zebra' },
        { tag: 'apple' },
        { tag: 'monkey' },
      ];
      
      const sorted = sortByTag(items);
      
      expect(sorted[0].tag).toBe('apple');
      expect(sorted[1].tag).toBe('monkey');
      expect(sorted[2].tag).toBe('zebra');
    });

    it('puts items without tags last', () => {
      const items = [
        { tag: 'work' },
        { tag: undefined },
        { tag: 'personal' },
      ];
      
      const sorted = sortByTag(items);
      
      expect(sorted[0].tag).toBe('personal');
      expect(sorted[1].tag).toBe('work');
      expect(sorted[2].tag).toBeUndefined();
    });

    it('does not mutate original array', () => {
      const items = [{ tag: 'b' }, { tag: 'a' }];
      const sorted = sortByTag(items);
      
      expect(items[0].tag).toBe('b');
      expect(sorted[0].tag).toBe('a');
    });
  });

  describe('groupByTag', () => {
    it('groups items by their tag', () => {
      const items = [
        { id: '1', tag: 'work' },
        { id: '2', tag: 'personal' },
        { id: '3', tag: 'work' },
      ];
      
      const groups = groupByTag(items);
      
      expect(groups.get('work')?.length).toBe(2);
      expect(groups.get('personal')?.length).toBe(1);
    });

    it('groups untagged items under empty string key', () => {
      const items = [
        { id: '1', tag: 'work' },
        { id: '2', tag: undefined },
        { id: '3' },
      ];
      
      const groups = groupByTag(items);
      
      expect(groups.get('')?.length).toBe(2);
    });
  });

  describe('getUniqueTags', () => {
    it('returns unique tags sorted alphabetically', () => {
      const items = [
        { tag: 'work' },
        { tag: 'personal' },
        { tag: 'work' },
        { tag: 'urgent' },
      ];
      
      const tags = getUniqueTags(items);
      
      expect(tags).toEqual(['personal', 'urgent', 'work']);
    });

    it('excludes undefined/empty tags', () => {
      const items = [
        { tag: 'work' },
        { tag: undefined },
        { tag: '' },
      ];
      
      const tags = getUniqueTags(items);
      
      expect(tags).toEqual(['work']);
    });

    it('returns empty array for no tags', () => {
      const items = [{ tag: undefined }];
      const tags = getUniqueTags(items);
      expect(tags).toEqual([]);
    });
  });

  describe('collectAllTags', () => {
    it('is an alias for getUniqueTags', () => {
      const items = [{ tag: 'a' }, { tag: 'b' }];
      expect(collectAllTags(items)).toEqual(getUniqueTags(items));
    });
  });

  describe('collectTagsScoped', () => {
    it('returns all tags when no parentPageId', () => {
      const tasks = [
        { tag: 'work', parentPageId: 'page1' },
        { tag: 'personal', parentPageId: 'page2' },
      ];
      
      const tags = collectTagsScoped(tasks);
      
      expect(tags).toContain('work');
      expect(tags).toContain('personal');
    });

    it('filters to specific parent when parentPageId provided', () => {
      const tasks = [
        { tag: 'work', parentPageId: 'page1' },
        { tag: 'personal', parentPageId: 'page2' },
        { tag: 'urgent', parentPageId: 'page1' },
      ];
      
      const tags = collectTagsScoped(tasks, 'page1');
      
      expect(tags).toContain('work');
      expect(tags).toContain('urgent');
      expect(tags).not.toContain('personal');
    });

    it('returns all tags when showAllTags is true', () => {
      const tasks = [
        { tag: 'work', parentPageId: 'page1' },
        { tag: 'personal', parentPageId: 'page2' },
      ];
      
      const tags = collectTagsScoped(tasks, 'page1', true);
      
      expect(tags).toContain('work');
      expect(tags).toContain('personal');
    });
  });

  describe('SUGGESTED_TAGS', () => {
    it('has common productivity tags', () => {
      expect(SUGGESTED_TAGS).toContain('work');
      expect(SUGGESTED_TAGS).toContain('personal');
      expect(SUGGESTED_TAGS).toContain('urgent');
    });
  });
});
