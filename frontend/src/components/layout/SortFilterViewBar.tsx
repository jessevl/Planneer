/**
 * @file SortFilterViewBar.tsx
 * @description Three-button bar replacing the single ViewSwitcher button.
 * @app SHARED - Used by Tasks and Pages views, including task pages and collections.
 *
 * Displays three adjoined segmented buttons:
 *   [↕ Sort]  [⌘ Filter (n)]  [⊞ View]
 *
 * Each button opens its own dropdown panel (desktop) or combined bottom sheet (mobile).
 *
 * Sort panel:
 *   Tasks  → Group by + Sort by (with direction toggle)
 *   Pages  → Sort by (with direction toggle) + Group by date toggle
 *
 * Filter panel:
 *   Tasks  → Priority multi-select, Tag multi-select, Due date status, Show completed
 *   Pages  → Type single-select, Tag multi-select
 *
 * View panel:
 *   Tasks  → List / Kanban / Table layout
 *   Pages  → Card / List / Table layout + Show excerpts toggle
 *
 * The Filter button shows an active badge count for non-default filter criteria.
 * Sort and View buttons show a dot indicator when non-default settings are active.
 *
 * Mobile: opens a single bottom sheet with three tab sections.
 *
 * Used by:
 *   - UnifiedHeader (TasksView, PagesView, PageDetailView task/collection headers)
 *   - PageCollection (inline header controls)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowUpDown, Filter, LayoutGrid, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { ListViewIcon, KanbanViewIcon, TableViewIcon } from '../common/Icons';
import { MobileSheet, Toggle, Label, TagBadge } from '@/components/ui';
import { cn } from '@/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import useClickOutside from '@/hooks/useClickOutside';
import type { ViewMode, GroupBy, TaskSortBy, SortDirection, TaskFilterOptions, PageFilterOptions } from '@/types/view';
import {
  DEFAULT_TASK_FILTER_OPTIONS,
  DEFAULT_PAGE_FILTER_OPTIONS,
  countActiveTaskFilters,
  countActivePageFilters,
  isDefaultTaskFilterOptions,
  isDefaultPageFilterOptions,
} from '@/types/view';
import type { NotesFilterType } from '@/stores/navigationStore';

// ============================================================================
// Types
// ============================================================================

type ContentType = 'tasks' | 'pages';

export interface SortFilterViewBarProps {
  contentType: ContentType;

  // ── Sort (tasks) ─────────────────────────────────────────────────────────
  groupBy: GroupBy;
  onGroupByChange: (gb: GroupBy) => void;
  hasSections?: boolean;
  isTaskPageView?: boolean;
  taskSortBy?: TaskSortBy;
  taskSortDirection?: SortDirection;
  onTaskSortByChange?: (sb: TaskSortBy) => void;
  onTaskSortDirectionChange?: (dir: SortDirection) => void;

  // ── Sort (pages) ─────────────────────────────────────────────────────────
  sortBy?: 'updated' | 'created' | 'title';
  sortDirection?: SortDirection;
  onSortByChange?: (sb: 'updated' | 'created' | 'title') => void;
  onSortDirectionChange?: (dir: SortDirection) => void;

  // ── Filter (tasks) ───────────────────────────────────────────────────────
  showCompleted: boolean;
  onShowCompletedChange: (show: boolean) => void;
  taskFilterOptions?: TaskFilterOptions;
  onTaskFilterOptionsChange?: (opts: TaskFilterOptions) => void;
  /** All existing task tags in the current context (for tag filter suggestions) */
  existingTaskTags?: string[];

  // ── Filter (pages) ───────────────────────────────────────────────────────
  filterBy?: NotesFilterType;
  onFilterByChange?: (filter: NotesFilterType) => void;
  pageFilterOptions?: PageFilterOptions;
  onPageFilterOptionsChange?: (opts: PageFilterOptions) => void;
  /** All existing page tags in the current context (for tag filter suggestions) */
  existingPageTags?: string[];

  // ── View ─────────────────────────────────────────────────────────────────
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showExcerpts?: boolean;
  onShowExcerptsChange?: (show: boolean) => void;

  // ── Behavior ─────────────────────────────────────────────────────────────
  /** When true, the due-date filter section is completely hidden (e.g. in predefined /tasks/ views that already have date pills) */
  hideDueDateFilter?: boolean;

  // ── Reset / Defaults ─────────────────────────────────────────────────────
  onReset?: () => void;
  taskDefaults?: {
    viewMode: string;
    groupBy: string;
    showCompleted: boolean;
    taskSortBy: string;
    taskSortDirection: string;
  };

  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Shared option row used inside dropdowns */
