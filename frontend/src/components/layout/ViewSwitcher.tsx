/**
 * @file ViewSwitcher.tsx
 * @description Dropdown menu for view options (grouping, sorting, display settings)
 * @app SHARED - Used by both Tasks App and Notes App (adapts based on contentType)
 * 
 * A popover dropdown that provides view customization options:
 * 
 * For Tasks (contentType='tasks'):
 * - Group by: date, priority, task page, section
 * - Show/hide completed tasks
 * 
 * For Notes (contentType='pages'):
 * - Grid/List toggle at top (like Craft)
 * - Sort by: Name, Date Created, Date Updated (with asc/desc toggle)
 * - Filter: All, Pages, Collections, Daily
 * - Card size: small, medium, large (for grid view)
 * 
 * The options shown adapt based on the contentType prop.
 * Changes trigger callbacks to update view preferences in the parent.
 */
import React, { useRef, useState } from 'react';
import { LayoutIcon, CheckIcon, ListViewIcon, KanbanViewIcon, TableViewIcon } from '../common/Icons';
import useClickOutside from '../../hooks/useClickOutside';
import { Toggle, Label } from '@/components/ui';
import { cn } from '@/lib/design-system';
import type { NotesFilterType } from '@/stores/navigationStore';

export type { ViewMode, GroupBy } from '../../types/view';
import type { ViewMode, GroupBy } from '../../types/view';

type ContentType = 'tasks' | 'pages';
type SortDirection = 'asc' | 'desc';

type TaskSortBy = 'date' | 'priority' | 'title' | 'created' | 'tag';

interface ViewSwitcherProps {
  viewMode: ViewMode;
  groupBy: GroupBy;
  showCompleted: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onShowCompletedChange: (show: boolean) => void;
  hasSections?: boolean; // Whether current taskPage has custom sections
  isTaskPageView?: boolean; // Whether we're viewing a specific task page (hides taskPage group option)
  contentType?: ContentType; // 'tasks' or 'pages'
  // Notes sort options
  sortBy?: 'updated' | 'created' | 'title';
  sortDirection?: SortDirection;
  onSortByChange?: (sortBy: 'updated' | 'created' | 'title') => void;
  onSortDirectionChange?: (direction: SortDirection) => void;
  // Notes filter
  filterBy?: NotesFilterType;
  onFilterByChange?: (filter: NotesFilterType) => void;
  // Task sort options (within groups)
  taskSortBy?: TaskSortBy;
  taskSortDirection?: SortDirection;
  onTaskSortByChange?: (sortBy: TaskSortBy) => void;
  onTaskSortDirectionChange?: (direction: SortDirection) => void;
  // Pages display options
  showExcerpts?: boolean;
  onShowExcerptsChange?: (show: boolean) => void;
  // Reset callback - when provided, overrides the built-in reset logic
  onReset?: () => void;
  // Default values for the current context (e.g. per-filter task defaults)
  // Used to compute hasActiveFilters and as fallback reset targets
  taskDefaults?: {
    viewMode: string;
    groupBy: string;
    showCompleted: boolean;
    taskSortBy: string;
    taskSortDirection: string;
  };
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  viewMode,
  groupBy,
  showCompleted,
  onViewModeChange,
  onGroupByChange,
  onShowCompletedChange,
  hasSections = false,
  isTaskPageView = false,
  contentType = 'tasks',
  sortBy = 'updated',
  sortDirection = 'desc',
  onSortByChange,
  onSortDirectionChange,
  filterBy = 'all',
  onFilterByChange,
  taskSortBy = 'date',
  taskSortDirection = 'desc',
  onTaskSortByChange,
  onTaskSortDirectionChange,
  showExcerpts = true,
  onShowExcerptsChange,
  onReset,
  taskDefaults,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside([
    { ref: containerRef, onOutside: () => setIsOpen(false) }
  ]);

  // Determine if any view settings are active (non-default)
  const hasActiveFilters = React.useMemo(() => {
    if (contentType === 'tasks') {
      const d = taskDefaults || { viewMode: 'list', groupBy: 'none', showCompleted: false, taskSortBy: 'date', taskSortDirection: 'desc' };
      return (
        groupBy !== d.groupBy || 
        showCompleted !== d.showCompleted || 
        viewMode !== d.viewMode || 
        taskSortBy !== d.taskSortBy ||
        taskSortDirection !== d.taskSortDirection
      );
    } else {
      // Pages defaults: kanban, date, all, updated, desc, showExcerpts=true, compactMobileGrid=false
      return (
        filterBy !== 'all' || 
        viewMode !== 'kanban' || 
        groupBy !== 'date' ||
        sortBy !== 'updated' || 
        sortDirection !== 'desc' ||
        !showExcerpts
      );
    }
  }, [contentType, groupBy, showCompleted, viewMode, taskSortBy, taskSortDirection, filterBy, sortBy, sortDirection, showExcerpts, taskDefaults]);

