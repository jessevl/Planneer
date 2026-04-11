/**
 * @file BooxPageEmbedPicker.tsx
 * @description Modal and mobile sheet for selecting mirrored BOOX notebook pages to embed
 * @app PAGES - Used by PageEditor when inserting a BOOX page block
 *
 * Features:
 * - Loads mirrored BOOX notebooks from the existing pages store
 * - Generates page preview thumbnails client-side from the mirrored source PDF
 * - Preserves notebook metadata for the BOOX page embed block contract
 * - Supports selecting multiple notebook pages in a single insert flow
 *
 * Used by:
 * - PageEditor
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { RefreshCw } from 'lucide-react';

import { ArrowLeftIcon, ArrowRightIcon, DocumentIcon, SearchIcon } from '@/components/common/Icons';
import { Button, Input, Modal, MobileSheet, Panel, SmartEmptyState, toastError, toastSuccess } from '@/components/ui';
import { cn } from '@/lib/design-system';
import {
  clampBooxPageNumber,
  createBooxNotebookPageId,
  type BooxPageEmbedData,
} from '@/lib/booxPageEmbed';
import { syncBooxIntegration } from '@/api/booxApi';
import { findBooxRootPage, isBooxNotebookPage } from '@/lib/pageUtils';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { selectCurrentWorkspaceId, useWorkspaceStore } from '@/stores/workspaceStore';
import { getPageFileUrl } from '@/api/pagesApi';
import type { Page } from '@/types/page';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface BooxPageEmbedPickerProps {
  /** Whether the picker is currently open. */
  isOpen: boolean;
  /** Close callback. */
  onClose: () => void;
  /** Called when the user confirms BOOX page selections. */
  onSelect: (selection: BooxPageEmbedData[]) => void;
}

function buildBooxPageSelection(
  notebook: Page,
  sourcePdfUrl: string,
  pageNumber: number,
  previewImageUrl: string,
): BooxPageEmbedData {
  return {
    notebookId: notebook.id,
    notebookPageId: createBooxNotebookPageId(notebook.id, pageNumber),
    notebookTitle: notebook.title,
    pageNumber,
    previewImageUrl,
    sourcePdfUrl,
    sourceModifiedAt: notebook.sourceModifiedAt ?? '',
  };
}

function getNotebookPdfUrl(page: Page | null): string | null {
  if (!page) return null;

  const pdfFilename = page.files?.find((file) => file.toLowerCase().endsWith('.pdf')) ?? page.files?.[0] ?? null;
  return pdfFilename ? getPageFileUrl(page.id, pdfFilename) : null;
}

function formatRemoteTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

async function renderPdfPagePreview(pdfUrl: string, pageNumber: number): Promise<string> {
  const loadingTask = getDocument({ url: pdfUrl, withCredentials: true });

  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.75, 480 / Math.max(baseViewport.width, 1));
    const viewport = page.getViewport({ scale: Math.max(scale, 0.8) });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas preview is unavailable in this browser');
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, canvas, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

    canvas.width = 0;
    canvas.height = 0;

    return dataUrl;
  } finally {
    await loadingTask.destroy();
  }
}

