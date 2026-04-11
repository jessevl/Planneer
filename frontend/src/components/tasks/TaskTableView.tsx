/**
 * @file TaskTableView.tsx
 * @description Table view for tasks using unified DataTable component
 * @app TASKS - Alternative display mode for task lists (table format)
 * 
 * Provides task-specific column definitions and grouping logic,
 * delegating rendering to the reusable DataTable component.
 */
import React, { useMemo, useCallback } from 'react';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import type { GroupBy } from '@/types/view';
import { DataTable, type DataTableColumn, type DataTableGroup } from '@frameer/components/ui/DataTable';
import { parseDate, getToday } from '@/lib/dateUtils';
import { groupTasksBy, sortTasksWithinGroups, type TaskSortBy, type TaskSortDirection } from '@/lib/selectors';
import { TaskCheckbox, DateBadge, PageBadge, TagBadge, SubtaskBadge } from '@/components/ui';
import { RepeatIcon } from '@/components/common/Icons';
import { cn } from '@/lib/design-system';
import { useTaskContextMenu } from '@/hooks/useTaskContextMenu';
import { useSelectionStore } from '@/stores/selectionStore';

type TaskCollection = Page;

interface TaskTableViewProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  groupBy: GroupBy;
  todayDate?: string;
  onEditTask?: (id: string | null) => void;
  taskPages?: TaskCollection[];
  onTaskDrop?: (taskId: string, targetGroup: string, groupBy: GroupBy) => void;
  onAddTaskToGroup?: (groupKey: string, groupBy: GroupBy) => void;
  sortBy?: TaskSortBy;
  sortDirection?: TaskSortDirection;
  showParentPage?: boolean;
}

