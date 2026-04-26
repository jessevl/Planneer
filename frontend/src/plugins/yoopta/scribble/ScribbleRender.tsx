import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PluginElementRenderProps } from '@yoopta/editor';
import { Blocks, Elements, generateId, useYooptaEditor, useYooptaReadOnly } from '@yoopta/editor';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';

import { useCurrentPageId } from '@/contexts';
import { getPageFileUrl, removePageFile, uploadPageFile } from '@/api/pagesApi';
import { cn } from '@/lib/design-system';
import { useSettingsStore } from '@/stores/settingsStore';

import {
  buildPencilTexturePattern,
  resolveScribbleStrokeOpacity,
  resolveSegmentWidth,
  resolveStrokeWidth,
} from './appearance';
import { ScribbleCommands } from './commands';
import {
  closeScribbleFullscreen,
  getActiveScribbleFullscreenBlockId,
  openScribbleFullscreen,
  subscribeScribbleFullscreen,
} from './fullscreenState';
import {
  buildRenderableStrokeLayerPathData,
  buildRenderableStrokePathData,
  buildFountainFillPathData,
  findIntersectingStrokeIds,
  isFilledScribbleStroke,
  normalizeScribbleStroke,
  parseScribbleSvg,
  serializeScribbleSnapshotToSvg,
} from './svg';
import { SCRIBBLE_FEATURES_ENABLED } from './featureFlags';
import {
  DEFAULT_SCRIBBLE_PROPS,
  DEFAULT_SCRIBBLE_BACKGROUND,
  EINK_SCRIBBLE_BACKGROUND,
  type ScribbleBackgroundPattern,
  type ScribbleElementProps,
  type ScribblePenFlow,
  type ScribblePoint,
  type ScribbleSharedToolState,
  type ScribbleSnapshot,
  type ScribbleStroke,
  type ScribbleTool,
  type ScribbleToolSettings,
} from './types';

const ScribbleFullscreenChrome = React.lazy(() => import('./ScribbleFullscreenChrome'));

const DEFAULT_SHARED_TOOL_STATE: ScribbleSharedToolState = {
  activeTool: 'pen',
  settings: {
    pen: { color: '#1f2937', width: 2.2, flow: 'ballpoint' },
    pencil: { color: '#52525b', width: 2.2, texture: '2b' },
    gel: { color: '#1d4ed8', width: 1.8 },
    marker: { color: '#fde68a', width: 12 },
    eraser: { width: 18 },
  },
};

const A4_PAGE_WIDTH = 794;
const A4_PAGE_HEIGHT = 1123;
const A4_ASPECT_RATIO = A4_PAGE_WIDTH / A4_PAGE_HEIGHT;

const sharedToolListeners = new Set<() => void>();
let sharedScribbleToolState: ScribbleSharedToolState = DEFAULT_SHARED_TOOL_STATE;

const runtimeScribbleSnapshots = new Map<string, ScribbleSnapshot>();

type ScribbleBlock = {
  id: string;
  type?: string;
  meta?: { order?: number };
  value?: Array<{ type?: string; props?: ScribbleElementProps }>;
};

function emitSharedToolUpdate() {
  sharedToolListeners.forEach((listener) => listener());
}

function setSharedScribbleToolState(nextState: ScribbleSharedToolState) {
  sharedScribbleToolState = nextState;
  emitSharedToolUpdate();
}

function useSharedScribbleToolState() {
  const [toolState, setToolState] = useState<ScribbleSharedToolState>(sharedScribbleToolState);

  useEffect(() => {
    const handleChange = () => setToolState(sharedScribbleToolState);
    sharedToolListeners.add(handleChange);
    return () => {
      sharedToolListeners.delete(handleChange);
    };
  }, []);

  const updateTool = useCallback((nextTool: ScribbleTool) => {
    if (sharedScribbleToolState.activeTool === nextTool) return;
    setSharedScribbleToolState({
      ...sharedScribbleToolState,
      activeTool: nextTool,
    });
  }, []);

  const updateSettings = useCallback(<T extends ScribbleTool>(tool: T, patch: Partial<ScribbleToolSettings[T]>) => {
    setSharedScribbleToolState({
      ...sharedScribbleToolState,
      settings: {
        ...sharedScribbleToolState.settings,
        [tool]: {
          ...sharedScribbleToolState.settings[tool],
          ...patch,
        },
      },
    });
  }, []);

  return [toolState, updateTool, updateSettings] as const;
}

function useActiveScribbleFullscreenBlockId() {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(() => getActiveScribbleFullscreenBlockId());

  useEffect(() => subscribeScribbleFullscreen(() => {
    setActiveBlockId(getActiveScribbleFullscreenBlockId());
  }), []);

  return activeBlockId;
}

function createEmptyScribbleSnapshot(background: string): ScribbleSnapshot {
  return {
    version: 1,
    background: background || DEFAULT_SCRIBBLE_BACKGROUND,
    pageHeight: A4_PAGE_HEIGHT,
    strokes: [],
  };
}

function resolveScribbleBackground(background: string | null | undefined, isEinkMode: boolean): string {
  if (isEinkMode) {
    return EINK_SCRIBBLE_BACKGROUND;
  }

  return background || DEFAULT_SCRIBBLE_BACKGROUND;
}

function cloneScribbleSnapshot(snapshot: ScribbleSnapshot): ScribbleSnapshot {
  return {
    ...snapshot,
    strokes: snapshot.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
  };
}

function getRuntimeScribbleSnapshot(blockId: string): ScribbleSnapshot | null {
  const snapshot = runtimeScribbleSnapshots.get(blockId);
  return snapshot ? cloneScribbleSnapshot(snapshot) : null;
}

function setRuntimeScribbleSnapshot(blockId: string, snapshot: ScribbleSnapshot) {
  runtimeScribbleSnapshots.set(blockId, cloneScribbleSnapshot(snapshot));
}