const BooxPageEmbedPicker: React.FC<BooxPageEmbedPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const isMobile = useIsMobile();
  const currentWorkspaceId = useWorkspaceStore(selectCurrentWorkspaceId);
  const pagesById = usePagesStore((state: PagesState) => state.pagesById);
  const loadPages = usePagesStore((state: PagesState) => state.loadPages);
  const getChildren = usePagesStore((state: PagesState) => state.getChildren);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [pageNumberInput, setPageNumberInput] = useState('1');
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewSelectionKey, setPreviewSelectionKey] = useState<string | null>(null);
  const [selectedPages, setSelectedPages] = useState<BooxPageEmbedData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const previewCacheRef = useRef(new Map<string, string>());
  const previewRequestIdRef = useRef(0);
  const previewPendingKeyRef = useRef<string | null>(null);

  const booxRootPage = useMemo(
    () => findBooxRootPage(Object.values(pagesById)),
    [pagesById],
  );

  const allNotebooks = useMemo(() => {
    const candidates = booxRootPage
      ? getChildren(booxRootPage.id).filter((page): page is Page => isBooxNotebookPage(page))
      : Object.values(pagesById).filter((page): page is Page => isBooxNotebookPage(page));

    return [...candidates].sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.title.localeCompare(right.title);
    });
  }, [booxRootPage, getChildren, pagesById]);

  const notebooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return allNotebooks;
    }

    return allNotebooks.filter((page) => page.title.toLowerCase().includes(query));
  }, [allNotebooks, searchQuery]);

  const selectedNotebook = useMemo(
    () => notebooks.find((page) => page.id === selectedNotebookId) ?? notebooks[0] ?? null,
    [notebooks, selectedNotebookId],
  );

  const activeWorkspaceId = selectedNotebook?.workspace ?? booxRootPage?.workspace ?? currentWorkspaceId ?? null;

  const selectedNotebookPdfUrl = useMemo(
    () => getNotebookPdfUrl(selectedNotebook),
    [selectedNotebook],
  );

  const maxPageNumber = useMemo(() => {
    const rawCount = selectedNotebook?.sourcePageCount;
    if (!rawCount || !Number.isFinite(rawCount) || rawCount < 1) {
      return 1;
    }

    return Math.max(1, Math.trunc(rawCount));
  }, [selectedNotebook?.sourcePageCount]);

  const selectedPageNumber = useMemo(() => {
    const parsed = Number.parseInt(pageNumberInput, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return clampBooxPageNumber(parsed, maxPageNumber);
  }, [maxPageNumber, pageNumberInput]);

  const canInsert = Boolean(selectedNotebook && selectedNotebookPdfUrl && selectedPageNumber && previewImageUrl && !isGeneratingPreview);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSearchQuery('');
    setPageNumberInput('1');
    setPreviewImageUrl(null);
    setPreviewError(null);
    setPreviewSelectionKey(null);
    setSelectedPages([]);
    setLoadError(null);
  }, [isOpen]);

  const refreshBooxNotebooks = useCallback(async () => {
    let booxRootId: string | null = null;

    const rootPages = await loadPages({ rootOnly: true, sortBy: 'order', sortDirection: 'asc' });
    const pagesAfterRootLoad = Object.values(usePagesStore.getState().pagesById);
    const root = findBooxRootPage(pagesAfterRootLoad);
    booxRootId = root?.id ?? null;

    if (booxRootId) {
      await loadPages({ parentId: booxRootId, sortBy: 'order', sortDirection: 'asc' });
    }

    return booxRootId;
  }, [loadPages]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const loadBooxNotebooks = async () => {
      setIsLoadingNotebooks(true);
      setLoadError(null);

      try {
        await refreshBooxNotebooks();
        if (cancelled) return;
      } catch (error) {
        if (!cancelled) {
          setLoadError((error as Error).message || 'Failed to load mirrored BOOX notebooks');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingNotebooks(false);
        }
      }
    };

    void loadBooxNotebooks();

    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshBooxNotebooks]);

  useEffect(() => {
    if (!selectedNotebookId && notebooks[0]) {
      setSelectedNotebookId(notebooks[0].id);
      return;
    }

    if (selectedNotebookId && !notebooks.some((page) => page.id === selectedNotebookId)) {
      setSelectedNotebookId(notebooks[0]?.id ?? null);
    }
  }, [notebooks, selectedNotebookId]);

  useEffect(() => {
    if (!selectedNotebook) {
      setPageNumberInput('1');
      setSelectedPages([]);
      return;
    }

    setSelectedPages([]);
    setPageNumberInput((current) => {
      const parsed = Number.parseInt(current, 10);
      if (!Number.isFinite(parsed)) {
        return '1';
      }

      return String(clampBooxPageNumber(parsed, selectedNotebook.sourcePageCount ?? undefined));
    });
  }, [selectedNotebook?.id]);

  useEffect(() => {
    if (!isOpen || !selectedNotebook?.id || !selectedNotebookPdfUrl || !selectedPageNumber) {
      previewPendingKeyRef.current = null;
      setPreviewImageUrl(null);
      setPreviewError(null);
      setPreviewSelectionKey(null);
      setIsGeneratingPreview(false);
      return;
    }

    const previewKey = `${selectedNotebook.id}:${selectedPageNumber}`;
    const cachedPreview = previewCacheRef.current.get(previewKey);
    if (cachedPreview) {
      previewPendingKeyRef.current = null;
      setPreviewImageUrl(cachedPreview);
      setPreviewError(null);
      setPreviewSelectionKey(previewKey);
      setIsGeneratingPreview(false);
      return;
    }

    if (previewPendingKeyRef.current === previewKey) {
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    previewPendingKeyRef.current = previewKey;
    setIsGeneratingPreview(true);
    setPreviewError(null);

    void renderPdfPagePreview(selectedNotebookPdfUrl, selectedPageNumber)
      .then((previewUrl) => {
        if (previewRequestIdRef.current !== requestId) {
          return;
        }

        previewCacheRef.current.set(previewKey, previewUrl);
        setPreviewImageUrl(previewUrl);
        setPreviewError(null);
        setPreviewSelectionKey(previewKey);
      })
      .catch((error) => {
        if (previewRequestIdRef.current !== requestId) {
          return;
        }

        setPreviewImageUrl(null);
        setPreviewError((error as Error).message || 'Failed to render the selected BOOX page preview');
        setPreviewSelectionKey(null);
      })
      .finally(() => {
        if (previewRequestIdRef.current === requestId) {
          previewPendingKeyRef.current = null;
          setIsGeneratingPreview(false);
        }
      });
  }, [isOpen, selectedNotebook?.id, selectedNotebookPdfUrl, selectedPageNumber]);

  const isCurrentPagePreviewReady = useMemo(() => {
    if (!selectedNotebook?.id || !selectedPageNumber) {
      return false;
    }

    return previewSelectionKey === `${selectedNotebook.id}:${selectedPageNumber}` && Boolean(previewImageUrl);
  }, [previewImageUrl, previewSelectionKey, selectedNotebook?.id, selectedPageNumber]);

  const isCurrentPageSelected = useMemo(() => {
    if (!selectedPageNumber) {
      return false;
    }

    return selectedPages.some((page) => page.pageNumber === selectedPageNumber);
  }, [selectedPageNumber, selectedPages]);

  const handleToggleCurrentPageSelection = useCallback(() => {
    if (!selectedNotebook || !selectedNotebookPdfUrl || !selectedPageNumber) {
      return;
    }

    setSelectedPages((current) => {
      const exists = current.some((page) => page.pageNumber === selectedPageNumber);
      if (exists) {
        return current.filter((page) => page.pageNumber !== selectedPageNumber);
      }

      if (!previewImageUrl || !isCurrentPagePreviewReady) {
        return current;
      }

      const next = [
        ...current,
        buildBooxPageSelection(selectedNotebook, selectedNotebookPdfUrl, selectedPageNumber, previewImageUrl),
      ];

      return next.sort((left, right) => left.pageNumber - right.pageNumber);
    });
  }, [isCurrentPagePreviewReady, previewImageUrl, selectedNotebook, selectedNotebookPdfUrl, selectedPageNumber]);

  const handleRemoveSelectedPage = useCallback((pageNumber: number) => {
    setSelectedPages((current) => current.filter((page) => page.pageNumber !== pageNumber));
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedPages.length === 0) {
      return;
    }

    onSelect(selectedPages);
  }, [onSelect, selectedPages]);

  const handlePageStep = useCallback((delta: number) => {
    const basePage = selectedPageNumber ?? 1;
    const nextPage = clampBooxPageNumber(basePage + delta, maxPageNumber);
    setPageNumberInput(String(nextPage));
  }, [maxPageNumber, selectedPageNumber]);

  const handlePreviewImageError = useCallback(() => {
    setPreviewError('The BOOX page preview could not be displayed in the picker.');
  }, []);

  const handleSync = useCallback(async () => {
    if (!activeWorkspaceId) {
      toastError('Select a workspace before running BOOX sync');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncBooxIntegration(activeWorkspaceId);
      await refreshBooxNotebooks();
      toastSuccess(`Synced ${result.total} BOOX notebook${result.total === 1 ? '' : 's'}`);
    } catch (error) {
      toastError((error as Error).message || 'BOOX sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [activeWorkspaceId, refreshBooxNotebooks]);

  const body = loadError ? (
    <Panel className="space-y-3 p-4">
      <div className="text-sm font-medium text-[var(--color-text-primary)]">Unable to load BOOX notebooks</div>
      <p className="text-sm text-[var(--color-text-secondary)]">{loadError}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setLoadError(null);
            setIsLoadingNotebooks(false);
          }}
        >
          Dismiss
        </Button>
      </div>
    </Panel>
  ) : (
    <div className="flex max-h-[68vh] min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Select a mirrored BOOX notebook and one or more pages, then add the pages you want to insert.
        </p>

        {isLoadingNotebooks ? (
          <Panel className="p-4 text-sm text-[var(--color-text-secondary)]">Loading mirrored BOOX notebooks…</Panel>
        ) : allNotebooks.length === 0 ? (
          <SmartEmptyState
            type="pages"
            title="No mirrored BOOX notebooks"
            description="Run a BOOX sync first so the picker has notebook PDFs to choose from."
          />
        ) : (
          <div className={cn('grid min-h-0 gap-3', !isMobile && 'md:grid-cols-[minmax(210px,240px)_minmax(0,1fr)]')}>
          <div className="space-y-3">
            <Input
              label="Find notebook"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search mirrored BOOX notebooks"
              icon={<SearchIcon className="h-4 w-4" />}
            />

            <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
              {notebooks.length === 0 ? (
                <Panel className="space-y-3 p-4 text-sm text-[var(--color-text-secondary)]">
                  <div className="font-medium text-[var(--color-text-primary)]">No matching BOOX notebooks</div>
                  <p>No synced notebook matches “{searchQuery.trim()}”.</p>
                  <div>
                    <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                      Clear Search
                    </Button>
                  </div>
                </Panel>
              ) : (
                notebooks.map((notebook) => {
                  const isSelected = notebook.id === selectedNotebook?.id;
                  const modifiedLabel = formatRemoteTimestamp(notebook.sourceModifiedAt);

                  return (
                    <button
                      key={notebook.id}
                      type="button"
                      onClick={() => setSelectedNotebookId(notebook.id)}
                      className={cn(
                        'w-full rounded-2xl border px-3 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'border-[var(--color-accent-primary)] bg-[var(--color-interactive-bg)]'
                          : 'border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)]',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-text-secondary)] shadow-sm dark:bg-gh-canvas-default">
                          <DocumentIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                            {notebook.title || 'Untitled BOOX notebook'}
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {notebook.sourcePageCount ? `${notebook.sourcePageCount} pages` : 'Page count unavailable'}
                          </div>
                          {modifiedLabel ? (
                            <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                              Source updated {modifiedLabel}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-0 space-y-3">
            <Panel className="space-y-2 p-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageStep(-1)}
                    disabled={!selectedNotebook || (selectedPageNumber ?? 1) <= 1}
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                  </Button>
                  <div className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                    Page {selectedPageNumber ?? 1}
                    {selectedNotebook?.sourcePageCount ? ` of ${selectedNotebook.sourcePageCount}` : ''}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageStep(1)}
                    disabled={!selectedNotebook || (selectedPageNumber ?? 1) >= maxPageNumber}
                  >
                    <ArrowRightIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isCurrentPageSelected ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={handleToggleCurrentPageSelection}
                    disabled={!selectedNotebook || !selectedPageNumber || !isCurrentPagePreviewReady}
                  >
                    {isCurrentPageSelected ? 'Remove Page' : 'Add Page'}
                  </Button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] px-4 py-2.5">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                        Page Preview
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                        {selectedNotebook?.title || 'BOOX notebook'}
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      Page {selectedPageNumber ?? 1}
                      {selectedNotebook?.sourcePageCount ? ` of ${selectedNotebook.sourcePageCount}` : ''}
                    </div>
                  </div>
                  {previewImageUrl ? (
                    <div className="bg-[var(--color-surface-secondary)] p-2.5">
                      <img
                        src={previewImageUrl}
                        alt={`${selectedNotebook?.title || 'BOOX notebook'} page ${selectedPageNumber ?? 1}`}
                        className="mx-auto block max-h-[30vh] w-full rounded-xl border border-[var(--color-border-subtle)] bg-white object-contain shadow-sm"
                        onError={handlePreviewImageError}
                      />
                      {isGeneratingPreview ? (
                        <div className="mt-3 text-center text-sm text-[var(--color-text-secondary)]">
                          Rendering BOOX page preview…
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex min-h-[220px] items-center justify-center px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
                      {isGeneratingPreview
                        ? 'Rendering BOOX page preview…'
                        : previewError || 'Select a page to preview the BOOX notebook page embed.'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                      Selected Pages
                    </div>
                    {selectedPages.length > 0 ? (
                      <div className="mt-2 flex max-h-20 flex-wrap gap-2 overflow-y-auto pr-1">
                        {selectedPages.map((page) => (
                          <button
                            key={page.notebookPageId}
                            type="button"
                            onClick={() => handleRemoveSelectedPage(page.pageNumber)}
                            className="rounded-full border border-[var(--color-border-default)] bg-white px-3 py-1 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-tertiary)] dark:bg-gh-canvas-default"
                          >
                            Page {page.pageNumber} ×
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        Add pages from the current preview using the toolbar above.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || !activeWorkspaceId}
          icon={<RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />}
        >
          {isSyncing ? 'Syncing…' : 'Sync Notebooks'}
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={selectedPages.length === 0}>
            {selectedPages.length > 1 ? `Insert ${selectedPages.length} BOOX Pages` : 'Insert BOOX Page'}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <MobileSheet isOpen={isOpen} onClose={onClose} title="Embed BOOX Page" maxHeight="85vh">
        {body}
      </MobileSheet>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" title="Embed BOOX Page">
      {body}
    </Modal>
  );
};

export default BooxPageEmbedPicker;