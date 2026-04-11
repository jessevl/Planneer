/**
 * @file KanbanView.tsx
 * @description Kanban board view for tasks
 * @app TASKS - Alternative display mode for task lists
 * 
 * Displays tasks in a horizontal kanban board layout with columns
 * based on the selected groupBy option (date, priority, task page, section).
 * 
 * Features:
 * - Drag-and-drop between columns to update task properties
 * - Column headers with task counts and date subtitles
 * - Uses useDragAndDrop hook for drag state management
 * - Mobile: Horizontal scroll with snap-to-column
 * - Mobile: Touch-friendly column navigation
 * 
 * Alternative to TaskList which shows tasks in a vertical list format.
 * Toggle between the two via ViewLayoutToggle in ViewHeader.
 */
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import TaskRow from './TaskRow';
import type { Task } from './TaskList';
import { parseDate, getToday, dayjs } from '../../lib/dateUtils';
import type { GroupBy } from '../layout/ViewSwitcher';
import type { Page } from '@/types/page';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { groupTasksBy, sortTasksWithinGroups, type TaskSortBy, type TaskSortDirection } from '../../lib/selectors';
import { DATE_GROUPS, getDateGroupSubtitle, type DateGroupKey } from '../../lib/dateGroups';
import { Panel, SectionHeader } from '../ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { getTagColor } from '@/lib/tagUtils';
import { cn } from '@/lib/design-system';

// Task collections are now Page type with viewMode='tasks'
type TaskCollection = Page;

interface KanbanViewProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  groupBy: GroupBy;
  todayDate?: string;
  onEditTask?: (id: string | null) => void;
  taskPages?: TaskCollection[];
  onTaskDrop?: (taskId: string, targetGroup: string, groupBy: GroupBy) => void;
  /** Callback to add a task directly to a specific group (date, section, tag, etc.) */
  onAddTaskToGroup?: (groupKey: string, groupBy: GroupBy) => void;
  // Sort options (within groups)
  sortBy?: TaskSortBy;
  sortDirection?: TaskSortDirection;
  /** Whether to show the parent page badge on task cards */
  showParentPage?: boolean;
  /** Restrict rendered groups and preserve the provided order */
  visibleGroupKeys?: string[];
  /** Maximum number of tasks to render per group */
  maxTasksPerGroup?: number;
  /** Optional footer renderer shown beneath a group's visible tasks */
  renderGroupFooter?: (args: {
    groupKey: string;
    totalCount: number;
    visibleCount: number;
    hiddenCount: number;
  }) => React.ReactNode;
  /** Embedded mode disables page-level horizontal padding for nested layouts */
  embedded?: boolean;
}

