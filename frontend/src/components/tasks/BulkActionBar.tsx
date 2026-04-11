/**
 * @file BulkActionBar.tsx
 * @description Floating action bar for bulk task operations
 * @app TASKS APP ONLY - Appears when multiple tasks are selected
 */
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore } from '@/stores/pagesStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { getTodayISO, parseDate } from '@/lib/dateUtils';
import { cn } from '@/lib/design-system';
import {
  TrashIcon,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  XIcon,
} from '@/components/common/Icons';
import { Panel, IconButton, TextSmall } from '@/components/ui';

export const BulkActionBar: React.FC = () => {
  const isMobile = useIsMobile();
  const selectedTaskIds = useSelectionStore((s) => s.selectedIds.task);
  const selectedPageIds = useSelectionStore((s) => s.selectedIds.page);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  
  const { updateTasks, deleteTasks, toggleCompleteTasks, tasksById } = useTasksStore(
    useShallow((s) => ({
      updateTasks: s.updateTasks,
      deleteTasks: s.deleteTasks,
      toggleCompleteTasks: s.toggleCompleteTasks,
      tasksById: s.tasksById,
    }))
  );

  const { deletePages } = usePagesStore(
    useShallow((s) => ({
      deletePages: s.deletePages,
    }))
  );

  const taskCount = selectedTaskIds.size;
  const pageCount = selectedPageIds.size;

  if (taskCount === 0 && pageCount === 0) return null;

  // Prioritize tasks if both are somehow selected, but usually it's one or the other
  const isTaskMode = taskCount > 0;
  const selectionCount = isTaskMode ? taskCount : pageCount;
  const selectionType = isTaskMode ? 'task' : 'page';

  const handleClear = () => {
    clearSelection(isTaskMode ? 'task' : 'page');
  };

  const handleDelete = () => {
    const idsArray = Array.from(isTaskMode ? selectedTaskIds : selectedPageIds);
    requestDelete({
      itemType: isTaskMode ? 'task' : 'page',
      count: selectionCount,
      onConfirm: () => {
        if (isTaskMode) {
          deleteTasks(idsArray);
        } else {
          deletePages(idsArray);
        }
        handleClear();
      },
    });
  };

  // Task-specific handlers
  const selectedTaskIdsArray = Array.from(selectedTaskIds);
  const selectedTasks = selectedTaskIdsArray.map(id => tasksById[id]).filter(Boolean);
  const todayISO = getTodayISO();
  const tomorrowISO = parseDate(todayISO).add(1, 'day').format('YYYY-MM-DD');
  const allCompleted = selectedTasks.length > 0 && selectedTasks.every(t => t.completed);

  const handleToggleComplete = () => {
    toggleCompleteTasks(selectedTaskIdsArray);
    clearSelection('task');
  };

  const handleMoveToday = () => {
    updateTasks(selectedTaskIdsArray, { dueDate: todayISO });
    clearSelection('task');
  };

  const handlePostponeTomorrow = () => {
    updateTasks(selectedTaskIdsArray, { dueDate: tomorrowISO });
    clearSelection('task');
  };

  return (
    <div 
      className="fixed md:bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4"
      style={{ 
        bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 4.75rem)' : undefined 
      }}
    >
      <div className="animate-fade-in animate-slide-up">
        <Panel 
          padding="none"
          shadow="lg"
          glass
          className="flex items-center justify-between gap-2 p-2 pr-4 rounded-full border border-white/20 dark:border-[var(--color-border-default)] bg-white/80 dark:bg-[var(--color-surface-base)]/80"
        >
        <div className="flex items-center gap-3 pl-2">
          <IconButton 
            onClick={handleClear}
            variant="ghost"
            size="sm"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <XIcon className="w-4 h-4" />
          </IconButton>
          <div className="flex flex-col">
            <TextSmall className="font-bold leading-none">
              {selectionCount} {isTaskMode ? 'tasks' : 'pages'} selected
            </TextSmall>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isTaskMode && (
            <>
              <IconButton
                onClick={handleToggleComplete}
                variant="ghost"
                title={allCompleted ? "Mark incomplete" : "Complete tasks"}
                className="text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)]"
              >
                <CheckIcon className="w-5 h-5" />
              </IconButton>
              <IconButton
                onClick={handleMoveToday}
                variant="ghost"
                title="Move to today"
                className="text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              >
                <CalendarIcon className="w-5 h-5" />
              </IconButton>
              <IconButton
                onClick={handlePostponeTomorrow}
                variant="ghost"
                title="Postpone to tomorrow"
                className="text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <ClockIcon className="w-5 h-5" />
              </IconButton>
              <div className="w-px h-6 bg-[var(--color-border-default)] mx-1" />
            </>
          )}
          
          <IconButton
            onClick={handleDelete}
            variant="ghost"
            title={isTaskMode ? "Delete tasks" : "Delete pages"}
            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <TrashIcon className="w-5 h-5" />
          </IconButton>
        </div>
        </Panel>
      </div>
    </div>
  );
};
