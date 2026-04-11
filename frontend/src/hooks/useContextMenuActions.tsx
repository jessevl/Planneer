/**
 * @file useContextMenuActions.ts
 * @description Universal context menu actions hook
 * @app SHARED - Provides context-aware menu items for tasks, pages, and projects
 * 
 * Centralizes all context menu action definitions and their implementations.
 * Components use this hook to get the appropriate menu items based on:
 * - Entity type (task, note, task page)
 * - Selection state (single vs multi-select)
 * - Entity-specific state (e.g., completed tasks, daily notes)
 * 
 * Works with:
 * - selectionStore for multi-selection state
 * - ContextMenu UI component for rendering
 * - Entity stores (tasksStore, pagesStore) for actions
 */
import { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore, selectPageActions } from '@/stores/pagesStore';
import { useSelectionStore, type SelectableEntityType } from '@/stores/selectionStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { getTodayISO, parseDate } from '@/lib/dateUtils';
import type { ContextMenuItem } from '@/components/ui';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import {
  TrashIcon,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  FlagIcon,
  SettingsIcon,
  ArrowRightIcon,
} from '@/components/common/Icons';
import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ContextMenuContext {
  type: SelectableEntityType;
  /** The item that was right-clicked (may or may not be in selection) */
  targetId: string;
  /** Optional: provide entity data for more context-aware actions */
  targetData?: Task | Page;
  /** Custom additional items to append */
  additionalItems?: ContextMenuItem[];
}

// ============================================================================
// ICON COMPONENTS (wrapped for context menu)
// ============================================================================

const iconClass = "w-4 h-4";