function removeRuntimeScribbleSnapshot(blockId: string) {
  runtimeScribbleSnapshots.delete(blockId);
}

function getEditorBlocks(editor: unknown): ScribbleBlock[] {
  const rawChildren = (editor as { children?: unknown[] | Record<string, unknown> }).children;

  if (Array.isArray(rawChildren)) {
    return rawChildren as ScribbleBlock[];
  }

  return Object.values(rawChildren ?? {}) as ScribbleBlock[];
}

function getScribbleBlocks(editor: unknown): ScribbleBlock[] {
  return getEditorBlocks(editor)
    .filter((block) => block?.type === 'Scribble')
    .sort((left, right) => (left?.meta?.order ?? 0) - (right?.meta?.order ?? 0));
}

function getScribbleProps(block: ScribbleBlock | null | undefined): ScribbleElementProps | null {
  const element = block?.value?.[0];

  if (!element || element.type !== 'scribble' || !element.props) {
    return null;
  }

  return element.props;
}

function resolveBackgroundPattern(pattern: ScribbleBackgroundPattern | null | undefined): ScribbleBackgroundPattern {
  return pattern ?? DEFAULT_SCRIBBLE_PROPS.backgroundPattern;
}

function getBackgroundPatternSpec(pattern: ScribbleBackgroundPattern) {
  switch (pattern) {
    case 'lines-tight':
      return { kind: 'lines' as const, spacing: 24 };
    case 'lines-regular':
      return { kind: 'lines' as const, spacing: 34 };
    case 'lines-wide':
      return { kind: 'lines' as const, spacing: 46 };
    case 'dots-tight':
      return { kind: 'dots' as const, spacing: 20 };
    case 'dots-regular':
      return { kind: 'dots' as const, spacing: 28 };
    case 'dots-wide':
      return { kind: 'dots' as const, spacing: 38 };
    case 'grid-tight':
      return { kind: 'grid' as const, spacing: 20 };
    case 'grid-regular':
      return { kind: 'grid' as const, spacing: 28 };
    case 'grid-wide':
      return { kind: 'grid' as const, spacing: 38 };
    default:
      return { kind: 'plain' as const, spacing: 0 };
  }
}

function getBackgroundPatternStroke(isEinkMode: boolean): string {
  return isEinkMode ? 'rgba(38, 38, 38, 0.13)' : 'rgba(71, 85, 105, 0.14)';
}

function paintScribbleBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: string,
  pattern: ScribbleBackgroundPattern,
  isEinkMode: boolean,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const spec = getBackgroundPatternSpec(pattern);
  if (spec.kind === 'plain') {
    return;
  }

  ctx.save();
  ctx.strokeStyle = getBackgroundPatternStroke(isEinkMode);
  ctx.fillStyle = getBackgroundPatternStroke(isEinkMode);
  ctx.lineWidth = 1;

  if (spec.kind === 'lines' || spec.kind === 'grid') {
    ctx.beginPath();
    for (let y = spec.spacing; y < height; y += spec.spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    if (spec.kind === 'grid') {
      for (let x = spec.spacing; x < width; x += spec.spacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const radius = isEinkMode ? 0.9 : 1.1;
  for (let y = spec.spacing; y < height; y += spec.spacing) {
    for (let x = spec.spacing; x < width; x += spec.spacing) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function createStrokeFromToolState(
  toolState: ScribbleSharedToolState,
  point: ScribblePoint,
): ScribbleStroke {
  const { activeTool, settings } = toolState;

  if (activeTool === 'pen') {
    return {
      id: generateId(),
      tool: 'pen',
      color: settings.pen.color,
      width: settings.pen.width,
      variant: settings.pen.flow,
      points: [point],
    };
  }

  if (activeTool === 'pencil') {
    return {
      id: generateId(),
      tool: 'pencil',
      color: settings.pencil.color,
      width: settings.pencil.width,
      variant: settings.pencil.texture,
      points: [point],
    };
  }

  if (activeTool === 'gel') {
    return {
      id: generateId(),
      tool: 'gel',
      color: settings.gel.color,
      width: settings.gel.width,
      points: [point],
    };
  }

  if (activeTool === 'marker') {
    return {
      id: generateId(),
      tool: 'marker',
      color: settings.marker.color,
      width: settings.marker.width,
      points: [point],
    };
  }

  return {
    id: generateId(),
    tool: 'eraser',
    color: '#ffffff',
    width: settings.eraser.width,
    points: [point],
  };
}

function toRelativePoint(event: PointerEvent | React.PointerEvent, rect: DOMRect): ScribblePoint {
  const x = rect.width <= 0 ? 0 : Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const y = rect.height <= 0 ? 0 : Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

  return {
    x,
    y,
    pressure: 'pressure' in event && typeof event.pressure === 'number' ? event.pressure : undefined,
  };
}

function strokeDistance(a: ScribblePoint, b: ScribblePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(a: ScribblePoint, b: ScribblePoint): ScribblePoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    pressure: ((a.pressure ?? 0.5) + (b.pressure ?? 0.5)) / 2,
  };
}

const pencilTextureTileCache = new Map<string, HTMLCanvasElement>();

function getPencilTextureTile(texture: ScribbleStroke['variant'], color: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cacheKey = `${texture ?? '2b'}:${color}`;
  const cached = pencilTextureTileCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pattern = buildPencilTexturePattern(texture, color);
  const canvas = document.createElement('canvas');
  canvas.width = pattern.tileSize;
  canvas.height = pattern.tileSize;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = 'round';

  for (const streak of pattern.streaks) {
    context.strokeStyle = streak.color;
    context.lineWidth = streak.width;
    context.beginPath();
    context.moveTo(streak.x1, streak.y1);
    context.lineTo(streak.x2, streak.y2);
    context.stroke();
  }

  for (const dot of pattern.dots) {
    context.fillStyle = dot.color;
    context.fillRect(dot.x, dot.y, dot.size, dot.size);
  }

  for (const smudge of pattern.smudges) {
    context.save();
    context.translate(smudge.x, smudge.y);
    context.rotate((smudge.rotation * Math.PI) / 180);
    context.fillStyle = smudge.color;
    context.beginPath();
    context.ellipse(0, 0, smudge.width / 2, smudge.height / 2, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  pencilTextureTileCache.set(cacheKey, canvas);
  return canvas;
}

function getStrokeBounds(
  stroke: ScribbleStroke,
  width: number,
  height: number,
  padding: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of stroke.points) {
    const x = point.x * width;
    const y = point.y * height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: width, maxY: height };
  }

  return {
    minX: Math.max(0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: Math.min(width, maxX + padding),
    maxY: Math.min(height, maxY + padding),
  };
}

function paintPencilTexture(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  stroke: ScribbleStroke,
  width: number,
  height: number,
) {
  const tile = getPencilTextureTile(stroke.variant, stroke.color);
  if (!tile) {
    return;
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) {
    return;
  }

  const bounds = getStrokeBounds(stroke, width, height, Math.max(5, resolveStrokeWidth(stroke) * 1.35));

  ctx.save();
  ctx.clip(path);
  ctx.globalAlpha = 1;
  ctx.fillStyle = pattern;
  ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  ctx.restore();
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: ScribbleStroke,
  width: number,
  height: number,
  background: string,
) {
  if (stroke.points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.tool === 'eraser' ? background : stroke.color;
  ctx.globalAlpha = resolveScribbleStrokeOpacity(stroke);
  ctx.setLineDash([]);

  if (isFilledScribbleStroke(stroke)) {
    const fillPath = stroke.svgPath ?? buildFountainFillPathData(stroke, width, height);
    if (fillPath) {
      ctx.fillStyle = stroke.color;
      ctx.globalAlpha = 1;
      ctx.fill(new Path2D(fillPath));
    }
    ctx.restore();
    return;
  }

  if (stroke.tool === 'pencil' && stroke.points.length > 1) {
    const layerPaths = buildRenderableStrokeLayerPathData(stroke, width, height);
    for (const layerPath of layerPaths) {
      const layer = new Path2D(layerPath);
      ctx.fillStyle = stroke.color;
      ctx.fill(layer);
      paintPencilTexture(ctx, layer, stroke, width, height);
    }

    ctx.restore();
    return;
  }

  const renderedPath = buildRenderableStrokePathData(stroke, width, height);
  if (renderedPath) {
    const renderedStrokePath = new Path2D(renderedPath);
    ctx.fillStyle = stroke.tool === 'eraser' ? background : stroke.color;
    ctx.fill(renderedStrokePath);

    ctx.restore();
    return;
  }

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    ctx.beginPath();
    ctx.arc(
      point.x * width,
      point.y * height,
      resolveSegmentWidth(stroke, point, point) / 2,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = stroke.tool === 'eraser' ? background : stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  const points = stroke.points;

  if (points.length === 2) {
    ctx.beginPath();
    ctx.lineWidth = resolveStrokeWidth(stroke);
    ctx.moveTo(points[0].x * width, points[0].y * height);
    ctx.lineTo(points[1].x * width, points[1].y * height);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Ink pen: per-segment variable width for natural pressure-responsive flow.
  // Each segment is stroked individually so lineWidth can vary with pressure.
  // Round lineCaps (set above) create smooth overlap at segment joints.
  if (stroke.variant === 'ink' && points.length > 2) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const curr = points[i];
      const next = points[i + 1];
      const w = resolveSegmentWidth(stroke, curr, next);
      ctx.beginPath();
      ctx.lineWidth = w;
      ctx.moveTo(curr.x * width, curr.y * height);
      if (i < points.length - 2) {
        const afterNext = points[i + 2];
        const m = midpoint(next, afterNext);
        ctx.quadraticCurveTo(
          next.x * width, next.y * height,
          m.x * width, m.y * height,
        );
      } else {
        ctx.lineTo(next.x * width, next.y * height);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.lineWidth = resolveStrokeWidth(stroke);
  ctx.moveTo(points[0].x * width, points[0].y * height);

  if (stroke.variant === 'ballpoint') {
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x * width, points[index].y * height);
    }
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const mid = midpoint(current, next);
      ctx.quadraticCurveTo(
        current.x * width,
        current.y * height,
        mid.x * width,
        mid.y * height,
      );
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x * width, last.y * height);
  }
  ctx.stroke();
  ctx.restore();
}

function syncContainerAspectRatio(container: HTMLDivElement): { width: number; height: number } {
  const rect = container.getBoundingClientRect();
  const nextWidth = Math.max(1, rect.width);
  const nextHeight = nextWidth / A4_ASPECT_RATIO;

  if (Math.abs(container.clientHeight - nextHeight) > 0.5) {
    container.style.height = `${nextHeight}px`;
  }

  return { width: nextWidth, height: nextHeight };
}

function persistScribbleElement(
  editor: ReturnType<typeof useYooptaEditor>,
  blockId: string,
  snapshot: ScribbleSnapshot,
  currentProps: ScribbleElementProps,
  preferredTool: ScribbleTool,
  overrides?: Partial<ScribbleElementProps>,
) {
  const scrollX = typeof window === 'undefined' ? 0 : window.scrollX;
  const scrollY = typeof window === 'undefined' ? 0 : window.scrollY;

  Elements.updateElement(editor, {
    blockId,
    type: 'scribble',
    props: {
      svgFileName: currentProps.svgFileName,
      strokeCount: snapshot.strokes.length,
      lastEdited: new Date().toISOString(),
      pageHeight: A4_PAGE_HEIGHT,
      background: snapshot.background,
      backgroundPattern: currentProps.backgroundPattern,
      preferredTool,
      ...overrides,
    },
  });

  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
      window.requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
      });
    });
  }
}

type UseScribbleDocumentArgs = {
  blockId: string;
  props: ScribbleElementProps;
  background: string;
  editor: ReturnType<typeof useYooptaEditor>;
  pageId: string | null;
  isReadOnly: boolean;
  preferredTool: ScribbleTool;
};

function useScribbleDocument({
  blockId,
  props,
  background,
  editor,
  pageId,
  isReadOnly,
  preferredTool,
}: UseScribbleDocumentArgs) {
  const cachedSnapshot = useMemo(() => getRuntimeScribbleSnapshot(blockId), [blockId]);
  const [snapshot, setSnapshot] = useState<ScribbleSnapshot>(() => cachedSnapshot ?? createEmptyScribbleSnapshot(background));
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(props.svgFileName && pageId));
  const svgUploadTimeoutRef = useRef<number | null>(null);
  const uploadedSvgMarkupRef = useRef<string | null>(null);
  const svgFileNameRef = useRef<string | null>(props.svgFileName);
  const hydratedSvgFileNameRef = useRef<string | null>(cachedSnapshot ? props.svgFileName : null);
  const svgUploadRequestRef = useRef(0);

  useEffect(() => {
    svgFileNameRef.current = props.svgFileName;
  }, [props.svgFileName]);

  useEffect(() => {
    const cached = getRuntimeScribbleSnapshot(blockId);
    if (cached) {
      setSnapshot(cached);
      setIsLoading(false);
      if (props.svgFileName && hydratedSvgFileNameRef.current == null) {
        hydratedSvgFileNameRef.current = props.svgFileName;
      }
      return;
    }

    if (!pageId || !props.svgFileName) {
      const emptySnapshot = createEmptyScribbleSnapshot(background);
      setRuntimeScribbleSnapshot(blockId, emptySnapshot);
      setSnapshot(emptySnapshot);
      uploadedSvgMarkupRef.current = null;
      hydratedSvgFileNameRef.current = props.svgFileName;
      setIsLoading(false);
      return;
    }

    if (hydratedSvgFileNameRef.current === props.svgFileName) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    fetch(getPageFileUrl(pageId, props.svgFileName), { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load Scribble SVG: ${response.status}`);
        }
        return response.text();
      })
      .then((markup) => {
        if (isCancelled) return;

        const parsed = parseScribbleSvg(markup, background, props.pageHeight);
        uploadedSvgMarkupRef.current = markup;
        hydratedSvgFileNameRef.current = props.svgFileName;
        setRuntimeScribbleSnapshot(blockId, parsed);
        setSnapshot(parsed);
        setIsLoading(false);
      })
      .catch((error) => {
        if (isCancelled) return;

        console.error('Failed to hydrate Scribble from SVG attachment:', error);
        const emptySnapshot = createEmptyScribbleSnapshot(background);
        setRuntimeScribbleSnapshot(blockId, emptySnapshot);
        setSnapshot(emptySnapshot);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [background, blockId, pageId, props]);

  useEffect(() => {
    if (snapshot.background === background) {
      return;
    }

    const nextSnapshot = {
      ...snapshot,
      background,
    };

    setRuntimeScribbleSnapshot(blockId, nextSnapshot);
    setSnapshot(nextSnapshot);

    if (!isReadOnly) {
      persistScribbleElement(editor, blockId, nextSnapshot, props, preferredTool, {
        background,
      });
    }
  }, [background, blockId, editor, isReadOnly, preferredTool, props, snapshot]);

  const svgMarkup = useMemo(
    () => serializeScribbleSnapshotToSvg(snapshot, A4_PAGE_WIDTH, A4_PAGE_HEIGHT),
    [snapshot],
  );

  useEffect(() => {
    if (isReadOnly || !pageId || isLoading) {
      return undefined;
    }

    if (svgUploadTimeoutRef.current != null) {
      window.clearTimeout(svgUploadTimeoutRef.current);
      svgUploadTimeoutRef.current = null;
    }

    const requestId = ++svgUploadRequestRef.current;

    if (snapshot.strokes.length === 0) {
      if (!svgFileNameRef.current) {
        uploadedSvgMarkupRef.current = null;
        return undefined;
      }

      svgUploadTimeoutRef.current = window.setTimeout(() => {
        const existingFileName = svgFileNameRef.current;
        if (!existingFileName) return;

        removePageFile(pageId, existingFileName)
          .then(() => {
            if (svgUploadRequestRef.current !== requestId) return;

            svgFileNameRef.current = null;
            uploadedSvgMarkupRef.current = null;
            hydratedSvgFileNameRef.current = null;
            persistScribbleElement(editor, blockId, snapshot, props, preferredTool, { svgFileName: null });
          })
          .catch((error) => {
            console.error('Failed to clear Scribble SVG attachment:', error);
          });
      }, 300);

      return () => {
        if (svgUploadTimeoutRef.current != null) {
          window.clearTimeout(svgUploadTimeoutRef.current);
          svgUploadTimeoutRef.current = null;
        }
      };
    }

    if (svgFileNameRef.current && uploadedSvgMarkupRef.current === svgMarkup) {
      return undefined;
    }

    svgUploadTimeoutRef.current = window.setTimeout(() => {
      const previousFileName = svgFileNameRef.current;
      const svgFile = new File([svgMarkup], `scribble-${blockId}-${Date.now()}.svg`, {
        type: 'image/svg+xml',
      });

      uploadPageFile(pageId, svgFile)
        .then((result) => {
          if (svgUploadRequestRef.current !== requestId) return;

          uploadedSvgMarkupRef.current = svgMarkup;
          svgFileNameRef.current = result.filename;
          hydratedSvgFileNameRef.current = result.filename;
          persistScribbleElement(editor, blockId, snapshot, props, preferredTool, {
            svgFileName: result.filename,
          });

          if (previousFileName && previousFileName !== result.filename) {
            void removePageFile(pageId, previousFileName).catch((error) => {
              console.error('Failed to replace Scribble SVG attachment:', error);
            });
          }
        })
        .catch((error) => {
          console.error('Failed to upload Scribble SVG attachment:', error);
        });
    }, 450);

    return () => {
      if (svgUploadTimeoutRef.current != null) {
        window.clearTimeout(svgUploadTimeoutRef.current);
        svgUploadTimeoutRef.current = null;
      }
    };
  }, [blockId, editor, isLoading, isReadOnly, pageId, preferredTool, props, snapshot, svgMarkup]);

  const persist = useCallback((next: ScribbleSnapshot, overrides?: Partial<ScribbleElementProps>) => {
    setRuntimeScribbleSnapshot(blockId, next);
    setSnapshot(next);
    persistScribbleElement(editor, blockId, next, props, preferredTool, overrides);
  }, [blockId, editor, preferredTool, props]);

  return {
    snapshot,
    persist,
    isLoading,
    svgFileNameRef,
  };
}

type ScribbleCanvasSurfaceProps = {
  scribble: ScribbleSnapshot;
  toolState: ScribbleSharedToolState;
  backgroundPattern: ScribbleBackgroundPattern;
  isEinkMode: boolean;
  isReadOnly: boolean;
  onPersist: (next: ScribbleSnapshot) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  emptyMessage?: string;
  onActivate?: (event: React.SyntheticEvent) => void;
};

function ScribbleCanvasSurface({
  scribble,
  toolState,
  backgroundPattern,
  isEinkMode,
  isReadOnly,
  onPersist,
  className,
  style,
  children,
  emptyMessage,
  onActivate,
}: ScribbleCanvasSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scribbleRef = useRef<ScribbleSnapshot>(scribble);
  const draftStrokeRef = useRef<ScribbleStroke | null>(null);
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const erasedStrokeIdsRef = useRef<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(true);

  const shouldHandlePointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return false;
    if (event.pointerType === 'touch') return false;
    return event.pointerType === 'pen' || event.pointerType === 'mouse';
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    if (!isVisible && !isDrawingRef.current) {
      return;
    }

    const nextSize = syncContainerAspectRatio(container);
    const cssWidth = nextSize.width;
    const cssHeight = nextSize.height;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)) {
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }

    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScribbleBackground(ctx, cssWidth, cssHeight, scribbleRef.current.background, backgroundPattern, isEinkMode);

    scribbleRef.current.strokes.forEach((stroke) => {
      drawStroke(ctx, stroke, cssWidth, cssHeight, scribbleRef.current.background);
    });

    if (draftStrokeRef.current) {
      const previewStroke = draftStrokeRef.current.points.length > 1
        ? normalizeScribbleStroke(draftStrokeRef.current)
        : draftStrokeRef.current;
      drawStroke(ctx, previewStroke, cssWidth, cssHeight, scribbleRef.current.background);
    }
  }, [backgroundPattern, isEinkMode, isVisible]);

  useEffect(() => {
    if (!isDrawingRef.current) {
      scribbleRef.current = scribble;
      redraw();
    }
  }, [scribble, redraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = entry?.isIntersecting ?? false;
        setIsVisible(nextVisible);
      },
      {
        root: null,
        threshold: 0.01,
        rootMargin: '240px 0px',
      },
    );
    intersectionObserver.observe(container);

    const observer = new ResizeObserver(() => redraw());
    if (isVisible) {
      observer.observe(container);
    }

    return () => {
      intersectionObserver.disconnect();
      observer.disconnect();
    };
  }, [isVisible, redraw]);

  useEffect(() => {
    if (isVisible) {
      redraw();
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || isDrawingRef.current) return;

    const nextSize = syncContainerAspectRatio(container);
    const cssWidth = nextSize.width;
    const cssHeight = nextSize.height;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)) {
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }

    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScribbleBackground(ctx, cssWidth, cssHeight, scribbleRef.current.background, backgroundPattern, isEinkMode);
  }, [backgroundPattern, isEinkMode, isVisible, redraw]);

  const finishStroke = useCallback(() => {
    const draft = draftStrokeRef.current;
    if (!draft) return;

    draftStrokeRef.current = null;
    isDrawingRef.current = false;
    const normalizedStroke = draft.points.length > 1 ? normalizeScribbleStroke(draft) : draft;
    const next = {
      ...scribbleRef.current,
      strokes: [...scribbleRef.current.strokes, normalizedStroke],
    };
    scribbleRef.current = next;
    onPersist(next);
  }, [onPersist]);

  const eraseAtPoint = useCallback((point: ScribblePoint) => {
    const threshold = toolState.settings.eraser.width / A4_PAGE_WIDTH;
    const intersectingIds = findIntersectingStrokeIds(scribbleRef.current, point, threshold);
    if (intersectingIds.length === 0) return false;

    const hitSet = new Set(intersectingIds);
    let changed = false;
    const nextStrokes = scribbleRef.current.strokes.filter((stroke) => {
      if (!hitSet.has(stroke.id)) return true;
      erasedStrokeIdsRef.current.add(stroke.id);
      changed = true;
      return false;
    });

    if (!changed) return false;

    scribbleRef.current = {
      ...scribbleRef.current,
      strokes: nextStrokes,
    };

    return true;
  }, [toolState.settings.eraser.width]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (isReadOnly) return;
    if (!shouldHandlePointer(event)) return;
    if (activePointerIdRef.current != null) return;
    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    activePointerIdRef.current = event.pointerId;

    if (toolState.activeTool === 'eraser') {
      erasedStrokeIdsRef.current = new Set();
      isDrawingRef.current = true;
      canvas.setPointerCapture(event.pointerId);
      if (eraseAtPoint(toRelativePoint(event, rect))) {
        redraw();
      }
      return;
    }

    draftStrokeRef.current = createStrokeFromToolState(toolState, toRelativePoint(event, rect));
    isDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    redraw();
  }, [eraseAtPoint, isReadOnly, redraw, shouldHandlePointer, toolState]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (toolState.activeTool === 'eraser') {
      if (eraseAtPoint(toRelativePoint(event, rect))) {
        redraw();
      }
      return;
    }

    if (!draftStrokeRef.current) return;

    const point = toRelativePoint(event, rect);
    const points = draftStrokeRef.current.points;
    const previous = points[points.length - 1];

    // Adaptive sampling: pencil needs more detail for grain, marker needs less
    const minDist = toolState.activeTool === 'marker' ? 0.002
      : toolState.activeTool === 'pencil' ? 0.0008
      : 0.001;
    if (!previous || strokeDistance(previous, point) > minDist) {
      draftStrokeRef.current = {
        ...draftStrokeRef.current,
        points: [...points, point],
      };
      redraw();
    }
  }, [eraseAtPoint, redraw, toolState.activeTool]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    activePointerIdRef.current = null;

    if (toolState.activeTool === 'eraser') {
      const didErase = erasedStrokeIdsRef.current.size > 0;
      erasedStrokeIdsRef.current = new Set();
      isDrawingRef.current = false;
      draftStrokeRef.current = null;
      if (didErase) {
        onPersist(scribbleRef.current);
      } else {
        redraw();
      }
      return;
    }

    finishStroke();
  }, [finishStroke, onPersist, redraw, toolState.activeTool]);

  const handlePointerLost = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    handlePointerUp(event);
  }, [handlePointerUp]);

  const hasContent = scribble.strokes.length > 0;
  const handleReadonlyActivate = useCallback((event: React.SyntheticEvent) => {
    if (!isReadOnly || !onActivate) return;
    event.preventDefault();
    event.stopPropagation();
    onActivate(event);
  }, [isReadOnly, onActivate]);

  return (
    <div
      ref={containerRef}
      className={cn(className, isReadOnly && onActivate && 'cursor-zoom-in')}
      style={style}
      onPointerDownCapture={isReadOnly ? handleReadonlyActivate : undefined}
      onClick={isReadOnly ? handleReadonlyActivate : undefined}
    >
      {children}
      <canvas
        ref={canvasRef}
        className={cn('block h-full w-full touch-none select-none', !isReadOnly && 'cursor-crosshair')}
        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none', msTouchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerLost}
        onLostPointerCapture={handlePointerLost}
        onContextMenu={(event) => event.preventDefault()}
      />

      {!hasContent && emptyMessage && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
          <div>
            <div className="text-base font-semibold text-[var(--color-text-primary)]">Start writing on the page</div>
            <div className="mt-2 text-sm text-[var(--color-text-secondary)]">{emptyMessage}</div>
          </div>
        </div>
      )}

      {!isVisible && hasContent && !isDrawingRef.current && (
        <div className="pointer-events-none absolute inset-0 bg-[color-mix(in_srgb,var(--color-surface-base)_30%,transparent)]" />
      )}
    </div>
  );
}

type ScribbleToolbarProps = {
  toolState: ScribbleSharedToolState;
  backgroundPattern: ScribbleBackgroundPattern;
  isReadOnly: boolean;
  isFullscreen: boolean;
  onToolSelect: (tool: ScribbleTool) => void;
  onToolSettingsChange: <T extends ScribbleTool>(tool: T, patch: Partial<ScribbleToolSettings[T]>) => void;
  onBackgroundPatternChange: (pattern: ScribbleBackgroundPattern) => void;
  onUndo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFullscreen: () => void;
};

type ScribbleFullscreenOverlayProps = {
  editor: ReturnType<typeof useYooptaEditor>;
  initialBlockId: string;
  isReadOnly: boolean;
  onClose: () => void;
};

function ScribbleFullscreenOverlay({ editor, initialBlockId, isReadOnly, onClose }: ScribbleFullscreenOverlayProps) {
  const pageId = useCurrentPageId();
  const isEinkMode = useSettingsStore((state) => state.einkMode);
  const [activeBlockId, setActiveBlockId] = useState(initialBlockId);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));

  const scribbleBlocks = useMemo(() => getScribbleBlocks(editor), [documentVersion, editor]);
  const activeIndex = useMemo(
    () => scribbleBlocks.findIndex((block) => block.id === activeBlockId),
    [activeBlockId, scribbleBlocks],
  );
  const resolvedIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeBlock = scribbleBlocks[resolvedIndex] ?? null;
  const activeProps = getScribbleProps(activeBlock);
  const [toolState, setActiveTool, updateToolSettings] = useSharedScribbleToolState();
  const activeTool = toolState.activeTool;
  const resolvedActiveProps = activeProps ?? DEFAULT_SCRIBBLE_PROPS;
  const resolvedBackground = resolveScribbleBackground(resolvedActiveProps.background, isEinkMode);
  const activeBackgroundPattern = resolveBackgroundPattern(resolvedActiveProps.backgroundPattern);
  const resolvedActiveBlockId = activeBlock?.id ?? '__scribble_missing__';
  const {
    snapshot: activeSnapshot,
    persist: persistActive,
  } = useScribbleDocument({
    blockId: resolvedActiveBlockId,
    props: resolvedActiveProps,
    background: resolvedBackground,
    editor,
    pageId,
    isReadOnly,
    preferredTool: activeTool,
  });
  const fullscreenChromeRef = useRef<HTMLDivElement>(null);
  const fullscreenSurfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleChange = () => setDocumentVersion((current) => current + 1);
    editor.on('change', handleChange);
    return () => {
      editor.off('change', handleChange);
    };
  }, [editor]);

  useEffect(() => {
    if (!activeBlock && scribbleBlocks.length === 0) {
      onClose();
      return;
    }

    if (!activeBlock && scribbleBlocks.length > 0) {
      setActiveBlockId(scribbleBlocks[0].id);
    }
  }, [activeBlock, onClose, scribbleBlocks]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navigateTo = useCallback((nextIndex: number) => {
    const nextBlock = scribbleBlocks[nextIndex];
    if (nextBlock) {
      setActiveBlockId(nextBlock.id);
    }
  }, [scribbleBlocks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft' && resolvedIndex > 0) {
        event.preventDefault();
        navigateTo(resolvedIndex - 1);
      }

      if (event.key === 'ArrowRight' && resolvedIndex < scribbleBlocks.length - 1) {
        event.preventDefault();
        navigateTo(resolvedIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [navigateTo, onClose, resolvedIndex, scribbleBlocks.length]);

  const handleToolSelect = useCallback((tool: ScribbleTool) => {
    if (!activeBlock) return;

    setActiveTool(tool);
  }, [activeBlock, setActiveTool]);

  const handleUndo = useCallback(() => {
    if (activeSnapshot.strokes.length === 0) return;

    persistActive({
      ...activeSnapshot,
      strokes: activeSnapshot.strokes.slice(0, -1),
    });
  }, [activeSnapshot, persistActive]);

  const addPageAfterActive = useCallback(() => {
    if (!activeBlock) return;

    const newId = ScribbleCommands.insertScribble(editor, {
      at: (activeBlock.meta?.order ?? 0) + 1,
      focus: false,
      props: {
        svgFileName: null,
        strokeCount: 0,
        pageHeight: A4_PAGE_HEIGHT,
        background: activeSnapshot.background,
        backgroundPattern: activeBackgroundPattern,
        preferredTool: activeTool,
      },
    });
    setActiveBlockId(newId);
  }, [activeBackgroundPattern, activeBlock, activeSnapshot.background, activeTool, editor]);

  const duplicatePage = useCallback(() => {
    if (!activeBlock) return;

    const newId = ScribbleCommands.insertScribble(editor, {
      at: (activeBlock.meta?.order ?? 0) + 1,
      focus: false,
      props: {
        svgFileName: null,
        strokeCount: activeSnapshot.strokes.length,
        pageHeight: A4_PAGE_HEIGHT,
        background: activeSnapshot.background,
        backgroundPattern: activeBackgroundPattern,
        preferredTool: activeTool,
      },
    });
    setRuntimeScribbleSnapshot(newId, activeSnapshot);
    setActiveBlockId(newId);
  }, [activeBackgroundPattern, activeBlock, activeSnapshot, activeTool, editor]);

  const deletePage = useCallback(async () => {
    if (!activeBlock) return;

    const nextBlock = scribbleBlocks[resolvedIndex + 1] ?? scribbleBlocks[resolvedIndex - 1] ?? null;

    if (pageId && activeProps?.svgFileName) {
      try {
        await removePageFile(pageId, activeProps.svgFileName);
      } catch (error) {
        console.error('Failed to remove Scribble SVG attachment:', error);
      }
    }

    removeRuntimeScribbleSnapshot(activeBlock.id);

    Blocks.deleteBlock(editor, { blockId: activeBlock.id });

    if (nextBlock) {
      openScribbleFullscreen(nextBlock.id);
      setActiveBlockId(nextBlock.id);
      return;
    }

    closeScribbleFullscreen(activeBlock.id);
    onClose();
  }, [activeBlock, activeProps?.svgFileName, editor, onClose, pageId, resolvedIndex, scribbleBlocks]);

  if (!activeBlock || !activeProps || typeof document === 'undefined') {
    return null;
  }

  const fullscreenWidth = Math.min(
    viewportSize.width,
    viewportSize.height * A4_ASPECT_RATIO,
  );

  const fullscreenHeight = fullscreenWidth / A4_ASPECT_RATIO;

  return createPortal(
    <div className="fixed inset-0 z-[10020] bg-[color-mix(in_srgb,var(--color-surface-base)_78%,black_22%)] backdrop-blur-md">
      <div ref={fullscreenChromeRef}>
        <React.Suspense fallback={<div className="pointer-events-none absolute inset-0 z-20" />}>
          <ScribbleFullscreenChrome
            toolState={toolState}
            backgroundPattern={activeBackgroundPattern}
            isReadOnly={isReadOnly}
            pageNumber={resolvedIndex + 1}
            totalPages={scribbleBlocks.length}
            strokeCount={activeSnapshot.strokes.length}
            lastEdited={activeProps.lastEdited}
            canGoPrevious={resolvedIndex > 0}
            isLastPage={resolvedIndex >= scribbleBlocks.length - 1}
            onToolSelect={handleToolSelect}
            onToolSettingsChange={updateToolSettings}
            onBackgroundPatternChange={(pattern) => persistActive(activeSnapshot, { backgroundPattern: pattern })}
            onUndo={handleUndo}
            onDuplicate={duplicatePage}
            onDelete={deletePage}
            onToggleFullscreen={onClose}
            onGoPrevious={() => navigateTo(resolvedIndex - 1)}
            onGoNextOrAdd={() => {
              if (resolvedIndex >= scribbleBlocks.length - 1) {
                addPageAfterActive();
                return;
              }
              navigateTo(resolvedIndex + 1);
            }}
          />
        </React.Suspense>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={fullscreenSurfaceRef}
          className="relative overflow-hidden bg-[var(--color-surface-base)] shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
          style={{
            width: `${Math.max(280, fullscreenWidth)}px`,
            height: `${Math.max(396, fullscreenHeight)}px`,
            background: activeSnapshot.background,
          }}
        >
          <ScribbleCanvasSurface
            key={activeBlock.id}
            scribble={activeSnapshot}
            toolState={toolState}
            backgroundPattern={activeBackgroundPattern}
            isEinkMode={isEinkMode}
            isReadOnly={isReadOnly}
            onPersist={persistActive}
            className="relative h-full w-full overflow-hidden"
            style={{
              width: '100%',
              height: '100%',
              background: activeSnapshot.background,
            }}
            emptyMessage="Use the page controls or arrow keys to move through pages without leaving fullscreen."
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ScribbleRender({
  attributes,
  element,
  blockId,
  children,
}: PluginElementRenderProps) {
  const editor = useYooptaEditor();
  const isReadOnly = useYooptaReadOnly();
  const pageId = useCurrentPageId();
  const pageRef = useRef<HTMLDivElement>(null);
  const props = element.props as unknown as ScribbleElementProps;
  const { strokeCount } = props;
  const isEinkMode = useSettingsStore((state) => state.einkMode);
  const resolvedBackground = resolveScribbleBackground(props.background, isEinkMode);
  const backgroundPattern = resolveBackgroundPattern(props.backgroundPattern);
  const [documentVersion, setDocumentVersion] = useState(0);
  const activeFullscreenBlockId = useActiveScribbleFullscreenBlockId();
  const isFullscreen = SCRIBBLE_FEATURES_ENABLED && activeFullscreenBlockId === blockId;
  const preferredTool = props.preferredTool ?? DEFAULT_SCRIBBLE_PROPS.preferredTool;
  const {
    snapshot: currentSnapshot,
    persist,
    isLoading,
  } = useScribbleDocument({
    blockId,
    props,
    background: resolvedBackground,
    editor,
    pageId,
    isReadOnly,
    preferredTool,
  });
  useEffect(() => {
    const handleChange = () => setDocumentVersion((current) => current + 1);
    editor.on('change', handleChange);
    return () => {
      editor.off('change', handleChange);
    };
  }, [editor]);

  const handleActivate = useCallback((event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (isReadOnly || !SCRIBBLE_FEATURES_ENABLED) {
      return;
    }

    openScribbleFullscreen(blockId);
  }, [blockId, isReadOnly]);

  const scribbleBlocks = useMemo(() => getScribbleBlocks(editor), [documentVersion, editor]);

  const pageMeta = useMemo(() => {
    const index = scribbleBlocks.findIndex((block) => block.id === blockId);
    return {
      pageNumber: index >= 0 ? index + 1 : 1,
      totalPages: Math.max(1, scribbleBlocks.length),
    };
  }, [blockId, scribbleBlocks]);

  const addPageAfterCurrent = useCallback(() => {
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block) return;

    ScribbleCommands.insertScribble(editor, {
      at: block.meta.order + 1,
      focus: false,
      props: {
        svgFileName: null,
        strokeCount: 0,
        pageHeight: A4_PAGE_HEIGHT,
        background: currentSnapshot.background,
        backgroundPattern,
        preferredTool,
      },
    });
  }, [backgroundPattern, blockId, currentSnapshot.background, editor, preferredTool]);

  const hasContent = strokeCount > 0 || currentSnapshot.strokes.length > 0;

  return (
    <div {...attributes} ref={pageRef} contentEditable={false} draggable={false}>
      <div className="my-4 flex items-center gap-3 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
        <span>Scribble Page {pageMeta.pageNumber} of {pageMeta.totalPages}</span>
        <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
      </div>

      <div className="relative mx-auto w-full overflow-hidden rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-surface-base)] shadow-sm">
        <ScribbleCanvasSurface
          scribble={currentSnapshot}
          toolState={DEFAULT_SHARED_TOOL_STATE}
          backgroundPattern={backgroundPattern}
          isEinkMode={isEinkMode}
          isReadOnly
          onPersist={persist}
          className="relative w-full"
          style={{
            width: '100%',
            background: currentSnapshot.background,
          }}
          emptyMessage={isLoading ? 'Loading handwriting from the attached SVG…' : 'Scribble is currently disabled. Existing pages remain visible in preview mode.'}
          onActivate={SCRIBBLE_FEATURES_ENABLED ? handleActivate : undefined}
        >
          <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4">
            <div className="glass-toolbar-lighter flex items-center gap-3 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)] shadow-lg">
              <span>Preview only</span>
              <span>{hasContent ? `${currentSnapshot.strokes.length} ${currentSnapshot.strokes.length === 1 ? 'stroke' : 'strokes'}` : 'Blank page'}</span>
              {!isReadOnly && <span>{SCRIBBLE_FEATURES_ENABLED ? 'Tap to open fullscreen' : 'Editing disabled'}</span>}
            </div>
          </div>

          {!hasContent && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs text-[var(--color-text-tertiary)]">
              A4 page ratio stays fixed as the window resizes.
            </div>
          )}
        </ScribbleCanvasSurface>
      </div>

      {!isReadOnly && SCRIBBLE_FEATURES_ENABLED && pageMeta.pageNumber === pageMeta.totalPages && (
        <div className="my-4 flex items-center gap-3 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] px-4 py-2 text-[11px] font-semibold tracking-[0.14em] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            onClick={addPageAfterCurrent}
          >
            <Plus className="h-4 w-4" />
            <span>Add scribble page</span>
          </button>
          <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
        </div>
      )}

      {SCRIBBLE_FEATURES_ENABLED && isFullscreen && (
        <ScribbleFullscreenOverlay
          editor={editor}
          initialBlockId={blockId}
          isReadOnly={isReadOnly}
          onClose={() => closeScribbleFullscreen(blockId)}
        />
      )}

      {children}
    </div>
  );
}