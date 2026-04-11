/**
 * @file ViewSwitcherMobileWrapper.tsx
 * @description Mobile-aware wrapper for ViewSwitcher that uses MobileSheet on touch devices
 * @app SHARED - Wraps ViewSwitcher component for responsive behavior
 * 
 * On mobile: Renders options in a bottom sheet instead of a dropdown
 * On desktop: Uses the standard dropdown menu
 * 
 * For task pages and collection pages, also includes saved views on mobile.
 */
import React, { useState, useCallback } from 'react';
import ViewSwitcher from './ViewSwitcher';
import { MobileSheet } from '@/components/ui';
import { ViewEditorModal } from '@/components/ui/SavedViewsBar';
import { LucideIcon } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { LayoutIcon, CheckIcon, SettingsIcon } from '../common/Icons';
import { cn } from '@/lib/design-system';
import type { ViewMode, GroupBy } from '@/types/view';
import type { NotesFilterType } from '@/stores/navigationStore';
import type { Page } from '@/types/page';
import type { PageSavedView, TaskViewConfig, CollectionViewConfig } from '@/types/savedView';
import { generateSavedViewId } from '@/types/savedView';

interface ViewSwitcherMobileWrapperProps {
  viewMode: ViewMode;
  groupBy: GroupBy;
  showCompleted: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onShowCompletedChange: (show: boolean) => void;
  hasSections?: boolean;
  isTaskPageView?: boolean; // Whether we're viewing a specific task page (hides taskPage group option)
  contentType?: 'tasks' | 'pages';
  // Notes sort options
  sortBy?: 'updated' | 'created' | 'title';
  sortDirection?: 'asc' | 'desc';
  onSortByChange?: (sortBy: 'updated' | 'created' | 'title') => void;
  onSortDirectionChange?: (direction: 'asc' | 'desc') => void;
  filterBy?: NotesFilterType;
  onFilterByChange?: (filter: NotesFilterType) => void;
  // Task sort options (within groups)
  taskSortBy?: 'date' | 'priority' | 'title' | 'created' | 'tag';
  taskSortDirection?: 'asc' | 'desc';
  onTaskSortByChange?: (sortBy: 'date' | 'priority' | 'title' | 'created' | 'tag') => void;
  onTaskSortDirectionChange?: (direction: 'asc' | 'desc') => void;
  // Pages display options
  showExcerpts?: boolean;
  onShowExcerptsChange?: (show: boolean) => void;
  // Saved views (for task pages and collection pages on mobile)
  page?: Page;
  onSavedViewUpdate?: (
    updates: { savedViews?: PageSavedView[]; activeSavedViewId?: string | null },
    configToApply?: TaskViewConfig | CollectionViewConfig | null
  ) => void;
  currentConfig?: TaskViewConfig | CollectionViewConfig;
  // Reset callback - when provided, overrides the built-in reset logic
  onReset?: () => void;
  // Default values for the current context (e.g. per-filter task defaults)
  taskDefaults?: {
    viewMode: string;
    groupBy: string;
    showCompleted: boolean;
    taskSortBy: string;
    taskSortDirection: string;
  };
}