  // Handle sort item click - if same sort, toggle direction; if different, set new sort
  const handleSortClick = (newSortBy: 'updated' | 'created' | 'title') => {
    if (sortBy === newSortBy && onSortDirectionChange) {
      // Toggle direction
      onSortDirectionChange(sortDirection === 'desc' ? 'asc' : 'desc');
    } else if (onSortByChange) {
      // Change sort field, reset to desc
      onSortByChange(newSortBy);
      onSortDirectionChange?.('desc');
    }
  };

  // Handle task sort item click - if same sort, toggle direction; if different, set new sort
  const handleTaskSortClick = (newSortBy: TaskSortBy) => {
    if (taskSortBy === newSortBy && onTaskSortDirectionChange) {
      // Toggle direction
      onTaskSortDirectionChange(taskSortDirection === 'desc' ? 'asc' : 'desc');
    } else if (onTaskSortByChange) {
      // Change sort field, reset to desc (later dates first)
      onTaskSortByChange(newSortBy);
      onTaskSortDirectionChange?.('desc');
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else if (contentType === 'tasks') {
      onViewModeChange('list');
      onGroupByChange('none');
      onShowCompletedChange(false);
      onTaskSortByChange?.('date');
      onTaskSortDirectionChange?.('desc');
    } else {
      onFilterByChange?.('all');
      onViewModeChange('kanban');
      onGroupByChange('date');
      onSortByChange?.('updated');
      onSortDirectionChange?.('desc');
      onShowExcerptsChange?.(true);
    }
    setIsOpen(false);
  };

  // Sort direction arrow component
  const SortArrow = ({ active }: { active: boolean }) => {
    if (!active) return null;
    return (
      <svg 
        className={`w-4 h-4 ml-auto transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`}
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
    );
  };

  // Task sort direction arrow component
  const TaskSortArrow = ({ active }: { active: boolean }) => {
    if (!active) return null;
    return (
      <svg 
        className={`w-4 h-4 ml-auto transition-transform ${taskSortDirection === 'asc' ? 'rotate-180' : ''}`}
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-full transition-all",
          hasActiveFilters 
            ? "text-[var(--color-interactive-text-strong)] bg-[var(--color-interactive-bg)] border border-[var(--color-interactive-border)]/30" 
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
        )}
        title="View options"
        aria-label="View options"
      >
        <LayoutIcon className={cn("w-4 h-4", hasActiveFilters && "text-[var(--color-interactive-text-strong)]")} />
        <span className="hidden sm:inline">View</span>
        {hasActiveFilters && (
          <span className="flex h-1.5 w-1.5 rounded-full bg-[var(--color-interactive-bg-strong)]" />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-52 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] shadow-xl z-[100]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ============ TASKS VIEW OPTIONS (Craft-style) ============ */}
          {contentType === 'tasks' && (
            <>
              {/* Grid/List/Table Toggle */}
              <div className="p-1.5 border-b border-[var(--color-border-default)]">
                <div className="flex bg-[var(--color-surface-secondary)] rounded-lg p-1">
                  <button
                    onClick={() => onViewModeChange('list')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'list'
                        ? 'bg-[var(--color-surface-base)] shadow-sm text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    title="List view"
                  >
                    <ListViewIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('kanban')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'kanban'
                        ? 'bg-[var(--color-surface-base)] shadow-sm text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    title="Card view"
                  >
                    <KanbanViewIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('table')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'table'
                        ? 'bg-[var(--color-surface-base)] shadow-sm text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    title="Table view"
                  >
                    <TableViewIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Group By Section */}
              <div className="py-1.5 border-b border-[var(--color-border-default)]">
                <Label className="mb-1 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Group by</Label>
                <button
                  onClick={() => { onGroupByChange('none'); setIsOpen(false); }}
                  className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                    groupBy === 'none' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {groupBy === 'none' && <CheckIcon className="w-4 h-4 mr-2" />}
                  {groupBy !== 'none' && <span className="w-4 mr-2" />}
                  <span>None</span>
                </button>
                <button
                  onClick={() => { onGroupByChange('date'); setIsOpen(false); }}
                  className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                    groupBy === 'date' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {groupBy === 'date' && <CheckIcon className="w-4 h-4 mr-2" />}
                  {groupBy !== 'date' && <span className="w-4 mr-2" />}
                  <span>Date</span>
                </button>
                <button
                  onClick={() => { onGroupByChange('priority'); setIsOpen(false); }}
                  className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                    groupBy === 'priority' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {groupBy === 'priority' && <CheckIcon className="w-4 h-4 mr-2" />}
                  {groupBy !== 'priority' && <span className="w-4 mr-2" />}
                  <span>Priority</span>
                </button>
                {/* Hide 'Tasks Page' group option when already on a tasks page */}
                {!isTaskPageView && (
                  <button
                    onClick={() => { onGroupByChange('taskPage'); setIsOpen(false); }}
                    className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      groupBy === 'taskPage' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {groupBy === 'taskPage' && <CheckIcon className="w-4 h-4 mr-2" />}
                    {groupBy !== 'taskPage' && <span className="w-4 mr-2" />}
                    <span>Tasks Page</span>
                  </button>
                )}
                <button
                  onClick={() => { onGroupByChange('tag'); setIsOpen(false); }}
                  className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                    groupBy === 'tag' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {groupBy === 'tag' && <CheckIcon className="w-4 h-4 mr-2" />}
                  {groupBy !== 'tag' && <span className="w-4 mr-2" />}
                  <span>Tag</span>
                </button>
                {hasSections && (
                  <button
                    onClick={() => { onGroupByChange('section'); setIsOpen(false); }}
                    className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      groupBy === 'section' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {groupBy === 'section' && <CheckIcon className="w-4 h-4 mr-2" />}
                    {groupBy !== 'section' && <span className="w-4 mr-2" />}
                    <span>Section</span>
                  </button>
                )}
              </div>

              {/* Sort By Section (within groups) */}
              {onTaskSortByChange && (
                <div className="py-1.5 border-b border-[var(--color-border-default)]">
                  <Label className="mb-1 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Sort by</Label>
                  <button
                    onClick={() => handleTaskSortClick('date')}
                    className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      taskSortBy === 'date' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {taskSortBy === 'date' && <CheckIcon className="w-4 h-4 mr-2" />}
                    {taskSortBy !== 'date' && <span className="w-4 mr-2" />}
                    <span>Date</span>
                    <TaskSortArrow active={taskSortBy === 'date'} />
                  </button>
                  <button
                    onClick={() => handleTaskSortClick('priority')}
                    className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      taskSortBy === 'priority' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {taskSortBy === 'priority' && <CheckIcon className="w-4 h-4 mr-2" />}
                    {taskSortBy !== 'priority' && <span className="w-4 mr-2" />}
                    <span>Priority</span>
                    <TaskSortArrow active={taskSortBy === 'priority'} />
                  </button>
                  <button
                    onClick={() => handleTaskSortClick('title')}
                    className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      taskSortBy === 'title' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {taskSortBy === 'title' && <CheckIcon className="w-4 h-4 mr-2" />}
                    {taskSortBy !== 'title' && <span className="w-4 mr-2" />}
                    <span>Title</span>
                    <TaskSortArrow active={taskSortBy === 'title'} />
                  </button>
                  <button
                    onClick={() => handleTaskSortClick('created')}
                    className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      taskSortBy === 'created' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {taskSortBy === 'created' && <CheckIcon className="w-4 h-4 mr-2" />}
                    {taskSortBy !== 'created' && <span className="w-4 mr-2" />}
                    <span>Created</span>
                    <TaskSortArrow active={taskSortBy === 'created'} />
                  </button>
                  <button
                    onClick={() => handleTaskSortClick('tag')}
                    className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      taskSortBy === 'tag' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {taskSortBy === 'tag' && <CheckIcon className="w-4 h-4 mr-2" />}
                    {taskSortBy !== 'tag' && <span className="w-4 mr-2" />}
                    <span>Tag</span>
                    <TaskSortArrow active={taskSortBy === 'tag'} />
                  </button>
                </div>
              )}

              {/* Show Completed Toggle */}
              <div className="py-1.5">
                <div
                  onClick={() => onShowCompletedChange(!showCompleted)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] cursor-pointer"
                >
                  <span className="text-[var(--color-text-secondary)]">Show completed</span>
                  <Toggle
                    checked={showCompleted}
                    onChange={onShowCompletedChange}
                  />
                </div>
              </div>
            </>
          )}

          {/* ============ NOTES VIEW OPTIONS (Craft-style) ============ */}
          {contentType === 'pages' && (
            <>
              {/* Grid/List/Table Toggle */}
              <div className="p-1.5 border-b border-[var(--color-border-default)]">
                <div className="flex bg-[var(--color-surface-secondary)] rounded-lg p-1">
                  <button
                    onClick={() => onViewModeChange('kanban')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'kanban'
                        ? 'bg-[var(--color-surface-base)] shadow-sm text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    title="Card view"
                  >
                    <KanbanViewIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('list')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'list'
                        ? 'bg-[var(--color-surface-base)] shadow-sm text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    title="List view"
                  >
                    <ListViewIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('table')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'table'
                        ? 'bg-[var(--color-surface-base)] shadow-sm text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    title="Table view"
                  >
                    <TableViewIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sort By Section */}
              {onSortByChange && (
                <div className="py-1.5 border-b border-[var(--color-border-default)]">
                  <Label className="mb-1 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Sort by</Label>
                  <button
                    onClick={() => handleSortClick('title')}
                    className={`w-full flex items-center px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      sortBy === 'title' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {sortBy === 'title' && <CheckIcon className="w-4 h-4 mr-3" />}
                    {sortBy !== 'title' && <span className="w-4 mr-3" />}
                    <span>Name</span>
                    <SortArrow active={sortBy === 'title'} />
                  </button>
                  <button
                    onClick={() => handleSortClick('created')}
                    className={`w-full flex items-center px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      sortBy === 'created' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {sortBy === 'created' && <CheckIcon className="w-4 h-4 mr-3" />}
                    {sortBy !== 'created' && <span className="w-4 mr-3" />}
                    <span>Date Created</span>
                    <SortArrow active={sortBy === 'created'} />
                  </button>
                  <button
                    onClick={() => handleSortClick('updated')}
                    className={`w-full flex items-center px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      sortBy === 'updated' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {sortBy === 'updated' && <CheckIcon className="w-4 h-4 mr-3" />}
                    {sortBy !== 'updated' && <span className="w-4 mr-3" />}
                    <span>Date Updated</span>
                    <SortArrow active={sortBy === 'updated'} />
                  </button>
                </div>
              )}

              {/* Group by date toggle (only when sorting by date field) */}
              {(sortBy === 'updated' || sortBy === 'created') && (
                <div className="py-1 border-b border-[var(--color-border-default)]">
                  <div
                    onClick={() => onGroupByChange(groupBy === 'date' ? 'none' : 'date')}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] cursor-pointer"
                  >
                    <span className="text-[var(--color-text-secondary)]">Group by date</span>
                    <Toggle
                      checked={groupBy === 'date'}
                      onChange={() => onGroupByChange(groupBy === 'date' ? 'none' : 'date')}
                    />
                  </div>
                </div>
              )}

              {/* Filter Section */}
              {onFilterByChange && (
                <div className="py-1 border-b border-[var(--color-border-default)]">
                  <Label className="mb-1 px-4 pt-2 block !text-[10px] !uppercase !tracking-widest text-[var(--color-text-tertiary)] opacity-70">Show</Label>
                  <button
                    onClick={() => { onFilterByChange('all'); setIsOpen(false); }}
                    className={`w-full flex items-center px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      filterBy === 'all' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {filterBy === 'all' && <CheckIcon className="w-4 h-4 mr-3" />}
                    {filterBy !== 'all' && <span className="w-4 mr-3" />}
                    <span>All</span>
                  </button>
                  <button
                    onClick={() => { onFilterByChange('notes'); setIsOpen(false); }}
                    className={`w-full flex items-center px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      filterBy === 'notes' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {filterBy === 'notes' && <CheckIcon className="w-4 h-4 mr-3" />}
                    {filterBy !== 'notes' && <span className="w-4 mr-3" />}
                    <span>Notes</span>
                  </button>
                  <button
                    onClick={() => { onFilterByChange('collections'); setIsOpen(false); }}
                    className={`w-full flex items-center px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      filterBy === 'collections' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {filterBy === 'collections' && <CheckIcon className="w-4 h-4 mr-3" />}
                    {filterBy !== 'collections' && <span className="w-4 mr-3" />}
                    <span>Collections</span>
                  </button>
                  <button
                    onClick={() => { onFilterByChange('tasks'); setIsOpen(false); }}
                    className={`w-full flex items-center px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] ${
                      filterBy === 'tasks' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {filterBy === 'tasks' && <CheckIcon className="w-4 h-4 mr-3" />}
                    {filterBy !== 'tasks' && <span className="w-4 mr-3" />}
                    <span>Tasks</span>
                  </button>
                </div>
              )}

              {/* Display Options */}
              {(onShowExcerptsChange && (viewMode === 'kanban' || viewMode === 'table')) && (
                <div className="py-1.5 border-b border-[var(--color-border-default)]">
                  <Label className="mb-1 px-4 pt-2 block !text-[10px] !uppercase !tracking-widest text-[var(--color-text-tertiary)] opacity-70">Display</Label>
                  <div
                    onClick={() => onShowExcerptsChange(!showExcerpts)}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm rounded-md hover:bg-[var(--color-surface-hover)] cursor-pointer"
                  >
                    <span className="text-[var(--color-text-secondary)]">Show previews</span>
                    <Toggle
                      checked={showExcerpts}
                      onChange={onShowExcerptsChange}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Reset Button */}
          {hasActiveFilters && (
            <div className="p-1.5 bg-[var(--color-surface-secondary)]">
              <button
                onClick={handleReset}
                className="w-full py-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] rounded-md transition-colors"
              >
                Reset to Default
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewSwitcher;
