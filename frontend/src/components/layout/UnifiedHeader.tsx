/**
 * @file UnifiedHeader.tsx
 * @description Unified header component for all views with consistent elements
 * @app SHARED - Used by all views (Home, Tasks, Notes, Daily Journal)
 * 
 * A standardized header that ensures consistency across all views with:
 * 
 * LEFT SIDE:
 * - Sidebar expand button (ALWAYS visible when sidebar collapsed)
 * - Breadcrumb navigation (showing where user is, even for non-nested items)
 * - Optional subtitle/context
 * 
 * RIGHT SIDE:
 * - New item button (task/page) where applicable
 * - View layout toggle (list/kanban/grid) where applicable
 * - View settings button (grouping, sorting, etc.) where applicable
 * - Page/Collection toggle where applicable (for pages)
 * - Delete button where applicable
 * - Last saved indicator where applicable (note editing)
 * - Additional custom actions
 * 
 * Used by:
 * - HomeView
 * - TasksView (tasks list and task page views)
 * - NotesView (all pages collection)
 * - NotePageView (individual note pages)
 * - DailyJournalView
 */
'use client';

import React from 'react';
import { SidebarIcon, PlusIcon, TrashIcon, ChevronRightIcon, HomeIcon, ListChecksIcon } from '../common/Icons';
import { PenLine, Pin, PinOff, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, MoreVertical, FolderInput, Maximize2, X } from 'lucide-react';
import SortFilterViewBar from './SortFilterViewBar';
import { IconButton, Button, FlexGroup, TextSmall, LucideIcon, NavigationHistoryButtons } from '@/components/ui';
import { CONTENT_WIDTH, CONTENT_PADDING, getRightInsetStyle } from '@/lib/layout';
import { cn } from '@/lib/design-system';
import { useMobileLayoutSafe } from '@/contexts/MobileLayoutContext';
import { useConfirmStore } from '@/stores/confirmStore';
import { useUIStore } from '@/stores/uiStore';
import { useNavigationStore } from '@/stores/navigationStore';
import type { NotesFilterType } from '@/stores/navigationStore';
import { useSelectionStore } from '@/stores/selectionStore';
import PageActionsMenu from '@/components/pages/PageActionsMenu';
import type { ViewMode, GroupBy, TaskFilterOptions, PageFilterOptions } from '../../types/view';
export interface BreadcrumbItem {
  id: string;
  title: string;
  icon?: string | null;
  onClick?: () => void;
}

// ============================================================================
// PROPS INTERFACE
// ============================================================================

interface UnifiedHeaderProps {
  // --- SIDEBAR TOGGLE (always visible at far left) ---
  sidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  
  // --- BREADCRUMB / NAVIGATION ---
  /** Root label for breadcrumb (e.g., "Home", "Tasks", "Pages") */
  rootLabel?: string;
  /** Optional icon for root */
  rootIcon?: React.ReactNode;
  /** Click handler for root breadcrumb */
  onRootClick?: () => void;
  /** Ancestor breadcrumb items (for nested items like pages) */
  breadcrumbs?: BreadcrumbItem[];
  /** Current item title (shown as non-clickable at end of breadcrumb) */
  currentTitle?: string;
  /** Optional icon for current item */
  currentIcon?: React.ReactNode;
  /** Click handler for title (enables inline editing) */
  onTitleClick?: () => void;
  
  // --- SUBTITLE ---
  subtitle?: string | React.ReactNode;
  
  // --- NEW ITEM BUTTON ---
  onAddItem?: () => void;
  addItemLabel?: string; // Tooltip: "Add task", "New Page", etc.
  
