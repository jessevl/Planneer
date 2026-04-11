/**
 * @file useTaskContextMenu.tsx
 * @description Task-specific context menu hook
 * @app TASKS APP ONLY - Provides context menu items for task rows
 * 
 * Returns menu items appropriate for single or multi-select task operations:
 * - Complete/Incomplete toggle
 * - Postpone to tomorrow
 * - Move to today (if overdue)
 * - Delete
 * 
 * Integrates with:
 * - selectionStore for multi-selection state
 * - tasksStore for task actions
 */
'use client';

import React, { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTasksStore } from '@/stores/tasksStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { getTodayISO, parseDate } from '@/lib/dateUtils';
import type { ContextMenuItem } from '@/components/ui';
import type { Task } from '@/types/task';
import {
  TrashIcon,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
} from '@/components/common/Icons';

const iconClass = "w-4 h-4";

interface UseTaskContextMenuOptions {
  /** The task that was right-clicked */
  task: Task;
}

/**
 * Hook to generate context menu items for tasks
 * 
 * @example
 * const { menuItems, handleClick } = useTaskContextMenu({ task });
 * return (
 *   <ContextMenu items={menuItems}>
 *     <TaskRowContent onClick={handleClick} />
 *   </ContextMenu>
 * );
 */
export function useTaskContextMenu({ task }: UseTaskContextMenuOptions) {
  // Selection state
  const selectedIds = useSelectionStore((s) => s.selectedIds.task);
  const handleItemClick = useSelectionStore((s) => s.handleItemClick);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  
  // Delete confirmation
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  
  // Task store actions
  const { updateTask, deleteTask, toggleComplete, tasksById } = useTasksStore(
    useShallow((s) => ({
      updateTask: s.updateTask,
      deleteTask: s.deleteTask,
      toggleComplete: s.toggleComplete,
      tasksById: s.tasksById,
    }))
  );
  
  // Effective selection (includes right-clicked task even if not selected)
  const effectiveSelection = useMemo(() => {
    const selection = new Set(selectedIds);
    selection.add(task.id);
    return Array.from(selection);
  }, [selectedIds, task.id]);
  
  const isMultiSelect = effectiveSelection.length > 1;
  const selectionCount = effectiveSelection.length;
  
  // Get all selected tasks for context-aware actions
  const selectedTasks = useMemo(() => 
    effectiveSelection.map(id => tasksById[id]).filter(Boolean) as Task[],
    [effectiveSelection, tasksById]
  );
  
  const todayISO = getTodayISO();
  const tomorrowISO = parseDate(todayISO).add(1, 'day').format('YYYY-MM-DD');
  
  // Check states across selection
  const allCompleted = selectedTasks.every(t => t.completed);
  const anyOverdue = selectedTasks.some(t => 
    t.dueDate && parseDate(t.dueDate).isBefore(parseDate(todayISO), 'day')
  );
  const anyFuture = selectedTasks.some(t => 
    t.dueDate && parseDate(t.dueDate).isAfter(parseDate(todayISO), 'day')
  );
  const anyNotToday = selectedTasks.some(t => 
    !t.dueDate || t.dueDate !== todayISO
  );
  
  // Generate menu items
  const menuItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    
    // Complete/Uncomplete — toggle tile
    items.push({
      id: 'toggle-complete',
      label: isMultiSelect
        ? allCompleted 
          ? `Mark ${selectionCount} incomplete`
          : `Complete ${selectionCount} tasks`
        : 'Completed',
      icon: <CheckIcon className={iconClass} />,
      toggled: allCompleted,
      onClick: () => {
        effectiveSelection.forEach(id => toggleComplete(id));
        clearSelection('task');
      },
    });
    
    // Move to Today (if any tasks are not scheduled for today - overdue, future, or no date)
    if (anyNotToday) {
      items.push({
        id: 'move-today',
        label: isMultiSelect ? `Move ${selectionCount} to today` : 'Move to today',
        icon: <CalendarIcon className={iconClass} />,
        onClick: () => {
          effectiveSelection.forEach(id => updateTask(id, { dueDate: todayISO }));
          clearSelection('task');
        },
      });
    }
    
    // Postpone to Tomorrow
    items.push({
      id: 'postpone-tomorrow',
      label: isMultiSelect ? `Postpone ${selectionCount} to tomorrow` : 'Postpone to tomorrow',
      icon: <ClockIcon className={iconClass} />,
      onClick: () => {
        effectiveSelection.forEach(id => updateTask(id, { dueDate: tomorrowISO }));
        clearSelection('task');
      },
    });
    
    // Delete
    items.push({
      id: 'delete',
      label: isMultiSelect ? `Delete ${selectionCount} tasks` : 'Delete',
      icon: <TrashIcon className={iconClass} />,
      variant: 'danger' as const,
      divider: true,
      onClick: () => {
        requestDelete({
          itemType: 'task',
          count: selectionCount,
          onConfirm: () => {
            effectiveSelection.forEach(id => deleteTask(id));
            clearSelection('task');
          },
        });
      },
    });
    
    return items;
  }, [
    isMultiSelect, allCompleted, anyOverdue, selectionCount,
    effectiveSelection, toggleComplete, updateTask, deleteTask,
    clearSelection, todayISO, tomorrowISO, requestDelete, anyNotToday
  ]);
  
  // Click handler with selection support
  const handleClick = useCallback((e: React.MouseEvent) => {
    handleItemClick('task', task.id, {
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
    }, 'main-tasks');
  }, [handleItemClick, task.id]);
  
  // Check if this task is selected
  const isSelected = selectedIds.has(task.id);
  
  return {
    menuItems,
    handleClick,
    isSelected,
    isMultiSelect,
    selectionCount,
    effectiveSelection,
  };
}
