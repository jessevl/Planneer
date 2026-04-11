/**
 * @file CompactTaskRow.tsx
 * @description Lightweight task row for dashboards and summaries
 * @app SHARED - Used by HomeView and other summary views
 * 
 * A simplified task row component that displays:
 * - Completion checkbox with priority-colored border (TaskCheckbox)
 * - Task title with description preview
 * - Due date, page, tag, and subtask badges
 * - Subtask progress badge (e.g., "2/5")
 * - Standard due date pill matching TaskRow
 * - Context menu support with multi-selection
 * 
 * Features:
 * - Drag-and-drop to sidebar pages to reassign tasks
 * - Click to edit (via onClick callback)
 * - Compact display optimized for dashboards
 * - Right-click context menu for quick actions
 * - Multi-selection with Cmd/Ctrl+Click
 * 
 * Used by:
 * - HomeView (Today's Tasks section and daily journal)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setDragData } from '../../hooks/dragUtils';
import { Panel, TaskCheckbox, PageBadge, SubtaskBadge, ContextMenu, Checkbox, DateBadge, TagBadge } from '@/components/ui';
import { RepeatIcon } from '@/components/common/Icons';
import { useTaskContextMenu } from '@/hooks/useTaskContextMenu';
import { useSelectionStore } from '@/stores/selectionStore';
import { cn } from '@/lib/design-system';
import { useIsTouch } from '@frameer/hooks/useMobileDetection';
import { useLongPress } from '@/hooks/useLongPress';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';

// Task collections are now Page type with viewMode='tasks'
type TaskCollection = Page;

export interface CompactTaskRowProps {
  /** The task to display */
  task: Task;
  /** Today's date in ISO format (for overdue calculation) */
  todayISO: string;
  /** Called when the completion checkbox is toggled */
  onToggleComplete: (taskId: string) => void;
  /** Task collections (pages with viewMode='tasks') for looking up task page names */
  taskPages?: TaskCollection[];
  /** Optional click handler for the entire row */
  onClick?: (taskId: string) => void;
  /** Whether to show the due date badge */
  showDueDateBadge?: boolean;
  /** Whether to show the task page badge */
  showPage?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional className */
  className?: string;
  /** Whether to enable multi-selection (default: true) */
  enableSelection?: boolean;
}

/**
 * CompactTaskRow - A lightweight task row for dashboards
 * 
 * @example
 * <CompactTaskRow
 *   task={task}
 *   todayISO={todayISO}
 *   taskPages={taskPages}
 *   onToggleComplete={handleToggle}
 *   showDueDateBadge
 * />
 */