// Priority badge colors
const priorityColors: Record<string, string> = {
  High: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  Medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  Low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

const TaskTableView: React.FC<TaskTableViewProps> = ({
  tasks,
  onToggleComplete,
  groupBy,
  todayDate,
  onEditTask,
  taskPages = [],
  onAddTaskToGroup,
  sortBy = 'date',
  sortDirection = 'asc',
  showParentPage = true,
}) => {
  const today = todayDate ? parseDate(todayDate) : getToday();
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const selectedIds = useSelectionStore((s) => s.selectedIds.task);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);

  // Build columns based on showParentPage
  const columns = useMemo((): DataTableColumn<Task>[] => {
    const cols: DataTableColumn<Task>[] = [
      {
        id: 'checkbox',
        label: '',
        width: '40px',
        align: 'center',
        render: (task) => (
          <div onClick={(e) => e.stopPropagation()}>
            <TaskCheckbox
              completed={task.completed}
              priority={task.priority}
              onChange={() => onToggleComplete(task.id)}
              size="sm"
            />
          </div>
        ),
      },
      {
        id: 'title',
        label: 'Title',
        width: 'minmax(200px, 1fr)',
        render: (task) => (
          <div className="flex items-center min-w-0">
            <span className={cn(
              'truncate text-sm',
              task.completed ? 'line-through text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'
            )}>
              {task.title}
            </span>
            {task.recurrence && (
              <RepeatIcon className="w-3 h-3 ml-2 text-[var(--color-text-secondary)] flex-shrink-0" />
            )}
          </div>
        ),
      },
      {
        id: 'dueDate',
        label: 'Due Date',
        width: '120px',
        render: (task) => task.dueDate ? (
          <DateBadge date={task.dueDate} />
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">—</span>
        ),
      },
      {
        id: 'priority',
        label: 'Priority',
        width: '90px',
        align: 'center',
        render: (task) => task.priority ? (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            priorityColors[task.priority] || 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
          )}>
            {task.priority}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">—</span>
        ),
      },
      {
        id: 'tag',
        label: 'Tag',
        width: '110px',
        render: (task) => task.tag ? (
          <TagBadge tag={task.tag} compact />
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">—</span>
        ),
      },
      {
        id: 'subtasks',
        label: 'Progress',
        width: '90px',
        align: 'center',
        render: (task) => {
          if (!task.subtasks || task.subtasks.length === 0) {
            return <span className="text-xs text-[var(--color-text-secondary)]">—</span>;
          }
          const completed = task.subtasks.filter(st => st.completed).length;
          return <SubtaskBadge total={task.subtasks.length} completed={completed} />;
        },
      },
    ];

    // Add parent page column if needed
    if (showParentPage) {
      cols.push({
        id: 'parentPage',
        label: 'Page',
        width: '140px',
        render: (task) => {
          const pageInfo = taskPages.find(p => p.id === task.parentPageId);
          if (task.parentPageId && pageInfo) {
            return (
              <PageBadge
                pageTitle={pageInfo.title}
                pageColor={pageInfo.color || undefined}
                pageIcon={pageInfo.icon}
              />
            );
          }
          return <span className="text-xs text-[var(--color-text-secondary)]">Inbox</span>;
        },
      });
    }

    return cols;
  }, [showParentPage, taskPages, onToggleComplete]);

  // Handle row click
  const handleRowClick = useCallback((task: Task, event: React.MouseEvent) => {
    if (selectionMode || event.metaKey || event.ctrlKey || event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      toggleSelect('task', task.id);
    } else {
      clearSelection('task');
      onEditTask?.(task.id);
    }
  }, [selectionMode, toggleSelect, clearSelection, onEditTask]);

  // Check if task is selected
  const isSelected = useCallback((task: Task) => selectedIds.has(task.id), [selectedIds]);
  
  // Check if task is muted (completed)
  const isMuted = useCallback((task: Task) => task.completed, []);

  // Handle add to group
  const handleAddToGroup = useCallback((groupKey: string) => {
    onAddTaskToGroup?.(groupKey, groupBy);
  }, [onAddTaskToGroup, groupBy]);

  // No grouping - just sort and display
  // Grouped view
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return {};
    const groups = groupTasksBy(tasks, groupBy, today, taskPages);
    return sortTasksWithinGroups(groups, sortBy, sortDirection);
  }, [tasks, groupBy, today, taskPages, sortBy, sortDirection]);

  // Convert to DataTable groups format
  const tableGroups = useMemo((): DataTableGroup<Task>[] => {
    if (groupBy === 'none') return [];
    return Object.entries(groupedTasks)
      .filter(([, group]) => group.tasks.length > 0)
      .map(([key, group]) => ({
        key,
        label: group.label,
        items: group.tasks,
        color: group.color,
      }));
  }, [groupedTasks, groupBy]);

  if (groupBy === 'none') {
    const sortedTasks = [...tasks].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          const aDate = a.dueDate || '9999-12-31';
          const bDate = b.dueDate || '9999-12-31';
          comparison = aDate.localeCompare(bDate);
          break;
        case 'priority':
          const priorityOrder = { High: 0, Medium: 1, Low: 2 };
          const aPri = a.priority ? priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3 : 3;
          const bPri = b.priority ? priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3 : 3;
          comparison = aPri - bPri;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'created':
          comparison = (a.created || '').localeCompare(b.created || '');
          break;
        case 'tag':
          comparison = (a.tag || '').localeCompare(b.tag || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return (
      <DataTable
        columns={columns}
        items={sortedTasks}
        getKey={(task) => task.id}
        onRowClick={handleRowClick}
        isSelected={isSelected}
        isMuted={isMuted}
        emptyMessage="No tasks"
        maxWidth="100%"
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      items={[]}
      groups={tableGroups}
      getKey={(task) => task.id}
      onRowClick={handleRowClick}
      isSelected={isSelected}
      isMuted={isMuted}
      onAddToGroup={onAddTaskToGroup ? handleAddToGroup : undefined}
      emptyMessage="No tasks"
      maxWidth="100%"
    />
  );
};

export default TaskTableView;
