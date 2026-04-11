/**
 * @file TaskList.tsx
 * @description Vertical list view for tasks with grouping support
 * @app TASKS - Primary task display component
 * 
 * Displays tasks in a grouped vertical list. This is the main task display
 * component used across all task views (All, Inbox, Today, Upcoming, Page).
 * 
 * Features:
 * - Grouping by date, priority, task page, or section
 * - Collapsible group headers with counts
 * - Drag-and-drop to change task properties (date, priority, etc.)
 * - Integration with the upcoming timeline for highlighted date
 * 
 * Exports the Task type for use by other task components.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import TaskRow from './TaskRow';
import { getToday, parseDate, dayjs } from '../../lib/dateUtils';
import type { Dayjs } from 'dayjs';
import type { View, TaskSortBy, TaskSortDirection } from '../../lib/selectors';
import { groupTasksBy, sortTasksWithinGroups } from '../../lib/selectors';
import type { GroupBy } from '../layout/ViewSwitcher';
import type { Page } from '@/types/page';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { DATE_GROUPS, getDateGroupSubtitle, type DateGroupKey } from '../../lib/dateGroups';
import { SectionHeader, SmartEmptyState } from '@/components/ui';
import { Plus } from 'lucide-react';

// Task collections are now Page type with viewMode='tasks'
type TaskCollection = Page;

export type { Task } from '../../types/task';
import type { Task } from '../../types/task';

export interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  todayDate?: string;
  // which view we're rendering in
  view: View;
  // click to edit (opens modal)
  onEditTask?: (id: string | null) => void;
  taskPages?: TaskCollection[];
  groupBy?: GroupBy;
  onTaskDrop?: (taskId: string, targetGroup: string, groupBy: GroupBy) => void;
  onHighlightedDateChange?: (date: string | null) => void;
  // Sort options (within groups)
  sortBy?: TaskSortBy;
  sortDirection?: TaskSortDirection;
  // Add task to specific group (for + button in section headers)
  onAddTaskToGroup?: (groupKey: string, groupBy: GroupBy) => void;
}

const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onToggleComplete, 
  todayDate, 
  view, 
  onEditTask, 
  taskPages = [], 
  groupBy = 'date', 
  onTaskDrop, 
  onHighlightedDateChange,
  sortBy = 'date',
  sortDirection = 'asc',
  onAddTaskToGroup,
}) => {
  // Use centralized date utilities - derive dayjs from ISO string if provided
  const today = todayDate ? parseDate(todayDate) : getToday();

  const { draggedItem, dragOverGroup, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave } = useDragAndDrop();

  // Collapsible groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Group tasks using shared utility
  const groupedTasks = useMemo(() => {
    const groups = groupTasksBy(tasks, groupBy, today, taskPages);
    // Apply sorting within each group
    return sortTasksWithinGroups(groups, sortBy, sortDirection);
  }, [tasks, groupBy, today, taskPages, sortBy, sortDirection]);

  // Extract just the task arrays for backwards compatibility
  const buckets = useMemo(() => {
    const result: Record<string, Task[]> = {};
    for (const [key, group] of Object.entries(groupedTasks)) {
      result[key] = group.tasks;
    }
    return result;
  }, [groupedTasks]);

  // Note: Tasks are already sorted within groups via sortTasksWithinGroups

  const groupsOrder: { key: string; label: string; color?: string }[] = useMemo(() => {
    if (groupBy === 'date') {
      return DATE_GROUPS.map(g => ({
        key: g.key,
        label: g.label
      }));
    } else if (groupBy === 'priority') {
      return [
        { key: 'high', label: 'High Priority', color: '#EF4444' },
        { key: 'medium', label: 'Medium Priority', color: '#F59E0B' },
        { key: 'low', label: 'Low Priority', color: '#3B82F6' },
        { key: 'none', label: 'No Priority', color: '#9CA3AF' },
      ];
    } else if (groupBy === 'taskPage') {
      const pageGroups = taskPages.map(p => ({ key: p.id, label: p.title, color: p.color || undefined }));
      return [...pageGroups, { key: 'inbox', label: 'Inbox', color: '#6B7280' }];
    } else if (groupBy === 'section') {
      // Get sections from the first page that has tasks (assumes single page view)
      const pagesWithTasks = [...new Set(tasks.map(t => t.parentPageId).filter(Boolean))];
      if (pagesWithTasks.length > 0) {
        const taskPage = taskPages.find(p => p.id === pagesWithTasks[0]);
        if (taskPage?.sections) {
          const sectionGroups = [...taskPage.sections]
            .sort((a, b) => a.order - b.order)
            .map(s => ({ key: s.id, label: s.name, color: s.color || taskPage.color || undefined }));
          return [...sectionGroups, { key: 'unassigned', label: 'Unassigned', color: '#9CA3AF' }];
        }
      }
      return [{ key: 'unassigned', label: 'Unassigned', color: '#9CA3AF' }];
    } else if (groupBy === 'tag') {
      // Get unique tags from tasks and sort them alphabetically
      const tagSet = new Set<string>();
      for (const task of tasks) {
        if (task.tag) tagSet.add(task.tag);
      }
      const sortedTags = Array.from(tagSet).sort();
      // Use the groupedTasks to get colors
      const tagGroups = sortedTags.map(tag => {
        const group = groupedTasks[tag];
        return { key: tag, label: tag, color: group?.color };
      });
      return [...tagGroups, { key: '__no_tag__', label: 'No Tag', color: '#9CA3AF' }];
    }
    // Default: no grouping, show all tasks in a single group
    return [{ key: 'all', label: 'Tasks' }];
  }, [groupBy, taskPages, view, tasks, groupedTasks]);

  const renderTaskItem = (task: Task) => {
    return (
      <TaskRow
        key={task.id}
        task={task}
        dataDueDate={task.dueDate}
        todayISO={todayDate}
        onToggleComplete={onToggleComplete}
        onEditTask={onEditTask}
        taskPages={taskPages}
        onDragStart={handleDragStart}
        showParentPage={view !== 'taskPage' && view !== 'taskCollection'}
      />
    );
  };

  // Keep track of the topmost visible task (for upcoming sticky week strip)
  const [userInteracted, setUserInteracted] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const visibleSet = useRef(new Set<HTMLElement>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  // removed rAF fallback; keep logic lightweight
  const initialPinnedRef = useRef(false);
  const lastTopRef = useRef(new WeakMap<HTMLElement, number>());
  const timelineStripHeightRef = useRef<number>(0);
  const lastHighlightedRef = useRef<string | null>(null);

  // On mount, if there are tasks due today, pin the highlight to today until user interacts
  useEffect(() => {
    if (view !== 'upcoming') return;
    const hasToday = tasks.some(t => t.dueDate && dayjs(t.dueDate).isSame(today, 'day'));
    if (hasToday) {
      const todayISO = today.format('YYYY-MM-DD');
      onHighlightedDateChange?.(todayISO);
      initialPinnedRef.current = true;
    }
  }, [view, tasks, today, onHighlightedDateChange]);

  // selection is handled within the IntersectionObserver callback

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    visibleSet.current.clear();

    // If no handler is provided, skip observation entirely
    if (!onHighlightedDateChange || view !== 'upcoming') {
      return;
    }

    observerRef.current = new IntersectionObserver((entries) => {
      // update visibleSet
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
    if (entry.isIntersecting) visibleSet.current.add(el);
        else visibleSet.current.delete(el);
        // cache current top without forcing a layout outside IO
        try {
          lastTopRef.current.set(el, entry.boundingClientRect.top);
        } catch {
          // no-op
        }
      }

      // choose the visible element whose top is nearest to viewport top (0)
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
    const offset = timelineStripHeightRef.current;
    if (!initialPinnedRef.current) {
      visibleSet.current.forEach(el => {
        try {
      if (!el.getAttribute('data-due')) return; // skip rows without a due date
      const cachedTop = lastTopRef.current.get(el);
      const top = cachedTop ?? el.getBoundingClientRect().top;
      const dist = Math.abs(top - offset);
          if (dist < bestDist) {
            bestDist = dist;
            best = el;
          }
        } catch {
          // ignore
        }
      });
    }
      if (best !== null) {
        const raw = (best as HTMLElement).getAttribute('data-due');
        const date = raw ? dayjs(raw).format('YYYY-MM-DD') : null;
        if (date && date !== lastHighlightedRef.current) {
          lastHighlightedRef.current = date;
          onHighlightedDateChange?.(date);
        }
      }
    }, { root: null, rootMargin: '0px 0px 0px 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });

    // observe all current refs
    rowRefs.current.forEach(el => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, [tasks, view, onHighlightedDateChange]);

  // Lightweight one-time interaction listeners to unpin initial highlight
  useEffect(() => {
    if (view !== 'upcoming') return;
    const onFirstInteract = () => {
      if (!userInteracted) {
        setUserInteracted(true);
        initialPinnedRef.current = false;
      }
    };
    const wheelHandler = onFirstInteract as EventListener;
    const touchHandler = onFirstInteract as EventListener;
    const keyHandler = onFirstInteract as EventListener;
    window.addEventListener('wheel', wheelHandler, { passive: true });
    window.addEventListener('touchstart', touchHandler, { passive: true });
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('wheel', wheelHandler);
      window.removeEventListener('touchstart', touchHandler);
      window.removeEventListener('keydown', keyHandler);
    };
  }, [view, userInteracted]);

  // Update timelineStripHeightRef when needed (will be set by parent)
  useEffect(() => {
    // This will be called by parent to set the strip height
    if (view === 'upcoming') {
      // Approximate height - will be overridden by parent
      timelineStripHeightRef.current = 80;
    }
  }, [view]);

  return (
    <div className="space-y-6">
      {groupsOrder.map(g => {
        const items = buckets[g.key] || [];
        // For section groupBy, always show all sections (even empty ones)
        // For other groupBy modes, skip empty groups
        if (!items.length && groupBy !== 'section') return null;
        return (
          <div 
            key={g.key}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedItem && onTaskDrop) {
                onTaskDrop(draggedItem, g.key, groupBy);
              }
              handleDragEnd();
            }}
            onDragEnter={(e) => {
              e.preventDefault();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              handleDragOver(g.key);
            }}
            onDragLeave={handleDragLeave}
            className={`transition-colors ${dragOverGroup === g.key ? 'bg-[var(--color-interactive-bg)] rounded-lg p-2' : ''}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <SectionHeader 
                label={g.label}
                subtitle={groupBy === 'date' ? getDateGroupSubtitle(g.key as DateGroupKey, today) ?? undefined : undefined}
                color={g.color}
                count={items.length}
                isExpanded={!collapsedGroups.has(g.key)}
                onToggle={() => toggleGroup(g.key)}
                onAdd={onAddTaskToGroup && groupBy !== 'none' ? () => onAddTaskToGroup(g.key, groupBy) : undefined}
                className="!mb-0"
              />
            </div>
            {!collapsedGroups.has(g.key) && (
            <ul className="space-y-2">{items.map(task => (
                // attach ref to each rendered li for intersection observation
                <div key={task.id} ref={(el) => {
                  if (el) {
                    // prefer the inner element that carries the data-due attribute
                    const target = el.querySelector('[data-due]') as HTMLElement | null;
                    if (target) rowRefs.current.set(task.id, target);
                    else rowRefs.current.set(task.id, el);
                  } else {
                    rowRefs.current.delete(task.id);
                  }
                }}>{renderTaskItem(task)}</div>
              ))}
            </ul>            )}          </div>
        );
      })}
    </div>
  );
};

export default TaskList;
