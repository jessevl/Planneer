/**
 * @file PageLocalGraphPanel.tsx
 * @description Narrow local graph sidepanel for page detail views
 * @app PAGES - Contextual graph utility panel shown beside a page
 *
 * Features:
 * - Auto-focuses the currently open page
 * - Keeps the graph scoped to a focused neighborhood
 * - Full-size node cards with tighter local layout for sidebar legibility
 * - Uses native UnifiedHeader with glass-panel styling (matches TaskDetailPane)
 * - No full-graph navigation — this is a local context panel only
 *
 * Used by:
 * - PageDetailView
 */
import React, { Suspense } from 'react';
import { Focus, Network, X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import type { PageRelationshipGraphHandle } from '@/components/pages/PageRelationshipGraph';
const PageRelationshipGraph = React.lazy(() => import('@/components/pages/PageRelationshipGraph'));
import { IconButton } from '@/components/ui';
import { buildRelationshipGraph, collectGraphTasks, createVisibleRelationshipGraph, relationshipGraphIds } from '@/lib/relationshipGraph';
import type { Page } from '@/types/page';
import type { Task } from '@/types/task';

interface PageLocalGraphPanelProps {
  /** Active page driving the local graph context */
  page: Page;
  /** All pages in the workspace */
  allPages: Page[];
  /** All tasks in the workspace */
  tasks: Task[];
  /** Closes the sidepanel */
  onClose: () => void;
}

const PageLocalGraphPanel: React.FC<PageLocalGraphPanelProps> = React.memo(({
  page,
  allPages,
  tasks,
  onClose,
}) => {
  const navigate = useNavigate();
  const graphRef = React.useRef<PageRelationshipGraphHandle>(null);
  const pageNodeId = React.useMemo(() => relationshipGraphIds.page(page.id), [page.id]);
  const scopedPages = React.useMemo(() => allPages.filter((candidate) => !candidate.isDailyNote), [allPages]);
  const graphTasks = React.useMemo(() => collectGraphTasks(scopedPages, tasks), [scopedPages, tasks]);
  const graph = React.useMemo(() => buildRelationshipGraph(scopedPages, graphTasks), [scopedPages, graphTasks]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(pageNodeId);

  React.useEffect(() => {
    setSelectedNodeId(pageNodeId);
  }, [pageNodeId]);

  const visibleGraph = React.useMemo(
    () => createVisibleRelationshipGraph(
      graph,
      scopedPages,
      '',
      true,
      true,
      true,
      selectedNodeId,
      true,
    ),
    [graph, scopedPages, selectedNodeId]
  );

  return (
    <aside className="flex h-full min-h-0 w-[340px] max-w-[36vw] flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]">
      <div className="sticky top-0 z-20 px-3 pb-2 pt-3">
        <div className="glass-panel-nav flex items-center justify-between gap-3 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            Local graph
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              title="Center and reset zoom"
              aria-label="Center and reset zoom"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedNodeId(pageNodeId);
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
              onClick={() => navigate({
                to: '/graph',
                search: {
                  selected: selectedNodeId ?? pageNodeId,
                },
              })}
            >
              <Network className="h-4 w-4" />
            </IconButton>
            <IconButton
              title="Close local graph"
              aria-label="Close local graph"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[var(--color-text-secondary)]"
            >
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Graph canvas — scrollable with padding for floating header */}
      <div className="min-h-0 flex-1">
        <Suspense fallback={null}>
          <PageRelationshipGraph
            ref={graphRef}
            allPages={scopedPages}
            tasks={graphTasks}
            graph={graph}
            visibleGraph={visibleGraph}
            selectedNodeId={selectedNodeId}
            onSelectedNodeIdChange={setSelectedNodeId}
            showInspector={false}
            showCanvasHints={false}
            compact
          />
        </Suspense>
      </div>
    </aside>
  );
});

PageLocalGraphPanel.displayName = 'PageLocalGraphPanel';

export default PageLocalGraphPanel;