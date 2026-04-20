/**
 * @file useNoteContextMenu.tsx
 * @description Note-specific context menu hook
 * @app NOTES APP ONLY - Provides context menu items for note rows/cards
 * 
 * Returns menu items appropriate for single or multi-select note operations:
 * - Properties (single select only)
 * - Delete (not for daily notes)
 * 
 * Integrates with:
 * - selectionStore for multi-selection state
 * - notesStore for note actions
 */
'use client';

import React, { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePagesStore, selectPageActions } from '@/stores/pagesStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import type { ContextMenuItem } from '@/components/ui';
import type { Page } from '@/types/page';
import {
  TrashIcon,
  SettingsIcon,
} from '@/components/common/Icons';

const iconClass = "w-4 h-4";

interface UseNoteContextMenuOptions {
  /** The page that was right-clicked */
  page: Page;
  /** Called when properties modal should open */
  onOpenProperties?: (id: string) => void;
  /** Number of children for cascade delete option (single select only) */
  childCount?: number;
}

/**
 * Hook to generate context menu items for pages
 * 
 * @example
 * const { menuItems, handleClick, isSelected } = useNoteContextMenu({ 
 *   note,
 *   onOpenProperties: handleOpenProperties,
 * });
 */
export function useNoteContextMenu({ page, onOpenProperties, childCount = 0 }: UseNoteContextMenuOptions) {
  // Selection state
  const selectedIds = useSelectionStore((s) => s.selectedIds.page);
  const handleItemClick = useSelectionStore((s) => s.handleItemClick);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  
  // Delete confirmation
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  
  // Page store actions
  const { deletePage, updatePage } = usePagesStore(useShallow(selectPageActions));
  
  // Effective selection (includes right-clicked note even if not selected)
  const effectiveSelection = useMemo(() => {
    const selection = new Set(selectedIds);
    selection.add(page.id);
    return Array.from(selection);
  }, [selectedIds, page.id]);
  
  const isMultiSelect = effectiveSelection.length > 1;
  const selectionCount = effectiveSelection.length;
  
  // Generate menu items
  const menuItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    
    // Properties (single select only)
    if (!isMultiSelect && onOpenProperties) {
      items.push({
        id: 'properties',
        label: 'Properties',
        icon: <SettingsIcon className={iconClass} />,
        onClick: () => onOpenProperties(page.id),
      });
    }
    
    // Delete - always available
    // For single select, use childCount for cascade option
    const hasChildren = !isMultiSelect && childCount > 0;
    
    items.push({
      id: 'delete',
      label: isMultiSelect ? `Delete ${selectionCount} pages` : 'Delete',
      icon: <TrashIcon className={iconClass} />,
      variant: 'danger' as const,
      divider: items.length > 0,
      onClick: () => {
        requestDelete({
          itemType: 'page',
          count: selectionCount,
          hasChildren,
          childCount: hasChildren ? childCount : 0,
          onConfirm: (cascade: boolean) => {
            effectiveSelection.forEach(id => {
              deletePage(id, cascade);
            });
            clearSelection('page');
          },
        });
      },
    });
    
    return items;
  }, [
    isMultiSelect, selectionCount, childCount,
    effectiveSelection, deletePage, updatePage, clearSelection,
    onOpenProperties, page.id, requestDelete
  ]);
  
  // Click handler with selection support
  const handleClick = useCallback((e: React.MouseEvent) => {
    handleItemClick('page', page.id, {
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
    }, 'main-pages');
  }, [handleItemClick, page.id]);
  
  // Check if this note is selected
  const isSelected = selectedIds.has(page.id);
  
  return {
    menuItems,
    handleClick,
    isSelected,
    isMultiSelect,
    selectionCount,
    effectiveSelection,
  };
}
