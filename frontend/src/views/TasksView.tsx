import { getFloatingPanelLayout, getRightInsetStyle } from '@/lib/layout';
/**
 * @file TasksView.tsx
 * @description Main view component for the Tasks App using Zustand stores directly
 * @app TASKS - Primary task display view with pill navigation
 * 
 * The main content area for task management, displaying tasks in either:
 * - List view (TaskList) with collapsible groups
 * - Kanban view (KanbanView) with draggable columns
 * 
 * Features:
 * - TaskViewPills for quick filter switching (Inbox, Today, Upcoming, All Tasks)
 * - ViewHeader with title and view options
 * - Due timeline for upcoming date navigation
 * - View mode toggle (list/kanban)
 * - Grouping by date, priority, page, or section
 * - Inline task creation via AddTaskForm
 * - Page breadcrumbs when viewing a task page
 * - Manage Sections button for task page views
 * 
 * Route Props (from TanStack Router):
 * - routeFilter: TaskFilter from URL (/tasks/:filter)
 * - routeTaskPageId: Page ID from URL (/tasks/:id)
 * 
 * Store integration:
 * - useTasks(): Derived task array from normalized state
 * - useTaskCollections(): Derived task pages array
 * - navigationStore: View preferences (route props override navigation state)
 * - uiStore: Form editing state, unsaved changes protection
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate } from '@tanstack/react-router';
import { getTodayISO, getToday, dayjs } from '../lib/dateUtils';
import type { Task } from '@/types/task';
import type { UpdatePageInput } from '@/types/page';
import TaskList from '../components/tasks/TaskList';
import KanbanView from '../components/tasks/KanbanView';
import TaskTableView from '../components/tasks/TaskTableView';
import TaskViewPills from '../components/tasks/TaskViewPills';
import DueTimelineStrip from '../components/common/DueTimelineStrip';
import UnifiedHeader, { type BreadcrumbItem } from '../components/layout/UnifiedHeader';
import UnifiedSidepanel, { UNIFIED_SIDEPANEL_DOCK_WIDTH, UNIFIED_SIDEPANEL_FLOATING_GUTTER, UNIFIED_SIDEPANEL_FLOATING_RESERVE_WIDTH } from '../components/layout/UnifiedSidepanel';
import FloatingSidePanelLayout from '../components/layout/FloatingSidePanelLayout';
import PageHero from '../components/pages/PageHero';
import SectionManagerModal from '../components/pages/SectionManagerModal';
import type { ViewMode, GroupBy } from '../components/layout/ViewSwitcher';
import type { TaskFilterOptions } from '../types/view';
import { DEFAULT_TASK_FILTER_OPTIONS } from '../types/view';
import { applyTaskFilterOptions, collectTaskTags } from '../lib/selectors';
import { dateGroupToDate, type DateGroupKey } from '../lib/dateGroups';
import { selectSidebarCounts } from '../lib/selectors';
import { Button, Container, FloatingPanel, LucideIcon, SmartEmptyState } from '@/components/ui';
import { SavedViewsBar } from '@/components/ui/SavedViewsBar';
import SortFilterViewBar from '../components/layout/SortFilterViewBar';
import { CheckIcon } from '../components/common/Icons';
import PomodoroTimer from '../components/pomodoro/PomodoroTimer';
import InlineFocusTimer from '../components/pomodoro/InlineFocusTimer';
import { useIsMobile, useIsDesktop } from '@frameer/hooks/useMobileDetection';
import type { TaskViewConfig, CollectionViewConfig, PageSavedView } from '@/types/savedView';

// Zustand stores with custom hooks
import { useTasksStore, useTasks } from '../stores/tasksStore';
import { usePagesStore, useTaskCollections, type PagesState } from '@/stores/pagesStore';
import { useNavigationStore, getViewKey, getDefaultPreferences, type TaskFilter } from '../stores/navigationStore';
import { useUIStore } from '../stores/uiStore';
import { usePomodoroStore } from '../stores/pomodoroStore';

interface TasksViewProps {
  /** Route-provided task filter (overrides store) */
  routeFilter?: TaskFilter;
  /** Route-provided task page ID (page with viewMode='tasks') */
  routeTaskPageId?: string;
}