const OptionRow: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  sortArrow?: React.ReactNode;
}> = ({ label, active, onClick, sortArrow }) => (
  <button
    onClick={onClick}
    data-active={active ? 'true' : 'false'}
    className={cn(
      'w-full flex items-center px-3 py-1.5 text-sm rounded-md eink-sfv-option-row',
      'hover:bg-[var(--color-surface-hover)] transition-colors',
      active
        ? 'bg-[var(--color-interactive-bg)]/15 text-[var(--color-text-primary)]'
        : 'text-[var(--color-text-secondary)]'
    )}
  >
    {active ? (
      <Check className="w-4 h-4 mr-2 flex-shrink-0 text-[var(--color-interactive-text-strong)]" />
    ) : (
      <span className="w-4 mr-2 flex-shrink-0" />
    )}
    <span className="flex-1 text-left">{label}</span>
    {sortArrow}
  </button>
);

/** Sort direction arrow */
const SortArrow: React.FC<{ direction: SortDirection }> = ({ direction }) => (
  <span className="ml-auto text-[var(--color-text-tertiary)]">
    {direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
  </span>
);

/** Colored priority pill for filter */
const PriorityPill: React.FC<{
  priority: 'High' | 'Medium' | 'Low';
  active: boolean;
  onClick: () => void;
}> = ({ priority, active, onClick }) => {
  const colors = {
    High: active
      ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40'
      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]',
    Medium: active
      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]',
    Low: active
      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/40'
      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]',
  };
  return (
    <button
      onClick={onClick}
      data-active={active ? 'true' : 'false'}
      data-priority={priority.toLowerCase()}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all eink-sfv-pill',
        colors[priority]
      )}
    >
      {active && <Check className="w-3 h-3" />}
      {priority}
    </button>
  );
};

// ============================================================================
// Panel contents
// ============================================================================

interface SortPanelProps {
  contentType: ContentType;
  groupBy: GroupBy;
  onGroupByChange: (gb: GroupBy) => void;
  hasSections?: boolean;
  isTaskPageView?: boolean;
  taskSortBy: TaskSortBy;
  taskSortDirection: SortDirection;
  onTaskSortByChange?: (sb: TaskSortBy) => void;
  onTaskSortDirectionChange?: (dir: SortDirection) => void;
  sortBy: 'updated' | 'created' | 'title';
  sortDirection: SortDirection;
  onSortByChange?: (sb: 'updated' | 'created' | 'title') => void;
  onSortDirectionChange?: (dir: SortDirection) => void;
  onClose?: () => void;
}

