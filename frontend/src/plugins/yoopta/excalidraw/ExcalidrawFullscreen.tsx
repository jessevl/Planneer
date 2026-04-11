/**
 * @file ExcalidrawFullscreen.tsx
 * @description Fullscreen Excalidraw canvas overlay for editing whiteboards
 * @app PAGES - Lazy-loaded when opening a whiteboard block
 *
 * Features:
 * - Full viewport Excalidraw editor with custom Craft-style toolbar
 * - Saves scene data (elements + appState + files) on close
 * - Generates + uploads PNG thumbnail via page images API on close
 * - Fallback auto-thumbnail after 5 minutes without close
 * - Hides Excalidraw's default UI in favor of custom ExcalidrawToolbar
 *
 * Used by:
 * - ExcalidrawRender.tsx (via React.lazy)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaptureUpdateAction, Excalidraw, exportToBlob, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import ExcalidrawToolbar from './ExcalidrawToolbar';
import {
  getDefaultStrokeColor,
  getDefaultViewBackgroundColor,
  normalizeDefaultStrokeColor,
} from './defaults';
import { useCurrentPageId } from '@/contexts';
import { uploadPageImage } from '@/api/pagesApi';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';

// ============================================================================
// TYPES
// ============================================================================

interface ExcalidrawFullscreenProps {
  snapshot: string | null;
  blockId: string;
  onClose: (snapshot: string, elementCount: number, thumbnailUrl: string | null) => void;
}

interface SceneData {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

interface ParsedSceneData {
  elements: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
  files?: BinaryFiles;
}

type PersistedAppState = Pick<
  AppState,
  | 'scrollX'
  | 'scrollY'
  | 'zoom'
  | 'theme'
  | 'viewBackgroundColor'
  | 'gridModeEnabled'
  | 'gridSize'
  | 'gridStep'
>;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Auto-save thumbnail fallback interval (5 minutes) */
const THUMBNAIL_FALLBACK_MS = 5 * 60 * 1000;

const DEFAULT_ACTIVE_TOOL: AppState['activeTool'] = {
  type: 'selection',
  customType: null,
  locked: false,
  lastActiveTool: null,
};

const getInitialAppStateOverrides = (isDark: boolean): Pick<
  AppState,
  | 'activeTool'
  | 'viewModeEnabled'
  | 'zenModeEnabled'
  | 'currentItemStrokeColor'
  | 'currentItemBackgroundColor'
  | 'viewBackgroundColor'
> => ({
  activeTool: DEFAULT_ACTIVE_TOOL,
  viewModeEnabled: false,
  zenModeEnabled: false,
  currentItemStrokeColor: getDefaultStrokeColor(isDark),
  currentItemBackgroundColor: 'transparent',
  viewBackgroundColor: getDefaultViewBackgroundColor(isDark),
});

// ============================================================================
// THUMBNAIL HELPERS
// ============================================================================

async function generateThumbnailBlob(
  api: ExcalidrawImperativeAPI,
): Promise<Blob | null> {
  const elements = api.getSceneElements();
  if (elements.length === 0) return null;

  try {
    const blob = await exportToBlob({
      elements,
      appState: {
        ...api.getAppState(),
        exportBackground: true,
        exportWithDarkMode: false,
      },
      files: api.getFiles(),
      maxWidthOrHeight: 800,
      getDimensions: () => ({ width: 800, height: 600, scale: 1 }),
    });
    return blob;
  } catch (err) {
    console.error('[ExcalidrawFullscreen] Thumbnail generation failed:', err);
    return null;
  }
}

async function uploadThumbnail(
  pageId: string,
  blob: Blob,
): Promise<string | null> {
  try {
    const file = new File([blob], `wb_thumb_${Date.now()}.png`, { type: 'image/png' });
    const result = await uploadPageImage(pageId, file, 800, 600);
    return result.src;
  } catch (err) {
    console.error('[ExcalidrawFullscreen] Thumbnail upload failed:', err);
    return null;
  }
}

function parseInitialScene(snapshot: string | null): SceneData | null {
  if (!snapshot) {
    return null;
  }

  try {
    const parsed = JSON.parse(snapshot) as ParsedSceneData;
    if (!parsed || !Array.isArray(parsed.elements)) {
      return null;
    }

    return {
      elements: parsed.elements,
      appState: parsed.appState ?? {},
      files: parsed.files ?? {},
    };
  } catch {
    return null;
  }
}

