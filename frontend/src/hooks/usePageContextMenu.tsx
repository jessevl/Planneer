/**
 * @file usePageContextMenu.tsx
 * @description Unified page context menu — shared builder + React hook wrapper
 * @app SHARED - Used by page rows/cards AND sidebar tree items
 * 
 * Exports:
 * - buildPageMenuItems: Pure function to build menu items (usable in callbacks)
 * - usePageContextMenu: React hook wrapper with store subscriptions
 * 
 * Supported menu items (included only when callback is provided):
 * - Open in new tab (single select, when tabs enabled)
 * - Create subpage (single select)
 * - Create task (single select)
 * - Favorite toggle tile
 * - Subpages toggle tile (show/hide children in sidebar)
 * - Export submenu (Markdown, CSV)
 * - Delete (with multi-select support)
 * 
 * Integrates with:
 * - selectionStore for multi-selection state
 * - pagesStore for page actions
 * - tabsStore for tab operations
 * - deleteConfirmStore for delete confirmation
 */
'use client';

import React, { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';
import { FilePlus, ListPlus, Download, ExternalLink, FolderInput, ArrowRightFromLine } from 'lucide-react';
import { usePagesStore, selectPageActions } from '@/stores/pagesStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTabsStore } from '@/stores/tabsStore';
import { useUIStore } from '@/stores/uiStore';
import type { ContextMenuItem } from '@/components/ui';
import type { Page } from '@/types/page';
import {
  TrashIcon,
} from '@/components/common/Icons';
import { exportPageToMarkdown, exportTasksToCSV } from '@/lib/dataExport';
import { toastSuccess, toastError } from '@/components/ui';

const iconClass = "w-4 h-4";

// ─── Shared builder ──────────────────────────────────────────

export interface BuildPageMenuItemsConfig {
  /** Whether multiple items are selected */
  isMultiSelect: boolean;
  /** Number of selected items */
  selectionCount: number;
  /** Whether tabs feature is enabled */
  tabsEnabled: boolean;
  /** Current show-children-in-sidebar state (for subpages toggle) */
  showChildrenInSidebar?: boolean;

  /** Callbacks — each item is included only when its callback is provided */
  onOpenInNewTab?: () => void;
  onCreateChild?: () => void;
  onCreateTask?: () => void;
  onToggleShowChildren?: () => void;
  onMoveTo?: () => void;
  onExportMarkdown?: () => void;
  onExportCSV?: () => void;
  onDelete?: () => void;
}

/**
 * Pure function that builds an array of ContextMenuItem for page context menus.
 *
 * Each item is **opt-in**: it only appears when its corresponding callback is
 * provided. This lets callers choose which actions to expose without boolean
 * flags — just omit the callback.
 *
 * Used by:
 * - `usePageContextMenu` (hook) — wraps stores around this builder
 * - `TreeSection.getContextMenuItems` — calls directly in a plain callback
 *
 * @example
 * // Minimal — only "Delete" shows up
 * buildPageMenuItems({
 *   isMultiSelect: false,
 *   selectionCount: 1,
 *   tabsEnabled: false,
 *   onDelete: () => deletePage(id),
 * });
 *
 * @example
 * // Full sidebar context menu with all toggles
 * buildPageMenuItems({
 *   isMultiSelect: false,
 *   selectionCount: 1,
 *   tabsEnabled: true,
 *   showChildrenInSidebar: page.showChildrenInSidebar,
 *   onOpenInNewTab: () => openTab(...),
 *   onCreateChild: () => createChild(page.id),
 *   onCreateTask: () => createTask(page.id),
 *   onToggleShowChildren: () => updatePage(page.id, { showChildrenInSidebar: !show }),
 *   onExportMarkdown: () => exportPageToMarkdown(page.id, page.title),
 *   onExportCSV: () => exportTasksToCSV(page.id, page.title),
 *   onDelete: () => requestDelete(...),
 * });
 */
export function buildPageMenuItems(config: BuildPageMenuItemsConfig): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  // Open in new tab (single select only)
  if (!config.isMultiSelect && config.tabsEnabled && config.onOpenInNewTab) {
    items.push({
      id: 'open-in-new-tab',
      label: 'Open in new tab',
      icon: <ExternalLink className={iconClass} />,
      onClick: config.onOpenInNewTab,
    });
  }

  // Create subpage (single select only)
  if (!config.isMultiSelect && config.onCreateChild) {
    items.push({
      id: 'create-subpage',
      label: 'Create subpage',
      icon: <FilePlus className={iconClass} />,
      onClick: config.onCreateChild,
    });
  }

  // Create task (single select only)
  if (!config.isMultiSelect && config.onCreateTask) {
    items.push({
      id: 'create-task',
      label: 'Create task',
      icon: <ListPlus className={iconClass} />,
      onClick: config.onCreateTask,
    });
  }

  // Toggle: Show subpages in sidebar
  if (config.onToggleShowChildren) {
    items.push({
      id: 'toggle-sidebar-children',
      label: 'Subpages',
      icon: <FolderInput className={iconClass} />,
      toggled: !!config.showChildrenInSidebar,
      onClick: config.onToggleShowChildren,
    });
  }

  // Move to (single select only)
  if (!config.isMultiSelect && config.onMoveTo) {
    items.push({
      id: 'move-to',
      label: 'Move to',
      icon: <ArrowRightFromLine className={iconClass} />,
      divider: items.length > 0,
      onClick: config.onMoveTo,
    });
  }

  // Export submenu (single select only)
  if (!config.isMultiSelect && config.onExportMarkdown) {
    const exportChildren: ContextMenuItem[] = [
      {
        id: 'export-markdown',
        label: 'As Markdown',
        onClick: config.onExportMarkdown,
      },
    ];
    if (config.onExportCSV) {
      exportChildren.push({
        id: 'export-csv',
        label: 'As CSV',
        onClick: config.onExportCSV,
      });
    }
    items.push({
      id: 'export',
      label: 'Export',
      icon: <Download className={iconClass} />,
      divider: items.length > 0,
      onClick: () => {},
      children: exportChildren,
    });
  }

  // Delete — always available
  if (config.onDelete) {
    items.push({
      id: 'delete',
      label: config.isMultiSelect ? `Delete ${config.selectionCount} pages` : 'Delete',
      icon: <TrashIcon className={iconClass} />,
      variant: 'danger' as const,
      divider: items.length > 0,
      onClick: config.onDelete,
    });
  }

  return items;
}

