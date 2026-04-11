/**
 * @file GraphView.tsx
 * @description Dedicated workspace graph screen for pages, task pages, tasks, and links
 * @app SHARED - Global relationship exploration view
 *
 * Features:
 * - Dedicated route for relationship graph browsing
 * - Shared header with sidebar toggle
 * - Full-paper graph canvas with floating controls and inspector
 *
 * Used by:
 * - /graph route
 */
import React from 'react';
import { BarChart3, CheckCircle2, Network, Search, SlidersHorizontal, Tag, ZoomIn, ZoomOut } from 'lucide-react';

import UnifiedHeader from '@/components/layout/UnifiedHeader';
import PageRelationshipGraph, { type PageRelationshipGraphHandle } from '@/components/pages/PageRelationshipGraph';
import { useClickOutside } from '@/hooks';
import { Button, Input, Popover, SettingsToggleRow } from '@/components/ui';
import { buildRelationshipGraph, collectGraphTasks, createVisibleRelationshipGraph } from '@/lib/relationshipGraph';
import { cn } from '@/lib/design-system';
import { Route } from '@/routes/graph';
import { useNavigationStore } from '@/stores/navigationStore';
import { usePages } from '@/stores/pagesStore';
import { useTasks } from '@/stores/tasksStore';

const GraphView: React.FC = () => {
  const { pages } = usePages();
  const tasks = useTasks();
  const navigate = Route.useNavigate();
  const { selected: selectedFromSearch } = Route.useSearch();
  const sidebarVisible = useNavigationStore((state) => state.sidebarVisible);
  const setSidebarVisible = useNavigationStore((state) => state.setSidebarVisible);
  const graphRef = React.useRef<PageRelationshipGraphHandle>(null);
  const statsPopoverRef = React.useRef<HTMLDivElement>(null);
  const searchPopoverRef = React.useRef<HTMLDivElement>(null);
  const filtersPopoverRef = React.useRef<HTMLDivElement>(null);
  const scopedPages = React.useMemo(() => pages.filter((page) => !page.isDailyNote), [pages]);
  const graphTasks = React.useMemo(() => collectGraphTasks(pages, tasks), [pages, tasks]);
  const graph = React.useMemo(() => buildRelationshipGraph(pages, graphTasks), [pages, graphTasks]);

  const [showHierarchy, setShowHierarchy] = React.useState(true);
  const [showLinks, setShowLinks] = React.useState(true);
  const [showTags, setShowTags] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(selectedFromSearch ?? null);
  const [openPopover, setOpenPopover] = React.useState<'stats' | 'search' | 'filters' | null>(null);

  React.useEffect(() => {
    setSelectedNodeId(selectedFromSearch ?? null);
  }, [selectedFromSearch]);

  const visibleGraph = React.useMemo(
    () => createVisibleRelationshipGraph(
      graph,
      scopedPages,
      searchTerm,
      showHierarchy,
      showLinks,
      showTags,
      selectedNodeId,
      true,
    ),
    [graph, scopedPages, searchTerm, showHierarchy, showLinks, showTags, selectedNodeId]
  );

  React.useEffect(() => {
    if (!selectedNodeId) return;
    const isSelectedVisible = visibleGraph.nodes.some((node) => node.id === selectedNodeId);
    if (!isSelectedVisible) {
      setSelectedNodeId(null);
      navigate({ to: '/graph', search: (previous) => ({ ...previous, selected: undefined }), replace: true });
    }
  }, [navigate, selectedNodeId, visibleGraph.nodes]);

  const handleSelectedNodeIdChange = React.useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    navigate({ to: '/graph', search: (previous) => ({ ...previous, selected: nodeId ?? undefined }), replace: true });
  }, [navigate]);

  useClickOutside([
    ...(openPopover === 'stats'
      ? [{ ref: statsPopoverRef, onOutside: () => setOpenPopover(null) }]
      : []),
    ...(openPopover === 'search'
      ? [{ ref: searchPopoverRef, onOutside: () => setOpenPopover(null) }]
      : []),
    ...(openPopover === 'filters'
      ? [{ ref: filtersPopoverRef, onOutside: () => setOpenPopover(null) }]
      : []),
  ]);

  const statLabelClassName = 'text-xs text-[var(--color-text-tertiary)]';
  const statValueClassName = 'text-sm font-semibold text-[var(--color-text-primary)]';

  const compactControlButtonClassName = (active: boolean) => cn(
    'flex h-9 w-9 items-center justify-center rounded-full transition-all',
    active
      ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/60'
  );

  const headerControls = (
    <>
      <div ref={statsPopoverRef} className="relative hidden sm:block">
        <button
          type="button"
          onClick={() => setOpenPopover(openPopover === 'stats' ? null : 'stats')}
          className={compactControlButtonClassName(openPopover === 'stats')}
          title="Graph statistics"
          aria-label="Graph statistics"
        >
          <BarChart3 className="h-4.5 w-4.5" />
        </button>
        {openPopover === 'stats' && (
          <Popover position="right" width="auto" padding="sm">
            <div className="w-52 space-y-1 p-1">
              <div className="flex items-center justify-between gap-4 px-2 py-1.5">
                <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]"><Network className="w-4 h-4" /><span className={statLabelClassName}>Pages</span></div>
                <span className={statValueClassName}>{graph.stats.pages}</span>
              </div>
              <div className="flex items-center justify-between gap-4 px-2 py-1.5">
                <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]"><CheckCircle2 className="w-4 h-4" /><span className={statLabelClassName}>Tasks</span></div>
                <span className={statValueClassName}>{graph.stats.tasks}</span>
              </div>
              <div className="flex items-center justify-between gap-4 px-2 py-1.5">
                <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]"><Tag className="w-4 h-4" /><span className={statLabelClassName}>Tags</span></div>
                <span className={statValueClassName}>{graph.stats.tags}</span>
              </div>
              <div className="border-t border-[var(--color-border-subtle)] my-1" />
              <div className="flex items-center justify-between gap-4 px-2 py-1.5">
                <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]"><BarChart3 className="w-4 h-4" /><span className={statLabelClassName}>Visible</span></div>
                <span className={statValueClassName}>{visibleGraph.nodes.length}</span>
              </div>
            </div>
          </Popover>
        )}
      </div>

      <div ref={searchPopoverRef} className="relative">
        <button
          type="button"
          onClick={() => setOpenPopover(openPopover === 'search' ? null : 'search')}
          className={compactControlButtonClassName(openPopover === 'search' || Boolean(searchTerm))}
          title="Search graph"
          aria-label="Search graph"
        >
          <Search className="h-4.5 w-4.5" />
        </button>
        {openPopover === 'search' && (
          <Popover position="right" width="auto" padding="sm">
            <div className="w-64 p-1">
              <div className="flex items-center gap-2">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search nodes…"
                  autoFocus
                  className="h-9 text-sm placeholder:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  disabled={!searchTerm}
                  className={cn(
                    'shrink-0 text-xs font-medium transition-colors',
                    searchTerm
                      ? 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      : 'cursor-default text-[var(--color-text-disabled)]'
                  )}
                >
                  Clear
                </button>
              </div>
            </div>
          </Popover>
        )}
      </div>

      <div ref={filtersPopoverRef} className="relative">
        <button
          type="button"
          onClick={() => setOpenPopover(openPopover === 'filters' ? null : 'filters')}
          className={compactControlButtonClassName(openPopover === 'filters')}
          title="Graph filters"
          aria-label="Graph filters"
        >
          <SlidersHorizontal className="h-4.5 w-4.5" />
        </button>
        {openPopover === 'filters' && (
          <Popover position="right" width="auto" padding="sm">
            <div className="w-56 p-1">
              <SettingsToggleRow label="Hierarchy" enabled={showHierarchy} onChange={setShowHierarchy} />
              <SettingsToggleRow label="Links" enabled={showLinks} onChange={setShowLinks} />
              <SettingsToggleRow label="Tags" enabled={showTags} onChange={setShowTags} />
            </div>
          </Popover>
        )}
      </div>

      <div className="hidden items-center gap-1 sm:flex">
        <button
          type="button"
          onClick={() => graphRef.current?.zoomOut()}
          className={compactControlButtonClassName(false)}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          onClick={() => graphRef.current?.zoomIn()}
          className={compactControlButtonClassName(false)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4.5 w-4.5" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden view-content">
      <UnifiedHeader
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        rootLabel="Graph"
        rootIcon={<Network className="w-4 h-4" />}
        additionalActionsRight={headerControls}
        desktopWidthClassName="w-full max-w-none"
        className="z-30"
      />

      <div className={cn('min-h-0 flex-1')}>
        <PageRelationshipGraph
          ref={graphRef}
          allPages={pages}
          tasks={graphTasks}
          graph={graph}
          visibleGraph={visibleGraph}
          selectedNodeId={selectedNodeId}
          onSelectedNodeIdChange={handleSelectedNodeIdChange}
          searchTerm={searchTerm}
        />
      </div>
    </div>
  );
};

export default GraphView;