const Icons = {
  delete: <TrashIcon className={iconClass} />,
  complete: <CheckIcon className={iconClass} />,
  calendar: <CalendarIcon className={iconClass} />,
  postpone: <ClockIcon className={iconClass} />,
  priority: <FlagIcon className={iconClass} />,
  properties: <SettingsIcon className={iconClass} />,  // kept for potential future use
  move: <ArrowRightIcon className={iconClass} />,
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useContextMenuActions(context: ContextMenuContext) {
  const { type, targetId, targetData, additionalItems } = context;
  
  // Selection state
  const { selectedIds, clearSelection } = useSelectionStore(
    useShallow((s) => ({
      selectedIds: s.selectedIds[type],
      clearSelection: s.clearSelection,
    }))
  );
  
  // Delete confirmation
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  
  // Ensure target is in selection (right-clicking an unselected item should add it)
  const effectiveSelection = useMemo(() => {
    const selection = new Set(selectedIds);
    selection.add(targetId);
    return Array.from(selection);
  }, [selectedIds, targetId]);
  
  const isMultiSelect = effectiveSelection.length > 1;
  const selectionCount = effectiveSelection.length;
  
  // Task store actions
  const { updateTask, deleteTask, toggleComplete } = useTasksStore(
    useShallow((s) => ({
      updateTask: s.updateTask,
      deleteTask: s.deleteTask,
      toggleComplete: s.toggleComplete,
    }))
  );
  const tasksById = useTasksStore((s) => s.tasksById);
  
  // Page store actions (handles both pages and task collections)
  const { deletePage, updatePage } = usePagesStore(useShallow(selectPageActions));
  const pagesById = usePagesStore((s) => s.pagesById);
  
  // ============================================================================
  // TASK ACTIONS
  // ============================================================================
  
  const taskActions = useMemo(() => {
    if (type !== 'task') return [];
    
    const items: ContextMenuItem[] = [];
    const tasks = effectiveSelection.map(id => tasksById[id]).filter(Boolean) as Task[];
    const allCompleted = tasks.every(t => t.completed);
    const anyCompleted = tasks.some(t => t.completed);
    const todayISO = getTodayISO();
    const tomorrowISO = getTomorrowISO();
    
    // Complete/Uncomplete
    items.push({
      id: 'toggle-complete',
      label: isMultiSelect
        ? allCompleted 
          ? `Mark ${selectionCount} incomplete`
          : `Complete ${selectionCount} tasks`
        : allCompleted
          ? 'Mark incomplete'
          : 'Complete',
      icon: Icons.complete,
      onClick: () => {
        effectiveSelection.forEach(id => toggleComplete(id));
        clearSelection(type);
      },
    });
    
    // Postpone to Today (if any have past due dates)
    const anyOverdue = tasks.some(t => t.dueDate && parseDate(t.dueDate).isBefore(parseDate(todayISO), 'day'));
    if (anyOverdue) {
      items.push({
        id: 'postpone-today',
        label: isMultiSelect ? `Move ${selectionCount} to today` : 'Move to today',
        icon: Icons.calendar,
        onClick: () => {
          effectiveSelection.forEach(id => updateTask(id, { dueDate: todayISO }));
          clearSelection(type);
        },
      });
    }
    
    // Postpone to Tomorrow
    items.push({
      id: 'postpone-tomorrow',
      label: isMultiSelect ? `Postpone ${selectionCount} to tomorrow` : 'Postpone to tomorrow',
      icon: Icons.postpone,
      onClick: () => {
        effectiveSelection.forEach(id => updateTask(id, { dueDate: tomorrowISO }));
        clearSelection(type);
      },
    });
    
    // Set Priority submenu items
    const priorityItems: ContextMenuItem[] = [
      {
        id: 'priority-high',
        label: 'High priority',
        icon: <FlagIcon className="w-4 h-4 text-red-500" />,
        onClick: () => {
          effectiveSelection.forEach(id => updateTask(id, { priority: 'High' }));
          clearSelection(type);
        },
      },
      {
        id: 'priority-medium',
        label: 'Medium priority',
        icon: <FlagIcon className="w-4 h-4 text-orange-500" />,
        onClick: () => {
          effectiveSelection.forEach(id => updateTask(id, { priority: 'Medium' }));
          clearSelection(type);
        },
      },
      {
        id: 'priority-low',
        label: 'Low priority',
        icon: <FlagIcon className="w-4 h-4 text-blue-500" />,
        onClick: () => {
          effectiveSelection.forEach(id => updateTask(id, { priority: 'Low' }));
          clearSelection(type);
        },
      },
      {
        id: 'priority-none',
        label: 'No priority',
        icon: <FlagIcon className="w-4 h-4 text-[var(--color-text-tertiary)]" />,
        onClick: () => {
          effectiveSelection.forEach(id => updateTask(id, { priority: undefined }));
          clearSelection(type);
        },
      },
    ];
    
    // Only show priority for single selection for now (submenu would need more complex UI)
    if (!isMultiSelect) {
      items.push({
        id: 'set-priority',
        label: 'Set priority...',
        icon: Icons.priority,
        onClick: () => {}, // This will be replaced with submenu in future
        disabled: true, // Placeholder - implement submenu later
      });
    }
    
    // Delete
    items.push({
      id: 'delete',
      label: isMultiSelect ? `Delete ${selectionCount} tasks` : 'Delete',
      icon: Icons.delete,
      variant: 'danger' as const,
      divider: items.length > 0,
      onClick: () => {
        requestDelete({
          itemType: 'task',
          count: selectionCount,
          onConfirm: () => {
            effectiveSelection.forEach(id => deleteTask(id));
            clearSelection(type);
          },
        });
      },
    });
    
    return items;
  }, [type, effectiveSelection, isMultiSelect, selectionCount, tasksById, toggleComplete, updateTask, deleteTask, clearSelection, targetId, requestDelete]);
  
  // ============================================================================
  // PAGE ACTIONS
  // ============================================================================
  
  const pageActions = useMemo(() => {
    if (type !== 'page') return [];
    
    const items: ContextMenuItem[] = [];
    const pages = effectiveSelection.map(id => pagesById[id]).filter(Boolean) as Page[];
    const hasDailyNotes = pages.some(n => n.isDailyNote);
    
    // Delete (but not daily notes - they can only be cleared, not deleted)
    if (!hasDailyNotes) {
      items.push({
        id: 'delete',
        label: isMultiSelect ? `Delete ${selectionCount} pages` : 'Delete',
        icon: Icons.delete,
        variant: 'danger' as const,
        divider: items.length > 0,
        onClick: () => {
          requestDelete({
            itemType: 'page',
            count: selectionCount,
            onConfirm: (cascade: boolean) => {
              effectiveSelection.forEach(id => {
                const page = pagesById[id];
                if (page && !page.isDailyNote) {
                  deletePage(id, cascade);
                }
              });
              clearSelection(type);
            },
          });
        },
      });
    }
    
    return items;
  }, [type, effectiveSelection, isMultiSelect, selectionCount, pagesById, deletePage, clearSelection, targetId, requestDelete]);
  
  // ============================================================================
  // COMBINE ITEMS
  // ============================================================================
  
  const menuItems = useMemo((): ContextMenuItem[] => {
    let items: ContextMenuItem[] = [];
    
    switch (type) {
      case 'task':
        items = taskActions;
        break;
      case 'page':
        items = pageActions;
        break;
    }
    
    // Append any additional custom items
    if (additionalItems?.length) {
      items = [...items, ...additionalItems];
    }
    
    return items;
  }, [type, taskActions, pageActions, additionalItems]);
  
  return {
    menuItems,
    effectiveSelection,
    isMultiSelect,
    selectionCount,
  };
}

// ============================================================================
// HELPER: Get tomorrow's date
// ============================================================================

function getTomorrowISO(): string {
  return parseDate(getTodayISO()).add(1, 'day').format('YYYY-MM-DD');
}