const KanbanView: React.FC<KanbanViewProps> = ({
  tasks,
  onToggleComplete,
  groupBy,
  todayDate,
  onEditTask,
  taskPages = [],
  onTaskDrop,
  onAddTaskToGroup,
  sortBy = 'date',
  sortDirection = 'asc',
  showParentPage = true,
  visibleGroupKeys,
  maxTasksPerGroup,
  renderGroupFooter,
  embedded = false,
}) => {
  // Mobile detection
  const isMobile = useIsMobile();
  
  // Scroll container ref for mobile column navigation
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  
  // Use centralized date utilities
  const today = todayDate ? parseDate(todayDate) : getToday();
  const { draggedItem, dragOverGroup, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave } = useDragAndDrop();

  // Group tasks using shared utility
  const groupedTasks = useMemo(() => {
    const groups = groupTasksBy(tasks, groupBy, today, taskPages);
    // Apply sorting within each group
    return sortTasksWithinGroups(groups, sortBy, sortDirection);
  }, [tasks, groupBy, today, taskPages, sortBy, sortDirection]);

  // Note: Tasks are already sorted within groups via sortTasksWithinGroups

  // For section groupBy, show all sections (even empty)
  // For other groupBy modes, filter out empty groups
  const groupOrder = useMemo(() => {
    if (visibleGroupKeys && visibleGroupKeys.length > 0) {
      return visibleGroupKeys.filter((key) => groupedTasks[key]);
    }

    return Object.keys(groupedTasks).filter((key) => {
      if (groupBy === 'section') return true;
      return groupedTasks[key].tasks.length > 0;
    });
  }, [groupBy, groupedTasks, visibleGroupKeys]);

  // Mobile: Handle scroll snap detection to update active column indicator
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    setIsScrolling(true);
    scrollTimeoutRef.current = window.setTimeout(() => setIsScrolling(false), 700);

    if (!isMobile) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;

    // On mobile, columns are 85vw wide + 16px gap
    const columnWidth = window.innerWidth * 0.85 + 16;
    const newIndex = Math.round(scrollLeft / columnWidth);
    setActiveColumnIndex(Math.max(0, Math.min(newIndex, groupOrder.length - 1)));
  }, [isMobile, groupOrder.length]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Mobile: Navigate to specific column
  const scrollToColumn = useCallback((index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    
    // On mobile, columns are 85vw wide + 16px gap
    const columnWidth = window.innerWidth * 0.85 + 16;
    container.scrollTo({
      left: columnWidth * index,
      behavior: 'smooth',
    });
    setActiveColumnIndex(index);
  }, []);

  return (
    <div className="relative flex flex-col w-full overflow-x-clip">
      {/* Mobile: Column indicator dots */}
      {isMobile && !embedded && groupOrder.length > 1 && (
        <div className="flex justify-center gap-2 pb-3 px-6">
          {groupOrder.map((key, index) => (
            <button
              key={key}
              onClick={() => scrollToColumn(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === activeColumnIndex
                  ? 'bg-[var(--color-accent-primary)] w-4'
                  : 'bg-[var(--color-border-default)]'
              }`}
              aria-label={`Go to ${groupedTasks[key].label}`}
            />
          ))}
        </div>
      )}
      
      {/* Kanban columns container */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          embedded
            ? 'grid grid-cols-1 gap-4 md:grid-cols-3'
            : 'flex gap-4 overflow-x-auto py-4 scroll-smooth scrollbar-auto-hide',
          isScrolling && "is-scrolling",
          !embedded && isMobile ? 'snap-x snap-mandatory px-6' : ''
        )}
        style={!isMobile && !embedded ? {
          paddingLeft: 'max(1.5rem, calc((100% - 64rem) / 2 + 1.5rem))',
          paddingRight: 'max(1.5rem, calc((100% - 64rem) / 2 + 1.5rem))',
        } : undefined}
      >
        {groupOrder.map((groupKey) => {
            const group = groupedTasks[groupKey];
            const visibleTasks = typeof maxTasksPerGroup === 'number'
              ? group.tasks.slice(0, maxTasksPerGroup)
              : group.tasks;
            const hiddenCount = Math.max(0, group.tasks.length - visibleTasks.length);
            
            // Get tint color for tag or section-based columns
            let tintColor: string | undefined;
            if (groupBy === 'tag' && groupKey !== 'none' && groupKey !== 'untagged') {
              const tagColors = getTagColor(groupKey);
              // Extract hex from Tailwind class (e.g., 'bg-blue-500' -> '#3b82f6')
              // For now, use the group.color if available
              tintColor = group.color;
            } else if (group.color) {
              // For sections or other colored groups
              tintColor = group.color;
            }
            
            return (
              <Panel
                key={groupKey}
                tintColor={tintColor}
                tintMode="border"
                padding="md"
                shadow="none"
                isHighlighted={dragOverGroup === groupKey}
                className={`flex-shrink-0 transition-all duration-200 ${
                  embedded
                    ? 'min-w-0'
                    : isMobile 
                    ? 'w-[85vw] snap-center min-h-[400px]' 
                    : 'w-80'
                } ${
                  dragOverGroup === groupKey 
                    ? 'scale-[1.02]' 
                    : ''
                }`}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedItem && onTaskDrop) {
                    onTaskDrop(draggedItem, groupKey, groupBy);
                  }
                  handleDragEnd();
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  handleDragOver(groupKey);
                }}
                onDragLeave={handleDragLeave}
              >
                <SectionHeader
                  label={group.label}
                  subtitle={groupBy === 'date' ? getDateGroupSubtitle(groupKey as DateGroupKey, today) ?? undefined : undefined}
                  color={group.color}
                  count={group.tasks.length}
                  onAdd={onAddTaskToGroup ? () => onAddTaskToGroup(groupKey, groupBy) : undefined}
                  className="!mb-4"
                />
                <ul className="space-y-2">
                  {visibleTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      dataDueDate={task.dueDate}
                      todayISO={todayDate}
                      onToggleComplete={onToggleComplete}
                      onEditTask={onEditTask}
                      taskPages={taskPages}
                      onDragStart={handleDragStart}
                      variant="card"
                      showParentPage={showParentPage}
                    />
                  ))}
                  
                  {/* Drop target for empty groups */}
                  {group.tasks.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-[var(--color-border-secondary)] rounded-lg flex items-center justify-center text-xs text-[var(--color-text-tertiary)]">
                      No tasks
                    </div>
                  )}
                </ul>
                {renderGroupFooter ? renderGroupFooter({
                  groupKey,
                  totalCount: group.tasks.length,
                  visibleCount: visibleTasks.length,
                  hiddenCount,
                }) : null}
              </Panel>
            );
          })}
      </div>
    </div>
  );
};

export default KanbanView;