const SortPanel: React.FC<SortPanelProps> = ({
  contentType,
  groupBy,
  onGroupByChange,
  hasSections,
  isTaskPageView,
  taskSortBy,
  taskSortDirection,
  onTaskSortByChange,
  onTaskSortDirectionChange,
  sortBy,
  sortDirection,
  onSortByChange,
  onSortDirectionChange,
  onClose,
}) => {
  const handleTaskSortClick = (sb: TaskSortBy) => {
    if (taskSortBy === sb && onTaskSortDirectionChange) {
      onTaskSortDirectionChange(taskSortDirection === 'desc' ? 'asc' : 'desc');
    } else if (onTaskSortByChange) {
      onTaskSortByChange(sb);
      onTaskSortDirectionChange?.('desc');
    }
  };

  const handlePageSortClick = (sb: 'updated' | 'created' | 'title') => {
    if (sortBy === sb && onSortDirectionChange) {
      onSortDirectionChange(sortDirection === 'desc' ? 'asc' : 'desc');
    } else if (onSortByChange) {
      onSortByChange(sb);
      onSortDirectionChange?.('desc');
    }
  };

  if (contentType === 'tasks') {
    return (
      <div>
        <div className="py-1.5 border-b border-[var(--color-border-default)]">
          <Label className="mb-1 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Group by</Label>
          <OptionRow label="None" active={groupBy === 'none'} onClick={() => { onGroupByChange('none'); onClose?.(); }} />
          <OptionRow label="Date" active={groupBy === 'date'} onClick={() => { onGroupByChange('date'); onClose?.(); }} />
          <OptionRow label="Priority" active={groupBy === 'priority'} onClick={() => { onGroupByChange('priority'); onClose?.(); }} />
          {!isTaskPageView && (
            <OptionRow label="Tasks Page" active={groupBy === 'taskPage'} onClick={() => { onGroupByChange('taskPage'); onClose?.(); }} />
          )}
          <OptionRow label="Tag" active={groupBy === 'tag'} onClick={() => { onGroupByChange('tag'); onClose?.(); }} />
          {hasSections && (
            <OptionRow label="Section" active={groupBy === 'section'} onClick={() => { onGroupByChange('section'); onClose?.(); }} />
          )}
        </div>
        {onTaskSortByChange && (
          <div className="py-1.5">
            <Label className="mb-1 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Sort by</Label>
            {(['date', 'priority', 'title', 'created', 'tag'] as TaskSortBy[]).map(sb => (
              <OptionRow
                key={sb}
                label={{ date: 'Date', priority: 'Priority', title: 'Title', created: 'Created', tag: 'Tag' }[sb]}
                active={taskSortBy === sb}
                onClick={() => handleTaskSortClick(sb)}
                sortArrow={taskSortBy === sb ? <SortArrow direction={taskSortDirection} /> : undefined}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Pages sort panel
  return (
    <div>
      {onSortByChange && (
        <div className="py-1.5 border-b border-[var(--color-border-default)]">
          <Label className="mb-1 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Sort by</Label>
          <OptionRow label="Name" active={sortBy === 'title'} onClick={() => handlePageSortClick('title')} sortArrow={sortBy === 'title' ? <SortArrow direction={sortDirection} /> : undefined} />
          <OptionRow label="Date Created" active={sortBy === 'created'} onClick={() => handlePageSortClick('created')} sortArrow={sortBy === 'created' ? <SortArrow direction={sortDirection} /> : undefined} />
          <OptionRow label="Date Updated" active={sortBy === 'updated'} onClick={() => handlePageSortClick('updated')} sortArrow={sortBy === 'updated' ? <SortArrow direction={sortDirection} /> : undefined} />
        </div>
      )}
      {(sortBy === 'updated' || sortBy === 'created') && (
        <div className="py-1.5">
          <div
            onClick={() => onGroupByChange(groupBy === 'date' ? 'none' : 'date')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] cursor-pointer"
          >
            <span className="text-[var(--color-text-secondary)]">Group by date</span>
            <Toggle checked={groupBy === 'date'} onChange={() => onGroupByChange(groupBy === 'date' ? 'none' : 'date')} />
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------------------

interface FilterPanelProps {
  contentType: ContentType;
  showCompleted: boolean;
  onShowCompletedChange: (v: boolean) => void;
  taskFilterOptions: TaskFilterOptions;
  onTaskFilterOptionsChange?: (opts: TaskFilterOptions) => void;
  existingTaskTags?: string[];
  filterBy: NotesFilterType;
  onFilterByChange?: (f: NotesFilterType) => void;
  pageFilterOptions: PageFilterOptions;
  onPageFilterOptionsChange?: (opts: PageFilterOptions) => void;
  existingPageTags?: string[];
  /** When true, the due date section is completely hidden (already filtered via date pills) */
  hideDueDateFilter?: boolean;
  onClose?: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  contentType,
  showCompleted,
  onShowCompletedChange,
  taskFilterOptions,
  onTaskFilterOptionsChange,
  existingTaskTags = [],
  filterBy,
  onFilterByChange,
  pageFilterOptions,
  onPageFilterOptionsChange,
  existingPageTags = [],
  hideDueDateFilter = false,
  onClose: _onClose,
}) => {
  const [tagSearch, setTagSearch] = useState('');

  const toggleTaskPriority = (p: 'High' | 'Medium' | 'Low') => {
    const current = taskFilterOptions.priorities;
    const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
    onTaskFilterOptionsChange?.({ ...taskFilterOptions, priorities: next });
  };

  const toggleTaskTag = (tag: string) => {
    const current = taskFilterOptions.tags;
    const next = current.includes(tag) ? current.filter(x => x !== tag) : [...current, tag];
    onTaskFilterOptionsChange?.({ ...taskFilterOptions, tags: next });
  };

  const togglePageTag = (tag: string) => {
    const current = pageFilterOptions.tags;
    const next = current.includes(tag) ? current.filter(x => x !== tag) : [...current, tag];
    onPageFilterOptionsChange?.({ ...pageFilterOptions, tags: next });
  };

  const filteredTaskTags = existingTaskTags.filter(t =>
    !tagSearch || t.toLowerCase().includes(tagSearch.toLowerCase())
  );
  const filteredPageTags = existingPageTags.filter(t =>
    !tagSearch || t.toLowerCase().includes(tagSearch.toLowerCase())
  );

  if (contentType === 'tasks') {
    return (
      <div>
        {/* Priority */}
        <div className="py-2 border-b border-[var(--color-border-default)]">
          <Label className="mb-2 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Priority</Label>
          <div className="flex flex-wrap gap-1.5 px-3 pb-1">
            {(['High', 'Medium', 'Low'] as const).map(p => (
              <PriorityPill
                key={p}
                priority={p}
                active={taskFilterOptions.priorities.includes(p)}
                onClick={() => toggleTaskPriority(p)}
              />
            ))}
            {taskFilterOptions.priorities.length > 0 && (
              <button
                onClick={() => onTaskFilterOptionsChange?.({ ...taskFilterOptions, priorities: [] })}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Tags */}
        {existingTaskTags.length > 0 && (
          <div className="py-2 border-b border-[var(--color-border-default)]">
            <Label className="mb-2 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Tag</Label>
            {existingTaskTags.length > 5 && (
              <div className="mx-3 mb-2">
                <input
                  value={tagSearch}
                  onChange={e => setTagSearch(e.target.value)}
                  placeholder="Search tags..."
                  className="w-full px-2.5 py-1 text-xs rounded-md bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-hover)]"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 px-3 pb-1 max-h-28 overflow-y-auto p-1">
              {filteredTaskTags.map(tag => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  compact
                  onClick={() => toggleTaskTag(tag)}
                  className={cn(
                    'cursor-pointer transition-opacity',
                    taskFilterOptions.tags.includes(tag) ? 'ring-2 ring-[var(--color-interactive-bg-strong)] ring-offset-1' : 'opacity-70 hover:opacity-100'
                  )}
                />
              ))}
            </div>
            {taskFilterOptions.tags.length > 0 && (
              <button
                onClick={() => onTaskFilterOptionsChange?.({ ...taskFilterOptions, tags: [] })}
                className="flex items-center gap-1 mx-3 mt-1 px-2 py-0.5 rounded text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              >
                <X className="w-3 h-3" /> Clear tags
              </button>
            )}
          </div>
        )}

        {/* Due date - hidden entirely when parent already provides date-based filtering (e.g. /tasks/ pills) */}
        {!hideDueDateFilter && (
          <div className="py-1.5 border-b border-[var(--color-border-default)]">
            <Label className="mb-1 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">
              Due date
            </Label>
            {(['all', 'has_due', 'no_due', 'overdue'] as const).map(opt => {
              const labels = { all: 'Any date', has_due: 'Has due date', no_due: 'No due date', overdue: 'Overdue' };
              return (
                <OptionRow
                  key={opt}
                  label={labels[opt]}
                  active={taskFilterOptions.dueDateFilter === opt}
                  onClick={() => {
                    onTaskFilterOptionsChange?.({ ...taskFilterOptions, dueDateFilter: opt });
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Show completed */}
        <div className="py-1.5">
          <div
            onClick={() => onShowCompletedChange(!showCompleted)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] cursor-pointer"
          >
            <span className="text-[var(--color-text-secondary)]">Show completed</span>
            <Toggle checked={showCompleted} onChange={onShowCompletedChange} />
          </div>
        </div>
      </div>
    );
  }

  // Pages filter panel
  return (
    <div>
      {/* Type */}
      <div className="py-1.5 border-b border-[var(--color-border-default)]">
        <Label className="mb-1 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Show</Label>
        {([
          { v: 'all', l: 'All' },
          { v: 'notes', l: 'Notes' },
          { v: 'collections', l: 'Collections' },
          { v: 'tasks', l: 'Tasks' },
        ] as { v: NotesFilterType; l: string }[]).map(({ v, l }) => (
          <OptionRow
            key={v}
            label={l}
            active={filterBy === v}
            onClick={() => {
              onFilterByChange?.(v);
              onPageFilterOptionsChange?.({ ...pageFilterOptions, filterBy: v as PageFilterOptions['filterBy'] });
            }}
          />
        ))}
      </div>

      {/* Tags */}
      <div className="py-2">
        <Label className="mb-2 px-3 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Tag</Label>
        {existingPageTags.length > 5 && (
          <div className="mx-3 mb-2">
            <input
              value={tagSearch}
              onChange={e => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              className="w-full px-2.5 py-1 text-xs rounded-md bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-hover)]"
            />
          </div>
        )}
        {existingPageTags.length === 0 ? (
          <p className="px-3 text-xs text-[var(--color-text-disabled)] italic">No tags yet — add tags to pages via their properties.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 px-3 pb-1 max-h-28 overflow-y-auto p-1">
            {filteredPageTags.map(tag => (
              <TagBadge
                key={tag}
                tag={tag}
                compact
                onClick={() => togglePageTag(tag)}
                className={cn(
                  'cursor-pointer transition-opacity',
                  pageFilterOptions.tags.includes(tag) ? 'ring-2 ring-[var(--color-interactive-bg-strong)] ring-offset-1' : 'opacity-70 hover:opacity-100'
                )}
              />
            ))}
          </div>
        )}
        {pageFilterOptions.tags.length > 0 && (
          <button
            onClick={() => onPageFilterOptionsChange?.({ ...pageFilterOptions, tags: [] })}
            className="flex items-center gap-1 mx-3 mt-1 px-2 py-0.5 rounded text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          >
            <X className="w-3 h-3" /> Clear tags
          </button>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------

interface ViewPanelProps {
  contentType: ContentType;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showExcerpts?: boolean;
  onShowExcerptsChange?: (show: boolean) => void;
}

const ViewPanel: React.FC<ViewPanelProps> = ({
  contentType,
  viewMode,
  onViewModeChange,
  showExcerpts,
  onShowExcerptsChange,
}) => {
  const viewBtnCls = (active: boolean) => cn(
    'p-2 rounded-full transition-all eink-sfv-view-button border border-transparent',
    active
      ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)]'
      : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
  );

  const viewOptions: { mode: ViewMode; Icon: React.FC<{ className?: string }>; label: string }[] = contentType === 'pages'
    ? [
        { mode: 'kanban', Icon: KanbanViewIcon, label: 'Cards' },
        { mode: 'list', Icon: ListViewIcon, label: 'List' },
        { mode: 'table', Icon: TableViewIcon, label: 'Table' },
      ]
    : [
        { mode: 'list', Icon: ListViewIcon, label: 'List' },
        { mode: 'kanban', Icon: KanbanViewIcon, label: 'Board' },
        { mode: 'table', Icon: TableViewIcon, label: 'Table' },
      ];

  return (
    <div>
      <div className="px-2 py-2 border-b border-[var(--color-border-default)]">
        <Label className="mb-2 px-1 block !text-[11px] !uppercase !tracking-wider text-[var(--color-text-tertiary)]">Layout</Label>
        <div className="flex items-center gap-1">
          {viewOptions.map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              data-active={viewMode === mode ? 'true' : 'false'}
              className={viewBtnCls(viewMode === mode)}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {onShowExcerptsChange !== undefined && (viewMode === 'kanban' || viewMode === 'table') && (
        <div className="py-1.5">
          <div
            onClick={() => onShowExcerptsChange(!showExcerpts)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-[var(--color-surface-hover)] cursor-pointer"
          >
            <span className="text-[var(--color-text-secondary)]">Show previews</span>
            <Toggle checked={!!showExcerpts} onChange={onShowExcerptsChange} />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Desktop Dropdown Panel
// ============================================================================

interface DesktopDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

const DesktopDropdown: React.FC<DesktopDropdownProps> = ({ isOpen, children, align = 'right' }) => {
  if (!isOpen) return null;
  return (
    <div
      className={cn(
        'absolute top-full mt-1.5 w-52 rounded-xl border border-[var(--color-border-default)]',
        'bg-[var(--color-surface-primary)] shadow-xl z-[100] overflow-hidden',
        align === 'right' ? 'right-0' : 'left-0'
      )}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

type ActivePanel = 'sort' | 'filter' | 'view' | null;

const SortFilterViewBar: React.FC<SortFilterViewBarProps> = ({
  contentType,
  groupBy,
  onGroupByChange,
  hasSections,
  isTaskPageView,
  taskSortBy = 'date',
  taskSortDirection = 'desc',
  onTaskSortByChange,
  onTaskSortDirectionChange,
  sortBy = 'updated',
  sortDirection = 'desc',
  onSortByChange,
  onSortDirectionChange,
  showCompleted,
  onShowCompletedChange,
  taskFilterOptions = DEFAULT_TASK_FILTER_OPTIONS,
  onTaskFilterOptionsChange,
  existingTaskTags = [],
  filterBy = 'all',
  onFilterByChange,
  pageFilterOptions = DEFAULT_PAGE_FILTER_OPTIONS,
  onPageFilterOptionsChange,
  existingPageTags = [],
  viewMode,
  onViewModeChange,
  showExcerpts,
  onShowExcerptsChange,
  onReset,
  hideDueDateFilter = false,
  taskDefaults,
  className,
}) => {
  const isMobile = useIsMobile();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'sort' | 'filter' | 'view'>('sort');

  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  useClickOutside([
    { ref: sortRef, onOutside: () => activePanel === 'sort' && setActivePanel(null) },
    { ref: filterRef, onOutside: () => activePanel === 'filter' && setActivePanel(null) },
    { ref: viewRef, onOutside: () => activePanel === 'view' && setActivePanel(null) },
  ]);

  const togglePanel = (panel: 'sort' | 'filter' | 'view') => {
    if (isMobile) {
      setMobileTab(panel);
      setMobileSheetOpen(true);
    } else {
      setActivePanel(prev => prev === panel ? null : panel);
    }
  };

  // ── Active detection ───────────────────────────────────────────────────────

  const isSortActive = React.useMemo(() => {
    if (contentType === 'tasks') {
      const d = taskDefaults || { groupBy: 'none', taskSortBy: 'date', taskSortDirection: 'desc' };
      return groupBy !== d.groupBy || taskSortBy !== d.taskSortBy || taskSortDirection !== d.taskSortDirection;
    }
    return sortBy !== 'updated' || sortDirection !== 'desc' || groupBy !== 'date';
  }, [contentType, groupBy, taskSortBy, taskSortDirection, sortBy, sortDirection, taskDefaults]);

  const filterCount = React.useMemo(() => {
    if (contentType === 'tasks') {
      return countActiveTaskFilters(taskFilterOptions, showCompleted);
    }
    // for pages, also count filterBy
    let count = countActivePageFilters(pageFilterOptions);
    if (filterBy !== 'all' && pageFilterOptions.filterBy === 'all') count++; // legacy filterBy
    return count;
  }, [contentType, taskFilterOptions, showCompleted, pageFilterOptions, filterBy]);

  const isViewActive = React.useMemo(() => {
    if (contentType === 'tasks') {
      const defaultMode = taskDefaults?.viewMode || 'list';
      return viewMode !== defaultMode;
    }
    return viewMode !== 'kanban';
  }, [contentType, viewMode, taskDefaults]);

  // ── Button style ──────────────────────────────────────────────────────────
  // Icons-only compact buttons with consistent visual treatment:
  // - All three show a dot indicator when in non-default state
  // - Filter ALSO shows a number badge with the active filter count

  const btnCls = (isOpen: boolean, isActive: boolean) => cn(
    'relative flex items-center justify-center w-7 h-7 rounded-full transition-all border border-transparent eink-header-button eink-sfv-trigger',
    'focus:outline-none select-none',
    isOpen
      ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
      : isActive
        ? 'text-[var(--color-interactive-text-strong)] bg-[var(--color-interactive-bg)]/20'
        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]',
  );

  /** Dot indicator shown on Sort and View when non-default */
  const ActiveDot = () => (
    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--color-interactive-bg-strong)] border-2 border-[var(--color-surface-base)] eink-sfv-indicator" />
  );

  // ── Shared panel props ────────────────────────────────────────────────────

  const sortPanelProps: SortPanelProps = {
    contentType,
    groupBy,
    onGroupByChange,
    hasSections,
    isTaskPageView,
    taskSortBy,
    taskSortDirection,
    onTaskSortByChange,
    onTaskSortDirectionChange,
    sortBy,
    sortDirection,
    onSortByChange,
    onSortDirectionChange,
    onClose: () => setActivePanel(null),
  };

  const filterPanelProps: FilterPanelProps = {
    contentType,
    showCompleted,
    onShowCompletedChange,
    taskFilterOptions,
    onTaskFilterOptionsChange,
    existingTaskTags,
    filterBy,
    onFilterByChange,
    pageFilterOptions,
    onPageFilterOptionsChange,
    existingPageTags,
    hideDueDateFilter,
    onClose: () => setActivePanel(null),
  };

  const viewPanelProps: ViewPanelProps = {
    contentType,
    viewMode,
    onViewModeChange,
    showExcerpts,
    onShowExcerptsChange,
  };

  // ── Has any active settings at all ────────────────────────────────────────
  const hasAnyActive = isSortActive || filterCount > 0 || isViewActive;

  const resetSort = useCallback(() => {
    if (contentType === 'tasks') {
      const d = taskDefaults || { groupBy: 'none', taskSortBy: 'date', taskSortDirection: 'desc' };
      onGroupByChange(d.groupBy as GroupBy);
      onTaskSortByChange?.(d.taskSortBy as TaskSortBy);
      onTaskSortDirectionChange?.(d.taskSortDirection as SortDirection);
    } else {
      onGroupByChange('date');
      onSortByChange?.('updated');
      onSortDirectionChange?.('desc');
    }
    setActivePanel(null);
  }, [contentType, taskDefaults, onGroupByChange, onTaskSortByChange, onTaskSortDirectionChange, onSortByChange, onSortDirectionChange]);

  const resetFilters = useCallback(() => {
    if (contentType === 'tasks') {
      onTaskFilterOptionsChange?.(DEFAULT_TASK_FILTER_OPTIONS);
      onShowCompletedChange(false);
    } else {
      onFilterByChange?.('all');
      onPageFilterOptionsChange?.(DEFAULT_PAGE_FILTER_OPTIONS);
    }
    setActivePanel(null);
  }, [contentType, onTaskFilterOptionsChange, onShowCompletedChange, onFilterByChange, onPageFilterOptionsChange]);

  const resetView = useCallback(() => {
    if (contentType === 'tasks') {
      const defaultMode = (taskDefaults?.viewMode || 'list') as ViewMode;
      onViewModeChange(defaultMode);
    } else {
      onViewModeChange('kanban');
    }
    setActivePanel(null);
  }, [contentType, taskDefaults, onViewModeChange]);

  const handleReset = useCallback(() => {
    onReset?.();
    // Also reset filter options
    if (contentType === 'tasks') {
      onTaskFilterOptionsChange?.(DEFAULT_TASK_FILTER_OPTIONS);
      onShowCompletedChange(false);
    } else {
      onFilterByChange?.('all');
      onPageFilterOptionsChange?.(DEFAULT_PAGE_FILTER_OPTIONS);
    }
    setActivePanel(null);
    setMobileSheetOpen(false);
  }, [onReset, contentType, onTaskFilterOptionsChange, onShowCompletedChange, onFilterByChange, onPageFilterOptionsChange]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={cn('inline-flex items-center gap-0.5', className)}>
        {/* ── Sort ── */}
        <div ref={sortRef} className="relative">
          <button
            onClick={() => togglePanel('sort')}
            data-active={isSortActive ? 'true' : 'false'}
            data-open={activePanel === 'sort' ? 'true' : 'false'}
            className={btnCls(activePanel === 'sort', isSortActive)}
            title="Sort options"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {isSortActive && <ActiveDot />}
          </button>
          <DesktopDropdown isOpen={!isMobile && activePanel === 'sort'} onClose={() => setActivePanel(null)}>
            <SortPanel {...sortPanelProps} />
            {isSortActive && (
              <div className="p-1.5 bg-[var(--color-surface-secondary)]">
                <button onClick={resetSort} className="w-full py-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] rounded-md transition-colors">
                  Reset sort
                </button>
              </div>
            )}
          </DesktopDropdown>
        </div>

        {/* ── Filter ── */}
        <div ref={filterRef} className="relative">
          <button
            onClick={() => togglePanel('filter')}
            data-active={filterCount > 0 ? 'true' : 'false'}
            data-open={activePanel === 'filter' ? 'true' : 'false'}
            className={btnCls(activePanel === 'filter', filterCount > 0)}
            title="Filter options"
          >
            <Filter className="w-3.5 h-3.5" />
            {filterCount > 0 ? (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-bold bg-[var(--color-interactive-bg-strong)] text-white leading-none eink-sfv-badge">
                {filterCount}
              </span>
            ) : null}
          </button>
          <DesktopDropdown isOpen={!isMobile && activePanel === 'filter'} onClose={() => setActivePanel(null)}>
            <FilterPanel {...filterPanelProps} />
            {filterCount > 0 && (
              <div className="p-1.5 bg-[var(--color-surface-secondary)]">
                <button onClick={resetFilters} className="w-full py-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] rounded-md transition-colors">
                  Clear filters
                </button>
              </div>
            )}
          </DesktopDropdown>
        </div>

        {/* ── View ── */}
        <div ref={viewRef} className="relative">
          <button
            onClick={() => togglePanel('view')}
            data-active={isViewActive ? 'true' : 'false'}
            data-open={activePanel === 'view' ? 'true' : 'false'}
            className={btnCls(activePanel === 'view', isViewActive)}
            title="View options"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {isViewActive && <ActiveDot />}
          </button>
          <DesktopDropdown isOpen={!isMobile && activePanel === 'view'} onClose={() => setActivePanel(null)}>
            <ViewPanel {...viewPanelProps} />
            {isViewActive && (
              <div className="p-1.5 bg-[var(--color-surface-secondary)]">
                <button onClick={resetView} className="w-full py-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] rounded-md transition-colors">
                  Reset view
                </button>
              </div>
            )}
          </DesktopDropdown>
        </div>
      </div>

      {/* ── Mobile Sheet ── */}
      {isMobile && (
        <MobileSheet
          isOpen={mobileSheetOpen}
          onClose={() => setMobileSheetOpen(false)}
          title="View Options"
        >
          {/* Tab strip */}
          <div className="flex border-b border-[var(--color-border-default)] mb-3">
            {(['sort', 'filter', 'view'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                data-active={mobileTab === tab ? 'true' : 'false'}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium capitalize transition-colors eink-sfv-tab',
                  mobileTab === tab
                    ? 'text-[var(--color-interactive-text-strong)] border-b-2 border-[var(--color-interactive-bg-strong)]'
                    : 'text-[var(--color-text-secondary)]'
                )}
              >
                {tab}
                {tab === 'filter' && filterCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-[var(--color-interactive-bg-strong)] text-white eink-sfv-badge">
                    {filterCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {mobileTab === 'sort' && <SortPanel {...sortPanelProps} />}
          {mobileTab === 'filter' && <FilterPanel {...filterPanelProps} />}
          {mobileTab === 'view' && <ViewPanel {...viewPanelProps} />}

          {hasAnyActive && (
            <div className="mt-3 p-1.5 bg-[var(--color-surface-secondary)] rounded-lg">
              <button onClick={handleReset} className="w-full py-2 px-3 text-sm font-semibold text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] rounded-md transition-colors">
                Reset to defaults
              </button>
            </div>
          )}
        </MobileSheet>
      )}
    </>
  );
};

export default SortFilterViewBar;
