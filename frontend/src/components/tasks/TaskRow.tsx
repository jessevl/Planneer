/**
 * @file TaskRow.tsx
 * @description Individual task row component with checkbox, badges, and context menu
 * @app TASKS - Used by TaskList and KanbanView
 * 
 * Renders a single task as a list item with:
 * - Completion checkbox with priority-colored border (TaskCheckbox)
 * - Task title (strikethrough when completed)
 * - Due date badge (red when overdue)
 * - Recurrence indicator (repeat icon for recurring tasks)
 * - Page badge with color indicator
 * - Subtask progress badge (e.g., "2/5")
 * - Drag handle for reordering
 * - Click to edit (opens modal via parent)
 * - Right-click context menu with task actions
 * - Multi-selection support (Cmd/Ctrl+Click, Shift+Click)
 * - Mobile: Swipe right to complete, swipe left to delete
 * 
 * Memoized for performance in long lists.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { parseDate, getToday, dayjs } from '../../lib/dateUtils';
import { setDragData } from '../../hooks/dragUtils';
import { useIsTouch } from '@frameer/hooks/useMobileDetection';
import { useLongPress } from '../../hooks/useLongPress';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import { Panel, DateBadge, PageBadge, TaskCheckbox, SubtaskBadge, ContextMenu, ContextMenuContent, TagBadge, Checkbox, Popover } from '@/components/ui';
import { RepeatIcon } from '@/components/common/Icons';
import { useSelectionStore } from '@/stores/selectionStore';
import { useTaskContextMenu } from '@/hooks/useTaskContextMenu';
import { cn } from '@/lib/design-system';

// Task collections are now Page type with viewMode='tasks'
type TaskCollection = Page;

export interface TaskRowProps {
  task: Task;
  todayISO?: string;
  dataDueDate?: string | undefined;
  onToggleComplete: (id: string) => void;
  onEditTask?: (id: string | null) => void;
  onDeleteTask?: (id: string) => void;
  taskPages: TaskCollection[];
  className?: string;
  /** Called when drag starts - notifies parent for cross-component drops */
  onDragStart?: (taskId: string) => void;
  /** Whether to enable multi-selection and context menu (default: true) */
  enableSelection?: boolean;
  /** Visual variant: 'row' (default) or 'card' (Kanban) */
  variant?: 'row' | 'card';
  /** Whether to show the parent page badge */
  showParentPage?: boolean;
}

