/**
 * @file treeUtils.ts
 * @description Shared utility functions for tree operations
 * @app SHARED - Used by pages, projects, and any hierarchical data
 * 
 * Common helpers for working with tree-structured data:
 * - isRootLevel: Check if a parentId represents root level
 * 
 * This consolidates duplicate helper functions that were previously
 * defined in pageUtils.ts and pagesStore.ts.
 */

/**
 * Check if a parentId value represents "no parent" (root level).
 * 
 * PocketBase uses empty string for unset relations, while the frontend
 * may use null or undefined. This function normalizes all these cases.
 * 
 * @param parentId - The parent ID to check
 * @returns true if the item should be considered a root-level item
 */
export function isRootLevel(parentId: string | null | undefined): boolean {
  return parentId === null || parentId === undefined || parentId === '';
}

/**
 * Constant for the root key used in children indexes.
 * Used when building parent->children maps.
 */
export const ROOT_KEY = 'ROOT';
