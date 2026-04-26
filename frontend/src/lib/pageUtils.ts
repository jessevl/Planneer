/**
 * @file pageUtils.ts
 * @description Utility functions for page operations and tree management
 * @app PAGES - Page hierarchy and content utilities
 * 
 * Provides functions for working with pages:
 * 
 * Content utilities:
 * - extractPagePreview: Extract plain text from Yoopta JSON for preview
 * - highlightText: Wrap search matches in highlighted spans
 * 
 * Tree operations:
 * - buildPageTree: Convert flat array to hierarchical tree
 * - getAncestorChain: Get breadcrumb path to a page
 * - getDescendantIds: Get all nested children IDs
 * - getChildPages: Get immediate children of a page
 * - getRootPages: Get top-level pages (no parent)
 * - getDailyPages: Get all daily journal pages
 * 
 * Hierarchy modifications:
 * - movePage: Change a page's parent
 * - reorderChildren: Update order of sibling pages
 * - getNextOrder: Calculate order value for new child
 * 
 * Queries:
 * - hasChildren, isDescendantOf: Hierarchy checks
 */
import type { Page, PageBreadcrumb, PagePreviewBlock, PagePreviewLeaf, PageTreeNode } from '../types/page';
import { isRootLevel, isTopLevelPlacement, ROOT_KEY } from './treeUtils';
import React from 'react';

function normalizePreviewBlockType(blockType?: string, elementType?: string): PagePreviewBlock['type'] {
  const source = `${blockType ?? ''} ${elementType ?? ''}`.toLowerCase();

  if (source.includes('headingone') || source.includes('heading-one')) return 'heading-one';
  if (source.includes('headingtwo') || source.includes('heading-two')) return 'heading-two';
  if (source.includes('headingthree') || source.includes('heading-three')) return 'heading-three';
  if (source.includes('blockquote')) return 'blockquote';
  if (source.includes('callout')) return 'callout';
  if (source.includes('code')) return 'code';
  if (source.includes('divider')) return 'divider';
  if (source.includes('bulleted')) return 'bulleted-list';
  if (source.includes('numbered')) return 'numbered-list';
  if (source.includes('todo')) return 'todo-list';

  return 'paragraph';
}

function extractPreviewLeaves(nodes: unknown[], inheritedHref?: string): PagePreviewLeaf[] {
  const leaves: PagePreviewLeaf[] = [];

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;

    const record = node as Record<string, unknown>;
    const nextHref =
      typeof record.href === 'string'
        ? record.href
        : typeof record.url === 'string'
          ? record.url
          : typeof record.link === 'string'
            ? record.link
            : inheritedHref;

    if (typeof record.text === 'string') {
      leaves.push({
        text: record.text,
        bold: Boolean(record.bold),
        italic: Boolean(record.italic),
        underline: Boolean(record.underline),
        strike: Boolean(record.strike),
        code: Boolean(record.code),
        highlight: record.highlight as boolean | string | undefined,
        href: nextHref,
      });
      continue;
    }

    if (Array.isArray(record.children)) {
      leaves.push(...extractPreviewLeaves(record.children, nextHref));
    }
  }

  return leaves;
}

export function extractRichPagePreviewBlocks(content: string | null, maxBlocks: number = 4): PagePreviewBlock[] {
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as Record<string, {
      id?: string;
      type?: string;
      meta?: { order?: number; depth?: number };
      value?: Array<{
        id?: string;
        type?: string;
        props?: { checked?: boolean };
        checked?: boolean;
        children?: unknown[];
      }>;
    }>;

    const blocks = Object.entries(parsed)
      .filter(([key, block]) => key !== '__rowLayout' && block && typeof block === 'object')
      .sort(([, a], [, b]) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0));

    const previewBlocks: PagePreviewBlock[] = [];

    for (const [blockKey, block] of blocks) {
      if (previewBlocks.length >= maxBlocks) break;

      const blockType = normalizePreviewBlockType(block.type);
      const depth = Number(block.meta?.depth ?? 0);

      if (blockType === 'divider') {
        previewBlocks.push({
          id: block.id ?? blockKey,
          type: 'divider',
          depth,
          children: [],
        });
        continue;
      }

      if (!Array.isArray(block.value)) continue;

      for (const [index, element] of block.value.entries()) {
        if (previewBlocks.length >= maxBlocks) break;

        const elementType = normalizePreviewBlockType(block.type, element?.type);
        const leaves = extractPreviewLeaves(Array.isArray(element?.children) ? element.children : []);
        const hasText = leaves.some((leaf) => leaf.text.trim().length > 0);

        if (!hasText && elementType !== 'todo-list') continue;

        previewBlocks.push({
          id: element?.id ?? `${block.id ?? blockKey}-${index}`,
          type: elementType,
          depth,
          checked: Boolean(element?.props?.checked ?? element?.checked),
          children: leaves,
        });
      }
    }

    return previewBlocks;
  } catch {
    return [];
  }
}

/**
 * Highlight matching text in a string by wrapping matches in styled spans
 * Returns an array of React elements (strings and highlighted spans)
 */
export function highlightText(text: string, searchQuery: string): React.ReactNode[] {
  if (!searchQuery || !searchQuery.trim()) {
    return [text];
  }
  
  const query = searchQuery.toLowerCase().trim();
  const lowerText = text.toLowerCase();
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(query);
  let keyIndex = 0;
  
  while (matchIndex !== -1) {
    // Add text before match
    if (matchIndex > lastIndex) {
      result.push(text.slice(lastIndex, matchIndex));
    }
    
    // Add highlighted match
    result.push(
      React.createElement(
        'mark',
        { 
          key: keyIndex++,
          className: 'bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5'
        },
        text.slice(matchIndex, matchIndex + query.length)
      )
    );
    
    lastIndex = matchIndex + query.length;
    matchIndex = lowerText.indexOf(query, lastIndex);
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  
  return result.length > 0 ? result : [text];
}

/**
 * Extract plain text preview from Yoopta content JSON
 */
export function extractPagePreview(content: string, maxLines: number = 4): string {
  try {
    const parsed = JSON.parse(content);
    const blockIds = Object.keys(parsed);
    const lines: string[] = [];
    
    for (const blockId of blockIds) {
      if (lines.length >= maxLines) break;
      
      const block = parsed[blockId];
      if (block.value && Array.isArray(block.value)) {
        for (const item of block.value) {
          if (lines.length >= maxLines) break;
          
          if (item.children && Array.isArray(item.children)) {
            const text = item.children.map((child: { text?: string }) => child.text || '').join('');
            if (text.trim()) {
              lines.push(text.trim());
            }
          }
        }
      }
    }
    
    return lines.length > 0 ? lines.join(' ') : '';
  } catch {
    return '';
  }
}

// Backward compatibility alias
export const extractNotePreview = extractPagePreview;

/**
 * Extract a plain text excerpt from Yoopta content JSON.
 * Used for storing in the database for efficient list queries.
 * 
 * IMPORTANT: Sorts blocks by meta.order to ensure excerpt uses content
 * from the TOP of the document, not the first-inserted block.
 * 
 * @param content - Yoopta JSON content string
 * @param maxLength - Maximum characters for excerpt (default 200)
 * @returns Plain text excerpt or null if no content
 */
export function extractExcerpt(content: string | null, maxLength = 200): string | null {
  if (!content) return null;
  
  try {
    const parsed = JSON.parse(content) as Record<string, { 
      meta?: { order: number };
      value?: Array<{ children?: Array<{ text?: string }> }>;
    }>;
    const textParts: string[] = [];
    let totalLength = 0;
    
    // Convert to array and sort by meta.order to respect document order
    const sortedBlocks = Object.values(parsed)
      .filter(block => block && block.value)
      .sort((a, b) => {
        const orderA = a.meta?.order ?? 0;
        const orderB = b.meta?.order ?? 0;
        return orderA - orderB;
      });
    
    // Iterate through blocks to extract text
    for (const block of sortedBlocks) {
      if (totalLength >= maxLength) break;
      if (!block.value || !Array.isArray(block.value)) continue;
      
      for (const item of block.value) {
        if (totalLength >= maxLength) break;
        if (!item.children || !Array.isArray(item.children)) continue;
        
        const text = item.children.map(child => child.text || '').join('').trim();
        if (text) {
          textParts.push(text);
          totalLength += text.length + 1; // +1 for space
        }
      }
    }
    
    if (textParts.length === 0) return null;
    
    const fullText = textParts.join(' ');
    if (fullText.length <= maxLength) return fullText;
    
    // Truncate at word boundary if possible
    const truncated = fullText.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    const cutPoint = lastSpace > maxLength * 0.7 ? lastSpace : maxLength;
    return truncated.slice(0, cutPoint) + '…';
  } catch {
    return null;
  }
}

/**
 * Compute excerpt for sync operations. Unlike extractExcerpt which returns null
 * for both "no content" and "content has no text", this function distinguishes
 * between the two cases:
 * - If content is null/undefined (not loaded), returns the fallback
 * - If content is valid but has no text, returns null (clears the excerpt)
 * - If content has text, returns the excerpt
 *
 * This prevents stale excerpts from persisting when page content is cleared:
 * when hasContent is true, the excerpt is ALWAYS derived from content, never
 * from the old excerpt.
 *
 * @param content - Yoopta JSON content string (null if content not loaded)
 * @param fallbackExcerpt - Excerpt to use when content is not available
 * @param hasContent - Whether content has been loaded for this page
 * @returns The computed excerpt or null
 */
export function computeExcerptForSync(
  content: string | null | undefined,
  fallbackExcerpt: string | null | undefined,
  hasContent: boolean
): string | null {
  if (!hasContent || content === null || content === undefined) {
    // Content not loaded — preserve whatever excerpt we have
    return fallbackExcerpt ?? null;
  }
  // Content IS loaded — derive excerpt from it (may be null if no text)
  return extractExcerpt(content) ?? null;
}

/**
 * Build a tree structure from a flat array of pages.
 * Returns only canonical top-level nodes, with children nested recursively.
 * Daily pages are excluded from the tree (they're accessed separately).
 * 
 * Note: Handles both null and '' as "no parent" (PocketBase convention).
 */
export function buildPageTree(pages: Page[]): PageTreeNode[] {
  // Filter out daily pages - they don't appear in the tree
  const nonDailyPages = pages.filter((n) => !n.isDailyNote);

  // Create a map for quick lookups
  const pageMap = new Map<string, Page>();
  nonDailyPages.forEach((page) => pageMap.set(page.id, page));

  // Build children map - use ROOT_KEY as key for root-level pages
  const childrenMap = new Map<string, Page[]>();
  childrenMap.set(ROOT_KEY, []);
  
  nonDailyPages.forEach((page) => {
    if (isRootLevel(page.parentId) && !(page.isTopLevel ?? true)) {
      return;
    }

    const key = isRootLevel(page.parentId) ? ROOT_KEY : page.parentId!;
    if (!childrenMap.has(key)) {
      childrenMap.set(key, []);
    }
    childrenMap.get(key)!.push(page);
  });

  // Sort children by order
  childrenMap.forEach((children) => {
    children.sort((a, b) => a.order - b.order);
  });

  // Recursive function to build tree nodes
  function buildNode(page: Page, depth: number): PageTreeNode {
    const children = childrenMap.get(page.id) || [];
    return {
      page,
      depth,
      children: children.map((child) => buildNode(child, depth + 1)),
    };
  }

  // Get root pages and build tree
  const rootPages = childrenMap.get(ROOT_KEY) || [];
  return rootPages.map((page) => buildNode(page, 0));
}

// Backward compatibility alias
export const buildNoteTree = buildPageTree;

/**
 * Get the ancestor chain (breadcrumbs) for a page.
 * Returns array from root to immediate parent (does not include the page itself).
 */
export function getAncestorChain(
  pagesById: Record<string, Page>,
  pageId: string
): PageBreadcrumb[] {
  const ancestors: PageBreadcrumb[] = [];
  let current = pagesById[pageId];

  if (!current) return ancestors;

  // Walk up the tree
  while (current.parentId) {
    const parent = pagesById[current.parentId];
    if (!parent) break;

    ancestors.unshift({
      id: parent.id,
      title: parent.title,
      icon: parent.icon,
    });

    current = parent;
  }

  return ancestors;
}

/**
 * Get all descendant IDs for a page (children, grandchildren, etc.).
 * Useful for cascade delete or move operations.
 */
export function getDescendantIds(pages: Page[], pageId: string): string[] {
  const descendants: string[] = [];
  const childrenMap = new Map<string, Page[]>();

  // Build children map
  pages.forEach((page) => {
    if (page.parentId) {
      if (!childrenMap.has(page.parentId)) {
        childrenMap.set(page.parentId, []);
      }
      childrenMap.get(page.parentId)!.push(page);
    }
  });

  // Recursive collection
  function collectDescendants(id: string) {
    const children = childrenMap.get(id) || [];
    children.forEach((child) => {
      descendants.push(child.id);
      collectDescendants(child.id);
    });
  }

  collectDescendants(pageId);
  return descendants;
}

/**
 * Check if a page is a descendant of another page.
 * Used to prevent invalid drag-drop operations (can't drop into self or descendants).
 */
export function isDescendantOf(
  pagesById: Record<string, Page>,
  pageId: string,
  potentialAncestorId: string
): boolean {
  let current = pagesById[pageId];

  while (current && current.parentId) {
    if (current.parentId === potentialAncestorId) {
      return true;
    }
    current = pagesById[current.parentId];
  }

  return false;
}

/**
 * Reorder children within a parent and return updated pages array.
 * Updates the `order` field for all affected pages.
 */
export function reorderChildren(
  pages: Page[],
  parentId: string | null,
  orderedIds: string[]
): Page[] {
  const orderMap = new Map<string, number>();
  orderedIds.forEach((id, index) => {
    orderMap.set(id, index);
  });

  return pages.map((page) => {
    if (page.parentId === parentId && orderMap.has(page.id)) {
      return { ...page, order: orderMap.get(page.id)! };
    }
    return page;
  });
}

/**
 * Get the next available order number for a parent.
 */
export function getNextOrder(pages: Page[], parentId: string | null): number {
  const children = pages.filter((n) => n.parentId === parentId && !n.isDailyNote);
  if (children.length === 0) return 0;
  return Math.max(...children.map((n) => n.order)) + 1;
}

/**
 * Sort pages by their order field.
 */
export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * Get direct children of a parent page.
 */
export function getChildPages(pages: Page[], parentId: string | null): Page[] {
  return sortByOrder(
    pages.filter((n) => {
      if (n.isDailyNote) return false;
      if (parentId === null) {
        return isTopLevelPlacement(n.parentId, n.isTopLevel);
      }
      return n.parentId === parentId;
    })
  );
}

// Backward compatibility alias
export const getChildNotes = getChildPages;

/**
 * Get root-level pages (no parent).
 */
export function getRootPages(pages: Page[]): Page[] {
  return getChildPages(pages, null);
}

// Backward compatibility alias
export const getRootNotes = getRootPages;

/**
 * Get all daily pages, sorted by date (newest first).
 */
export function getDailyPages(pages: Page[]): Page[] {
  return pages
    .filter((n) => n.isDailyNote)
    .sort((a, b) => {
      if (!a.dailyNoteDate || !b.dailyNoteDate) return 0;
      return b.dailyNoteDate.localeCompare(a.dailyNoteDate);
    });
}

// Backward compatibility alias
export const getDailyNotes = getDailyPages;

/**
 * Move a page to a new parent at a specific position.
 * Returns the updated pages array with corrected order values.
 */
export function movePage(
  pages: Page[],
  pageId: string,
  newParentId: string | null,
  newOrder?: number
): Page[] {
  const pageToMove = pages.find((n) => n.id === pageId);
  if (!pageToMove) return pages;

  const oldParentId = pageToMove.parentId;
  const targetOrder = newOrder ?? getNextOrder(pages, newParentId);

  // If moving within same parent, just reorder
  if (oldParentId === newParentId) {
    const siblings = getChildPages(pages, newParentId);
    const currentIndex = siblings.findIndex((n) => n.id === pageId);
    const newIndex = Math.min(targetOrder, siblings.length - 1);

    if (currentIndex === newIndex) return pages;

    // Remove from current position and insert at new position
    const reordered = siblings.filter((n) => n.id !== pageId);
    reordered.splice(newIndex, 0, pageToMove);

    const orderedIds = reordered.map((n) => n.id);
    return reorderChildren(pages, newParentId, orderedIds);
  }

  // Moving to different parent
  return pages.map((page) => {
    if (page.id === pageId) {
      return {
        ...page,
        parentId: newParentId,
        order: targetOrder,
        updated: new Date().toISOString(),
      };
    }

    // Reorder siblings in old parent (fill the gap)
    if (page.parentId === oldParentId && page.order > pageToMove.order) {
      return { ...page, order: page.order - 1 };
    }

    // Reorder siblings in new parent (make room)
    if (page.parentId === newParentId && page.order >= targetOrder) {
      return { ...page, order: page.order + 1 };
    }

    return page;
  });
}

/**
 * Count all pages under a parent (including nested descendants).
 */
export function countDescendants(pages: Page[], pageId: string): number {
  return getDescendantIds(pages, pageId).length;
}

/**
 * Check if a page has any children.
 */
export function hasChildren(pages: Page[], pageId: string): boolean {
  return pages.some((n) => n.parentId === pageId && !n.isDailyNote);
}

/**
 * Flatten a tree back to an array (useful for debugging).
 */
export function flattenTree(nodes: PageTreeNode[]): Page[] {
  const result: Page[] = [];

  function traverse(node: PageTreeNode) {
    result.push(node.page);
    node.children.forEach(traverse);
  }

  nodes.forEach(traverse);
  return result;
}

