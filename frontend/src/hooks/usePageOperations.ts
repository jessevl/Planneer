/**
 * @file usePageOperations.ts
 * @description Unified hook for page operations (delete, task migration)
 * @app SHARED - Used by TreeSection, PageDetailView, AllPagesView, UnifiedHeader
 * 
 * Consolidates duplicated logic for:
 * - Deleting pages with children (pages + tasks)
 * - Moving tasks to inbox when deleting task pages
 * - Task migration when changing page mode from 'tasks'
 * 
 * This hook integrates with:
 * - deleteConfirmStore for confirmation dialogs
 * - tasksStore for task operations
 * - pagesStore for page updates
 */
'use client';

import { useCallback, useMemo } from 'react';
import { useTasksStore, useTasks } from '@/stores/tasksStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import type { Page, PageViewMode } from '@/types/page';

// ============================================================================
// TYPES
// ============================================================================

export interface PageDeleteOptions {
  /** The page being deleted */
  page: Page;
  /** Number of child pages (descendants) */
  childPageCount?: number;
  /** Callback to execute the actual delete */
  onDelete: (pageId: string, cascade: boolean) => void;
  /** Optional callback after delete completes */
  onComplete?: () => void;
}

export interface PageModeChangeOptions {
  /** The page being updated */
  page: Page;
  /** The new view mode */
  newMode: PageViewMode;
  /** Callback to apply the mode change */
  onUpdate: (pageId: string, viewMode: PageViewMode) => void;
  /** Optional callback after change completes */
  onComplete?: () => void;
}

export interface UsePageOperationsResult {
  /** Count tasks for a specific page */
  countTasksForPage: (pageId: string) => number;
  
  /** Request delete with proper confirmation (handles children + tasks) */
  requestPageDelete: (options: PageDeleteOptions) => void;
  
  /** Check if mode change needs migration and handle it */
  handleModeChange: (options: PageModeChangeOptions) => { needsMigration: boolean; taskCount: number };
  
  /** Move all tasks from a page to inbox */
  migrateTasksToInbox: (pageId: string) => void;
  
  /** Get tasks for a page */
  getTasksForPage: (pageId: string) => ReturnType<typeof useTasks>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Unified hook for page operations
 * 
 * @example
 * const { requestPageDelete, handleModeChange, migrateTasksToInbox } = usePageOperations();
 * 
 * // Delete a page with proper confirmation
 * requestPageDelete({
 *   page,
 *   childPageCount: page.childCount || 0,
 *   onDelete: (id, cascade) => deletePage(id, cascade),
 * });
 * 
 * // Handle mode change with migration check
 * const { needsMigration, taskCount } = handleModeChange({
 *   page,
 *   newMode: 'note',
 *   onUpdate: (id, mode) => updatePage(id, { viewMode: mode }),
 * });
 */
export function usePageOperations(): UsePageOperationsResult {
  const allTasks = useTasks();
  const updateTask = useTasksStore((s) => s.updateTask);
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  
  // Count tasks assigned to a specific page
  const countTasksForPage = useCallback((pageId: string): number => {
    return allTasks.filter(t => t.parentPageId === pageId).length;
  }, [allTasks]);
  
  // Get tasks for a page
  const getTasksForPage = useCallback((pageId: string) => {
    return allTasks.filter(t => t.parentPageId === pageId);
  }, [allTasks]);
  
  // Move all tasks from a page to inbox (set parentPageId to undefined/null)
  const migrateTasksToInbox = useCallback((pageId: string) => {
    const pageTasks = allTasks.filter(t => t.parentPageId === pageId);
    pageTasks.forEach((task) => {
      updateTask(task.id, { parentPageId: undefined });
    });
  }, [allTasks, updateTask]);
  
  // Request delete with proper confirmation dialog
  const requestPageDelete = useCallback((options: PageDeleteOptions) => {
    const { page, childPageCount = 0, onDelete, onComplete } = options;
    
    // For task pages, also count tasks as "children"
    const taskCount = page.viewMode === 'tasks' ? countTasksForPage(page.id) : 0;
    const totalChildCount = childPageCount + taskCount;
    const hasChildren = totalChildCount > 0;
    
    requestDelete({
      itemType: 'page',
      count: 1,
      hasChildren,
      childCount: totalChildCount,
      onConfirm: (cascade: boolean) => {
        // If not cascading and this is a task page with tasks, move them to inbox first
        if (!cascade && page.viewMode === 'tasks' && taskCount > 0) {
          migrateTasksToInbox(page.id);
        }
        onDelete(page.id, cascade);
        onComplete?.();
      },
    });
  }, [countTasksForPage, migrateTasksToInbox, requestDelete]);
  
  // Check if mode change needs migration and return info
  const handleModeChange = useCallback((options: PageModeChangeOptions): { needsMigration: boolean; taskCount: number } => {
    const { page, newMode, onUpdate, onComplete } = options;
    
    // Only need migration when changing FROM tasks mode
    if (page.viewMode !== 'tasks' || newMode === 'tasks') {
      // No migration needed, apply directly
      onUpdate(page.id, newMode);
      onComplete?.();
      return { needsMigration: false, taskCount: 0 };
    }
    
    // Check if there are tasks to migrate
    const taskCount = countTasksForPage(page.id);
    
    if (taskCount === 0) {
      // No tasks, can change directly
      onUpdate(page.id, newMode);
      onComplete?.();
      return { needsMigration: false, taskCount: 0 };
    }
    
    // Has tasks, caller needs to show migration modal
    return { needsMigration: true, taskCount };
  }, [countTasksForPage]);
  
  return {
    countTasksForPage,
    requestPageDelete,
    handleModeChange,
    migrateTasksToInbox,
    getTasksForPage,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get display label for page based on its viewMode
 */
export function getPageLabel(page: Page): string {
  switch (page.viewMode) {
    case 'tasks':
      return 'tasks page';
    case 'collection':
      return 'collection';
    default:
      return 'note';
  }
}

/**
 * Get plural display label for pages
 */
export function getPageLabelPlural(count: number, viewMode?: PageViewMode): string {
  if (count === 1) {
    switch (viewMode) {
      case 'tasks':
        return 'tasks page';
      case 'collection':
        return 'collection';
      default:
        return 'page';
    }
  }
  // For multiple items, just say "pages"
  return 'pages';
}