// ─── React hook wrapper ──────────────────────────────────────

interface UsePageContextMenuOptions {
  /** The page that was right-clicked */
  page: Page;
  /** Called when creating a child page */
  onCreateChild?: (parentId: string) => void;
  /** Called when creating a task in a task collection */
  onCreateTask?: (parentPageId: string) => void;
  /** Number of children for cascade delete option (single select only) */
  childCount?: number;
  /** Callback to open page in new tab */
  onOpenInNewTab?: (page: Page) => void;
}

/**
 * Hook to generate context menu items for pages.
 * Wraps buildPageMenuItems with reactive store subscriptions.
 * 
 * @example
 * const { menuItems, handleClick, isSelected } = usePageContextMenu({ 
 *   page,
 *   onCreateChild: handleCreateChild,
 *   onCreateTask: handleCreateTask,
 * });
 */
export function usePageContextMenu({ page, onCreateChild, onCreateTask, childCount = 0, onOpenInNewTab }: UsePageContextMenuOptions) {
  // Selection state
  const selectedIds = useSelectionStore((s) => s.selectedIds.page);
  const handleItemClick = useSelectionStore((s) => s.handleItemClick);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  
  // Delete confirmation
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  
  // Page store actions
  const { deletePage, updatePage } = usePagesStore(useShallow(selectPageActions));
  
  // Tab state
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const openTab = useTabsStore((s) => s.openTab);
  const navigate = useNavigate();
  
  // Effective selection (includes right-clicked page even if not selected)
  const effectiveSelection = useMemo(() => {
    const selection = new Set(selectedIds);
    selection.add(page.id);
    return Array.from(selection);
  }, [selectedIds, page.id]);
  
  const isMultiSelect = effectiveSelection.length > 1;
  const selectionCount = effectiveSelection.length;
  
  // Generate menu items via shared builder
  const menuItems = useMemo((): ContextMenuItem[] => {
    const hasChildren = !isMultiSelect && childCount > 0;

    return buildPageMenuItems({
      isMultiSelect,
      selectionCount,
      tabsEnabled,

      onOpenInNewTab: tabsEnabled ? () => {
        if (onOpenInNewTab) {
          onOpenInNewTab(page);
        } else {
          openTab({
            title: page.title,
            path: `/pages/${page.id}`,
            icon: page.icon,
            color: page.color,
            pageId: page.id,
            type: 'page',
          });
          navigate({ to: `/pages/${page.id}` });
        }
      } : undefined,

      onCreateChild: onCreateChild ? () => onCreateChild(page.id) : undefined,

      onCreateTask: (onCreateTask && page.viewMode === 'tasks') ? () => onCreateTask(page.id) : undefined,


      onMoveTo: () => {
        useUIStore.getState().openPageMovePicker(page.id, page.title || 'Untitled');
      },

      onExportMarkdown: async () => {
        try {
          await exportPageToMarkdown(page.id, page.title);
        } catch (error) {
          console.error('Export failed:', error);
        }
      },

      onExportCSV: page.viewMode === 'tasks' ? () => {
        try {
          exportTasksToCSV(page.id, page.title);
          toastSuccess('Tasks exported to CSV');
        } catch (error) {
          console.error('CSV export failed:', error);
          toastError('No tasks to export');
        }
      } : undefined,

      onDelete: () => {
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
  }, [
    isMultiSelect, selectionCount, childCount, tabsEnabled,
    effectiveSelection, deletePage, updatePage, clearSelection,
    onCreateChild, onCreateTask, onOpenInNewTab, openTab, navigate,
    page.id, page.title, page.icon, page.color, page.viewMode, requestDelete
  ]);
  
  // Click handler with selection support
  const handleClick = useCallback((e: React.MouseEvent) => {
    handleItemClick('page', page.id, {
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
    }, 'main-pages');
  }, [handleItemClick, page.id]);
  
  // Check if this page is selected
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