const CompactTaskRow: React.FC<CompactTaskRowProps> = React.memo(({
  task,
  todayISO,
  onToggleComplete,
  taskPages = [],
  onClick,
  showDueDateBadge = true,
  showPage = true,
  size = 'md',
  className,
  enableSelection = true,
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Multi-selection and context menu
  const { menuItems, handleClick: handleSelectionClick, isSelected } = useTaskContextMenu({ task });
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const selectionMode = useSelectionStore((s) => s.selectionMode);

  // Touch detection
  const isTouch = useIsTouch();

  // Long press handler for mobile selection
  const { longPressHandlers, isLongPressing } = useLongPress({
    onLongPress: (e) => {
      handleSelectionClick(e as any);
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    },
    onClick: (e) => {
      // If in selection mode, toggle selection on click
      if (selectionMode) {
        handleSelectionClick(e as any);
        return;
      }
      
      // Normal click
      onClick?.(task.id);
    },
    enabled: isTouch && enableSelection,
    duration: 500,
  });

  // Get task page info
  const pageInfo = useMemo(() => {
    const taskPageId = task.parentPageId;
    if (!showPage || !taskPageId) return null;
    return taskPages.find(p => p.id === taskPageId);
  }, [showPage, task.parentPageId, taskPages]);

  const displayPageTitle = useMemo(() => {
    if (!pageInfo?.title) return null;

    const maxCombinedChars = size === 'sm' ? 44 : 58;
    const taskLength = task.title.trim().length;
    const pageTitle = pageInfo.title.trim();
    const availablePageChars = Math.max(4, Math.min(pageTitle.length, maxCombinedChars - taskLength));

    if (pageTitle.length <= availablePageChars) {
      return pageTitle;
    }

    return `${pageTitle.slice(0, availablePageChars).trimEnd()}...`;
  }, [pageInfo?.title, size, task.title]);

  // Subtask progress calculation
  const subtaskProgress = useMemo(() => {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    return {
      total: task.subtasks.length,
      completed: task.subtasks.filter(st => st.completed).length,
    };
  }, [task.subtasks]);

  // Handlers
  const handleToggle = useCallback(() => {
    onToggleComplete(task.id);
  }, [onToggleComplete, task.id]);

  const handleRowClick = useCallback((e: React.MouseEvent) => {
    // Prevent mouse events on touch devices to avoid double-triggering with useLongPress
    if (isTouch) return;

    // Handle multi-selection with modifier keys or selection mode
    if (enableSelection && (selectionMode || e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      handleSelectionClick(e);
      return;
    }
    
    // Clear selection and call onClick
    if (enableSelection) {
      clearSelection('task');
    }
    onClick?.(task.id);
  }, [isTouch, enableSelection, selectionMode, handleSelectionClick, clearSelection, onClick, task.id]);

  // Size-based styles
  const sizeStyles = size === 'sm' ? {
    panel: 'py-2 px-3',
    rounded: 'rounded-lg',
    checkboxSize: 'sm' as const,
    text: 'text-sm',
    gap: 'gap-2.5',
    description: 'line-clamp-1 text-xs text-[var(--color-text-secondary)]',
    pageBadge: 'min-w-0 max-w-[112px] lg:max-w-[128px] xl:max-w-[144px]',
  } : {
    panel: 'py-3 px-4',
    rounded: 'rounded-xl',
    checkboxSize: 'md' as const,
    text: 'text-sm',
    gap: 'gap-3',
    description: 'line-clamp-1 text-xs text-[var(--color-text-secondary)]',
    pageBadge: 'min-w-0 max-w-[150px] sm:max-w-[170px] md:max-w-[190px]',
  };

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [rowWidth, setRowWidth] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setRowWidth(entry.contentRect.width);
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const shouldShowDescription = useMemo(() => {
    if (!task.description) return false;
    return size === 'sm' ? rowWidth >= 540 : rowWidth >= 680;
  }, [rowWidth, size, task.description]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    setDragData(e, task.id, 'task');
    setIsDragging(true);
  }, [task.id]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const rowContent = (
    <Panel
      opacity="subtle"
      hover={!isDragging && !isLongPressing}
      className={cn(
        'group relative w-full min-w-0 select-none transition-all duration-200 list-item-hover',
        'border border-[var(--color-border-default)] bg-[var(--color-surface-base)]',
        sizeStyles.panel,
        !className?.includes('rounded-') && sizeStyles.rounded,
        onClick && 'cursor-pointer',
        isDragging && 'opacity-50',
        isLongPressing && 'scale-[0.98] opacity-90',
        enableSelection && isSelected && 'ring-2 ring-[var(--color-interactive-ring)] bg-[var(--color-interactive-bg)]/50',
        className,
      )}
      onClick={onClick ? handleRowClick : undefined}
      {...(isTouch ? longPressHandlers : {})}
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
        ref={contentRef}
        className={`flex w-full min-w-0 items-start ${sizeStyles.gap}`}
        draggable={!isTouch}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col items-center gap-1.5">
          <TaskCheckbox
            completed={task.completed}
            priority={task.priority}
            onChange={handleToggle}
            size={sizeStyles.checkboxSize}
            className="mt-0.5"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <div className="min-w-0 overflow-hidden">
            <span className={`${sizeStyles.text} block min-w-0 break-words pr-7 leading-5 ${
              task.completed
                ? 'text-[var(--color-text-secondary)] line-through'
                : 'text-[var(--color-text-primary)]'
            }`}>
              {task.title}
            </span>
            {shouldShowDescription && (
              <span className={`mt-0.5 block min-w-0 ${sizeStyles.description}`}>
                {task.description}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">
            {showDueDateBadge && task.dueDate && (
              <DateBadge date={task.dueDate} />
            )}

            {task.recurrence && (
              <span title="Repeating task" className="flex-shrink-0">
                <RepeatIcon className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
              </span>
            )}

            {task.tag && (
              <TagBadge tag={task.tag} compact />
            )}

            {subtaskProgress && (
              <SubtaskBadge
                total={subtaskProgress.total}
                completed={subtaskProgress.completed}
              />
            )}

            {pageInfo && (
              <PageBadge
                pageTitle={displayPageTitle || pageInfo.title}
                pageColor={pageInfo.color || undefined}
                pageIcon={pageInfo.icon}
                className={sizeStyles.pageBadge}
              />
            )}
          </div>
        </div>
    </div>
    </Panel>
  );

  // Wrap with ContextMenu if enabled
  return menuItems.length > 0 ? (
    <ContextMenu items={menuItems}>
      {rowContent}
    </ContextMenu>
  ) : (
    rowContent
  );
});

CompactTaskRow.displayName = 'CompactTaskRow';

export default CompactTaskRow;
