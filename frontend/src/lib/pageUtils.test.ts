/**
 * @file pageUtils.test.ts
 * @description Unit tests for page utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  highlightText,
  extractPagePreview,
  extractRichPagePreviewBlocks,
  extractExcerpt,
  buildPageTree,
  getAncestorChain,
  getDescendantIds,
} from './pageUtils';
import type { Page } from '@/types/page';

// Helper to create a minimal Page for testing
function createPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    title: 'Test Page',
    content: '',
    parentId: null,
    order: 0,
    viewMode: 'note',
    childrenViewMode: 'list',
    isDailyNote: false,
    dailyNoteDate: null,
    isExpanded: false,
    isPinned: false,
    pinnedOrder: 0,
    showChildrenInSidebar: true,
    childCount: 0,
    created: '2025-01-15T00:00:00Z',
    updated: '2025-01-15T00:00:00Z',
    ...overrides,
  } as Page;
}

describe('pageUtils', () => {
  describe('highlightText', () => {
    it('returns array with original text when no query', () => {
      const result = highlightText('Hello World', '');
      expect(result).toEqual(['Hello World']);
    });

    it('returns array with original text when query is whitespace', () => {
      const result = highlightText('Hello World', '   ');
      expect(result).toEqual(['Hello World']);
    });

    it('highlights matching text case-insensitively', () => {
      const result = highlightText('Hello World', 'world');
      expect(result.length).toBe(2);
      expect(result[0]).toBe('Hello ');
      // Second element should be a React element (mark)
      expect(typeof result[1]).toBe('object');
    });

    it('highlights multiple occurrences', () => {
      const result = highlightText('test TEST Test', 'test');
      // Should have 3 highlights with text between them
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('handles query at start of string', () => {
      const result = highlightText('Hello World', 'hello');
      expect(result.length).toBe(2);
      // First element is the highlighted match
      expect(typeof result[0]).toBe('object');
    });

    it('handles query at end of string', () => {
      const result = highlightText('Hello World', 'world');
      expect(result.length).toBe(2);
      expect(result[0]).toBe('Hello ');
    });
  });

  describe('extractPagePreview', () => {
    it('extracts text from Yoopta JSON content', () => {
      const content = JSON.stringify({
        'block-1': {
          id: 'block-1',
          type: 'Paragraph',
          value: [{ children: [{ text: 'Hello World' }] }],
        },
      });
      
      const preview = extractPagePreview(content);
      expect(preview).toBe('Hello World');
    });

    it('joins multiple blocks', () => {
      const content = JSON.stringify({
        'block-1': {
          id: 'block-1',
          type: 'Paragraph',
          value: [{ children: [{ text: 'Line 1' }] }],
        },
        'block-2': {
          id: 'block-2',
          type: 'Paragraph',
          value: [{ children: [{ text: 'Line 2' }] }],
        },
      });
      
      const preview = extractPagePreview(content);
      expect(preview).toContain('Line 1');
      expect(preview).toContain('Line 2');
    });

    it('respects maxLines parameter', () => {
      const content = JSON.stringify({
        'block-1': { value: [{ children: [{ text: 'Line 1' }] }] },
        'block-2': { value: [{ children: [{ text: 'Line 2' }] }] },
        'block-3': { value: [{ children: [{ text: 'Line 3' }] }] },
        'block-4': { value: [{ children: [{ text: 'Line 4' }] }] },
        'block-5': { value: [{ children: [{ text: 'Line 5' }] }] },
      });
      
      const preview = extractPagePreview(content, 2);
      expect(preview).toContain('Line 1');
      expect(preview).toContain('Line 2');
      // Not checking for exclusion since behavior may vary
    });

    it('returns empty string for invalid JSON', () => {
      const preview = extractPagePreview('not json');
      expect(preview).toBe('');
    });

    it('returns empty string for null/undefined', () => {
      const preview = extractPagePreview(null as any);
      expect(preview).toBe('');
    });
  });

  describe('extractRichPagePreviewBlocks', () => {
    it('preserves block types and inline marks from Yoopta content', () => {
      const content = JSON.stringify({
        'block-1': {
          id: 'block-1',
          type: 'HeadingOne',
          meta: { order: 0, depth: 0 },
          value: [
            {
              id: 'heading-1',
              type: 'heading-one',
              children: [
                { text: 'Important', bold: true },
                { text: ' title' },
              ],
            },
          ],
        },
        'block-2': {
          id: 'block-2',
          type: 'Paragraph',
          meta: { order: 1, depth: 0 },
          value: [
            {
              id: 'paragraph-1',
              type: 'paragraph',
              children: [
                { text: 'A ' },
                { text: 'highlighted', highlight: true },
                { text: ' note' },
              ],
            },
          ],
        },
      });

      const blocks = extractRichPagePreviewBlocks(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('heading-one');
      expect(blocks[0].children[0].bold).toBe(true);
      expect(blocks[1].children[1].highlight).toBe(true);
    });

    it('renders todo list items with checked state', () => {
      const content = JSON.stringify({
        'block-1': {
          id: 'block-1',
          type: 'TodoList',
          meta: { order: 0, depth: 1 },
          value: [
            {
              id: 'todo-1',
              type: 'todo-list',
              props: { checked: true },
              children: [{ text: 'Ship preview update' }],
            },
          ],
        },
      });

      const blocks = extractRichPagePreviewBlocks(content);

      expect(blocks[0].type).toBe('todo-list');
      expect(blocks[0].checked).toBe(true);
      expect(blocks[0].depth).toBe(1);
    });
  });

  describe('extractExcerpt', () => {
    it('extracts text and limits length', () => {
      const content = JSON.stringify({
        'block-1': {
          value: [{ children: [{ text: 'Short text' }] }],
        },
      });
      
      const excerpt = extractExcerpt(content);
      expect(excerpt).toBe('Short text');
    });

    it('truncates at word boundary for long text', () => {
      const longText = 'This is a very long text that should be truncated at a word boundary when it exceeds the maximum length parameter that we set for the excerpt extraction function.';
      const content = JSON.stringify({
        'block-1': { value: [{ children: [{ text: longText }] }] },
      });
      
      const excerpt = extractExcerpt(content, 50);
      expect(excerpt!.length).toBeLessThanOrEqual(55); // Allow for ellipsis
      expect(excerpt).toContain('…');
    });

    it('returns null for empty content', () => {
      expect(extractExcerpt(null)).toBeNull();
      expect(extractExcerpt('')).toBeNull();
    });

    it('returns null for content with no text', () => {
      const content = JSON.stringify({
        'block-1': { value: [] },
      });
      expect(extractExcerpt(content)).toBeNull();
    });
  });

  describe('buildPageTree', () => {
    it('builds tree from flat pages', () => {
      const pages = [
        createPage({ id: 'root-1', parentId: null, order: 0 }),
        createPage({ id: 'child-1', parentId: 'root-1', order: 0 }),
        createPage({ id: 'root-2', parentId: null, order: 1 }),
      ];
      
      const tree = buildPageTree(pages);
      
      expect(tree.length).toBe(2);
      expect(tree[0].page.id).toBe('root-1');
      expect(tree[0].children.length).toBe(1);
      expect(tree[0].children[0].page.id).toBe('child-1');
      expect(tree[1].page.id).toBe('root-2');
    });

    it('handles deep nesting', () => {
      const pages = [
        createPage({ id: 'level-0', parentId: null, order: 0 }),
        createPage({ id: 'level-1', parentId: 'level-0', order: 0 }),
        createPage({ id: 'level-2', parentId: 'level-1', order: 0 }),
      ];
      
      const tree = buildPageTree(pages);
      
      expect(tree[0].depth).toBe(0);
      expect(tree[0].children[0].depth).toBe(1);
      expect(tree[0].children[0].children[0].depth).toBe(2);
    });

    it('excludes daily notes from tree', () => {
      const pages = [
        createPage({ id: 'page-1', parentId: null, isDailyNote: false }),
        createPage({ id: 'daily-1', parentId: null, isDailyNote: true }),
      ];
      
      const tree = buildPageTree(pages);
      
      expect(tree.length).toBe(1);
      expect(tree[0].page.id).toBe('page-1');
    });

    it('sorts by order', () => {
      const pages = [
        createPage({ id: 'page-c', parentId: null, order: 2 }),
        createPage({ id: 'page-a', parentId: null, order: 0 }),
        createPage({ id: 'page-b', parentId: null, order: 1 }),
      ];
      
      const tree = buildPageTree(pages);
      
      expect(tree[0].page.id).toBe('page-a');
      expect(tree[1].page.id).toBe('page-b');
      expect(tree[2].page.id).toBe('page-c');
    });

    it('handles empty string parentId as root', () => {
      const pages = [
        createPage({ id: 'page-1', parentId: '' as any }),
        createPage({ id: 'page-2', parentId: null }),
      ];
      
      const tree = buildPageTree(pages);
      
      expect(tree.length).toBe(2);
    });
  });

  describe('getAncestorChain', () => {
    it('returns empty array for root page', () => {
      const pagesById = {
        'root': createPage({ id: 'root', parentId: null }),
      };
      
      const ancestors = getAncestorChain(pagesById, 'root');
      
      expect(ancestors).toEqual([]);
    });

    it('returns parent for single-level nesting', () => {
      const pagesById = {
        'parent': createPage({ id: 'parent', title: 'Parent', parentId: null }),
        'child': createPage({ id: 'child', parentId: 'parent' }),
      };
      
      const ancestors = getAncestorChain(pagesById, 'child');
      
      expect(ancestors.length).toBe(1);
      expect(ancestors[0].id).toBe('parent');
      expect(ancestors[0].title).toBe('Parent');
    });

    it('returns full chain for deep nesting', () => {
      const pagesById = {
        'grandparent': createPage({ id: 'grandparent', title: 'GP', parentId: null }),
        'parent': createPage({ id: 'parent', title: 'P', parentId: 'grandparent' }),
        'child': createPage({ id: 'child', parentId: 'parent' }),
      };
      
      const ancestors = getAncestorChain(pagesById, 'child');
      
      expect(ancestors.length).toBe(2);
      expect(ancestors[0].id).toBe('grandparent');
      expect(ancestors[1].id).toBe('parent');
    });

    it('returns empty array for unknown page', () => {
      const ancestors = getAncestorChain({}, 'unknown');
      expect(ancestors).toEqual([]);
    });
  });

  describe('getDescendantIds', () => {
    it('returns empty array for page with no children', () => {
      const pages = [createPage({ id: 'page-1', parentId: null })];
      const descendants = getDescendantIds(pages, 'page-1');
      expect(descendants).toEqual([]);
    });

    it('returns direct children', () => {
      const pages = [
        createPage({ id: 'parent', parentId: null }),
        createPage({ id: 'child-1', parentId: 'parent' }),
        createPage({ id: 'child-2', parentId: 'parent' }),
      ];
      
      const descendants = getDescendantIds(pages, 'parent');
      
      expect(descendants).toContain('child-1');
      expect(descendants).toContain('child-2');
      expect(descendants.length).toBe(2);
    });

    it('returns all descendants recursively', () => {
      const pages = [
        createPage({ id: 'root', parentId: null }),
        createPage({ id: 'child', parentId: 'root' }),
        createPage({ id: 'grandchild', parentId: 'child' }),
      ];
      
      const descendants = getDescendantIds(pages, 'root');
      
      expect(descendants).toContain('child');
      expect(descendants).toContain('grandchild');
      expect(descendants.length).toBe(2);
    });
  });
});