  // --- VIEW LAYOUT (list/kanban/grid) - passed to ViewSwitcher ---
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  
  // --- VIEW SETTINGS (ViewSwitcher dropdown) ---
  showViewSettings?: boolean;
  groupBy?: GroupBy;
  showCompleted?: boolean;
  onGroupByChange?: (groupBy: GroupBy) => void;
  onShowCompletedChange?: (show: boolean) => void;
  contentType?: 'tasks' | 'pages';
  hasSections?: boolean;
  isTaskPageView?: boolean; // Whether viewing a specific task page (hides taskPage group option)
  /** When true, the due-date filter section is hidden (used in predefined /tasks/ views that already have date pills) */
  hideDueDateFilter?: boolean;
  // Notes sort options
  sortBy?: 'updated' | 'created' | 'title';
  sortDirection?: 'asc' | 'desc';
  onSortByChange?: (sortBy: 'updated' | 'created' | 'title') => void;
  onSortDirectionChange?: (direction: 'asc' | 'desc') => void;
  filterBy?: NotesFilterType;
  onFilterByChange?: (filter: NotesFilterType) => void;
  // Filter options (new)
  taskFilterOptions?: TaskFilterOptions;
  onTaskFilterOptionsChange?: (opts: TaskFilterOptions) => void;
  existingTaskTags?: string[];
  pageFilterOptions?: PageFilterOptions;
  onPageFilterOptionsChange?: (opts: PageFilterOptions) => void;
  existingPageTags?: string[];
  // Task sort options (within groups)
  taskSortBy?: 'date' | 'priority' | 'title' | 'created' | 'tag';
  taskSortDirection?: 'asc' | 'desc';
  onTaskSortByChange?: (sortBy: 'date' | 'priority' | 'title' | 'created' | 'tag') => void;
  onTaskSortDirectionChange?: (direction: 'asc' | 'desc') => void;
  // Reset callback - when provided, overrides the built-in reset logic in ViewSwitcher
  onResetViewSettings?: () => void;
  // Default values for the current context (e.g. per-filter task defaults)
  taskDefaults?: {
    viewMode: string;
    groupBy: string;
    showCompleted: boolean;
    taskSortBy: string;
    taskSortDirection: string;
  };
  
  /** Current page for content indicators */
  currentPage?: import('@/types/page').Page;
  
  // --- PIN BUTTON ---
  showPinButton?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  
  // --- DELETE BUTTON ---
  showDeleteButton?: boolean;
  onDelete?: () => void;
  
  // --- ADDITIONAL ACTIONS ---
  /** Custom actions rendered before the standard actions */
  additionalActionsLeft?: React.ReactNode;
  /** Custom actions rendered after the standard actions */
  additionalActionsRight?: React.ReactNode;
  
  // --- ADDITIONAL CONTENT BELOW HEADER ---
  /** Content rendered below the main header bar (e.g., TaskViewPills, date timeline) */
  belowHeader?: React.ReactNode;
  /** Custom content that replaces the default main floating header row */
  customHeaderContent?: React.ReactNode;
  /** Additional CSS classes for the header container */
  className?: string;
  /** Whether the page has a cover image that extends under the notch (affects sticky positioning on mobile) */
  hasCover?: boolean;
  /** Whether this header is in a split view panel (hides sidebar toggle, nav buttons, minimizes breadcrumb) */
  inSplitView?: boolean;
  /** Optional desktop width wrapper class for the header content; defaults to the shared content width */
  desktopWidthClassName?: string;
  /** Optional extra right inset applied to the desktop header wrapper. */
  desktopRightInsetPx?: number;
  /** Whether the header should be horizontally compact (reduced gaps and padding) */
  compact?: boolean;
  /** Callback when expand button is clicked in split view */
  onExpandSplitView?: () => void;
  /** Show the unified sidepanel toggle button */
  showSidePanelToggle?: boolean;
  /** Optional unified sidepanel toggle callback */
  onToggleSidePanel?: (open: boolean) => void;
  /** External sidepanel state */
  sidePanelOpen?: boolean;
  /** Whether to show excerpts/previews in list views */
  showExcerpts?: boolean;
  /** Callback when show excerpts toggle changes */
  onShowExcerptsChange?: (show: boolean) => void;
}