function normalizeSceneForTheme(scene: SceneData | null, isDark: boolean): SceneData | null {
  if (!scene) {
    return null;
  }

  const elements = scene.elements.map((element) => {
    const strokeColor = normalizeDefaultStrokeColor(element.strokeColor, isDark);

    if (!strokeColor || strokeColor === element.strokeColor) {
      return element;
    }

    return {
      ...element,
      strokeColor,
    } as NonDeletedExcalidrawElement;
  });

  const appState = {
    ...scene.appState,
    currentItemStrokeColor: normalizeDefaultStrokeColor(scene.appState.currentItemStrokeColor, isDark) ?? getDefaultStrokeColor(isDark),
    viewBackgroundColor: getDefaultViewBackgroundColor(isDark),
  };

  return {
    ...scene,
    elements,
    appState,
  };
}

function getPersistedAppState(appState: AppState): PersistedAppState {
  return {
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
    theme: appState.theme,
    viewBackgroundColor: appState.viewBackgroundColor,
    gridModeEnabled: appState.gridModeEnabled,
    gridSize: appState.gridSize,
    gridStep: appState.gridStep,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

const ExcalidrawFullscreen: React.FC<ExcalidrawFullscreenProps> = ({
  snapshot,
  blockId,
  onClose,
}) => {
  const pageId = useCurrentPageId();
  const isDark = useIsDarkMode();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestThumbnailUrlRef = useRef<string | null>(null);
  const [activeTool, setActiveTool] = useState<AppState['activeTool']['type']>('selection');
  const appStateRef = useRef<AppState | null>(null);
  const selectedElementsRef = useRef<readonly ExcalidrawElement[]>([]);
  // Tick bumped to re-render property row when meaningful style/selection changes occur
  const [propertyTick, setPropertyTick] = useState(0);

  // Parse initial scene data
  const initialScene = useRef<SceneData | null>(normalizeSceneForTheme(parseInitialScene(snapshot), isDark));

  // Generate + upload thumbnail
  const saveThumbnail = useCallback(async (): Promise<string | null> => {
    if (!api || !pageId) return null;

    const blob = await generateThumbnailBlob(api);
    if (!blob) return null;

    const url = await uploadThumbnail(pageId, blob);
    if (url) {
      latestThumbnailUrlRef.current = url;
    }
    return url;
  }, [api, pageId]);

  // Set up fallback thumbnail timer
  useEffect(() => {
    thumbnailTimerRef.current = setInterval(() => {
      saveThumbnail();
    }, THUMBNAIL_FALLBACK_MS);

    return () => {
      if (thumbnailTimerRef.current) {
        clearInterval(thumbnailTimerRef.current);
      }
    };
  }, [saveThumbnail]);

  // Handle close: save scene + thumbnail
  const handleClose = useCallback(async () => {
    if (!api) {
      onClose('', 0, null);
      return;
    }

    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();

    const sceneData: SceneData = {
      elements,
      appState: getPersistedAppState(appState),
      files,
    };
    const snapshotJson = JSON.stringify(sceneData);
    const elementCount = elements.filter((el) => !el.isDeleted).length;

    // Generate and upload thumbnail
    const thumbnailUrl = await saveThumbnail();

    onClose(snapshotJson, elementCount, thumbnailUrl);
  }, [api, onClose, saveThumbnail]);

  // Handle Excalidraw onChange to track active tool + selected elements
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], state: AppState) => {
      const toolType = state.activeTool?.type;
      if (toolType && toolType !== activeTool) {
        setActiveTool(toolType);
      }

      // Store in refs (no re-render)
      const prevState = appStateRef.current;
      appStateRef.current = state;

      // Compute selected elements
      const selectedIds = state.selectedElementIds;
      const selected = selectedIds
        ? elements.filter((el) => selectedIds[el.id] && !el.isDeleted)
        : [];

      // Only bump tick when selection count changes or style-relevant appState changes
      const prevSelected = selectedElementsRef.current;
      selectedElementsRef.current = selected;

      const selectionChanged = selected.length !== prevSelected.length
        || selected.some((el, i) => prevSelected[i]?.id !== el.id);
      // Detect when element properties change (e.g. text alignment set from toolbar)
      const elementVersionChanged = selected.some((el, i) => prevSelected[i]?.version !== el.version);
      const styleChanged = prevState && (
        prevState.currentItemStrokeColor !== state.currentItemStrokeColor
        || prevState.currentItemBackgroundColor !== state.currentItemBackgroundColor
        || prevState.currentItemStrokeWidth !== state.currentItemStrokeWidth
        || prevState.currentItemStrokeStyle !== state.currentItemStrokeStyle
        || prevState.currentItemRoughness !== state.currentItemRoughness
        || prevState.currentItemOpacity !== state.currentItemOpacity
        || prevState.currentItemRoundness !== state.currentItemRoundness
        || (prevState as unknown as Record<string, unknown>).currentItemFillStyle !== (state as unknown as Record<string, unknown>).currentItemFillStyle
        || (prevState as unknown as Record<string, unknown>).currentItemFontSize !== (state as unknown as Record<string, unknown>).currentItemFontSize
        || (prevState as unknown as Record<string, unknown>).currentItemFontFamily !== (state as unknown as Record<string, unknown>).currentItemFontFamily
      );

      const zoomChanged = prevState && prevState.zoom?.value !== state.zoom?.value;

      if (selectionChanged || styleChanged || zoomChanged || elementVersionChanged || !prevState) {
        setPropertyTick((t) => t + 1);
      }
    },
    [activeTool],
  );

  // Normalize restored scene state so old or malformed snapshots don't open in a non-editable mode.
  useEffect(() => {
    if (!api) {
      return;
    }

    api.updateScene({
      elements: normalizeSceneForTheme({
        elements: api.getSceneElements(),
        appState: api.getAppState(),
        files: api.getFiles(),
      }, isDark)?.elements,
      appState: getInitialAppStateOverrides(isDark),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [api, isDark]);

  // Prevent body scroll while fullscreen is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.classList.add('excalidraw-whiteboard-open');
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('excalidraw-whiteboard-open');
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape key to close (capture phase + keyCode fallback for Safari)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleClose]);

  // Excalidraw reintroduces a mobile footer island at smaller breakpoints.
  // There is no supported prop to disable that DOM entirely, so prune it
  // from this fullscreen instance whenever Excalidraw mounts/re-renders.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const removeFooterNodes = () => {
      root.querySelectorAll(
        '.excalidraw .layer-ui__wrapper__footer, .excalidraw .layer-ui__wrapper__footer-left, .excalidraw .layer-ui__wrapper__footer-right, .excalidraw .footer-center, .excalidraw .undo-redo-buttons',
      ).forEach((node) => {
        node.remove();
      });
    };

    removeFooterNodes();

    const observer = new MutationObserver(() => {
      removeFooterNodes();
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div ref={containerRef} className="fixed inset-0 z-[10020] bg-white dark:bg-gh-canvas-default pointer-events-auto excalidraw-fullscreen-container" style={{ width: '100vw', height: '100vh' }}>
      <Excalidraw
        excalidrawAPI={(excalidrawApi) => { setApi(excalidrawApi); }}
        initialData={initialScene.current ? {
          elements: initialScene.current.elements as ExcalidrawElement[],
          appState: {
            ...initialScene.current.appState,
            ...getInitialAppStateOverrides(isDark),
          },
          files: initialScene.current.files,
        } : {
          appState: {
            ...getInitialAppStateOverrides(isDark),
          },
        }}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            export: false,
            loadScene: false,
            toggleTheme: false,
            saveAsImage: false,
          },
          tools: { image: true },
        }}
      >
        {/* Empty MainMenu removes hamburger from DOM */}
        <MainMenu />
      </Excalidraw>
      {api && (
        <ExcalidrawToolbar
          api={api}
          activeTool={activeTool}
          appState={appStateRef.current}
          selectedElements={selectedElementsRef.current}
          onClose={handleClose}
          renderTick={propertyTick}
        />
      )}
    </div>,
    document.body,
  );
};

export default ExcalidrawFullscreen;
