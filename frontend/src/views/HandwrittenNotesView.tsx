/**
 * @file HandwrittenNotesView.tsx
 * @description Dedicated viewer for mirrored handwritten BOOX notebooks
 * @app PAGES - Separate handwritten-notes browsing surface
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PenLine, RefreshCw, Settings } from 'lucide-react';

import UnifiedHeader from '@/components/layout/UnifiedHeader';
import BooxNotebookView from '@/components/pages/BooxNotebookView';
import PageCollection from '@/components/pages/PageCollection';
import { Button, Card, H3, SmartEmptyState, toastError, toastSuccess } from '@/components/ui';
import { usePages, usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore, selectCurrentWorkspace } from '@/stores/workspaceStore';
import { ensureBooxIntegrationFresh, syncBooxIntegration } from '@/api/booxApi';
import { cn } from '@/lib/design-system';
import { CONTENT_WIDTH } from '@/lib/layout';
import { findBooxRootPage, isBooxNotebookPage, isBooxRootPage } from '@/lib/pageUtils';
import type { Page } from '@/types/page';
interface HandwrittenNotesViewProps {
  routePageId?: string;
}

const HandwrittenNotesView: React.FC<HandwrittenNotesViewProps> = ({ routePageId }) => {
  const handwrittenContentWidthClassName = cn('mx-auto', CONTENT_WIDTH.default);
  const navigate = useNavigate();
  const sidebarVisible = useNavigationStore((state) => state.sidebarVisible);
  const setSidebarVisible = useNavigationStore((state) => state.setSidebarVisible);
  const handwrittenViewMode = useNavigationStore((state) => state.handwrittenViewMode);
  const handwrittenGroupBy = useNavigationStore((state) => state.handwrittenGroupBy);
  const handwrittenSortBy = useNavigationStore((state) => state.handwrittenSortBy);
  const handwrittenSortDirection = useNavigationStore((state) => state.handwrittenSortDirection);
  const handwrittenShowExcerpts = useNavigationStore((state) => state.handwrittenShowExcerpts);
  const setHandwrittenViewMode = useNavigationStore((state) => state.setHandwrittenViewMode);
  const setHandwrittenGroupBy = useNavigationStore((state) => state.setHandwrittenGroupBy);
  const setHandwrittenSortBy = useNavigationStore((state) => state.setHandwrittenSortBy);
  const setHandwrittenSortDirection = useNavigationStore((state) => state.setHandwrittenSortDirection);
  const setHandwrittenShowExcerpts = useNavigationStore((state) => state.setHandwrittenShowExcerpts);
  const openSettingsModal = useUIStore((state) => state.openSettingsModal);
  const currentWorkspace = useWorkspaceStore(selectCurrentWorkspace);
  const { pages } = usePages();
  const pagesById = usePagesStore((state: PagesState) => state.pagesById);
  const getChildren = usePagesStore((state: PagesState) => state.getChildren);
  const selectPage = usePagesStore((state: PagesState) => state.selectPage);
  const loadPages = usePagesStore((state: PagesState) => state.loadPages);
  const childrenIndex = usePagesStore((state: PagesState) => state.childrenIndex);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  const booxRootPage = useMemo(() => findBooxRootPage(pages), [pages]);
  const selectedPageId = routePageId ?? booxRootPage?.id ?? null;
  const selectedPage = selectedPageId ? pagesById[selectedPageId] ?? null : null;
  const selectedNotebook = selectedPage && isBooxNotebookPage(selectedPage) ? selectedPage : null;
  const activeWorkspaceId = selectedPage?.workspace ?? booxRootPage?.workspace ?? currentWorkspace?.id ?? null;

  useEffect(() => {
    if (!routePageId) {
      return;
    }
    selectPage(routePageId, false, true, false);
  }, [routePageId, selectPage]);

  useEffect(() => {
    if (!booxRootPage || !isBooxRootPage(booxRootPage)) {
      return;
    }

    loadPages({ parentId: booxRootPage.id, sortBy: 'updated', sortDirection: 'desc' });
  }, [booxRootPage?.id, loadPages]);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    let cancelled = false;

    const autoRefreshBoox = async () => {
      setIsAutoRefreshing(true);
      try {
        const result = await ensureBooxIntegrationFresh(activeWorkspaceId);
        if (!result || cancelled) return;

        if (booxRootPage?.id) {
          await loadPages({ parentId: booxRootPage.id, sortBy: 'updated', sortDirection: 'desc' });
        }
      } catch {
        // Silent background refresh; manual sync continues to surface errors.
      } finally {
        if (!cancelled) setIsAutoRefreshing(false);
      }
    };

    void autoRefreshBoox();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, booxRootPage?.id, loadPages]);

  const notebooks = useMemo(() => {
    if (!booxRootPage) {
      return [];
    }

    return getChildren(booxRootPage.id)
      .filter((child): child is Page => isBooxNotebookPage(child));
  }, [booxRootPage, getChildren]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible(!sidebarVisible);
  }, [setSidebarVisible, sidebarVisible]);

  const handleOpenRoot = useCallback(() => {
    navigate({ to: '/handwritten' });
  }, [navigate]);

  const handleOpenNotebook = useCallback((pageId: string) => {
    navigate({ to: '/handwritten/$id', params: { id: pageId } });
  }, [navigate]);

  const handleSync = useCallback(async () => {
    if (!activeWorkspaceId) {
      toastError('This handwritten notes section is missing a workspace context');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncBooxIntegration(activeWorkspaceId);
      if (booxRootPage?.id) {
        await loadPages({ parentId: booxRootPage.id, sortBy: 'updated', sortDirection: 'desc' });
      }
      toastSuccess(`Synced ${result.total} BOOX notebook${result.total === 1 ? '' : 's'}`);
    } catch (error) {
      toastError((error as Error).message || 'BOOX sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [activeWorkspaceId, booxRootPage?.id, loadPages]);

  const headerActions = (
    <div className="flex items-center gap-2">
      {isAutoRefreshing ? (
        <div className="flex items-center gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Refreshing BOOX…</span>
        </div>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        icon={<RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />}
        disabled={isSyncing || !activeWorkspaceId}
        onClick={handleSync}
      >
        Sync
      </Button>
      <Button
        variant="ghost"
        size="sm"
        icon={<Settings className="h-4 w-4" />}
        onClick={() => openSettingsModal('boox')}
      >
        Settings
      </Button>
    </div>
  );

  const subtitle = selectedNotebook
    ? 'Read-only mirrored notebook from your handwritten library'
    : booxRootPage
      ? `${notebooks.length} mirrored notebook${notebooks.length === 1 ? '' : 's'} in your handwritten library`
      : 'Your BOOX notebooks and handwritten PDFs live here as a separate, read-only library';

  if (!booxRootPage) {
    return (
      <div className="flex-1 overflow-y-auto pb-32 md:pb-6 view-content">
        <UnifiedHeader
          sidebarVisible={sidebarVisible}
          onToggleSidebar={handleToggleSidebar}
          rootLabel="Handwritten Notes"
          rootIcon={<PenLine className="w-4 h-4" />}
          subtitle={subtitle}
          additionalActionsRight={headerActions}
          desktopWidthClassName={handwrittenContentWidthClassName}
        />
        <div className="pt-[calc(var(--header-height)+1.5rem)] pb-32 md:pb-6">
          <div className={cn(handwrittenContentWidthClassName, 'px-4 md:px-6')}>
            <SmartEmptyState
              type="pages"
              title="No handwritten notebooks yet"
              description="Configure BOOX sync for this workspace, then run a sync to populate the handwritten library."
              actionLabel="Open BOOX settings"
              onAction={() => openSettingsModal('boox')}
            />
          </div>
        </div>
      </div>
    );
  }

  if (routePageId && selectedPage && !isBooxRootPage(selectedPage) && !isBooxNotebookPage(selectedPage)) {
    return (
      <div className="flex-1 overflow-y-auto pb-32 md:pb-6 view-content">
        <UnifiedHeader
          sidebarVisible={sidebarVisible}
          onToggleSidebar={handleToggleSidebar}
          rootLabel="Handwritten Notes"
          rootIcon={<PenLine className="w-4 h-4" />}
          subtitle="That page is not part of the handwritten notes library"
          additionalActionsRight={headerActions}
          desktopWidthClassName={handwrittenContentWidthClassName}
        />
        <div className="pt-[calc(var(--header-height)+1.5rem)] pb-32 md:pb-6">
          <div className={cn(handwrittenContentWidthClassName, 'px-4 md:px-6')}>
            <Card className="p-8 text-center">
              <H3 className="mb-2">Handwritten notebook not found</H3>
              <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
                The selected page does not belong to the mirrored handwritten notes section.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={handleOpenRoot}>Back to library</Button>
                <Button variant="ghost" onClick={() => navigate({ to: '/pages' })}>Open Pages</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-32 md:pb-6 view-content">
      <UnifiedHeader
        sidebarVisible={sidebarVisible}
        onToggleSidebar={handleToggleSidebar}
        rootLabel="Handwritten Notes"
        rootIcon={<PenLine className="w-4 h-4" />}
        onRootClick={selectedNotebook ? handleOpenRoot : undefined}
        currentTitle={selectedNotebook?.title}
        subtitle={subtitle}
        additionalActionsRight={headerActions}
        desktopWidthClassName={handwrittenContentWidthClassName}
      />

      {selectedNotebook ? (
        <BooxNotebookView page={selectedNotebook} contentRightInsetPx={0} />
      ) : (
        <div className="pt-[calc(var(--header-height)+1.5rem)] pb-32 md:pb-6">
          <div className={cn(handwrittenContentWidthClassName, 'flex flex-col gap-6 px-4 md:px-6')}>
            {notebooks.length === 0 ? (
              <SmartEmptyState
                type="pages"
                title="No handwritten notebooks yet"
                description="Run a BOOX sync after configuring WebDAV to populate this handwritten library."
                actionLabel="Open BOOX settings"
                onAction={() => openSettingsModal('boox')}
              />
            ) : (
              <PageCollection
                pages={notebooks}
                onPageClick={handleOpenNotebook}
                viewMode={handwrittenViewMode}
                onViewModeChange={setHandwrittenViewMode}
                sortBy={handwrittenSortBy}
                onSortByChange={setHandwrittenSortBy}
                sortDirection={handwrittenSortDirection}
                onSortDirectionChange={setHandwrittenSortDirection}
                groupBy={handwrittenGroupBy}
                onGroupByChange={setHandwrittenGroupBy}
                showExcerpts={handwrittenShowExcerpts}
                onShowExcerptsChange={setHandwrittenShowExcerpts}
                showHeader
                draggable={false}
                emptyTitle="No handwritten notebooks yet"
                emptyDescription="Run a BOOX sync after configuring WebDAV to populate this handwritten library."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HandwrittenNotesView;