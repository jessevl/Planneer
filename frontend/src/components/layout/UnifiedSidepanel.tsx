/**
 * @file UnifiedSidepanel.tsx
 * @description Config-driven right-side utility panel for page and task contexts
 * @app SHARED - Used by TasksView, PagesView, PageDetailView
 *
 * Features:
 * - Declarative layout per route/page context (see sidepanelConfig.ts)
 * - Persisted tab selection with automatic fallback to context default
 * - Quick task editor with dirty-change guard (see useTaskPaneState)
 * - Embedded local relationship graph
 * - Task overview with today/upcoming sections
 * - Layout-aware task actions (sidepanel editor or modal, depending on context)
 */
import React, { Suspense } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { CheckSquare, Focus, Info, ListChecks, Network, Plus, X } from 'lucide-react';

const PageRelationshipGraph = React.lazy(() => import('@/components/pages/PageRelationshipGraph'));

import ConfirmDiscardModal from '@/components/common/ConfirmDiscardModal';
import ItemIcon from '@/components/common/ItemIcon';
import type { PageRelationshipGraphHandle } from '@/components/pages/PageRelationshipGraph';
import CompactTaskRow from '@/components/tasks/CompactTaskRow';
import TaskDetailPane from '@/components/tasks/TaskDetailPane';
import { IconButton, InlineTagInput } from '@/components/ui';
import { useBacklinks } from '@/hooks/useBacklinks';
import { useTaskPaneState } from '@/hooks/useTaskPaneState';
import { buildRelationshipGraph, collectGraphTasks, createVisibleRelationshipGraph, relationshipGraphIds } from '@/lib/relationshipGraph';
import { cn } from '@/lib/design-system';
import { dayjs, getTodayISO, isOverdue, isToday } from '@/lib/dateUtils';
import { FLOATING_PANEL_GUTTER_PX, getFloatingPanelReserveWidth } from '@/lib/layout';
import { resolveSidepanelContext, getSidepanelLayout } from '@/lib/sidepanelConfig';
import { useNavigationStore, type UnifiedSidepanelTab } from '@/stores/navigationStore';
import { usePagesStore, useTaskCollections } from '@/stores/pagesStore';
import { useTasksStore } from '@/stores/tasksStore';
import { useUIStore } from '@/stores/uiStore';
import type { Page } from '@/types/page';
import type { Task } from '@/types/task';

// ─── Constants ──────────────────────────────────────────────────────────

export const UNIFIED_SIDEPANEL_DOCK_WIDTH = 328;
export const UNIFIED_SIDEPANEL_FLOATING_GUTTER = FLOATING_PANEL_GUTTER_PX;
export const UNIFIED_SIDEPANEL_FLOATING_RESERVE_WIDTH = getFloatingPanelReserveWidth(UNIFIED_SIDEPANEL_DOCK_WIDTH, UNIFIED_SIDEPANEL_FLOATING_GUTTER);

interface TabMeta {
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TAB_META: Record<UnifiedSidepanelTab, TabMeta> = {
  graph:           { label: 'Local graph',    shortLabel: 'Graph', icon: Network },
  metadata:        { label: 'Metadata',       shortLabel: 'Meta',  icon: Info },
  'task-editor':   { label: 'Task editor',    shortLabel: 'Edit',  icon: CheckSquare },
  'task-overview': { label: 'Task overview',  shortLabel: 'Tasks', icon: ListChecks },
};

// ─── Props ──────────────────────────────────────────────────────────────

interface UnifiedSidepanelProps {
  currentPage?: Page | null;
  childPages?: Page[];
  floating?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function pageIconType(page: Page): 'note' | 'collection' | 'daily' | 'tasks' {
  if ((page as Page & { isDailyNote?: boolean }).isDailyNote) return 'daily';
  if (page.viewMode === 'collection') return 'collection';
  if (page.viewMode === 'tasks') return 'tasks';
  return 'note';
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function sortTasksForOverview(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return (b.created ?? '').localeCompare(a.created ?? '');
  });
}

function filterOverviewTasks(tasks: Task[], filter: 'today' | 'upcoming'): Task[] {
  const open = tasks.filter((t) => !t.completed);
  return filter === 'today'
    ? open.filter((t) => isToday(t.dueDate) || isOverdue(t.dueDate))
    : open.filter((t) => !!t.dueDate && !isToday(t.dueDate) && !isOverdue(t.dueDate));
}

// ─── Component ──────────────────────────────────────────────────────────

const UnifiedSidepanel: React.FC<UnifiedSidepanelProps> = ({
  currentPage,
  childPages = [],
  floating = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Config-driven layout
  const context = resolveSidepanelContext(location.pathname, currentPage);
  const layout = getSidepanelLayout(context);
  const hasGraphTab = layout.tabs.includes('graph');
  const hasOverviewTab = layout.tabs.includes('task-overview');
  const hasEditorTab = layout.tabs.includes('task-editor');

  // Stores
  const { taskCollections } = useTaskCollections();
  const pagesById = usePagesStore((s) => s.pagesById);
  const updatePage = usePagesStore((s) => s.updatePage);
  const tasksById = useTasksStore((s) => s.tasksById);
  const taskOrder = useTasksStore((s) => s.taskOrder);
  const toggleComplete = useTasksStore((s) => s.toggleComplete);
  const sidePanelTab = useNavigationStore((s) => s.sidePanelTab);
  const setSidePanelOpen = useNavigationStore((state) => state.setSidePanelOpen);
  const setSidePanelTab = useNavigationStore((s) => s.setSidePanelTab);
  const openSidePanel = useNavigationStore((s) => s.openSidePanel);
  const startEditingTask = useUIStore((s) => s.startEditingTask);
  const startCreatingTask = useUIStore((s) => s.startCreatingTask);
  const openTaskPane = useUIStore((s) => s.openTaskPane);

  // Task pane dirty-guard
  const pane = useTaskPaneState();

  // Tab selection — fall back to layout default when persisted tab is unavailable
  const activeTab = layout.tabs.includes(sidePanelTab) ? sidePanelTab : layout.defaultTab;

  React.useEffect(() => {
    if (!layout.tabs.includes(sidePanelTab)) {
      setSidePanelTab(layout.defaultTab);
    }
  }, [layout, setSidePanelTab, sidePanelTab]);

  // ── Derived data (gated by tab availability for performance) ──────────

  const allPages = React.useMemo(() => Object.values(pagesById), [pagesById]);
  const allTasks = React.useMemo(
    () => taskOrder.map((id) => tasksById[id]).filter((t): t is Task => !!t),
    [taskOrder, tasksById],
  );

  // Graph data (skipped when graph tab is not in the layout)
  const graphPages = React.useMemo(
    () => hasGraphTab ? allPages.filter((p) => !(p as Page & { isDailyNote?: boolean }).isDailyNote) : [],
    [allPages, hasGraphTab],
  );
  const graphTasks = React.useMemo(
    () => hasGraphTab ? collectGraphTasks(graphPages, allTasks) : [],
    [graphPages, allTasks, hasGraphTab],
  );
  const relationshipGraph = React.useMemo(
    () => hasGraphTab ? buildRelationshipGraph(graphPages, graphTasks) : null,
    [graphPages, graphTasks, hasGraphTab],
  );
  const focusedNodeId = React.useMemo(
    () => currentPage && hasGraphTab ? relationshipGraphIds.page(currentPage.id) : null,
    [currentPage, hasGraphTab],
  );
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(focusedNodeId);
  React.useEffect(() => { setSelectedNodeId(focusedNodeId); }, [focusedNodeId]);

  const visibleGraph = React.useMemo(() => {
    if (!hasGraphTab || !relationshipGraph) return null;
    return createVisibleRelationshipGraph(
      relationshipGraph, graphPages, '', true, true, true,
      selectedNodeId ?? focusedNodeId, true,
    );
  }, [focusedNodeId, graphPages, hasGraphTab, relationshipGraph, selectedNodeId]);

  // Task overview data (skipped when overview tab is not in the layout)
  const todayTasks = React.useMemo(
    () => hasOverviewTab ? sortTasksForOverview(filterOverviewTasks(allTasks, 'today')) : [],
    [allTasks, hasOverviewTab],
  );
  const upcomingTasks = React.useMemo(
    () => hasOverviewTab ? sortTasksForOverview(filterOverviewTasks(allTasks, 'upcoming')) : [],
    [allTasks, hasOverviewTab],
  );

  const backlinks = useBacklinks(currentPage?.id);
  const graphRef = React.useRef<PageRelationshipGraphHandle>(null);
  const selectedTask = pane.snapshot.taskId ? tasksById[pane.snapshot.taskId] ?? null : null;

  // ── Layout-aware actions ──────────────────────────────────────────────
  // Use the sidepanel task-editor when available, otherwise fall back to modal.

  const handleTaskClick = React.useCallback((taskId: string) => {
    if (!tasksById[taskId]) return;
    if (hasEditorTab) {
      openSidePanel('task-editor');
      openTaskPane('edit', taskId);
    } else {
      startEditingTask(taskId);
    }
  }, [hasEditorTab, openSidePanel, openTaskPane, startEditingTask, tasksById]);

  const handleCreateTask = React.useCallback(() => {
    const defaults = {
      defaultDueDate: getTodayISO(),
      defaultTaskPageId: currentPage?.viewMode === 'tasks' ? currentPage.id : currentPage?.id,
    };
    if (hasEditorTab) {
      openSidePanel('task-editor');
      openTaskPane('create', null, defaults);
    } else {
      startCreatingTask(defaults);
    }
  }, [currentPage, hasEditorTab, openSidePanel, openTaskPane, startCreatingTask]);

  // ── Render ────────────────────────────────────────────────────────────

  const showClear = activeTab === 'task-editor' && pane.snapshot.mode === 'edit';
  const showCreate = activeTab === 'task-overview';

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-col',
        floating
          ? 'bg-transparent eink-shell-surface-secondary'
          : 'border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] eink-shell-surface-secondary',
      )}
      style={{ width: UNIFIED_SIDEPANEL_DOCK_WIDTH }}
    >
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20 border-b border-[var(--color-border-subtle)] px-3 py-3 backdrop-blur-xl eink-shell-surface-secondary',
        floating
          ? 'bg-[color-mix(in_srgb,var(--color-surface-base)_72%,transparent)]'
          : 'bg-[var(--color-surface-secondary)]/88',
      )}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <TabBar
              tabs={layout.tabs}
              activeTab={activeTab}
              onSelect={(id) => { openSidePanel(id); setSidePanelTab(id); }}
            />
          </div>

          {(showClear || showCreate) && (
            <div className="glass-panel-nav eink-shell-surface flex h-11 flex-shrink-0 items-center gap-1 px-2">
              {showCreate && <HeaderAction icon={Plus} label="Create task" onClick={handleCreateTask} />}
              {showClear && <HeaderAction icon={X} label="Clear opened task" onClick={pane.reset} />}
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'graph' && (
          <GraphTabContent
            currentPage={currentPage}
            focusedNodeId={focusedNodeId}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            graphPages={graphPages}
            graphTasks={graphTasks}
            relationshipGraph={relationshipGraph}
            visibleGraph={visibleGraph}
            graphRef={graphRef}
            navigate={navigate}
          />
        )}
        {activeTab === 'metadata' && (
          <MetadataTabContent
            currentPage={currentPage}
            childPages={childPages}
            allTasks={allTasks}
            pagesById={pagesById}
            backlinks={backlinks}
            onUpdatePage={updatePage}
            onTaskClick={handleTaskClick}
            navigate={navigate}
          />
        )}
        {activeTab === 'task-editor' && (
          <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-[var(--color-surface-primary)]">
            <TaskDetailPane
              mode={pane.snapshot.mode}
              task={selectedTask}
              taskPages={taskCollections}
              selectedTaskPageId={pane.snapshot.defaults?.defaultTaskPageId ?? currentPage?.id ?? null}
              currentView={currentPage?.viewMode === 'tasks' ? 'taskCollection' : 'all'}
              defaultDueDate={pane.snapshot.defaults?.defaultDueDate}
              defaultSection={pane.snapshot.defaults?.defaultSection}
              defaultPriority={pane.snapshot.defaults?.defaultPriority}
              onClose={pane.reset}
              onDeleteTask={pane.reset}
              onDirtyChange={pane.setDirty}
              showHeader={false}
            />
          </div>
        )}
        {activeTab === 'task-overview' && (
          <TaskOverviewTabContent
            todayTasks={todayTasks}
            upcomingTasks={upcomingTasks}
            taskCollections={taskCollections}
            toggleComplete={toggleComplete}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      <ConfirmDiscardModal
        open={pane.showDiscard}
        onCancel={pane.keepEditing}
        onDiscard={pane.discard}
        message="You have unsaved task changes. Discard them?"
      />
    </aside>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────

/** Small icon button used in the sidepanel header. */
const HeaderAction: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}> = ({ icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
    aria-label={label}
    title={label}
  >
    <Icon className="h-4 w-4" />
  </button>
);

/** Segmented tab bar for switching between available panel tabs. */
const TabBar: React.FC<{
  tabs: UnifiedSidepanelTab[];
  activeTab: UnifiedSidepanelTab;
  onSelect: (tab: UnifiedSidepanelTab) => void;
}> = ({ tabs, activeTab, onSelect }) => (
  <div className="flex items-center rounded-full bg-[var(--color-surface-secondary)] p-1">
    {tabs.map((tabId) => {
      const meta = TAB_META[tabId];
      const Icon = meta.icon;
      return (
        <button
          key={tabId}
          type="button"
          onClick={() => onSelect(tabId)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium transition-all',
            activeTab === tabId
              ? 'bg-[var(--color-surface-primary)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
          )}
          title={meta.label}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{meta.shortLabel}</span>
        </button>
      );
    })}
  </div>
);

/** Local relationship graph tab content. */
const GraphTabContent: React.FC<{
  currentPage?: Page | null;
  focusedNodeId: string | null;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  graphPages: Page[];
  graphTasks: Task[];
  relationshipGraph: ReturnType<typeof buildRelationshipGraph> | null;
  visibleGraph: ReturnType<typeof createVisibleRelationshipGraph> | null;
  graphRef: React.RefObject<PageRelationshipGraphHandle | null>;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ currentPage, focusedNodeId, selectedNodeId, onSelectNode, graphPages, graphTasks, relationshipGraph, visibleGraph, graphRef, navigate }) => {
  if (!currentPage || !focusedNodeId || !relationshipGraph || !visibleGraph) {
    return <EmptyPanelState title="Open a page to inspect its local graph." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Local graph</p>
        <div className="flex items-center gap-1">
          <IconButton
            title="Center and reset zoom"
            aria-label="Center and reset zoom"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelectNode(focusedNodeId);
              graphRef.current?.fit();
            }}
          >
            <Focus className="h-4 w-4" />
          </IconButton>
          <IconButton
            title="Open in full graph explorer"
            aria-label="Open in full graph explorer"
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/graph', search: { selected: selectedNodeId ?? focusedNodeId } })}
          >
            <Network className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><p className="text-xs text-[var(--color-text-tertiary)]">Loading graph…</p></div>}>
        <PageRelationshipGraph
          ref={graphRef}
          allPages={graphPages}
          tasks={graphTasks}
          graph={relationshipGraph}
          visibleGraph={visibleGraph}
          selectedNodeId={selectedNodeId}
          onSelectedNodeIdChange={onSelectNode}
          showInspector={false}
          showCanvasHints={false}
          compact
        />
      </Suspense>
    </div>
  );
};

/** Page metadata and backlinks tab content. */
const MetadataTabContent: React.FC<{
  currentPage?: Page | null;
  childPages: Page[];
  allTasks: Task[];
  pagesById: Record<string, Page>;
  backlinks: ReturnType<typeof useBacklinks>;
  onUpdatePage: (id: string, updates: Partial<Page>) => void;
  onTaskClick: (taskId: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ currentPage, childPages, allTasks, pagesById, backlinks, onUpdatePage, onTaskClick, navigate }) => {
  if (!currentPage) {
    return <EmptyPanelState title="Open a page to inspect its metadata." />;
  }

  const parentPage = currentPage.parentId ? pagesById[currentPage.parentId] : null;
  const directTaskCount = allTasks.filter((t) => t.parentPageId === currentPage.id).length;
  const tags = currentPage.tags?.split(',').map((tag) => tag.trim()).filter(Boolean) ?? [];
  const siblingTagSuggestions = (() => {
    const parentKey = currentPage.parentId || '__root__';
    const tagSet = new Set<string>();

    Object.values(pagesById)
      .filter((page) => (page.parentId || '__root__') === parentKey)
      .forEach((page) => {
        page.tags?.split(',').map((tag) => tag.trim()).filter(Boolean).forEach((tag) => tagSet.add(tag));
      });

    return Array.from(tagSet).sort();
  })();
  const tagColorUniverse = Array.from(new Set([...siblingTagSuggestions, ...tags])).sort();
  const description = currentPage.excerpt?.trim() || 'No description yet.';
  const coverLabel = currentPage.coverImage
    ? 'Image cover'
    : currentPage.coverGradient
      ? 'Gradient cover'
      : 'No cover';
  const formatBytes = (rawSize?: string | null) => {
    const size = Number(rawSize ?? 0);
    if (!Number.isFinite(size) || size <= 0) {
      return null;
    }
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (size >= 1024) {
      return `${Math.round(size / 1024)} KB`;
    }
    return `${size} B`;
  };
  const infoRows = [
    {
      label: 'Type',
      value: currentPage.sourceOrigin
        ? currentPage.sourceItemType === 'root'
          ? `${currentPage.sourceOrigin} root collection`
          : `${currentPage.sourceOrigin} ${currentPage.sourceItemType ?? currentPage.viewMode}`
        : currentPage.viewMode,
    },
    { label: 'Created', value: formatDateTime(currentPage.created) },
    { label: 'Updated', value: formatDateTime(currentPage.updated) },
    { label: 'Children', value: String(childPages.length) },
    { label: 'Tasks', value: String(directTaskCount) },
    { label: 'Parent', value: parentPage?.title ?? 'Workspace root' },
    { label: 'Cover', value: coverLabel },
    ...(currentPage.sourceOrigin
      ? [
          { label: 'Mirror source', value: currentPage.sourceOrigin },
          { label: 'Source path', value: currentPage.sourcePath || 'Unknown' },
          { label: 'Remote created', value: formatDateTime(currentPage.sourceCreatedAt || '') },
          { label: 'Remote updated', value: formatDateTime(currentPage.sourceModifiedAt || '') },
          { label: 'Last synced', value: formatDateTime(currentPage.sourceLastSyncedAt || '') },
          { label: 'Remote size', value: formatBytes(currentPage.sourceContentLength) || 'Unknown' },
          { label: 'ETag', value: currentPage.sourceETag || 'Unavailable' },
        ]
      : []),
  ].filter((row) => row.value && row.value !== '');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-3">
      {/* Info card */}
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <ItemIcon type={pageIconType(currentPage)} icon={currentPage.icon} color={currentPage.color} size="sm" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{currentPage.title || 'Untitled'}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">{currentPage.id}</p>
          </div>
        </div>
        <div className="space-y-2">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-[var(--color-text-tertiary)]">{row.label}</span>
              <span className="text-right text-[var(--color-text-primary)]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Description</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Auto-generated from the page content preview</p>
        </div>
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Tags</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Labels attached to this page</p>
        </div>

        <InlineTagInput
          value={currentPage.tags || ''}
          onChange={(value) => onUpdatePage(currentPage.id, { tags: value })}
          existingTags={tagColorUniverse}
          isMulti
          placeholder="Add tags..."
          contextKey={`page-tags-${currentPage.id}`}
          className="min-h-[36px] px-0 py-0"
        />
      </div>

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Cover</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Visual preview used in the page hero</p>
        </div>

        {currentPage.coverImage || currentPage.coverGradient ? (
          <div className="space-y-3">
            <div
              className="h-28 w-full overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]"
              style={currentPage.coverGradient ? { background: currentPage.coverGradient } : undefined}
            >
              {currentPage.coverImage ? (
                <img
                  src={currentPage.coverImage}
                  alt={currentPage.title || 'Page cover'}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            {currentPage.coverAttribution ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">{currentPage.coverAttribution}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">No cover configured.</p>
        )}
      </div>

      {/* Backlinks card */}
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Backlinks</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Items that reference this page</p>
          </div>
          <span className="rounded-full bg-[var(--color-surface-tertiary)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
            {backlinks.length}
          </span>
        </div>

        {backlinks.length ? (
          <div className="space-y-2">
            {backlinks.map((bl) => (
              <button
                key={`${bl.sourceType}-${bl.sourceId}`}
                type="button"
                onClick={() => {
                  if (bl.sourceType === 'page') {
                    navigate({ to: '/pages/$id', params: { id: bl.sourceId } });
                  } else {
                    onTaskClick(bl.sourceId);
                  }
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-tertiary)]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {bl.sourceType === 'page' ? (
                    <ItemIcon
                      type={bl.sourceViewMode === 'collection' ? 'collection' : bl.sourceViewMode === 'tasks' ? 'tasks' : 'note'}
                      icon={bl.sourceIcon}
                      color={bl.sourceColor}
                      size="sm"
                    />
                  ) : (
                    <CheckSquare className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--color-text-primary)]">{bl.sourceTitle}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{bl.sourceType === 'page' ? 'Page' : 'Task'}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">No backlinks yet.</p>
        )}
      </div>
    </div>
  );
};

/** Today/upcoming task overview tab content. */
const TaskOverviewTabContent: React.FC<{
  todayTasks: Task[];
  upcomingTasks: Task[];
  taskCollections: Page[];
  toggleComplete: (taskId: string) => void;
  onTaskClick: (taskId: string) => void;
}> = ({ todayTasks, upcomingTasks, taskCollections, toggleComplete, onTaskClick }) => {
  const todayISO = React.useMemo(() => getTodayISO(), []);

  const taskGroups = React.useMemo(() => {
    const todayDate = dayjs(todayISO).startOf('day');
    const tomorrowTasks: Task[] = [];
    const thisWeekTasks: Task[] = [];
    const laterTasks: Task[] = [];

    for (const task of upcomingTasks) {
      if (!task.dueDate) {
        laterTasks.push(task);
        continue;
      }

      const dueDate = dayjs(task.dueDate).startOf('day');
      const dayOffset = dueDate.diff(todayDate, 'day');

      if (dayOffset === 1) {
        tomorrowTasks.push(task);
        continue;
      }

      if (dayOffset <= 7) {
        thisWeekTasks.push(task);
        continue;
      }

      laterTasks.push(task);
    }

    return [
      { key: 'today', title: 'Today', tasks: todayTasks, showEmptyState: true },
      { key: 'tomorrow', title: 'Tomorrow', tasks: tomorrowTasks },
      { key: 'this-week', title: 'This week', tasks: thisWeekTasks },
      { key: 'later', title: 'Later', tasks: laterTasks },
    ].filter((group) => group.showEmptyState || group.tasks.length > 0);
  }, [todayISO, todayTasks, upcomingTasks]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3">
      <div className="space-y-5">
        {taskGroups.map((group) => (
          <TaskOverviewSection
            key={group.key}
            title={group.title}
            tasks={group.tasks}
            taskPages={taskCollections}
            todayISO={todayISO}
            onToggleComplete={toggleComplete}
            onTaskClick={onTaskClick}
            showEmptyState={group.showEmptyState}
          />
        ))}
      </div>
    </div>
  );
};

/** A section within the task overview (Today, Upcoming). */
const TaskOverviewSection: React.FC<{
  title: string;
  tasks: Task[];
  taskPages: Page[];
  todayISO: string;
  onToggleComplete: (taskId: string) => void;
  onTaskClick: (taskId: string) => void;
  showEmptyState?: boolean;
}> = ({ title, tasks, taskPages, todayISO, onToggleComplete, onTaskClick, showEmptyState = false }) => (
  <section>
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        <span className="text-xs text-[var(--color-text-tertiary)]">{tasks.length}</span>
      </div>
    </div>

    {tasks.length ? (
      <div className="space-y-2">
        {tasks.map((task) => (
          <CompactTaskRow
            key={task.id}
            task={task}
            todayISO={todayISO}
            onToggleComplete={onToggleComplete}
            onClick={onTaskClick}
            taskPages={taskPages}
            className="w-full rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-base)]"
          />
        ))}
      </div>
    ) : showEmptyState ? (
      <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-4 py-4 text-sm text-[var(--color-text-primary)]">
        No tasks.
      </div>
    ) : null}
  </section>
);

/** Placeholder shown when a tab has no content to display. */
const EmptyPanelState: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center">
    <div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
    </div>
  </div>
);

export default UnifiedSidepanel;