// Page Title Button - Button that opens move picker
const PageTitleButton: React.FC<{
  page: import('@/types/page').Page;
  title: string;
  icon?: React.ReactNode;
  compact?: boolean;
}> = ({ page, title, icon, compact }) => {
  const openPageMovePicker = useUIStore(state => state.openPageMovePicker);
  
  return (
    <button
      onClick={() => openPageMovePicker(page.id, page.title)}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 md:px-2.5 md:py-1.5 font-semibold truncate max-w-[180px] text-sm rounded-full text-[var(--color-text-primary)] hover:bg-white/50 dark:hover:bg-white/10 transition-all group",
        compact && "max-w-[120px] px-2"
      )}
      title="Move to collection"
    >
      {icon && <div className="flex-shrink-0 flex items-center">{icon}</div>}
      <span className="truncate">{title}</span>
      <FolderInput className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  // Sidebar
  sidebarVisible = true,
  onToggleSidebar,
  
  // Breadcrumb
  rootLabel,
  rootIcon,
  onRootClick,
  breadcrumbs = [],
  currentTitle,
  currentIcon,
  onTitleClick,
  
  // Subtitle
  subtitle,
  
  // Add button
  onAddItem,
  addItemLabel = 'Add',
  
  // Layout (passed to ViewSwitcher)
  viewMode,
  onViewModeChange,
  
  // View settings
  showViewSettings = false,
  groupBy,
  showCompleted = false,
  onGroupByChange,
  onShowCompletedChange,
  contentType = 'tasks',
  hasSections = false,
  isTaskPageView = false,
  sortBy,
  sortDirection,
  onSortByChange,
  onSortDirectionChange,
  filterBy,
  onFilterByChange,
  taskFilterOptions,
  onTaskFilterOptionsChange,
  existingTaskTags,
  pageFilterOptions,
  onPageFilterOptionsChange,
  existingPageTags,
  // Task sort options (within groups)
  taskSortBy,
  taskSortDirection,
  onTaskSortByChange,
  onTaskSortDirectionChange,
  // Reset/defaults for ViewSwitcher
  onResetViewSettings,
  taskDefaults,
  hideDueDateFilter = false,
  
  currentPage,
  
  // Pin
  showPinButton = false,
  isPinned = false,
  onTogglePin,
  
  // Delete
  showDeleteButton = false,
  onDelete,
  
  // Additional
  additionalActionsLeft,
  additionalActionsRight,
  belowHeader,
  customHeaderContent,
  className,
  hasCover = false,
  inSplitView = false,
  desktopWidthClassName = `${CONTENT_WIDTH.default} mx-auto`,
  desktopRightInsetPx = 0,
  compact = false,
  onExpandSplitView,
  showSidePanelToggle = false,
  onToggleSidePanel,
  sidePanelOpen: sidePanelOpenProp,
  showExcerpts,
  onShowExcerptsChange,
}) => {
  // Mobile layout context for hamburger menu
  const { isMobile } = useMobileLayoutSafe();
  const { selectionMode, getSelectionCount } = useSelectionStore();
  const selectionCount = getSelectionCount(contentType === 'tasks' ? 'task' : 'page');
  
  const sidePanelOpenFromStore = useNavigationStore((s) => s.sidePanelOpen);
  const toggleSidePanelStore = useNavigationStore((s) => s.toggleSidePanel);
  const sidePanelOpen = sidePanelOpenProp ?? sidePanelOpenFromStore;

  const handleToggleSidePanel = () => {
    if (onToggleSidePanel) {
      onToggleSidePanel(!sidePanelOpen);
    } else {
      toggleSidePanelStore();
    }
  };

  const hasRightControls = !!(additionalActionsLeft || showViewSettings || additionalActionsRight || onAddItem || (!inSplitView && showSidePanelToggle) || currentPage || (inSplitView && onExpandSplitView));

  // Desktop: Floating glass panel header
  if (!isMobile) {
    return (
      <header className={cn(
        "w-full sticky z-20 h-0 overflow-visible",
        'pt-0 top-0',
        className
      )}>
        <div
          className="relative pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
          style={getRightInsetStyle(desktopRightInsetPx)}
        >
        <div
          className={cn(
            'relative',
            desktopWidthClassName
          )}
        >
          {customHeaderContent ? (
            <div className={cn(
              CONTENT_PADDING,
              "py-4",
              inSplitView && "px-2 py-3 md:px-2",
              compact && !inSplitView && "py-3"
            )}>
              {customHeaderContent}
            </div>
          ) : (
          <div className={cn(
            "flex items-center justify-between gap-3 py-4",
            CONTENT_PADDING,
            inSplitView && "gap-1.5 px-2 py-3 md:px-2",
            compact && !inSplitView && "gap-1.5 py-3"
          )}>
            {/* LEFT GROUP: Navigation glass panel */}
            <div className={cn(
              "glass-panel-nav eink-shell-surface flex h-11 items-center gap-1 px-3 min-w-0",
              (inSplitView || compact) && "gap-0.5 px-2"
            )}>
              {/* Navigation history buttons - URL-based, works for both main and split view */}
              {!inSplitView && <NavigationHistoryButtons size={compact ? "sm" : "md"} />}

              {/* Breadcrumb navigation - minimized in split view (current page only) */}
              <nav className="flex items-center gap-0.5 text-sm overflow-hidden min-w-0" aria-label="Breadcrumb">
                {/* Root item - hidden in split view */}
                {rootLabel && !inSplitView && (
                  <>
                    {onRootClick ? (
                      <button
                        onClick={onRootClick}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]/60 transition-all flex-shrink-0"
                      >
                        {rootIcon && <div className="flex-shrink-0 flex items-center">{rootIcon}</div>}
                        <span className="text-sm">{rootLabel}</span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2 py-1 text-[var(--color-text-tertiary)] flex-shrink-0">
                        {rootIcon && <div className="flex-shrink-0 flex items-center">{rootIcon}</div>}
                        <span className="text-sm">{rootLabel}</span>
                      </span>
                    )}
                    {(breadcrumbs.length > 0 || currentTitle) && (
                      <ChevronRightIcon className="w-3 h-3 text-[var(--color-text-disabled)] flex-shrink-0" />
                    )}
                  </>
                )}

                {/* Ancestor breadcrumbs - hidden in split view */}
                {!inSplitView && (() => {
                  const maxCrumbs = compact ? 1 : 3;
                  const hasMoreCrumbs = breadcrumbs.length > maxCrumbs;
                  const displayCrumbs = hasMoreCrumbs ? breadcrumbs.slice(-maxCrumbs) : breadcrumbs;
                  
                  return (
                    <>
                      {hasMoreCrumbs && (
                        <>
                          <span className="px-2 py-1 text-[var(--color-text-secondary)] text-sm">...</span>
                          <ChevronRightIcon className="w-3 h-3 text-[var(--color-text-disabled)] flex-shrink-0" />
                        </>
                      )}
                      {displayCrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.id}>
                          {index > 0 && (
                            <ChevronRightIcon className="w-3 h-3 text-[var(--color-text-disabled)] flex-shrink-0" />
                          )}
                          <button
                            onClick={crumb.onClick}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]/60 transition-all max-w-[150px]",
                              compact && "max-w-[80px]"
                            )}
                          >
                            {crumb.icon && <LucideIcon name={crumb.icon} className="w-3.5 h-3.5 flex-shrink-0" />}
                            <span className="truncate text-sm">{crumb.title || 'Untitled'}</span>
                          </button>
                        </React.Fragment>
                      ))}
                      {displayCrumbs.length > 0 && (
                        <ChevronRightIcon className="w-3 h-3 text-[var(--color-text-disabled)] flex-shrink-0" />
                      )}
                    </>
                  );
                })()}

                {/* Current title */}
                {currentTitle && currentPage && !currentPage.isDailyNote && !currentPage.isReadOnly && (
                  <PageTitleButton
                    page={currentPage}
                    title={currentTitle}
                    icon={currentIcon}
                    compact={compact}
                  />
                )}
                {currentTitle && (!currentPage || currentPage.isDailyNote || currentPage.isReadOnly) && (
                  <span className={cn(
                    "flex items-center gap-1.5 px-2 py-1 font-semibold text-[var(--color-text-primary)] truncate max-w-[200px] text-sm",
                    compact && "max-w-[120px]"
                  )}>
                    {currentIcon && <div className="flex-shrink-0 flex items-center">{currentIcon}</div>}
                    <span className="truncate">{currentTitle}</span>
                  </span>
                )}
              </nav>
            </div>

            {/* SPACER */}
            <div className="flex-1" />

            {hasRightControls && (
              <div className="flex items-center gap-2">
              <div className={cn(
                "glass-panel-nav eink-shell-surface flex h-11 items-center gap-1 px-3",
                (inSplitView || compact) && "gap-0.5 px-2"
              )}>
                {additionalActionsLeft}

                {showViewSettings && onGroupByChange && onShowCompletedChange && viewMode && (
                  <SortFilterViewBar
                    contentType={contentType}
                    viewMode={viewMode}
                    onViewModeChange={onViewModeChange || (() => {})}
                    groupBy={groupBy || 'none'}
                    onGroupByChange={onGroupByChange}
                    hasSections={hasSections}
                    isTaskPageView={isTaskPageView}
                    showCompleted={showCompleted}
                    onShowCompletedChange={onShowCompletedChange}
                    sortBy={sortBy}
                    sortDirection={sortDirection}
                    onSortByChange={onSortByChange}
                    onSortDirectionChange={onSortDirectionChange}
                    filterBy={filterBy}
                    onFilterByChange={onFilterByChange}
                    taskSortBy={taskSortBy}
                    taskSortDirection={taskSortDirection}
                    onTaskSortByChange={onTaskSortByChange}
                    onTaskSortDirectionChange={onTaskSortDirectionChange}
                    taskFilterOptions={taskFilterOptions}
                    onTaskFilterOptionsChange={onTaskFilterOptionsChange}
                    existingTaskTags={existingTaskTags}
                    pageFilterOptions={pageFilterOptions}
                    onPageFilterOptionsChange={onPageFilterOptionsChange}
                    existingPageTags={existingPageTags}
                    onReset={onResetViewSettings}
                    taskDefaults={taskDefaults}
                    hideDueDateFilter={hideDueDateFilter}
                    showExcerpts={showExcerpts}
                    onShowExcerptsChange={onShowExcerptsChange}
                  />
                )}

                {additionalActionsRight}

                {onAddItem && (
                  <>
                    <div className="w-px h-6 bg-[var(--color-border-subtle)] mx-1" />
                    <Button
                      onClick={onAddItem}
                      variant="primary"
                      size="sm"
                      icon={<PlusIcon className="w-4 h-4" />}
                      title={addItemLabel}
                      className="shadow-sm"
                    >
                      {addItemLabel}
                    </Button>
                  </>
                )}

                {showSidePanelToggle && !inSplitView && (
                  <button
                    onClick={handleToggleSidePanel}
                    title={sidePanelOpen ? 'Hide sidepanel' : 'Show sidepanel'}
                    data-active={sidePanelOpen ? 'true' : 'false'}
                    className={cn(
                      "flex items-center justify-center rounded-full transition-all eink-header-button border border-transparent",
                      compact ? "w-8 h-8" : "w-9 h-9",
                      sidePanelOpen
                        ? "text-[var(--color-interactive-text-strong)] bg-[var(--color-interactive-bg)] hover:bg-[var(--color-interactive-bg-hover)] border-[var(--color-border-emphasis)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/60"
                    )}
                  >
                    {sidePanelOpen ? (
                      <PanelRightClose className={compact ? "w-4 h-4" : "w-5 h-5"} strokeWidth={1.75} />
                    ) : (
                      <PanelRightOpen className={compact ? "w-4 h-4" : "w-5 h-5"} strokeWidth={1.75} />
                    )}
                  </button>
                )}

                {currentPage && (
                  <PageActionsMenu
                    page={currentPage}
                    onDelete={onDelete}
                  />
                )}

                {inSplitView && onExpandSplitView && (
                  <button
                    onClick={onExpandSplitView}
                    title="Open in full view"
                    className="flex items-center justify-center w-9 h-9 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              </div>
            )}
          </div>
          )}
          
          {/* Content below header (pills, weekly strip, etc.) */}
          {belowHeader && (
            <div className={cn(CONTENT_PADDING, "pb-3")}>
              {belowHeader}
            </div>
          )}
        </div>
        </div>
      </header>
    );
  }

  // Mobile: Floating glass panel header (same architecture as desktop, optimized for mobile)
  return (
    <header className={cn(
      "w-full sticky z-20 h-px overflow-visible",
      // Base padding + safe area, but skip base padding when cover extends under notch
      hasCover ? "pt-[env(safe-area-inset-top)] md:pt-[calc(0.5rem+env(safe-area-inset-top))]" : "pt-[calc(0.5rem+env(safe-area-inset-top))]",
      // When cover extends under notch, header needs to stick below the notch
      hasCover ? "top-[env(safe-area-inset-top)]" : "top-0",
      className
    )}>
      <div className="relative pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {customHeaderContent ? (
          <div className="px-3 py-2">
            {customHeaderContent}
          </div>
        ) : (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          {/* LEFT GROUP: Navigation glass panel */}
          <div className="glass-panel-nav eink-shell-surface flex h-11 items-center gap-2 px-3 min-w-0">
            {/* Breadcrumb navigation - simplified for mobile */}
            <nav className="flex items-center gap-1 text-sm overflow-hidden min-w-0" aria-label="Breadcrumb">
              {/* Root item or back navigation */}
              {rootLabel && !currentTitle && (
                <span className="flex items-center gap-2 px-2 py-1 text-[var(--color-text-primary)] font-medium flex-shrink-0">
                  {rootIcon}
                  <span className="text-sm">{rootLabel}</span>
                </span>
              )}
              
              {/* When we have a current title, show simplified breadcrumb */}
              {currentTitle && (
                <>
                  {/* Root/parent as back link */}
                  {(rootLabel || breadcrumbs.length > 0) && (
                    <button
                      onClick={breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].onClick : onRootClick}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[var(--color-text-secondary)] hover:bg-white/50 dark:hover:bg-white/10 transition-all flex-shrink-0"
                    >
                      <ChevronRightIcon className="w-4 h-4 rotate-180" />
                      <span className="text-xs">
                        {breadcrumbs.length > 0 ? (breadcrumbs[breadcrumbs.length - 1].title || 'Back') : rootLabel}
                      </span>
                    </button>
                  )}
                  
                  {/* Current title */}
                  {currentPage && !currentPage.isDailyNote && !currentPage.isReadOnly ? (
                    <PageTitleButton
                      page={currentPage}
                      title={currentTitle}
                      icon={currentIcon}
                    />
                  ) : (
                    <span className="flex items-center gap-1.5 px-1.5 py-1 font-semibold text-[var(--color-text-primary)] truncate text-sm">
                      {currentIcon}
                      <span className="truncate">{currentTitle}</span>
                    </span>
                  )}
                </>
              )}
            </nav>

          </div>

          {hasRightControls && (
            <div className="flex items-center gap-2">
            <div className="glass-panel-nav eink-shell-surface flex h-11 items-center gap-1.5 px-3">
              {additionalActionsLeft}

              {showViewSettings && onGroupByChange && onShowCompletedChange && viewMode && (
                <SortFilterViewBar
                  contentType={contentType}
                  viewMode={viewMode}
                  onViewModeChange={onViewModeChange || (() => {})}
                  groupBy={groupBy || 'none'}
                  onGroupByChange={onGroupByChange}
                  hasSections={hasSections}
                  isTaskPageView={isTaskPageView}
                  showCompleted={showCompleted}
                  onShowCompletedChange={onShowCompletedChange}
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSortByChange={onSortByChange}
                  onSortDirectionChange={onSortDirectionChange}
                  filterBy={filterBy}
                  onFilterByChange={onFilterByChange}
                  taskSortBy={taskSortBy}
                  taskSortDirection={taskSortDirection}
                  onTaskSortByChange={onTaskSortByChange}
                  onTaskSortDirectionChange={onTaskSortDirectionChange}
                  taskFilterOptions={taskFilterOptions}
                  onTaskFilterOptionsChange={onTaskFilterOptionsChange}
                  existingTaskTags={existingTaskTags}
                  pageFilterOptions={pageFilterOptions}
                  onPageFilterOptionsChange={onPageFilterOptionsChange}
                  existingPageTags={existingPageTags}
                  onReset={onResetViewSettings}
                  taskDefaults={taskDefaults}
                  hideDueDateFilter={hideDueDateFilter}
                  showExcerpts={showExcerpts}
                  onShowExcerptsChange={onShowExcerptsChange}
                />
              )}

              {additionalActionsRight}

              {onAddItem && (
                <button
                  onClick={onAddItem}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-interactive-bg-strong)] hover:brightness-110 text-white transition-all shadow-sm"
                  title={addItemLabel}
                  aria-label={addItemLabel}
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              )}

              {showSidePanelToggle && !inSplitView && (
                <button
                  onClick={handleToggleSidePanel}
                  title={sidePanelOpen ? 'Hide sidepanel' : 'Show sidepanel'}
                  data-active={sidePanelOpen ? 'true' : 'false'}
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all w-9 h-9 eink-header-button border border-transparent",
                    sidePanelOpen
                      ? "text-[var(--color-interactive-text-strong)] bg-[var(--color-interactive-bg)] hover:bg-[var(--color-interactive-bg-hover)] border-[var(--color-border-emphasis)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/60"
                  )}
                >
                  {sidePanelOpen ? (
                    <PanelRightClose className="w-5 h-5" strokeWidth={1.75} />
                  ) : (
                    <PanelRightOpen className="w-5 h-5" strokeWidth={1.75} />
                  )}
                </button>
              )}

              {currentPage && (
                <PageActionsMenu
                  page={currentPage}
                  onDelete={onDelete}
                />
              )}
            </div>
            </div>
          )}
        </div>
        )}
        
        {/* Content below header (pills, weekly strip, etc.) */}
        {belowHeader && (
          <div className="px-3 pb-2">
            {belowHeader}
          </div>
        )}
      </div>
    </header>
  );
};

export default UnifiedHeader;