const ViewSwitcherMobileWrapper: React.FC<ViewSwitcherMobileWrapperProps> = (props) => {
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { 
    contentType = 'tasks', 
    groupBy, 
    showCompleted, 
    viewMode, 
    taskSortBy = 'date', 
    taskSortDirection = 'desc',
    filterBy = 'all',
    sortBy = 'updated',
    sortDirection = 'desc',
    isTaskPageView = false,
    showExcerpts = true,
  } = props;

  // Determine if any view settings are active (non-default)
  const hasActiveFilters = React.useMemo(() => {
    if (contentType === 'tasks') {
      const d = props.taskDefaults || { viewMode: 'list', groupBy: isTaskPageView ? 'none' : 'date', showCompleted: false, taskSortBy: 'date', taskSortDirection: 'asc' };
      return (
        groupBy !== d.groupBy || 
        showCompleted !== d.showCompleted || 
        viewMode !== d.viewMode || 
        taskSortBy !== d.taskSortBy ||
        taskSortDirection !== d.taskSortDirection
      );
    } else {
      // Pages defaults: kanban, date, all, updated, desc, showExcerpts=true
      return (
        filterBy !== 'all' || 
        viewMode !== 'kanban' || 
        groupBy !== 'date' ||
        sortBy !== 'updated' || 
        sortDirection !== 'desc' ||
        !showExcerpts
      );
    }
  }, [contentType, groupBy, showCompleted, viewMode, taskSortBy, taskSortDirection, filterBy, sortBy, sortDirection, isTaskPageView, showExcerpts, props.taskDefaults]);

  // On mobile, we return a custom implementation
  // On desktop, use the standard ViewSwitcher
  if (!isMobile) {
    return <ViewSwitcher {...props} />;
  }

  // Mobile version: button that opens sheet
  return (
    <>
      <button
        onClick={() => setIsSheetOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-full transition-all",
          hasActiveFilters 
            ? "text-[var(--color-interactive-text-strong)] bg-[var(--color-interactive-bg)] border border-[var(--color-interactive-border)]/30" 
            : "text-[var(--color-text-secondary)] hover:bg-white/50 dark:hover:bg-white/10"
        )}
        title="View options"
        aria-label="View options"
      >
        <LayoutIcon className="w-4 h-4" />
        <span>View</span>
      </button>

      {/* Mobile Sheet with View Switcher content */}
      <MobileSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="View Options"
        className="max-h-[80vh]"
      >
        <div className="p-4 space-y-4">
          {/* Wrap the ViewSwitcher content directly since we're already in a sheet */}
          <ViewSwitcherContent {...props} onClose={() => setIsSheetOpen(false)} />
        </div>
      </MobileSheet>
    </>
  );
};

