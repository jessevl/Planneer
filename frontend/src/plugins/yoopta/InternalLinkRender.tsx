/**
 * @file InternalLinkRender.tsx
 * @description Render component for internal link blocks in Yoopta editor
 * @app NOTES APP ONLY - Displays linked tasks/pages inline
 * 
 * Compact single-line display matching TaskRow/NoteRow styling:
 * - Tasks: Priority checkbox, title, task page badge, type indicator
 * - Notes: Icon, title, type indicator
 * 
 * Clicking tasks opens task modal, clicking pages navigates to the page.
 */
import React, { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PluginElementRenderProps } from '@yoopta/editor';
import { ArrowRightIcon, ListChecksIcon, PagesIcon } from '@/components/common/Icons';
import ItemIcon from '@/components/common/ItemIcon';
import { TaskCheckbox } from '@/components/ui';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface InternalLinkProps {
  nodeType: 'void';
  linkType: 'task' | 'note';
  linkedId: string;
  title: string;
  completed?: boolean;
  icon?: string | null;
}

// ============================================================================
// RENDER COMPONENT
// ============================================================================

const InternalLinkRender: React.FC<PluginElementRenderProps> = ({
  element,
  attributes,
  children,
}) => {
  const navigate = useNavigate();
  const props = (element.props || {}) as InternalLinkProps;
  const { linkType, linkedId, title: storedTitle, completed: storedCompleted, icon: storedIcon } = props;
  
  // Get live data from stores for real-time updates
  const tasksById = useTasksStore((s) => s.tasksById);
  const pagesById = usePagesStore((s: PagesState) => s.pagesById);
  const taskPagesById = usePagesStore((s: PagesState) => s.pagesById);
  
  // Open tasks in the sidepanel only when it is already visible.
  const openTaskInContext = useUIStore((s) => s.openTaskInContext);
  
  // Resolve current data (use store data if available, fall back to stored props)
  const resolvedData = useMemo(() => {
    if (linkType === 'task') {
      const task = tasksById[linkedId];
      if (task) {
        const taskPage = task.parentPageId ? taskPagesById[task.parentPageId] : null;
        return {
          exists: true,
          title: task.title,
          completed: task.completed,
          priority: task.priority || 'none',
          projectName: taskPage?.title,
          projectColor: taskPage?.color,
          icon: null,
          color: undefined,
          viewMode: undefined,
          isDailyNote: false,
        };
      }
      return {
        exists: false,
        title: storedTitle || 'Unknown Task',
        completed: storedCompleted ?? false,
        priority: 'none',
        projectName: undefined,
        projectColor: undefined,
        icon: null,
        color: undefined,
        viewMode: undefined,
        isDailyNote: false,
      };
    } else {
      const page = pagesById[linkedId];
      if (page) {
        return {
          exists: true,
          title: page.title || 'Untitled',
          completed: false,
          priority: undefined,
          projectName: undefined,
          projectColor: undefined,
          icon: page.icon,
          color: page.color,
          viewMode: page.viewMode,
          isDailyNote: page.isDailyNote,
        };
      }
      return {
        exists: false,
        title: storedTitle || 'Unknown Page',
        completed: false,
        priority: undefined,
        projectName: undefined,
        projectColor: undefined,
        icon: storedIcon,
        color: undefined,
        viewMode: undefined,
        isDailyNote: false,
      };
    }
  }, [linkType, linkedId, tasksById, pagesById, taskPagesById, storedTitle, storedCompleted, storedIcon]);
  
  // Handle click: tasks open modal, pages navigate
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (linkType === 'task') {
      openTaskInContext(linkedId);
    } else {
      navigate({ to: '/pages/$id', params: { id: linkedId } });
    }
  }, [linkType, linkedId, navigate, openTaskInContext]);

  // Determine icon type for pages
  const iconType = resolvedData.isDailyNote 
    ? 'daily' 
    : resolvedData.viewMode === 'collection' 
      ? 'collection' 
      : 'note';
  
  return (
    <div {...attributes} contentEditable={false}>
      <div 
        onClick={handleClick}
        className={cn(
          'yoopta-plugin-card group my-1 px-3 py-2 rounded-lg cursor-pointer select-none',
          'border border-solid transition-all duration-150',
          resolvedData.exists
            ? 'border-[var(--color-border-default)]'
            : 'border-dashed border-[var(--color-border-secondary)] opacity-60'
        )}
      >
        <div className="flex items-center gap-2">
          {/* Icon / Checkbox */}
          {linkType === 'task' ? (
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="flex-shrink-0 z-10"
            >
              <TaskCheckbox
                completed={resolvedData.completed}
                priority={resolvedData.priority === 'none' ? 'p4' : resolvedData.priority}
                onChange={() => {
                  // Toggle the task completion
                  useTasksStore.getState().toggleComplete(linkedId);
                }}
                size="sm"
              />
            </div>
          ) : (
            <div className="flex-shrink-0">
              <ItemIcon
                type={iconType}
                icon={resolvedData.icon}
                color={resolvedData.color}
                size="xs"
              />
            </div>
          )}
          
          {/* Title */}
          <span className={cn(
            'flex-1 truncate text-sm',
            resolvedData.completed 
              ? 'line-through text-[var(--color-text-tertiary)]' 
              : 'text-[var(--color-text-primary)]',
            !resolvedData.exists && 'italic'
          )}>
            {resolvedData.title}
          </span>
          
          {/* Project badge for tasks */}
          {linkType === 'task' && resolvedData.projectName && (
            <span 
              className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)] truncate max-w-[100px]"
              style={resolvedData.projectColor ? { 
                backgroundColor: `${resolvedData.projectColor}15`,
                color: resolvedData.projectColor,
              } : undefined}
            >
              {resolvedData.projectName}
            </span>
          )}
          
          {/* Type indicator */}
          <span className="flex-shrink-0 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
            {linkType === 'task' ? (
              <ListChecksIcon className="w-3.5 h-3.5" />
            ) : (
              <PagesIcon className="w-3.5 h-3.5" />
            )}
          </span>
          
          {/* Arrow */}
          <ArrowRightIcon className="w-4 h-4 flex-shrink-0 text-[var(--color-text-disabled)] group-hover:text-[var(--color-accent-primary)] transition-colors" />
        </div>
        
        {/* Not found warning */}
        {!resolvedData.exists && (
          <div className="mt-1 text-xs text-[var(--color-warning)]">
            {linkType === 'task' ? 'Task' : 'Page'} not found
          </div>
        )}
      </div>
      {/* Yoopta requires children even for void elements */}
      {children}
    </div>
  );
};

export default InternalLinkRender;