const TasksView: React.FC<TasksViewProps> = ({
  routeFilter,
  routeTaskPageId,
}) => {
  // Mobile detection - hide add button on mobile (use FAB instead)
  const isMobile = useIsMobile();
  // Desktop detection for reading pane (disable on tablet < 1024px)
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();

  // Use route props if provided, otherwise fall back to store
  const selectedTaskPageId = routeTaskPageId ?? null;
  const isTaskPageView = !!routeTaskPageId;

  // === ZUSTAND STORES ===
  
  // Tasks - derived array via custom hook
  const tasks = useTasks();
  const tasksById = useTasksStore((state) => state.tasksById);
  const toggleComplete = useTasksStore((state) => state.toggleComplete);
  const updateTask = useTasksStore((state) => state.updateTask);

  // Task collections (pages with viewMode='tasks')
  const { taskCollections: taskPages } = useTaskCollections();
  const taskPagesById = useMemo(() => {
    const map: Record<string, typeof taskPages[0]> = {};
    taskPages.forEach(p => { map[p.id] = p; });
    return map;
  }, [taskPages]);
  const updateTaskPage = usePagesStore((state: PagesState) => state.updatePage);
  
  // Get the selected task page directly from the store for real-time updates
  const selectedTaskPageFromStore = usePagesStore((state: PagesState) => 
    selectedTaskPageId ? state.pagesById[selectedTaskPageId] : null
  );

  // UI store
  const {
    formDirty,
    requestNavigation,
    openSectionManager,
    openTaskInContext,
    createTaskInContext,
  } = useUIStore(useShallow((state) => ({
    formDirty: state.formDirty,
    requestNavigation: state.requestNavigation,
    openSectionManager: state.openSectionManager,
    openTaskInContext: state.openTaskInContext,
    createTaskInContext: state.createTaskInContext,
  })));

  // Navigation store
  const sidebarVisible = useNavigationStore((state) => state.sidebarVisible);
  const setSidebarVisible = useNavigationStore((state) => state.setSidebarVisible);
  const toggleSidebar = useCallback(() => setSidebarVisible(!sidebarVisible), [setSidebarVisible, sidebarVisible]);

  const { 
    taskFilter: storeTaskFilter, 
    setTaskFilter, 
    viewPreferences, 
    setViewPreference,
    setTaskFilterOptions,
    sidePanelOpen,
    setSidePanelOpen,
  } = useNavigationStore(useShallow((state) => ({
    taskFilter: state.taskFilter,
    setTaskFilter: state.setTaskFilter,
    viewPreferences: state.viewPreferences,
    setViewPreference: state.setViewPreference,
    setTaskFilterOptions: state.setTaskFilterOptions,
    sidePanelOpen: state.sidePanelOpen,
    setSidePanelOpen: state.setSidePanelOpen,
  })));

  // Subscribe to the full map so useMemo re-runs when options change
  const taskFilterOptionsMap = useNavigationStore(useShallow((s) => s.taskFilterOptions));

  // Pomodoro store
  const isImmersive = usePomodoroStore((state) => state.isImmersive);
  const exitImmersive = usePomodoroStore((state) => state.exitImmersive);

  // === STATE ===

  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);

  // === DERIVED VALUES ===

  const taskFilter = routeFilter ?? storeTaskFilter;
  const todayISO = useMemo(() => getTodayISO(), []);
  const _today = useMemo(() => getToday(), []);
  const sidebarCounts = useMemo(() => selectSidebarCounts(tasks, todayISO), [tasks, todayISO]);

  const selectedTaskPageLive = isTaskPageView ? selectedTaskPageFromStore : null;
  const viewKey = getViewKey(isTaskPageView ? 'taskPage' : 'tasks', selectedTaskPageId, taskFilter);
  
  const currentViewPrefs = useMemo(() => {
    const stored = viewPreferences[viewKey];
    const defaults = getDefaultPreferences(viewKey);
    if (isTaskPageView && selectedTaskPageLive) {
      return {
        viewMode: selectedTaskPageLive.tasksViewMode || 'list',
        groupBy: selectedTaskPageLive.tasksGroupBy || 'none',
        showCompleted: selectedTaskPageLive.showCompletedTasks ?? false,
        taskSortBy: stored?.taskSortBy || defaults.taskSortBy || 'date' as const,
        taskSortDirection: stored?.taskSortDirection || defaults.taskSortDirection || 'desc' as const,
      };
    }
    return {
      viewMode: stored?.viewMode || defaults.viewMode,
      groupBy: stored?.groupBy || defaults.groupBy,
      showCompleted: stored?.showCompleted ?? defaults.showCompleted,
      taskSortBy: stored?.taskSortBy || defaults.taskSortBy || 'date' as const,
      taskSortDirection: stored?.taskSortDirection || defaults.taskSortDirection || 'desc' as const,
    };
  }, [isTaskPageView, selectedTaskPageLive, viewPreferences, viewKey]);

  const { viewMode, groupBy, showCompleted, taskSortBy, taskSortDirection } = currentViewPrefs;

  // Filter options for the current view (persisted to localStorage, reactive)
  const taskFilterOptions: TaskFilterOptions = useMemo(
    () => taskFilterOptionsMap[viewKey] ?? DEFAULT_TASK_FILTER_OPTIONS,
    [viewKey, taskFilterOptionsMap]
  );

  // All unique tags across tasks in this view (for filter suggestions)
  const allTaskTags = useMemo(() => collectTaskTags(tasks), [tasks]);

  const showSidePanel = isDesktop && sidePanelOpen;

  const currentTaskConfig = useMemo((): TaskViewConfig => ({
    viewMode: viewMode as ViewMode,
    groupBy: groupBy as GroupBy,
    showCompleted,
    sortBy: taskSortBy,
    sortDirection: taskSortDirection,
    filterOptions: taskFilterOptions,
  }), [viewMode, groupBy, showCompleted, taskSortBy, taskSortDirection, taskFilterOptions]);

  const filteredTasks = useMemo(() => {
    let viewFiltered: Task[];
    if (isTaskPageView && selectedTaskPageId) {
      viewFiltered = tasks.filter(t => t.parentPageId === selectedTaskPageId);
    } else {
      switch (taskFilter) {
        case 'inbox':
          viewFiltered = tasks.filter(t => !t.parentPageId);
          break;
        case 'today':
          viewFiltered = tasks.filter(t => {
            if (!t.dueDate) return false;
            const due = dayjs(t.dueDate);
            return due.isSame(dayjs(todayISO), 'day') || due.isBefore(dayjs(todayISO), 'day');
          });
          break;
        case 'upcoming':
          viewFiltered = tasks.filter(t => !!t.dueDate);
          break;
        case 'all':
        default:
          viewFiltered = [...tasks];
          break;
      }
    }
    if (!showCompleted) {
      viewFiltered = viewFiltered.filter((t: Task) => !t.completed);
    }
    // Apply filter options (priority, tag, due date)
    return applyTaskFilterOptions(viewFiltered, taskFilterOptions, todayISO);
  }, [tasks, isTaskPageView, selectedTaskPageId, taskFilter, todayISO, showCompleted, taskFilterOptions]);

  // === HANDLERS ===

  const handleTaskClick = useCallback((taskId: string | null) => {
    if (taskId) {
      openTaskInContext(taskId);
    }
  }, [openTaskInContext]);

  const handleCreateTask = useCallback((defaults?: {
    defaultDueDate?: string;
    defaultTaskPageId?: string;
    defaultSection?: string;
    defaultTag?: string;
    defaultPriority?: 'Low' | 'Medium' | 'High';
  }) => {
    createTaskInContext(defaults || {});
  }, [createTaskInContext]);

  const handleFilterOptionsChange = useCallback((opts: TaskFilterOptions) => {
    setTaskFilterOptions(viewKey, opts);
    // Also persist to task page if viewing one
    if (isTaskPageView && selectedTaskPageId) {
      updateTaskPage(selectedTaskPageId, { tasksFilterOptions: JSON.stringify(opts) });
    }
  }, [setTaskFilterOptions, viewKey, isTaskPageView, selectedTaskPageId, updateTaskPage]);

  const handleSavedViewUpdate = useCallback((
    updates: { savedViews?: PageSavedView[]; activeSavedViewId?: string | null },
    configToApply?: TaskViewConfig | CollectionViewConfig | null
  ) => {
    if (!selectedTaskPageId) return;
    const batchedUpdates: UpdatePageInput = { ...updates };
    if (configToApply && 'showCompleted' in configToApply) {
      const taskConfig = configToApply as TaskViewConfig;
      batchedUpdates.tasksViewMode = taskConfig.viewMode === 'graph' ? 'list' : taskConfig.viewMode;
      batchedUpdates.tasksGroupBy = taskConfig.groupBy as 'date' | 'priority' | 'section' | 'tag' | 'none' | 'parentPage';
      batchedUpdates.showCompletedTasks = taskConfig.showCompleted;
      setViewPreference(viewKey, 'taskSortBy', taskConfig.sortBy);
      setViewPreference(viewKey, 'taskSortDirection', taskConfig.sortDirection);
      // Apply filter options from saved view
      if (taskConfig.filterOptions) {
        handleFilterOptionsChange(taskConfig.filterOptions);
      }
    }
    updateTaskPage(selectedTaskPageId, batchedUpdates);
  }, [selectedTaskPageId, updateTaskPage, setViewPreference, viewKey, handleFilterOptionsChange]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (isTaskPageView && selectedTaskPageId) {
      updateTaskPage(selectedTaskPageId, { tasksViewMode: mode as 'list' | 'kanban' | 'table' });
    } else {
      setViewPreference(viewKey, 'viewMode', mode);
    }
  }, [isTaskPageView, selectedTaskPageId, updateTaskPage, setViewPreference, viewKey]);

  const handleGroupByChange = useCallback((gb: GroupBy) => {
    const mappedGroupBy = gb === 'taskPage' ? 'none' : gb;
    if (isTaskPageView && selectedTaskPageId) {
      updateTaskPage(selectedTaskPageId, { tasksGroupBy: mappedGroupBy as 'date' | 'priority' | 'section' | 'tag' | 'none' | 'parentPage' });
    } else {
      setViewPreference(viewKey, 'groupBy', gb as 'date' | 'priority' | 'taskPage' | 'section');
    }
  }, [isTaskPageView, selectedTaskPageId, updateTaskPage, setViewPreference, viewKey]);

  const handleShowCompletedChange = useCallback((show: boolean) => {
    if (isTaskPageView && selectedTaskPageId) {
      updateTaskPage(selectedTaskPageId, { showCompletedTasks: show });
    } else {
      setViewPreference(viewKey, 'showCompleted', show);
    }
  }, [isTaskPageView, selectedTaskPageId, updateTaskPage, setViewPreference, viewKey]);

  const handleTaskSortByChange = useCallback((sortBy: 'date' | 'priority' | 'title' | 'created' | 'tag') => {
    setViewPreference(viewKey, 'taskSortBy', sortBy);
  }, [setViewPreference, viewKey]);

  const handleTaskSortDirectionChange = useCallback((direction: 'asc' | 'desc') => {
    setViewPreference(viewKey, 'taskSortDirection', direction);
  }, [setViewPreference, viewKey]);

  // Per-filter defaults for ViewSwitcher reset and hasActiveFilters
  const currentTaskDefaults = useMemo(() => {
    const defaults = getDefaultPreferences(viewKey);
    return {
      viewMode: defaults.viewMode || 'list',
      groupBy: defaults.groupBy || 'none',
      showCompleted: defaults.showCompleted ?? false,
      taskSortBy: defaults.taskSortBy || 'date',
      taskSortDirection: defaults.taskSortDirection || 'desc',
    };
  }, [viewKey]);

  const handleResetToDefaults = useCallback(() => {
    const defaults = getDefaultPreferences(viewKey);
    handleViewModeChange((defaults.viewMode || 'list') as ViewMode);
    handleGroupByChange((defaults.groupBy || 'none') as GroupBy);
    handleShowCompletedChange(defaults.showCompleted ?? false);
    handleTaskSortByChange((defaults.taskSortBy || 'date') as 'date' | 'priority' | 'title' | 'created' | 'tag');
    handleTaskSortDirectionChange((defaults.taskSortDirection || 'desc') as 'asc' | 'desc');
    setTaskFilterOptions(viewKey, DEFAULT_TASK_FILTER_OPTIONS);
  }, [viewKey, handleViewModeChange, handleGroupByChange, handleShowCompletedChange, handleTaskSortByChange, handleTaskSortDirectionChange, setTaskFilterOptions]);

  const handleTaskDrop = useCallback((taskId: string, targetGroup: string, currentGroupBy: GroupBy) => {
    const task = tasksById[taskId];
    if (!task) return;
    const updates: Partial<Task> = {};
    if (currentGroupBy === 'date') {
      updates.dueDate = dateGroupToDate(targetGroup as DateGroupKey, getToday());
    } else if (currentGroupBy === 'priority') {
      switch (targetGroup) {
        case 'high': updates.priority = 'High'; break;
        case 'medium': updates.priority = 'Medium'; break;
        case 'low': updates.priority = 'Low'; break;
        case 'none': updates.priority = undefined; break;
      }
    } else if (currentGroupBy === 'taskPage') {
      updates.parentPageId = targetGroup === 'inbox' ? undefined : targetGroup;
      updates.sectionId = undefined;
    } else if (currentGroupBy === 'section') {
      updates.sectionId = targetGroup === 'unassigned' ? undefined : targetGroup;
    } else if (currentGroupBy === 'tag') {
      updates.tag = targetGroup === '__no_tag__' ? undefined : targetGroup;
    }
    updateTask(taskId, updates);
  }, [tasksById, updateTask]);

  const _handleStartCreate = useCallback((): boolean => {
    if (formDirty) {
      requestNavigation({ type: 'task', target: null });
      return false;
    }
    const defaults: { defaultDueDate?: string; defaultTaskPageId?: string } = {};
    if (isTaskPageView && selectedTaskPageId) {
      defaults.defaultTaskPageId = selectedTaskPageId;
    } else if (taskFilter === 'today' || taskFilter === 'upcoming') {
      defaults.defaultDueDate = getTodayISO();
    }
    handleCreateTask(Object.keys(defaults).length > 0 ? defaults : undefined);
    return true;
  }, [formDirty, requestNavigation, handleCreateTask, isTaskPageView, selectedTaskPageId, taskFilter]);

  const handleAddTaskToGroup = useCallback((groupKey: string, currentGroupBy: GroupBy) => {
    const defaults: { defaultDueDate?: string; defaultTaskPageId?: string; defaultSection?: string; defaultTag?: string; defaultPriority?: 'Low' | 'Medium' | 'High' } = {};
    if (isTaskPageView && selectedTaskPageId) {
      defaults.defaultTaskPageId = selectedTaskPageId;
    }
    if (currentGroupBy === 'date') {
      const date = dateGroupToDate(groupKey as DateGroupKey, getToday());
      if (date) defaults.defaultDueDate = date;
    } else if (currentGroupBy === 'priority') {
      if (groupKey === 'high') defaults.defaultPriority = 'High';
      else if (groupKey === 'medium') defaults.defaultPriority = 'Medium';
      else if (groupKey === 'low') defaults.defaultPriority = 'Low';
    } else if (currentGroupBy === 'taskPage') {
      if (groupKey !== 'inbox') defaults.defaultTaskPageId = groupKey;
    } else if (currentGroupBy === 'section') {
      if (groupKey !== 'unassigned') defaults.defaultSection = groupKey;
    } else if (currentGroupBy === 'tag') {
      if (groupKey !== 'none' && groupKey !== 'untagged' && groupKey !== '__no_tag__') defaults.defaultTag = groupKey;
    }
    handleCreateTask(Object.keys(defaults).length > 0 ? defaults : undefined);
  }, [isTaskPageView, selectedTaskPageId, handleCreateTask]);

  const getTitle = () => {
    if (isTaskPageView && selectedTaskPageId && taskPagesById[selectedTaskPageId]) {
      return taskPagesById[selectedTaskPageId].title;
    }
    return null;
  };

  const handleScrollToDate = useCallback((iso: string) => {
    const taskElement = document.querySelector(`[data-due="${iso}"]`);
    if (taskElement) {
      taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // === EFFECTS ===

  React.useEffect(() => {
    if (routeFilter && routeFilter !== storeTaskFilter) {
      setTaskFilter(routeFilter);
    }
  }, [routeFilter, storeTaskFilter, setTaskFilter]);

  // Sync sort settings when activeSavedViewId changes (including from SSE updates).
  // This ensures that when a saved view is activated on another device, the sort settings
  // are applied locally, preventing the auto-save effect from detecting a false "modification".
  React.useEffect(() => {
    if (!isTaskPageView || !selectedTaskPageLive) return;
    
    const activeViewId = selectedTaskPageLive.activeSavedViewId;
    if (!activeViewId) return;
    
    const savedViews = selectedTaskPageLive.savedViews || [];
    const activeView = savedViews.find(v => v.id === activeViewId);
    if (!activeView || !('showCompleted' in activeView.config)) return;
    
    const taskConfig = activeView.config as TaskViewConfig;
    // Apply the saved view's sort settings to local preferences
    // This is idempotent - setting the same value doesn't cause issues
    setViewPreference(viewKey, 'taskSortBy', taskConfig.sortBy);
    setViewPreference(viewKey, 'taskSortDirection', taskConfig.sortDirection);
  }, [isTaskPageView, selectedTaskPageLive, setViewPreference, viewKey]);

  const taskPageBreadcrumbs = useMemo((): BreadcrumbItem[] => {
    if (!isTaskPageView || !selectedTaskPageId) return [];
    const taskPage = taskPagesById[selectedTaskPageId];
    if (!taskPage) return [];
    const parentChain: BreadcrumbItem[] = [];
    let currentParentId = taskPage.parentId;
    while (currentParentId && taskPagesById[currentParentId]) {
      const parent = taskPagesById[currentParentId];
      const parentId = parent.id;
      parentChain.unshift({
        id: parent.id,
        title: parent.title,
        icon: parent.icon || undefined,
        onClick: () => navigate({ to: '/tasks/$filter', params: { filter: parentId } }),
      });
      currentParentId = parent.parentId;
    }
    return parentChain;
  }, [isTaskPageView, selectedTaskPageId, taskPagesById, navigate]);

  const headerActionsLeft = taskFilter === 'today' && !isTaskPageView ? (
    <InlineFocusTimer todayTasks={filteredTasks} size="sm" variant="header" />
  ) : null;

  const headerActionsRight = isTaskPageView && selectedTaskPageId && groupBy === 'section' ? (
    <Button onClick={() => openSectionManager(selectedTaskPageId)} variant="secondary" size="sm">
      Manage Sections
    </Button>
  ) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FloatingSidePanelLayout
        side="right"
        isOpen={showSidePanel}
        onOpenChange={setSidePanelOpen}
        pinned={false}
        railWidth={0}
        collapsedWidth={0}
        defaultExpandedWidth={UNIFIED_SIDEPANEL_DOCK_WIDTH}
        expandedWidth={UNIFIED_SIDEPANEL_DOCK_WIDTH}
        gutterPx={UNIFIED_SIDEPANEL_FLOATING_GUTTER}
        className="flex-1 overflow-hidden"
        contentClassName="flex h-full flex-col overflow-hidden"
        applyContentInset={false}
        renderPanel={() => (
          <UnifiedSidepanel floating currentPage={selectedTaskPageFromStore ?? undefined} />
        )}
      >
        {({ reserveWidth }) => (
          <div
            className="flex-1 overflow-y-auto pb-32 md:pb-6 view-content"
          >
            {isTaskPageView && selectedTaskPageId && selectedTaskPageFromStore?.coverImage && (
              <PageHero
                pageId={selectedTaskPageId}
                title={getTitle() || ''}
                coverImage={selectedTaskPageFromStore.coverImage}
                coverGradient={selectedTaskPageFromStore.coverGradient}
                coverAttribution={selectedTaskPageFromStore.coverAttribution}
                editableCover={true}
                onCoverChange={(cover) => updateTaskPage(selectedTaskPageId, { coverImage: cover })}
                hideActions={true}
                icon={selectedTaskPageFromStore.icon}
                color={selectedTaskPageFromStore.color}
                viewMode="tasks"
                hideTitle={true}
                tags={selectedTaskPageFromStore.tags}
                contentRightInsetPx={reserveWidth}
              />
            )}
            <div style={getRightInsetStyle(reserveWidth)}>
            <UnifiedHeader
              sidebarVisible={sidebarVisible}
              onToggleSidebar={toggleSidebar}
              rootLabel="Tasks"
              rootIcon={<CheckIcon className="w-4 h-4" />}
              breadcrumbs={taskPageBreadcrumbs}
              currentTitle={getTitle() || undefined}
              hasCover={!!selectedTaskPageFromStore?.coverImage}
              currentIcon={isTaskPageView && selectedTaskPageId && taskPagesById[selectedTaskPageId]?.icon ? (
                <LucideIcon name={taskPagesById[selectedTaskPageId].icon!} className="w-4 h-4" style={{ color: taskPagesById[selectedTaskPageId].color || undefined }} />
              ) : undefined}
              viewMode={!isTaskPageView ? viewMode : undefined}
              onViewModeChange={!isTaskPageView ? handleViewModeChange : undefined}
              showViewSettings={!isTaskPageView}
              groupBy={!isTaskPageView ? groupBy : undefined}
              showCompleted={!isTaskPageView ? showCompleted : false}
              onGroupByChange={!isTaskPageView ? handleGroupByChange : undefined}
              onShowCompletedChange={!isTaskPageView ? handleShowCompletedChange : undefined}
              contentType="tasks"
              hasSections={!!isTaskPageView}
              isTaskPageView={isTaskPageView}
              additionalActionsLeft={headerActionsLeft}
              additionalActionsRight={headerActionsRight}
              taskSortBy={!isTaskPageView ? taskSortBy : undefined}
              taskSortDirection={!isTaskPageView ? taskSortDirection : undefined}
              onTaskSortByChange={!isTaskPageView ? handleTaskSortByChange : undefined}
              onTaskSortDirectionChange={!isTaskPageView ? handleTaskSortDirectionChange : undefined}
              onResetViewSettings={!isTaskPageView ? handleResetToDefaults : undefined}
              taskDefaults={!isTaskPageView ? currentTaskDefaults : undefined}
              taskFilterOptions={!isTaskPageView ? taskFilterOptions : undefined}
              onTaskFilterOptionsChange={!isTaskPageView ? handleFilterOptionsChange : undefined}
              existingTaskTags={!isTaskPageView ? allTaskTags : undefined}
              hideDueDateFilter={!isTaskPageView}
              showSidePanelToggle={true}
              sidePanelOpen={sidePanelOpen}
              currentPage={isTaskPageView ? selectedTaskPageFromStore ?? undefined : undefined}
              showDeleteButton={false}
            />

            <Container className="pt-[calc(var(--header-height)+1.5rem)] py-2">
              {!isTaskPageView && (
                <div className="mb-2">
                  <TaskViewPills
                    activeFilter={taskFilter}
                    counts={{
                      inbox: sidebarCounts.inboxCount,
                      today: sidebarCounts.todayCount + sidebarCounts.overdueCount,
                      upcoming: sidebarCounts.upcomingCount,
                      all: sidebarCounts.allCount,
                    }}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {isTaskPageView && selectedTaskPageLive && (
                    <SavedViewsBar
                      page={selectedTaskPageLive}
                      onUpdatePage={handleSavedViewUpdate}
                      currentConfig={currentTaskConfig}
                    />
                  )}
                </div>
                {isTaskPageView && (
                  <SortFilterViewBar
                    contentType="tasks"
                    viewMode={viewMode}
                    onViewModeChange={handleViewModeChange}
                    groupBy={groupBy}
                    onGroupByChange={handleGroupByChange}
                    hasSections
                    isTaskPageView
                    showCompleted={showCompleted}
                    onShowCompletedChange={handleShowCompletedChange}
                    taskSortBy={taskSortBy}
                    taskSortDirection={taskSortDirection}
                    onTaskSortByChange={handleTaskSortByChange}
                    onTaskSortDirectionChange={handleTaskSortDirectionChange}
                    taskFilterOptions={taskFilterOptions}
                    onTaskFilterOptionsChange={handleFilterOptionsChange}
                    existingTaskTags={allTaskTags}
                    onReset={handleResetToDefaults}
                    taskDefaults={currentTaskDefaults}
                    className="flex-shrink-0"
                  />
                )}
              </div>
            </Container>

            {taskFilter === 'upcoming' && !isTaskPageView && !isMobile && (
              <Container className="pt-2">
                <div className="-mx-1 md:-mx-2 lg:-mx-3">
                  <DueTimelineStrip
                    highlightedDate={highlightedDate}
                    tasks={filteredTasks}
                    todayISO={todayISO}
                    onSelectDate={(iso) => setHighlightedDate(iso)}
                    onScrollToDate={handleScrollToDate}
                    hideBorder
                  />
                </div>
              </Container>
            )}

            {filteredTasks.length === 0 ? (
              <Container>
                <SmartEmptyState 
                  type={isTaskPageView ? 'tasks' : taskFilter}
                  onAction={() => handleCreateTask()}
                  actionLabel="Add Task"
                />
              </Container>
            ) : (
              <>
                {viewMode === 'table' ? (
                  <Container>
                    <TaskTableView
                      tasks={filteredTasks}
                      onToggleComplete={toggleComplete}
                      groupBy={groupBy}
                      todayDate={todayISO}
                      onEditTask={(id: string | null) => handleTaskClick(id)}
                      taskPages={taskPages}
                      onTaskDrop={handleTaskDrop}
                      sortBy={taskSortBy}
                      sortDirection={taskSortDirection}
                      onAddTaskToGroup={handleAddTaskToGroup}
                      showParentPage={!isTaskPageView}
                    />
                  </Container>
                ) : viewMode === 'kanban' ? (
                  <KanbanView
                    tasks={filteredTasks}
                    onToggleComplete={toggleComplete}
                    groupBy={groupBy}
                    todayDate={todayISO}
                    onEditTask={(id) => handleTaskClick(id)}
                    taskPages={taskPages}
                    onTaskDrop={handleTaskDrop}
                    sortBy={taskSortBy}
                    sortDirection={taskSortDirection}
                    onAddTaskToGroup={handleAddTaskToGroup}
                    showParentPage={!isTaskPageView}
                  />
                ) : (
                  <Container>
                    <TaskList
                      tasks={filteredTasks}
                      onToggleComplete={toggleComplete}
                      view={isTaskPageView ? 'taskPage' : taskFilter}
                      onEditTask={(id) => handleTaskClick(id)}
                      todayDate={todayISO}
                      taskPages={taskPages}
                      groupBy={groupBy}
                      onTaskDrop={handleTaskDrop}
                      onHighlightedDateChange={undefined}
                      sortBy={taskSortBy}
                      sortDirection={taskSortDirection}
                      onAddTaskToGroup={handleAddTaskToGroup}
                    />
                  </Container>
                )}
              </>
            )}
            </div>
          </div>
        )}
      </FloatingSidePanelLayout>
      <SectionManagerModal />
      {isImmersive && <PomodoroTimer onClose={exitImmersive} tasks={filteredTasks} />}
    </div>
  );
};

export default TasksView;
