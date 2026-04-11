/**
 * @file usePagePropertiesModal.ts
 * @description Unified hook for page properties modal state and handlers
 * @app SHARED - Used by TreeSection, PageDetailView, AllPagesView
 * 
 * Consolidates duplicated logic for:
 * - Modal open/close state management
 * - Properties data transformation
 * - Save handler with viewMode change detection
 * - Integration with task migration flow
 * 
 * This hook integrates with:
 * - usePageOperations for task migration
 * - ItemPropertiesModal component
 * - TaskMigrationModal component
 */
'use client';

import { useState, useCallback, useMemo } from 'react';
import { usePageOperations } from './usePageOperations';
import type { Page, PageViewMode } from '@/types/page';

// ============================================================================
// TYPES
// ============================================================================

/** Data format for the properties modal */
export interface PagePropertiesData {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  viewMode?: PageViewMode;
  isPinned?: boolean;
  isReadOnly?: boolean;
}

/** Parent option for the dropdown */
export interface ParentOption {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
  depth: number;
}

export interface UsePagePropertiesModalOptions {
  /** Callback to update a page */
  onUpdate: (pageId: string, updates: Partial<Page>) => void;
  /** Callback to create a new page */
  onCreate?: (data: { title: string; icon: string | null; color: string | null; parentId: string | null }) => void;
  /** Callback to delete a page */
  onDelete?: (pageId: string, cascade: boolean) => void;
  /** Number of child pages for cascade delete option */
  getChildCount?: (pageId: string) => number;
}

export interface UsePagePropertiesModalResult {
  // Modal state
  isOpen: boolean;
  modalData: PagePropertiesData | null;
  
  // Migration modal state
  isMigrationModalOpen: boolean;
  migrationTaskCount: number;
  migrationPageName: string;
  
  // Actions
  openForEdit: (page: Page) => void;
  openForCreate: (parentId?: string | null) => void;
  close: () => void;
  
  // Save handler (returns true if saved, false if migration needed)
  handleSave: (data: PagePropertiesData) => boolean;
  
  // Migration handlers
  confirmMigration: () => void;
  cancelMigration: () => void;
  
  // Delete handler
  handleDelete: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Unified hook for page properties modal
 * 
 * @example
 * const {
 *   isOpen,
 *   modalData,
 *   isMigrationModalOpen,
 *   migrationTaskCount,
 *   openForEdit,
 *   close,
 *   handleSave,
 *   confirmMigration,
 *   handleDelete,
 * } = usePagePropertiesModal({
 *   onUpdate: (id, updates) => updatePage(id, updates),
 *   onDelete: (id, cascade) => deletePage(id, cascade),
 *   getChildCount: (id) => countDescendants(id),
 * });
 */
export function usePagePropertiesModal(options: UsePagePropertiesModalOptions): UsePagePropertiesModalResult {
  const { onUpdate, onCreate, onDelete, getChildCount } = options;
  const { countTasksForPage, migrateTasksToInbox, requestPageDelete } = usePageOperations();
  
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<PagePropertiesData | null>(null);
  const [originalPage, setOriginalPage] = useState<Page | null>(null);
  
  // Migration modal state
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [pendingData, setPendingData] = useState<PagePropertiesData | null>(null);
  
  // Computed migration info
  const migrationTaskCount = useMemo(() => {
    if (!originalPage) return 0;
    return countTasksForPage(originalPage.id);
  }, [originalPage, countTasksForPage]);
  
  const migrationPageName = originalPage?.title || 'Untitled';
  
  // Open for editing an existing page
  const openForEdit = useCallback((page: Page) => {
    setModalData({
      id: page.id,
      title: page.title,
      icon: page.icon,
      color: page.color,
      parentId: page.parentId,
      viewMode: page.viewMode,
      isPinned: page.isPinned,
      isReadOnly: page.isReadOnly,
    });
    setOriginalPage(page);
    setIsOpen(true);
  }, []);
  
  // Open for creating a new page
  const openForCreate = useCallback((parentId?: string | null) => {
    setModalData({
      id: '',
      title: '',
      icon: null,
      color: '#3b82f6', // Default blue
      parentId: parentId ?? null,
    });
    setOriginalPage(null);
    setIsOpen(true);
  }, []);
  
  // Close modal
  const close = useCallback(() => {
    setIsOpen(false);
    setModalData(null);
    setOriginalPage(null);
  }, []);
  
  // Handle save - returns true if saved, false if migration needed
  const handleSave = useCallback((data: PagePropertiesData): boolean => {
    if (!data.id) {
      // Creating new page
      onCreate?.({
        title: data.title,
        icon: data.icon,
        color: data.color,
        parentId: data.parentId,
      });
      close();
      return true;
    }
    
    // Editing existing page
    // Check if viewMode is changing from 'tasks' to something else
    if (originalPage?.viewMode === 'tasks' && data.viewMode && data.viewMode !== 'tasks') {
      const taskCount = countTasksForPage(originalPage.id);
      if (taskCount > 0) {
        // Need migration - store pending data and show migration modal
        setPendingData(data);
        setIsMigrationModalOpen(true);
        setIsOpen(false);
        return false;
      }
    }
    
    // Apply updates directly
    onUpdate(data.id, {
      title: data.title,
      icon: data.icon,
      color: data.color,
      parentId: data.parentId,
      viewMode: data.viewMode,
      isPinned: data.isPinned,
    });
    close();
    return true;
  }, [originalPage, countTasksForPage, onUpdate, onCreate, close]);
  
  // Confirm migration - move tasks to inbox and apply pending changes
  const confirmMigration = useCallback(() => {
    if (!originalPage || !pendingData) return;
    
    // Move tasks to inbox
    migrateTasksToInbox(originalPage.id);
    
    // Apply the pending updates
    onUpdate(pendingData.id, {
      title: pendingData.title,
      icon: pendingData.icon,
      color: pendingData.color,
      parentId: pendingData.parentId,
      viewMode: pendingData.viewMode,
      isPinned: pendingData.isPinned,
    });
    
    // Clean up state
    setIsMigrationModalOpen(false);
    setPendingData(null);
    setOriginalPage(null);
    setModalData(null);
  }, [originalPage, pendingData, migrateTasksToInbox, onUpdate]);
  
  // Cancel migration
  const cancelMigration = useCallback(() => {
    setIsMigrationModalOpen(false);
    setPendingData(null);
    // Keep original page data for if they want to edit again
  }, []);
  
  // Handle delete
  const handleDelete = useCallback(() => {
    if (!originalPage || !onDelete) return;
    
    const childPageCount = getChildCount?.(originalPage.id) || 0;
    
    requestPageDelete({
      page: originalPage,
      childPageCount,
      onDelete,
      onComplete: close,
    });
  }, [originalPage, onDelete, getChildCount, requestPageDelete, close]);
  
  return {
    isOpen,
    modalData,
    isMigrationModalOpen,
    migrationTaskCount,
    migrationPageName,
    openForEdit,
    openForCreate,
    close,
    handleSave,
    confirmMigration,
    cancelMigration,
    handleDelete,
  };
}