const TaskRow: React.FC<TaskRowProps> = React.memo(({ 
  task, 
  todayISO, 
  dataDueDate, 
  onToggleComplete, 
  onEditTask,
  onDeleteTask,
  taskPages, 
  className, 
  onDragStart,
  enableSelection = true,
  variant = 'row',
  showParentPage = true,
}) => {
  // Use centralized date utilities
  const today = useMemo(() => todayISO ? parseDate(todayISO) : getToday(), [todayISO]);
  const onToggle = useCallback(() => onToggleComplete(task.id), [onToggleComplete, task.id]);
  const onEdit = useCallback(() => onEditTask?.(task.id), [onEditTask, task.id]);

  // Local drag state for visual feedback
  const [isDragging, setIsDragging] = useState(false);
  
  // Long press context menu state for mobile
  const [showMobileContextMenu, setShowMobileContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  // Track when menu just opened to prevent immediate close on touch end
  const menuJustOpenedRef = React.useRef(false);

  // Multi-selection and context menu
  const { menuItems, handleClick: handleSelectionClick, isSelected } = useTaskContextMenu({ task });
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const selectionMode = useSelectionStore((s) => s.selectionMode);

  // Touch detection
  const isTouch = useIsTouch();
  
  // Long press handler for mobile context menu
  const { longPressHandlers, isLongPressing } = useLongPress({
    onLongPress: (e) => {
      // Toggle selection on long press for mobile
      handleSelectionClick(e as any);
      
      // Also show haptic feedback if possible (optional, but good for UX)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    },
    onClick: (e) => {
      // Check if tap was on the checkbox - if so, don't open edit modal
      // The checkbox has its own onClick handler
      const target = e.target as HTMLElement;
      if (target.closest('button[role="checkbox"]')) {
        return; // Let the checkbox handle its own click
      }
      
      // If in selection mode, toggle selection on click
      if (selectionMode) {
        handleSelectionClick(e as any);
        return;
      }

      // Normal click - edit the task
      if (!('metaKey' in e) || (!e.metaKey && !e.ctrlKey && !e.shiftKey)) {
        onEdit();
      }
    },
    enabled: isTouch && enableSelection,
    duration: 500,
  });

  const isOverdue = task.dueDate && dayjs(task.dueDate).isBefore(today, 'day') && !task.completed;
  const pageInfo = taskPages.find(p => p.id === task.parentPageId);

  // Subtask progress calculation
  const subtaskProgress = useMemo(() => {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    return {
      total: task.subtasks.length,
      completed: task.subtasks.filter(st => st.completed).length,
    };
  }, [task.subtasks]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    setDragData(e, task.id, 'task');
    setIsDragging(true);
    onDragStart?.(task.id); // Notify parent for cross-component drops
  }, [task.id, onDragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle click - if modifier key is pressed, handle selection; otherwise edit
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    // Prevent mouse events on touch devices to avoid double-triggering with useLongPress
    if (isTouch) return;

    if (enableSelection && (selectionMode || e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      handleSelectionClick(e);
    } else {
      // Clear selection and edit
      if (enableSelection) {
        clearSelection('task');
      }
      onEdit();
    }
  }, [isTouch, enableSelection, selectionMode, handleSelectionClick, clearSelection, onEdit]);
  
  // Handle mobile context menu item click
  const handleMobileMenuItemClick = useCallback((item: typeof menuItems[0]) => {
    setShowMobileContextMenu(false);
    item.onClick();
  }, []);

  const rowContent = (
    <div className="relative rounded-xl">
      {/* Mobile context menu portal */}
      {showMobileContextMenu && isTouch && menuItems.length > 0 && (
        <>
          {/* Backdrop to close menu */}
          <div 
            className="fixed inset-0 z-[200]" 
            onPointerDown={() => {
              // Ignore if menu just opened (prevents close on touch end after long press)
              if (menuJustOpenedRef.current) return;
              setShowMobileContextMenu(false);
            }}
          />
          {/* Context menu */}
          <Popover
            style={{
              position: 'fixed',
              left: `${Math.min(contextMenuPosition.x, window.innerWidth - 220)}px`,
              top: `${Math.min(contextMenuPosition.y, window.innerHeight - (menuItems.length * 44 + 16))}px`,
            }}
            width="auto"
            padding="sm"
            className="min-w-[200px] animate-fade-in"
          >
            <ContextMenuContent
              items={menuItems}
              onItemClick={(item) => handleMobileMenuItemClick(item)}
            />
          </Popover>
        </>
      )}
      
      {/* Main content */}
      <div {...(isTouch ? longPressHandlers : {})}>
        <Panel 
          opacity="subtle" 
          hover={!isDragging && !isLongPressing}
          className={cn(
            'py-3 px-3 select-none transition-all duration-200 group relative list-item-hover',
            !className?.includes('rounded-') && 'rounded-xl',
            isDragging && 'opacity-50',
            isLongPressing && 'scale-[0.98] opacity-90',
            enableSelection && isSelected && 'ring-2 ring-[var(--color-accent-emphasis)] bg-[var(--color-accent-muted)]/50',
            className
          )}
        >
          {/* Selection Checkbox - Top Right */}
          {enableSelection && (selectionMode || isSelected) && (
            <div className="absolute top-2 right-2 z-10 animate-in fade-in zoom-in-95 duration-200">
              <Checkbox
                checked={isSelected}
                onChange={() => handleSelectionClick({} as any)}
                size="sm"
              />
            </div>
          )}
          {enableSelection && !selectionMode && !isSelected && !isTouch && (
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Checkbox
                checked={false}
                onChange={() => handleSelectionClick({} as any)}
                size="sm"
              />
            </div>
          )}

          <div 
            data-due={dataDueDate ? dayjs(dataDueDate).format('YYYY-MM-DD') : ''}
            data-task-id={task.id}
            draggable={!isTouch}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className="flex items-start gap-3"
          >
            <div className="flex flex-col items-center gap-2">
              <TaskCheckbox
                completed={task.completed}
                priority={task.priority}
                onChange={onToggle}
                size="md"
                className="mt-0.5 touch:min-w-[44px] touch:min-h-[44px] touch:flex touch:items-center touch:justify-center"
              />
            </div>
            <span
              className={cn(
                'flex-1 cursor-pointer min-h-[44px] touch:min-h-[48px]',
                task.completed ? 'line-through text-[var(--color-text-disabled)]' : 'text-[var(--color-text-primary)]'
              )}
              onClick={handleRowClick}
            >
              <div className="font-medium">{task.title}</div>
              {task.description && (
                <div className={`text-xs text-[var(--color-text-tertiary)] mt-1`}>{task.description}</div>
              )}
              
              {/* Subtask Progress Bar (Card variant only) */}
              {variant === 'card' && subtaskProgress && (
                <div className="mt-2 mb-1">
                  <div className="flex items-center justify-between text-[10px] font-medium text-[var(--color-text-tertiary)] mb-1">
                    <span>Progress</span>
                    <span>{Math.round((subtaskProgress.completed / subtaskProgress.total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--color-accent-emphasis)] transition-all duration-300"
                      style={{ width: `${(subtaskProgress.completed / subtaskProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Date, Recurrence, Tag, and Subtask badges */}
              <div className="mt-1 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {task.dueDate && <DateBadge date={task.dueDate} />}
                  {task.recurrence && (
                    <span title="Repeating task">
                      <RepeatIcon className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                    </span>
                  )}
                  {task.tag && <TagBadge tag={task.tag} compact />}
                  {variant === 'row' && subtaskProgress && (
                    <SubtaskBadge
                      total={subtaskProgress.total}
                      completed={subtaskProgress.completed}
                    />
                  )}
                </div>
                {showParentPage && task.parentPageId && (
                  <PageBadge
                    pageTitle={pageInfo?.title || ''}
                    pageColor={pageInfo?.color || undefined}
                    pageIcon={pageInfo?.icon}
                  />
                )}
              </div>
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );

  // Wrap with context menu if selection is enabled (desktop only - mobile uses long-press)
  if (enableSelection && menuItems.length > 0 && !isTouch) {
    return <ContextMenu items={menuItems}>{rowContent}</ContextMenu>;
  }

  return rowContent;
});
TaskRow.displayName = 'TaskRow';

export default TaskRow;
