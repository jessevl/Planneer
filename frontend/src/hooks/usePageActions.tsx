/**
 * @file usePageActions.tsx
 * @description Unified page action definitions for use across menus and contexts
 * @app SHARED - Single source of truth for all page actions
 *
 * Provides a set of action builders that return ContextMenuItem objects.
 * These can be used in:
 * - PageActionsMenu (header dropdown)
 * - Page context menus (right-click on page rows/cards)
 * - Sidebar context menus (right-click on sidebar tree items)
 * - FavoritesSection context menus
 *
 * Each action builder returns a ContextMenuItem or null (if not applicable).
 * Consumers filter and compose actions as needed for their context.
 */
'use client';

import React, { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';
import {
  Download, FolderInput, FilePlus, ListPlus, ExternalLink,
} from 'lucide-react';
import { usePagesStore, selectPageActions } from '@/stores/pagesStore';
import { useTasksStore } from '@/stores/tasksStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTabsStore } from '@/stores/tabsStore';
import { exportPageToMarkdown, exportTasksToCSV } from '@/lib/dataExport';
import { toastSuccess, toastError } from '@/components/ui';
import { TrashIcon } from '@/components/common/Icons';
import type { ContextMenuItem } from '@/components/ui';
import type { Page } from '@/types/page';

const iconClass = 'w-4 h-4';

// ============================================================================
// TYPES
// ============================================================================

export interface UsePageActionsOptions {
  page: Page;
  /** Override child count (otherwise computed from page.childCount) */
  childCount?: number;
  /** Override task count (otherwise computed from store) */
  taskCount?: number;
  /** Callback for creating a child page */
  onCreateChild?: (parentId: string) => void;
  /** Callback for creating a task in a task collection */
  onCreateTask?: (parentPageId: string) => void;
  /** Callback for opening the page in a new tab */
  onOpenInNewTab?: (page: Page) => void;
  /** Custom delete handler (bypasses default delete confirmation) */
  onDelete?: () => void;
}

export interface PageActions {
  /** Open page in a new tab (context menu only, requires tabs enabled) */
  openInNewTab: () => ContextMenuItem | null;
  /** Create a subpage under this page */
  createSubpage: () => ContextMenuItem | null;
  /** Create a task in this task collection */
  createTask: () => ContextMenuItem | null;
  /** Toggle show/hide subpages in sidebar */
  toggleSidebarChildren: () => ContextMenuItem;
  /** Export page to Markdown */
  exportMarkdown: () => ContextMenuItem;
  /** Export tasks to CSV (only for task pages with tasks) */
  exportCSV: () => ContextMenuItem | null;
  /** Delete page */
  delete: (opts?: { divider?: boolean }) => ContextMenuItem;

  /** Get all actions suitable for the header actions menu */
  forActionMenu: () => ContextMenuItem[];
  /** Get all actions suitable for a right-click context menu */
  forContextMenu: () => ContextMenuItem[];
}

// ============================================================================
// HOOK
// ============================================================================

export function usePageActions(options: UsePageActionsOptions): PageActions {
  const { page, onCreateChild, onCreateTask, onOpenInNewTab, onDelete } = options;

  // Store access
  const { updatePage, deletePage } = usePagesStore(useShallow(selectPageActions));
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const openTab = useTabsStore((s) => s.openTab);
  const navigate = useNavigate();

  // Compute counts
  const tasksById = useTasksStore((s) => s.tasksById);
  const computedTaskCount = useMemo(() => {
    return Object.values(tasksById).filter(t => t.parentPageId === page.id).length;
  }, [page.id, tasksById]);
  const taskCount = options.taskCount ?? computedTaskCount;
  const childCount = options.childCount ?? (page.childCount || 0);
  const totalChildren = childCount + taskCount;

  // ---- Action builders ----

  const openInNewTab = useCallback((): ContextMenuItem | null => {
    if (!tabsEnabled) return null;
    return {
      id: 'open-in-new-tab',
      label: 'Open in new tab',
      icon: <ExternalLink className={iconClass} />,
      onClick: () => {
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
      },
    };
  }, [tabsEnabled, page, onOpenInNewTab, openTab, navigate]);

  const createSubpage = useCallback((): ContextMenuItem | null => {
    if (!onCreateChild) return null;
    return {
      id: 'create-subpage',
      label: 'Create subpage',
      icon: <FilePlus className={iconClass} />,
      onClick: () => onCreateChild(page.id),
    };
  }, [onCreateChild, page.id]);

  const createTaskAction = useCallback((): ContextMenuItem | null => {
    if (!onCreateTask || page.viewMode !== 'tasks') return null;
    return {
      id: 'create-task',
      label: 'Create task',
      icon: <ListPlus className={iconClass} />,
      onClick: () => onCreateTask(page.id),
    };
  }, [onCreateTask, page.id, page.viewMode]);


  const toggleSidebarChildren = useCallback((): ContextMenuItem => {
    const currentShow = page.showChildrenInSidebar ?? (page.viewMode === 'note');
    return {
      id: 'toggle-sidebar-children',
      label: currentShow ? 'Hide subpages in sidebar' : 'Show subpages in sidebar',
      icon: <FolderInput className={iconClass} />,
      onClick: () => updatePage(page.id, { showChildrenInSidebar: !currentShow }),
    };
  }, [page.id, page.showChildrenInSidebar, page.viewMode, updatePage]);

  const exportMarkdown = useCallback((): ContextMenuItem => ({
    id: 'export-markdown',
    label: 'Export to Markdown',
    icon: <Download className={iconClass} />,
    onClick: async () => {
      try {
        await exportPageToMarkdown(page.id, page.title);
      } catch (error) {
        console.error('Export failed:', error);
      }
    },
  }), [page.id, page.title]);

  const exportCSV = useCallback((): ContextMenuItem | null => {
    if (taskCount === 0) return null;
    return {
      id: 'export-csv',
      label: 'Export to CSV',
      icon: <Download className={iconClass} />,
      onClick: () => {
        try {
          exportTasksToCSV(page.id, page.title);
          toastSuccess('Tasks exported to CSV');
        } catch (error) {
          console.error('CSV export failed:', error);
          toastError('No tasks to export');
        }
      },
    };
  }, [page.id, page.title, taskCount]);

  const deleteAction = useCallback((opts?: { divider?: boolean }): ContextMenuItem => ({
    id: 'delete',
    label: 'Delete',
    icon: <TrashIcon className={iconClass} />,
    variant: 'danger' as const,
    divider: opts?.divider ?? true,
    onClick: () => {
      if (onDelete) {
        onDelete();
      } else {
        requestDelete({
          itemType: 'page',
          count: 1,
          hasChildren: totalChildren > 0,
          childCount: totalChildren,
          onConfirm: (cascade: boolean) => {
            deletePage(page.id, cascade);
          },
        });
      }
    },
  }), [onDelete, page.id, totalChildren, requestDelete, deletePage]);

  // ---- Composed action sets ----

  const forActionMenu = useCallback((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    items.push(toggleSidebarChildren());
    items.push(exportMarkdown());
    const csv = exportCSV();
    if (csv) items.push(csv);
    items.push(deleteAction({ divider: true }));
    return items;
  }, [toggleSidebarChildren, exportMarkdown, exportCSV, deleteAction]);

  const forContextMenu = useCallback((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    const tab = openInNewTab();
    if (tab) items.push(tab);
    const sub = createSubpage();
    if (sub) items.push(sub);
    const task = createTaskAction();
    if (task) items.push(task);

    items.push(exportMarkdown());
    const csv = exportCSV();
    if (csv) items.push(csv);
    items.push(deleteAction({ divider: true }));
    return items;
  }, [openInNewTab, createSubpage, createTaskAction, exportMarkdown, exportCSV, deleteAction]);

  return useMemo(() => ({
    openInNewTab,
    createSubpage,
    createTask: createTaskAction,
    toggleSidebarChildren,
    exportMarkdown,
    exportCSV,
    delete: deleteAction,
    forActionMenu,
    forContextMenu,
  }), [
    openInNewTab, createSubpage, createTaskAction, toggleSidebarChildren,
    exportMarkdown, exportCSV, deleteAction, forActionMenu, forContextMenu,
  ]);
}