// Extracted content component to avoid circular rendering
const ViewSwitcherContent: React.FC<ViewSwitcherMobileWrapperProps & { onClose: () => void }> = ({
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
  taskSortDirection = 'asc',
  onTaskSortByChange,
  onTaskSortDirectionChange,
  showExcerpts = true,
  onShowExcerptsChange,
  // Saved views props
  page,
  onSavedViewUpdate,
  currentConfig,
  onClose,
  // Reset/defaults
  onReset,
  taskDefaults,
}) => {
  // Saved views state
  const savedViews = page?.savedViews || [];
  const activeViewId = page?.activeSavedViewId;
  const activeView = savedViews.find(v => v.id === activeViewId);
  const [editingView, setEditingView] = useState<PageSavedView | null>(null);

  // Handle saved view selection
  const handleSelectSavedView = useCallback((view: PageSavedView) => {
    if (!onSavedViewUpdate) return;
    
    const isCurrentlyActive = activeViewId === view.id;
    if (isCurrentlyActive) {
      // Deactivate
      onSavedViewUpdate({ activeSavedViewId: null }, null);
    } else {
      // Activate and apply config
      onSavedViewUpdate({ activeSavedViewId: view.id }, view.config);
    }
    onClose();
  }, [activeViewId, onSavedViewUpdate, onClose]);

  // Handle save new view
  const handleSaveNewView = useCallback(() => {
    if (!onSavedViewUpdate || !currentConfig) return;
    
    const newView: PageSavedView = {
      id: generateSavedViewId(),
      name: `View ${savedViews.length + 1}`,
      order: savedViews.length,
      icon: null,
      color: null,
      config: currentConfig,
    };
    
    onSavedViewUpdate({
      savedViews: [...savedViews, newView],
      activeSavedViewId: newView.id,
    }, newView.config);
    onClose();
  }, [onSavedViewUpdate, currentConfig, savedViews, onClose]);

  // Handle delete saved view
  const handleDeleteSavedView = useCallback((viewId: string) => {
    if (!onSavedViewUpdate) return;
    
    const newViews = savedViews.filter(v => v.id !== viewId);
    const updates: { savedViews: PageSavedView[]; activeSavedViewId?: string | null } = {
      savedViews: newViews,
    };
    if (activeViewId === viewId) {
      updates.activeSavedViewId = null;
    }
    onSavedViewUpdate(updates, null);
  }, [savedViews, activeViewId, onSavedViewUpdate]);

  // Handle rename/edit saved view
  const handleRenameSavedView = useCallback((name: string, icon: string | null, color: string | null, config: TaskViewConfig | CollectionViewConfig) => {
    if (!onSavedViewUpdate || !editingView) return;
    
    const newViews = savedViews.map(v => 
      v.id === editingView.id 
        ? { ...v, name, icon, color, config } 
        : v
    );
    
    onSavedViewUpdate({ savedViews: newViews });
    setEditingView(null);
  }, [savedViews, editingView, onSavedViewUpdate]);

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
      // Pages defaults: kanban, date, all, updated, desc, showExcerpts=true
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
    onClose();
  };

  return (
    <>
      {/* Saved Views Section - only for task pages and collection pages */}
      {page && onSavedViewUpdate && savedViews.length > 0 && (
        <div className="pb-4 border-b border-[var(--color-border-subtle)]">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
            Saved Views
          </label>
          <div className="space-y-1">
            {savedViews.map((view) => (
              <div key={view.id} className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectSavedView(view)}
                  className={cn(
                    "flex-1 flex items-center gap-2 text-left py-3 px-4 min-h-[44px] rounded-lg text-sm transition-colors",
                    activeViewId === view.id
                      ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] font-medium'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
                  )}
                >
                  {view.icon && <LucideIcon name={view.icon} className="w-4 h-4" style={{ color: view.color || undefined }} />}
                  <span className="flex-1">{view.name}</span>
                  {activeViewId === view.id && <CheckIcon className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setEditingView(view)}
                  className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-interactive-text-strong)] transition-colors"
                  title="Edit view"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Current View Button */}
      {page && onSavedViewUpdate && currentConfig && (
        <div className={savedViews.length > 0 ? 'pt-2' : ''}>
          <button
            onClick={handleSaveNewView}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] rounded-lg text-sm font-medium border-2 border-dashed border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-interactive-border)] hover:text-[var(--color-interactive-text-strong)] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Save Current View
          </button>
        </div>
      )}

      {/* Divider if we showed saved views */}
      {page && onSavedViewUpdate && (
        <div className="border-b border-[var(--color-border-subtle)]" />
      )}

      {contentType === 'tasks' && (
        <>
          {/* View Mode Toggle - List / Kanban / Table */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
              Layout
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onViewModeChange('list');
                  onClose();
                }}
                className={`flex-1 py-3 px-4 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[var(--color-interactive-bg-strong)] text-white'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                }`}
              >
                List
              </button>
              <button
                onClick={() => {
                  onViewModeChange('kanban');
                  onClose();
                }}
                className={`flex-1 py-3 px-4 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-[var(--color-interactive-bg-strong)] text-white'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => {
                  onViewModeChange('table');
                  onClose();
                }}
                className={`flex-1 py-3 px-4 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-[var(--color-interactive-bg-strong)] text-white'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          {/* Group By */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
              Group By
            </label>
            <div className="space-y-1">
              {/* Filter out 'taskPage' when on a task page view */}
              {['none', 'date', 'priority', ...(isTaskPageView ? [] : ['taskPage']), 'tag', ...(hasSections ? ['section'] : [])].map((group) => {
                const displayName = group === 'taskPage' ? 'Tasks Page' : group.charAt(0).toUpperCase() + group.slice(1);
                return (
                  <button
                    key={group}
                    onClick={() => {
                      onGroupByChange(group as GroupBy);
                      onClose();
                    }}
                    className={`w-full text-left py-3 px-4 min-h-[44px] rounded-lg text-sm transition-colors ${
                      groupBy === group
                        ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] font-medium'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
                    }`}
                  >
                    {displayName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort By (within groups) */}
          {onTaskSortByChange && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
                Sort By
              </label>
              <div className="space-y-1">
                {(['date', 'priority', 'title', 'created'] as const).map((sort) => {
                  const displayName = sort === 'created' ? 'Created' : sort.charAt(0).toUpperCase() + sort.slice(1);
                  const isActive = taskSortBy === sort;
                  return (
                    <button
                      key={sort}
                      onClick={() => {
                        if (taskSortBy === sort && onTaskSortDirectionChange) {
                          // Toggle direction
                          onTaskSortDirectionChange(taskSortDirection === 'asc' ? 'desc' : 'asc');
                        } else {
                          onTaskSortByChange(sort);
                          onTaskSortDirectionChange?.('asc');
                        }
                      }}
                      className={`w-full text-left py-3 px-4 min-h-[44px] rounded-lg text-sm transition-colors flex items-center justify-between ${
                        isActive
                          ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] font-medium'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
                      }`}
                    >
                      <span>{displayName}</span>
                      {isActive && (
                        <svg 
                          className={`w-4 h-4 transition-transform ${taskSortDirection === 'asc' ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path d="M12 5v14M19 12l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Show Completed Toggle */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
              Display
            </label>
            <button
              onClick={() => onShowCompletedChange(!showCompleted)}
              className={`w-full text-left py-3 px-4 min-h-[44px] rounded-lg text-sm transition-colors ${
                showCompleted
                  ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] font-medium'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
              }`}
            >
              Show Completed
            </button>
          </div>
        </>
      )}

      {contentType === 'pages' && (
        <>
          {/* Layout Toggle - List / Gallery / Table */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
              Layout
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onViewModeChange('list');
                  onClose();
                }}
                className={`flex-1 py-3 px-4 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[var(--color-interactive-bg-strong)] text-white'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                }`}
              >
                List
              </button>
              <button
                onClick={() => {
                  onViewModeChange('kanban');
                  onClose();
                }}
                className={`flex-1 py-3 px-4 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-[var(--color-interactive-bg-strong)] text-white'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                }`}
              >
                Gallery
              </button>
              <button
                onClick={() => {
                  onViewModeChange('table');
                  onClose();
                }}
                className={`flex-1 py-3 px-4 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-[var(--color-interactive-bg-strong)] text-white'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                }`}
              >
                Table
              </button>
            </div>
          </div>

          {/* Sort Options */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
              Sort By
            </label>
            <div className="space-y-1">
              {['updated', 'created', 'title'].map((sort) => (
                <button
                  key={sort}
                  onClick={() => {
                    if (onSortByChange) onSortByChange(sort as any);
                    if (onSortDirectionChange) onSortDirectionChange('desc');
                    onClose();
                  }}
                  className={`w-full text-left py-3 px-4 min-h-[44px] rounded-lg text-sm transition-colors ${
                    sortBy === sort
                      ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] font-medium'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
                  }`}
                >
                  {sort.charAt(0).toUpperCase() + sort.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Filter */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
              Filter
            </label>
            <div className="space-y-1">
              {['all', 'pages', 'collections', 'tasks'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    if (onFilterByChange) onFilterByChange(filter as any);
                    onClose();
                  }}
                  className={`w-full text-left py-3 px-4 min-h-[44px] rounded-lg text-sm transition-colors ${
                    filterBy === filter
                      ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] font-medium'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 block">
              Display
            </label>
            <div className="space-y-1">
              {onShowExcerptsChange && viewMode === 'kanban' && (
                <button
                  onClick={() => onShowExcerptsChange(!showExcerpts)}
                  className={`w-full text-left py-3 px-4 min-h-[44px] rounded-lg text-sm transition-colors ${
                    showExcerpts
                      ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] font-medium'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
                  }`}
                >
                  Show Previews
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Reset Button */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-[var(--color-border-subtle)]">
          <button
            onClick={handleReset}
            className="w-full py-3 px-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-interactive-text-strong)] bg-[var(--color-interactive-bg)] hover:bg-[var(--color-interactive-bg-hover)] rounded-xl transition-colors"
          >
            Reset to Default
          </button>
        </div>
      )}

      {/* Edit View Modal */}
      {editingView && currentConfig && (
        <ViewEditorModal
          title="Edit View"
          initialName={editingView.name}
          initialIcon={editingView.icon}
          initialColor={editingView.color}
          config={editingView.config}
          onSave={handleRenameSavedView}
          onClose={() => setEditingView(null)}
          onDelete={() => handleDeleteSavedView(editingView.id)}
        />
      )}
    </>
  );
};

export default ViewSwitcherMobileWrapper;
