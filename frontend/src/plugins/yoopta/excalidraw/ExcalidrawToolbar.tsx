/**
 * @file ExcalidrawToolbar.tsx
 * @description Unified Craft-inspired toolbar with tool row + contextual property sub-bar
 * @app PAGES - Replaces Excalidraw's default toolbar & properties panel
 *
 * Features:
 * - Pill-shaped floating toolbar with tool icons (row 1)
 * - Property sub-bar visually tucked behind the main bar (row 2)
 * - Context-aware: only shows relevant controls per element type
 * - Compact dropdowns for color, stroke width, style
 * - Modern color palette with dark/light mode variants
 * - Custom zoom controls (bottom-right)
 * - Layer ordering + delete/duplicate for selected elements
 *
 * Used by:
 * - ExcalidrawFullscreen.tsx
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ExcalidrawImperativeAPI, AppState, ToolType } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { FillStyle, StrokeStyle } from '@excalidraw/excalidraw/element/types';
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import {
  Hand,
  MousePointer2,
  Square,
  Diamond,
  Circle,
  Type,
  ArrowUpRight,
  Pencil,
  Eraser,
  X,
  Minus,
  Image,
  Frame,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  MoveDown,
  MoveUp,
  ZoomIn,
  ZoomOut,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from 'lucide-react';
import { cn } from '@/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';
import { DEFAULT_STROKE_COLORS, getDefaultStrokeColor } from './defaults';

// ============================================================================
// TYPES
// ============================================================================

interface ToolDef {
  id: ToolType;
  icon: React.ReactNode;
  label: string;
}

export interface ExcalidrawToolbarProps {
  api: ExcalidrawImperativeAPI;
  activeTool: string;
  appState: AppState | null;
  selectedElements: readonly ExcalidrawElement[];
  onClose: () => void;
  /** Incremented by parent to signal that ref-based appState/selectedElements have fresh values */
  renderTick: number;
}

type DropdownId = 'stroke' | 'fill' | 'fontSize' | 'fontFamily' | 'textAlign' | null;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const I = 'w-[18px] h-[18px]';

const TOOLS: ToolDef[] = [
  { id: 'hand', icon: <Hand className={I} />, label: 'Hand (H)' },
  { id: 'selection', icon: <MousePointer2 className={I} />, label: 'Select (V)' },
  { id: 'freedraw', icon: <Pencil className={I} />, label: 'Draw (P)' },
  { id: 'eraser', icon: <Eraser className={I} />, label: 'Eraser (E)' },
  { id: 'arrow', icon: <ArrowUpRight className={I} />, label: 'Arrow (A)' },
  { id: 'line', icon: <Minus className={I} />, label: 'Line (L)' },
  { id: 'text', icon: <Type className={I} />, label: 'Text (T)' },
  { id: 'rectangle', icon: <Square className={I} />, label: 'Rectangle (R)' },
  { id: 'ellipse', icon: <Circle className={I} />, label: 'Ellipse (O)' },
  { id: 'diamond', icon: <Diamond className={I} />, label: 'Diamond (D)' },
  { id: 'image', icon: <Image className={I} />, label: 'Image' },
  { id: 'frame', icon: <Frame className={I} />, label: 'Frame (F)' },
];

// ============================================================================
// COLOR PALETTE — dark/light mode variants
// ============================================================================

interface PaletteColor { light: string; dark: string; label: string }

const STROKE_PALETTE: PaletteColor[] = [
  { light: DEFAULT_STROKE_COLORS.light, dark: DEFAULT_STROKE_COLORS.dark, label: 'Default' },
  { light: '#e03131', dark: '#ff6b6b', label: 'Red' },
  { light: '#f08c00', dark: '#ffa94d', label: 'Orange' },
  { light: '#2f9e44', dark: '#69db7c', label: 'Green' },
  { light: '#1971c2', dark: '#74c0fc', label: 'Blue' },
  { light: '#7048e8', dark: '#b197fc', label: 'Purple' },
];

const FILL_PALETTE: PaletteColor[] = [
  { light: 'transparent', dark: 'transparent', label: 'None' },
  { light: '#ffc9c9', dark: '#862e2e', label: 'Red' },
  { light: '#fff3bf', dark: '#66460d', label: 'Yellow' },
  { light: '#b2f2bb', dark: '#2b6930', label: 'Green' },
  { light: '#a5d8ff', dark: '#1c4f7e', label: 'Blue' },
  { light: '#d0bfff', dark: '#3b2768', label: 'Purple' },
];

const STROKE_WIDTH_OPTS = [
  { value: 1, label: 'Thin' },
  { value: 2, label: 'Medium' },
  { value: 4, label: 'Bold' },
];

const STROKE_STYLE_OPTS: { value: StrokeStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

const FILL_STYLE_OPTS: { value: FillStyle; label: string; icon: string }[] = [
  { value: 'hachure', label: 'Hachure', icon: '⟋' },
  { value: 'cross-hatch', label: 'Cross-hatch', icon: '⨯' },
  { value: 'solid', label: 'Solid', icon: '■' },
  { value: 'zigzag', label: 'Zigzag', icon: '⩘' },
];

const FONT_SIZE_OPTS = [
  { value: 16, label: 'Small' },
  { value: 20, label: 'Medium' },
  { value: 28, label: 'Large' },
  { value: 36, label: 'Very Large' },
];

const FONT_FAMILY_OPTS = [
  { value: 1, label: 'Hand-drawn' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Code' },
];

const ROUGHNESS_OPTS = [
  { value: 0, label: 'Architect' },
  { value: 1, label: 'Artist' },
  { value: 2, label: 'Cartoonist' },
];

// ============================================================================
// ELEMENT CAPABILITY HELPERS
// ============================================================================

type Category = 'shape' | 'line' | 'text' | 'freedraw' | 'image' | 'none';

function getCategory(tool: string, selected: readonly ExcalidrawElement[]): Category {
  if (selected.length > 0) {
    const types = new Set(selected.map((el) => el.type));
    if (types.has('text')) return 'text';
    if (types.has('freedraw')) return 'freedraw';
    if (types.has('image')) return 'image';
    if (types.has('arrow') || types.has('line')) return 'line';
    if (types.has('rectangle') || types.has('diamond') || types.has('ellipse')) return 'shape';
    return 'none';
  }
  if (['rectangle', 'diamond', 'ellipse'].includes(tool)) return 'shape';
  if (['arrow', 'line'].includes(tool)) return 'line';
  if (tool === 'text') return 'text';
  if (tool === 'freedraw') return 'freedraw';
  if (tool === 'image') return 'image';
  return 'none';
}

function getCaps(cat: Category) {
  return {
    stroke: cat !== 'image' && cat !== 'none',
    fill: cat === 'shape',
    strokeWidth: cat !== 'image' && cat !== 'none' && cat !== 'text',
    strokeStyle: cat === 'shape' || cat === 'line',
    roughness: cat === 'shape' || cat === 'line',
    edges: cat === 'shape',
    opacity: cat !== 'none',
  };
}

function getCommon<K extends keyof ExcalidrawElement>(
  els: readonly ExcalidrawElement[], key: K,
): ExcalidrawElement[K] | undefined {
  if (els.length === 0) return undefined;
  const first = els[0][key];
  return els.every((el) => el[key] === first) ? first : undefined;
}

/** Collect text elements from selection: directly selected text + text bound to selected containers */
function getTextElementsFromSelection(
  selectedElements: readonly ExcalidrawElement[],
  allElements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  const textEls: ExcalidrawElement[] = [];
  const boundTextIds = new Set<string>();

  for (const el of selectedElements) {
    if (el.type === 'text') {
      textEls.push(el);
    } else if (el.boundElements) {
      for (const bound of el.boundElements) {
        if (bound.type === 'text') boundTextIds.add(bound.id);
      }
    }
  }

  if (boundTextIds.size > 0) {
    for (const el of allElements) {
      if (boundTextIds.has(el.id)) textEls.push(el);
    }
  }

  return textEls;
}

function getTextProp<T>(els: ExcalidrawElement[], key: string, fallback: T): T {
  if (els.length === 0) return fallback;
  const first = (els[0] as unknown as Record<string, T>)[key];
  if (els.every((el) => (el as unknown as Record<string, T>)[key] === first)) return first;
  return first; // mixed — show first
}

// ============================================================================
// BOUND TEXT POSITION RECOMPUTATION
// ============================================================================

/** Matches the BOUND_TEXT_PADDING constant from Excalidraw's internals */
const BOUND_TEXT_PADDING = 5;

interface BoundTextInfo {
  x: number; y: number;
  width: number; height: number;
  textAlign: string;
  verticalAlign: string;
}

/** Get the containerId of a text element (avoids verbose casting) */
function getContainerId(el: ExcalidrawElement): string | null {
  return (el as unknown as { containerId: string | null }).containerId;
}

function newNonce(): number {
  return Math.floor(Math.random() * 2147483647);
}

// ---- Text measurement helpers (mirrors Excalidraw internals) ----

/** Font family ID → CSS font-family string (matches Excalidraw's FONT_FAMILY) */
const FONT_FAMILY_MAP: Record<number, string> = {
  1: 'Virgil', 2: 'Helvetica', 3: 'Cascadia', 5: 'Excalifont', 6: 'Nunito',
  7: 'Lilita One', 8: 'Comic Shanns', 9: 'Liberation Sans',
};

function getFontString(fontSize: number, fontFamily: number): string {
  return `${fontSize}px ${FONT_FAMILY_MAP[fontFamily] ?? 'Excalifont'}`;
}

/** Shared offscreen 2D context for text measurement */
let _measureCanvas: HTMLCanvasElement | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  return _measureCanvas.getContext('2d')!;
}

function getLineWidth(text: string, font: string): number {
  const ctx = getMeasureCtx();
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Simple word-boundary text wrapping (mirrors Excalidraw's wrapText for common cases) */
function wrapTextSimple(text: string, font: string, maxWidth: number): string {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return text;
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (getLineWidth(paragraph, font) <= maxWidth) { result.push(paragraph); continue; }
    const words = paragraph.split(/(\s+)/);
    let line = '';
    let lineW = 0;
    for (const w of words) {
      const wW = getLineWidth(w, font);
      if (line && lineW + wW > maxWidth) {
        result.push(line.trimEnd());
        line = /\s/.test(w) ? '' : w;
        lineW = /\s/.test(w) ? 0 : wW;
      } else {
        line += w;
        lineW += wW;
      }
    }
    if (line) result.push(line.trimEnd());
  }
  return result.join('\n');
}

function measureTextDims(text: string, font: string, fontSize: number, lineHeight: number): { width: number; height: number } {
  const lines = text.split('\n').map((l) => l || ' ');
  let width = 0;
  for (const l of lines) width = Math.max(width, getLineWidth(l, font));
  return { width, height: lines.length * fontSize * lineHeight };
}

/** Get container's max content dimension for a given axis (mirrors Excalidraw's getBoundTextMax[Width|Height]) */
function getContainerMaxDim(type: string, dim: number): number {
  if (type === 'ellipse') return Math.round((dim / 2) * Math.SQRT2) - BOUND_TEXT_PADDING * 2;
  if (type === 'diamond') return Math.round(dim / 2) - BOUND_TEXT_PADDING * 2;
  return dim - BOUND_TEXT_PADDING * 2;
}

/** Convert text content height → container outer height (mirrors computeContainerDimensionForBoundText) */
function containerDimForText(dim: number, type: string): number {
  const padded = Math.ceil(dim) + BOUND_TEXT_PADDING * 2;
  if (type === 'ellipse') return Math.round(padded / Math.SQRT2 * 2);
  if (type === 'diamond') return 2 * padded;
  return padded;
}

/**
 * Recomputes the x/y position of text bound inside a container shape.
 * Mirrors Excalidraw's internal `computeBoundTextPosition` for non-arrow shapes.
 */
function computeBoundTextPos(
  container: ExcalidrawElement,
  textEl: BoundTextInfo,
): { x: number; y: number } {
  // Container inner origin (accounting for shape-specific padding)
  let offsetX = BOUND_TEXT_PADDING;
  let offsetY = BOUND_TEXT_PADDING;
  if (container.type === 'ellipse') {
    offsetX += (container.width / 2) * (1 - Math.SQRT2 / 2);
    offsetY += (container.height / 2) * (1 - Math.SQRT2 / 2);
  } else if (container.type === 'diamond') {
    offsetX += container.width / 4;
    offsetY += container.height / 4;
  }
  const cx = container.x + offsetX;
  const cy = container.y + offsetY;

  // Max content area inside the container
  const maxW = getContainerMaxDim(container.type, container.width);
  const maxH = getContainerMaxDim(container.type, container.height);

  // Vertical position
  let y: number;
  if (textEl.verticalAlign === 'top') {
    y = cy;
  } else if (textEl.verticalAlign === 'bottom') {
    y = cy + (maxH - textEl.height);
  } else {
    y = cy + (maxH / 2 - textEl.height / 2);
  }

  // Horizontal position
  let x: number;
  if (textEl.textAlign === 'left') {
    x = cx;
  } else if (textEl.textAlign === 'right') {
    x = cx + (maxW - textEl.width);
  } else {
    x = cx + (maxW / 2 - textEl.width / 2);
  }

  return { x, y };
}

// ============================================================================
// DROPDOWN
// ============================================================================

const Dropdown: React.FC<{
  trigger: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  align?: 'left' | 'center';
}> = ({ trigger, isOpen, onToggle, children, align = 'center' }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: align === 'center' ? rect.left + rect.width / 2 : rect.left,
      });
    }
  }, [isOpen, align]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        onToggleRef.current();
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={cn(
          'flex items-center gap-0.5 rounded-lg px-1.5 py-1 transition-colors',
          'text-gray-600 dark:text-gray-400',
          isOpen ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-white/10',
        )}
      >
        {trigger}
        <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && createPortal(
        <div
          ref={panelRef}
          className={cn(
            'fixed p-2 rounded-xl z-[10040] min-w-[140px]',
            'bg-white dark:bg-[#2a2a2a]',
            'border border-gray-200 dark:border-white/10',
            'shadow-xl',
          )}
          style={{
            top: pos.top,
            left: pos.left,
            transform: align === 'center' ? 'translateX(-50%)' : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
};

// ============================================================================
// COLOR SWATCH
// ============================================================================

const Swatch: React.FC<{
  color: string; isActive: boolean; onClick: () => void; label: string;
}> = ({ color, isActive, onClick, label }) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    className={cn(
      'w-6 h-6 rounded-full border-2 transition-all flex-shrink-0',
      isActive ? 'border-[var(--color-accent-primary)] scale-110 shadow-sm' : 'border-transparent hover:scale-105',
    )}
    style={{
      backgroundColor: color === 'transparent' ? undefined : color,
      backgroundImage: color === 'transparent'
        ? 'linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)'
        : undefined,
      backgroundSize: color === 'transparent' ? '6px 6px' : undefined,
      backgroundPosition: color === 'transparent' ? '0 0,3px 3px' : undefined,
    }}
  />
);

// Glass classes are defined in globals.css (.glass-toolbar, .glass-toolbar-lighter)
// Used instead of inline styles for consistency across all toolbars.

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ExcalidrawToolbar: React.FC<ExcalidrawToolbarProps> = ({
  api, activeTool, appState, selectedElements, onClose, renderTick,
}) => {
  const isMobile = useIsMobile();
  const isDark = useIsDarkMode();
  const [openDD, setOpenDD] = useState<DropdownId>(null);
  const strokeInputRef = useRef<HTMLInputElement>(null);
  const fillInputRef = useRef<HTMLInputElement>(null);
  const [row1Width, setRow1Width] = useState(0);
  const row1Ref = useCallback((node: HTMLDivElement | null) => {
    if (node) setRow1Width(node.offsetWidth);
  }, []);

  // Primary toolbar (row1) horizontal scroll state
  const row1ScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeftRow1, setCanScrollLeftRow1] = useState(false);
  const [canScrollRightRow1, setCanScrollRightRow1] = useState(false);

  const updateRow1ScrollState = useCallback(() => {
    const el = row1ScrollRef.current;
    if (!el) { setCanScrollLeftRow1(false); setCanScrollRightRow1(false); return; }
    setCanScrollLeftRow1(el.scrollLeft > 1);
    setCanScrollRightRow1(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollRow1By = useCallback((dir: 'left' | 'right') => {
    row1ScrollRef.current?.scrollBy({ left: dir === 'left' ? -100 : 100, behavior: 'smooth' });
  }, []);

  // Sub-bar horizontal scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) { setCanScrollLeft(false); setCanScrollRight(false); return; }
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollBy = useCallback((dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -100 : 100, behavior: 'smooth' });
  }, []);

  // Force re-read on renderTick changes (parent bumps tick when refs update)
  void renderTick;

  const toggle = useCallback((id: DropdownId) => setOpenDD((p) => (p === id ? null : id)), []);

  // ---- Derived ----
  const hasSel = selectedElements.length > 0;
  const toolType = appState?.activeTool?.type ?? activeTool;
  const cat = getCategory(toolType, selectedElements);
  const caps = getCaps(cat);
  const showSub = cat !== 'none';

  // Re-check scroll overflow when sub-bar content changes
  useEffect(() => {
    updateScrollState();
    updateRow1ScrollState();
  }, [updateScrollState, updateRow1ScrollState, cat, hasSel, renderTick]);

  // Re-check primary toolbar scroll on mount and resize
  useEffect(() => {
    updateRow1ScrollState();
    window.addEventListener('resize', updateRow1ScrollState);
    return () => window.removeEventListener('resize', updateRow1ScrollState);
  }, [updateRow1ScrollState]);

  // Detect text content in selection (including text bound to shapes)
  const relevantTextEls = hasSel ? getTextElementsFromSelection(selectedElements, api.getSceneElements()) : [];
  const showTextProps = cat === 'text' || relevantTextEls.length > 0;
  // Single-pass: detect standalone text vs text bound to non-arrow shapes
  const { hasShapeBoundText, hasStandaloneText } = (() => {
    if (!relevantTextEls.length) return { hasShapeBoundText: false, hasStandaloneText: false };
    const sceneMap = new Map(api.getSceneElements().map((el) => [el.id, el]));
    let shapeBound = false, standalone = false;
    for (const el of relevantTextEls) {
      const cId = getContainerId(el);
      if (!cId) { standalone = true; continue; }
      const c = sceneMap.get(cId);
      if (c && c.type !== 'arrow') shapeBound = true;
    }
    return { hasShapeBoundText: shapeBound, hasStandaloneText: standalone };
  })();
  const showTextAlignment = hasStandaloneText || hasShapeBoundText;

  const resolve = useCallback((pc: PaletteColor) => isDark ? pc.dark : pc.light, [isDark]);
  const defaultStroke = getDefaultStrokeColor(isDark);

  // Read values
  const stroke = hasSel
    ? (getCommon(selectedElements, 'strokeColor') ?? appState?.currentItemStrokeColor ?? defaultStroke)
    : (appState?.currentItemStrokeColor ?? defaultStroke);
  const fill = hasSel
    ? (getCommon(selectedElements, 'backgroundColor') ?? appState?.currentItemBackgroundColor ?? 'transparent')
    : (appState?.currentItemBackgroundColor ?? 'transparent');
  const sWidth = hasSel
    ? (getCommon(selectedElements, 'strokeWidth') ?? appState?.currentItemStrokeWidth ?? 2)
    : (appState?.currentItemStrokeWidth ?? 2);
  const sStyle: StrokeStyle = hasSel
    ? ((getCommon(selectedElements, 'strokeStyle') as StrokeStyle | undefined) ?? (appState?.currentItemStrokeStyle as StrokeStyle) ?? 'solid')
    : ((appState?.currentItemStrokeStyle as StrokeStyle) ?? 'solid');
  const fStyle: FillStyle = hasSel
    ? ((getCommon(selectedElements, 'fillStyle') as FillStyle | undefined) ?? (appState?.currentItemFillStyle as FillStyle) ?? 'hachure')
    : ((appState?.currentItemFillStyle as FillStyle) ?? 'hachure');
  const rough = hasSel
    ? (getCommon(selectedElements, 'roughness') ?? appState?.currentItemRoughness ?? 1)
    : (appState?.currentItemRoughness ?? 1);
  const opa = hasSel
    ? (getCommon(selectedElements, 'opacity') ?? appState?.currentItemOpacity ?? 100)
    : (appState?.currentItemOpacity ?? 100);
  const fSize = Math.round(
    relevantTextEls.length > 0
      ? (relevantTextEls[0] as unknown as { fontSize: number }).fontSize
      : ((appState as Record<string, unknown> | null)?.currentItemFontSize as number) ?? 20,
  );
  const fFamily = showTextProps
    ? getTextProp(relevantTextEls, 'fontFamily', ((appState as Record<string, unknown> | null)?.currentItemFontFamily as number) ?? 1)
    : (((appState as Record<string, unknown> | null)?.currentItemFontFamily as number) ?? 1);
  const tAlign = showTextProps
    ? getTextProp(relevantTextEls, 'textAlign', 'left' as string)
    : 'left';
  const vAlign = showTextProps
    ? getTextProp(relevantTextEls, 'verticalAlign', 'middle' as string)
    : 'middle';
  const round = hasSel
    ? (selectedElements.every((el) => el.roundness !== null) ? 'round' : 'sharp')
    : (appState?.currentItemRoundness ?? 'round');

  // ---- Updaters ----
  const updateStyle = useCallback(
    (elPatch: Record<string, unknown>, asPatch: Record<string, unknown>) => {
      if (!appState) return;
      const elements = api.getSceneElements().map((el) =>
        appState.selectedElementIds[el.id] ? { ...el, ...elPatch } as typeof el : el,
      );
      api.updateScene({
        elements,
        appState: asPatch as Pick<AppState, keyof AppState>,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api, appState],
  );

  const setTool = useCallback((id: ToolType) => { api.setActiveTool({ type: id }); setOpenDD(null); }, [api]);
  const setStroke = useCallback((c: string) => updateStyle({ strokeColor: c }, { currentItemStrokeColor: c }), [updateStyle]);
  const setFill = useCallback((c: string) => updateStyle({ backgroundColor: c }, { currentItemBackgroundColor: c }), [updateStyle]);
  const setFillStyle = useCallback((s: FillStyle) => updateStyle({ fillStyle: s }, { currentItemFillStyle: s }), [updateStyle]);
  const setSWidth = useCallback((w: number) => updateStyle({ strokeWidth: w }, { currentItemStrokeWidth: w }), [updateStyle]);
  const setSStyle = useCallback((s: StrokeStyle) => updateStyle({ strokeStyle: s }, { currentItemStrokeStyle: s }), [updateStyle]);
  /** Apply a text property change to text elements, handling alignment repositioning and container auto-resize */
  const updateTextProp = useCallback((patch: Record<string, unknown>, asPatch?: Record<string, unknown>) => {
    if (!appState) return;
    const selIds = new Set(Object.keys(appState.selectedElementIds));
    const boundTextIds = new Set<string>();
    const containerIds = new Set<string>();
    for (const el of selectedElements) {
      if (el.boundElements) {
        for (const b of el.boundElements) {
          if (b.type === 'text') { boundTextIds.add(b.id); containerIds.add(el.id); }
        }
      }
    }
    const needsReposition = patch.textAlign !== undefined || patch.verticalAlign !== undefined;
    const needsRemeasure = patch.fontSize !== undefined || patch.fontFamily !== undefined;
    const allSceneElements = api.getSceneElements();
    const elById = (needsReposition || needsRemeasure)
      ? new Map(allSceneElements.map((el) => [el.id, el]))
      : null;
    const containerResizes = new Map<string, number>();
    const elements = allSceneElements.map((el) => {
      if ((selIds.has(el.id) && el.type === 'text') || boundTextIds.has(el.id)) {
        const p: Record<string, unknown> = { ...el, ...patch, version: el.version + 1, versionNonce: newNonce() };
        const cId = getContainerId(el);
        if (cId && elById) {
          const container = elById.get(cId);
          if (container && container.type !== 'arrow') {
            if (needsRemeasure) {
              const { fontSize, fontFamily, lineHeight, originalText, autoResize } = p as unknown as
                { fontSize: number; fontFamily: number; lineHeight: number; originalText: string; autoResize: boolean };
              const font = getFontString(fontSize, fontFamily);
              const maxW = getContainerMaxDim(container.type, container.width);
              const wrapped = wrapTextSimple(originalText, font, maxW);
              const dims = measureTextDims(wrapped, font, fontSize, lineHeight);
              p.text = wrapped;
              if (autoResize) p.width = dims.width;
              p.height = dims.height;
              const maxH = getContainerMaxDim(container.type, container.height);
              if (dims.height > maxH) {
                containerResizes.set(cId, containerDimForText(dims.height, container.type));
              }
            }
            const pos = computeBoundTextPos(
              containerResizes.has(cId) ? { ...container, height: containerResizes.get(cId)! } : container,
              p as unknown as BoundTextInfo,
            );
            p.x = pos.x;
            p.y = pos.y;
          }
        }
        return p as typeof el;
      }
      if (containerIds.has(el.id)) {
        const resize = containerResizes.get(el.id);
        return { ...el, ...(resize !== undefined ? { height: resize } : {}), version: el.version + 1, versionNonce: newNonce() } as typeof el;
      }
      return el;
    });
    api.updateScene({
      elements,
      appState: (asPatch ?? {}) as Pick<AppState, keyof AppState>,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [api, appState, selectedElements]);

  const setFontSize = useCallback((v: number) => {
    updateTextProp({ fontSize: v }, { currentItemFontSize: v } as Record<string, unknown>);
    setOpenDD(null);
  }, [updateTextProp]);
  const setFontFamily = useCallback((v: number) => {
    updateTextProp({ fontFamily: v }, { currentItemFontFamily: v } as Record<string, unknown>);
    setOpenDD(null);
  }, [updateTextProp]);
  const setTextAlign = useCallback((v: string) => {
    updateTextProp({ textAlign: v }, { currentItemTextAlign: v } as Record<string, unknown>);
  }, [updateTextProp]);
  const setVerticalAlign = useCallback((v: string) => {
    updateTextProp({ verticalAlign: v });
  }, [updateTextProp]);
  const setRough = useCallback((v: number) => { updateStyle({ roughness: v }, { currentItemRoughness: v }); setOpenDD(null); }, [updateStyle]);
  const setRound = useCallback((t: 'sharp' | 'round') => {
    updateStyle({ roundness: t === 'round' ? { type: 3 as const, value: 32 } : null }, { currentItemRoundness: t });
  }, [updateStyle]);
  const setOpa = useCallback((v: number) => updateStyle({ opacity: v }, { currentItemOpacity: v }), [updateStyle]);

  // ---- Layer / actions ----
  const moveLayer = useCallback((dir: 'forward' | 'backward') => {
    if (!hasSel || !appState) return;
    const all = [...api.getSceneElements()];
    const ids = new Set(Object.keys(appState.selectedElementIds));
    if (dir === 'forward') {
      for (let i = all.length - 2; i >= 0; i--) {
        if (ids.has(all[i].id) && !ids.has(all[i + 1].id)) {
          [all[i], all[i + 1]] = [all[i + 1], all[i]];
        }
      }
    } else {
      for (let i = 1; i < all.length; i++) {
        if (ids.has(all[i].id) && !ids.has(all[i - 1].id)) {
          [all[i], all[i - 1]] = [all[i - 1], all[i]];
        }
      }
    }
    api.updateScene({ elements: all, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
  }, [api, appState, hasSel]);

  const handleDelete = useCallback(() => {
    if (!hasSel || !appState) return;
    const elements = api.getSceneElements().map((el) =>
      appState.selectedElementIds[el.id] ? { ...el, isDeleted: true } as typeof el : el,
    );
    api.updateScene({
      elements,
      appState: { selectedElementIds: {} } as Pick<AppState, keyof AppState>,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [api, appState, hasSel]);

  const handleDuplicate = useCallback(() => {
    if (!hasSel || !appState) return;
    const all = api.getSceneElements();
    const newEls: ExcalidrawElement[] = [...all];
    const newSel: Record<string, true> = {};
    for (const el of all) {
      if (appState.selectedElementIds[el.id]) {
        const dup = { ...el, id: `${el.id}_d${Date.now()}`, x: el.x + 20, y: el.y + 20, seed: newNonce() };
        newEls.push(dup as ExcalidrawElement);
        newSel[dup.id] = true;
      }
    }
    api.updateScene({
      elements: newEls,
      appState: { selectedElementIds: newSel } as Pick<AppState, keyof AppState>,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [api, appState, hasSel]);

  // ---- Zoom ----
  const handleZoom = useCallback((dir: 'in' | 'out' | 'reset') => {
    if (!appState) return;
    const cur = appState.zoom?.value ?? 1;
    let z: number;
    if (dir === 'in') z = Math.min(cur * 1.2, 10);
    else if (dir === 'out') z = Math.max(cur / 1.2, 0.1);
    else z = 1;
    api.updateScene({
      appState: {
        zoom: { value: z as AppState['zoom']['value'] },
        ...(dir === 'reset' ? { scrollX: 0 as AppState['scrollX'], scrollY: 0 as AppState['scrollY'] } : {}),
      } as Pick<AppState, keyof AppState>,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [api, appState]);

  const zoomPct = Math.round((appState?.zoom?.value ?? 1) * 100);

  // ---- Shared classes ----
  const toolBtn = cn('flex items-center justify-center rounded-full transition-colors', isMobile ? 'w-10 h-10' : 'w-8 h-8');
  const subBtn = cn('flex items-center justify-center rounded-full transition-colors flex-shrink-0', isMobile ? 'w-9 h-9' : 'w-7 h-7', 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10');
  const activeBtn = 'bg-[var(--color-accent-muted)] !text-[var(--color-accent-primary)]';

  // Stroke style icon helper
  const strokeStyleIcon = (s: StrokeStyle) => {
    if (s === 'dashed') return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="1" y1="8" x2="5" y2="8" /><line x1="7" y1="8" x2="11" y2="8" /><line x1="13" y1="8" x2="15" y2="8" />
      </svg>
    );
    if (s === 'dotted') return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {[2, 6, 10, 14].map((cx) => <circle key={cx} cx={cx} cy="8" r="1" fill="currentColor" />)}
      </svg>
    );
    return <Minus className="w-4 h-4" />;
  };

  return (
    <>
      {/* ===== TOOLBAR CONTAINER ===== */}
      <div
        className={cn(
          'flex flex-col items-center',
          'fixed left-1/2 -translate-x-1/2 z-[10030]',
          'max-w-[calc(100vw-24px)]',
        )}
        style={{ top: 'max(12px, env(safe-area-inset-top, 12px))' }}
        onClick={() => setOpenDD(null)}
      >
        {/* ROW 1: TOOLS */}
        <div ref={row1Ref} className={cn(
          'glass-toolbar relative z-10 shadow-lg overflow-hidden max-w-full',
        )}>
          {/* Left scroll arrow for row 1 */}
          {canScrollLeftRow1 && (
            <button
              type="button"
              onClick={() => scrollRow1By('left')}
              className={cn(
                'absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-3',
                'bg-gradient-to-r from-white/90 via-white/60 to-transparent',
                'dark:from-[#1a1a1a]/90 dark:via-[#1a1a1a]/60 dark:to-transparent',
                'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                'transition-colors',
              )}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          <div
            ref={row1ScrollRef}
            onScroll={updateRow1ScrollState}
            className="excalidraw-toolbar-scroll flex items-center gap-0.5 px-2 py-1 overflow-x-auto"
          >
            {TOOLS.map((t) => (
              <button
                key={t.id} type="button" title={t.label}
                onClick={(e) => { e.stopPropagation(); setTool(t.id); }}
                className={cn(toolBtn, 'flex-shrink-0', activeTool === t.id
                  ? 'bg-[var(--color-accent-primary)] text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10')}
              >
                {t.icon}
              </button>
            ))}
            <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-0.5 flex-shrink-0" />
            <button type="button" title="Close whiteboard (Esc)" onClick={onClose}
              className={cn(toolBtn, 'flex-shrink-0 text-gray-500 dark:text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400')}>
              <X className={I} />
            </button>
          </div>
          {/* Right scroll arrow for row 1 */}
          {canScrollRightRow1 && (
            <button
              type="button"
              onClick={() => scrollRow1By('right')}
              className={cn(
                'absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-3',
                'bg-gradient-to-l from-white/90 via-white/60 to-transparent',
                'dark:from-[#1a1a1a]/90 dark:via-[#1a1a1a]/60 dark:to-transparent',
                'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                'transition-colors',
              )}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* ROW 2: PROPERTY SUB-BAR (tucked behind row 1) */}
        <div
          className={cn(
            'glass-toolbar-lighter relative overflow-hidden max-w-full',
            '-mt-6',
            'border-t-0',
            'shadow-md',
            'transition-all duration-200',
            showSub ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none h-0 !py-0 !border-0',
          )}
          style={{
            width: row1Width || undefined,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left scroll button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollBy('left')}
              className={cn(
                'absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-3 pt-5',
                'bg-gradient-to-r from-white/90 via-white/60 to-transparent',
                'dark:from-[#1a1a1a]/90 dark:via-[#1a1a1a]/60 dark:to-transparent',
                'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                'transition-colors',
              )}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="excalidraw-subbar-scroll flex items-center gap-1 px-5 pt-7 pb-1 overflow-x-auto"
          >
            {/* Stroke color + width + style + roughness + edges */}
            {caps.stroke && (
              <Dropdown trigger={
                <div className="w-5 h-5 rounded-full border-[2.5px]" style={{ borderColor: stroke, backgroundColor: 'transparent' }} title="Stroke" />
              } isOpen={openDD === 'stroke'} onToggle={() => toggle('stroke')}>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Stroke</span>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {STROKE_PALETTE.map((pc) => { const c = resolve(pc); return (
                      <Swatch key={pc.label} color={c} isActive={stroke === c} onClick={() => { setStroke(c); setOpenDD(null); }} label={pc.label} />
                    ); })}
                    <div className="relative">
                      <button type="button" title="Custom color" onClick={() => strokeInputRef.current?.click()} className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600" style={{ backgroundColor: stroke }} />
                      <input ref={strokeInputRef} type="color" value={stroke === 'transparent' ? '#000000' : stroke} onChange={(e) => setStroke(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  {caps.strokeWidth && (<>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase pt-1 border-t border-gray-100 dark:border-white/5">Width</span>
                    <div className="flex gap-0.5">
                      {STROKE_WIDTH_OPTS.map((w) => (
                        <button key={w.value} type="button" title={w.label} onClick={() => setSWidth(w.value)} className={cn(subBtn, sWidth === w.value && activeBtn)}>
                          <Minus className="w-4 h-4" style={{ strokeWidth: w.value + 1 }} />
                        </button>
                      ))}
                    </div>
                  </>)}
                  {caps.strokeStyle && (<>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase pt-1 border-t border-gray-100 dark:border-white/5">Style</span>
                    <div className="flex gap-0.5">
                      {STROKE_STYLE_OPTS.map((s) => (
                        <button key={s.value} type="button" title={s.label} onClick={() => setSStyle(s.value)} className={cn(subBtn, sStyle === s.value && activeBtn)}>
                          {strokeStyleIcon(s.value)}
                        </button>
                      ))}
                    </div>
                  </>)}
                  {caps.roughness && (<>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase pt-1 border-t border-gray-100 dark:border-white/5">Sloppiness</span>
                    <div className="flex gap-0.5">
                      {ROUGHNESS_OPTS.map((r) => (
                        <button key={r.value} type="button" title={r.label} onClick={() => setRough(r.value)} className={cn(subBtn, rough === r.value && activeBtn)}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            {r.value === 0 && <path d="M2 12 L14 4" />}
                            {r.value === 1 && <path d="M2 12 Q8 2 14 4" />}
                            {r.value === 2 && <path d="M2 12 Q5 4 8 8 Q11 2 14 4" />}
                          </svg>
                        </button>
                      ))}
                    </div>
                  </>)}
                  {caps.edges && (<>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase pt-1 border-t border-gray-100 dark:border-white/5">Edges</span>
                    <div className="flex gap-0.5">
                      <button type="button" title="Sharp" onClick={() => setRound('sharp')} className={cn(subBtn, round === 'sharp' && activeBtn)}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="8" /></svg>
                      </button>
                      <button type="button" title="Round" onClick={() => setRound('round')} className={cn(subBtn, round === 'round' && activeBtn)}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="8" rx="3" /></svg>
                      </button>
                    </div>
                  </>)}
                </div>
              </Dropdown>
            )}

            {/* Fill color + fill style */}
            {caps.fill && (
              <Dropdown trigger={
                <div className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600" title="Fill" style={{
                  backgroundColor: fill === 'transparent' ? undefined : fill,
                  backgroundImage: fill === 'transparent' ? 'linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)' : undefined,
                  backgroundSize: fill === 'transparent' ? '6px 6px' : undefined,
                  backgroundPosition: fill === 'transparent' ? '0 0,3px 3px' : undefined,
                }} />
              } isOpen={openDD === 'fill'} onToggle={() => toggle('fill')}>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Fill</span>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {FILL_PALETTE.map((pc) => { const c = resolve(pc); return (
                      <Swatch key={pc.label} color={c} isActive={fill === c} onClick={() => { setFill(c); setOpenDD(null); }} label={pc.label} />
                    ); })}
                    <div className="relative">
                      <button type="button" title="Custom color" onClick={() => fillInputRef.current?.click()} className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: fill === 'transparent' ? '#ffffff' : fill }} />
                      <input ref={fillInputRef} type="color" value={fill === 'transparent' ? '#ffffff' : fill} onChange={(e) => setFill(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase pt-1 border-t border-gray-100 dark:border-white/5">Fill style</span>
                  <div className="flex gap-0.5">
                    {FILL_STYLE_OPTS.map((f) => (
                      <button key={f.value} type="button" title={f.label} onClick={() => setFillStyle(f.value)} className={cn(subBtn, fStyle === f.value && activeBtn)}>
                        <span className="text-sm leading-none">{f.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Dropdown>
            )}

            {/* Font size */}
            {showTextProps && (
              <Dropdown trigger={<span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{fSize}px</span>} isOpen={openDD === 'fontSize'} onToggle={() => toggle('fontSize')}>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Text size</span>
                  {FONT_SIZE_OPTS.map((f) => (
                    <button key={f.value} type="button" onClick={() => setFontSize(f.value)} className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded-lg text-xs w-full text-left transition-colors',
                      fSize === f.value ? activeBtn : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5',
                    )}>
                      <span style={{ fontSize: Math.min(f.value * 0.5, 16) }}>{f.label}</span> <span className="text-[10px] text-gray-400">{f.value}px</span>
                    </button>
                  ))}
                </div>
              </Dropdown>
            )}

            {/* Font family */}
            {showTextProps && (
              <Dropdown trigger={<span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{FONT_FAMILY_OPTS.find((f) => f.value === fFamily)?.label ?? 'Font'}</span>} isOpen={openDD === 'fontFamily'} onToggle={() => toggle('fontFamily')}>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Font</span>
                  {FONT_FAMILY_OPTS.map((f) => (
                    <button key={f.value} type="button" onClick={() => setFontFamily(f.value)} className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded-lg text-xs w-full text-left transition-colors',
                      fFamily === f.value ? activeBtn : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5',
                    )}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </Dropdown>
            )}

            {/* Text alignment — hidden for arrow labels since it has no effect */}
            {showTextAlignment && (
              <div className="flex items-center gap-0 flex-shrink-0">
                <button type="button" title="Align left" onClick={() => setTextAlign('left')} className={cn(subBtn, tAlign === 'left' && activeBtn)}><AlignLeft className="w-3.5 h-3.5" /></button>
                <button type="button" title="Align center" onClick={() => setTextAlign('center')} className={cn(subBtn, tAlign === 'center' && activeBtn)}><AlignCenter className="w-3.5 h-3.5" /></button>
                <button type="button" title="Align right" onClick={() => setTextAlign('right')} className={cn(subBtn, tAlign === 'right' && activeBtn)}><AlignRight className="w-3.5 h-3.5" /></button>
                {hasShapeBoundText && (<>
                  <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-0.5 flex-shrink-0" />
                  <button type="button" title="Align top" onClick={() => setVerticalAlign('top')} className={cn(subBtn, vAlign === 'top' && activeBtn)}><AlignVerticalJustifyStart className="w-3.5 h-3.5" /></button>
                  <button type="button" title="Align middle" onClick={() => setVerticalAlign('middle')} className={cn(subBtn, vAlign === 'middle' && activeBtn)}><AlignVerticalJustifyCenter className="w-3.5 h-3.5" /></button>
                  <button type="button" title="Align bottom" onClick={() => setVerticalAlign('bottom')} className={cn(subBtn, vAlign === 'bottom' && activeBtn)}><AlignVerticalJustifyEnd className="w-3.5 h-3.5" /></button>
                </>)}
              </div>
            )}

            {/* Opacity */}
            {caps.opacity && (<>
              <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-0.5 flex-shrink-0" />
              <div className="flex items-center gap-1 flex-shrink-0" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <input type="range" min="0" max="100" value={opa}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => setOpa(Number(e.target.value))}
                  className="w-14 h-1 accent-[var(--color-accent-primary)] cursor-pointer" style={{ touchAction: 'none' }} title={`Opacity: ${opa}%`} />
                <span className="text-[10px] text-gray-400 w-6 text-right tabular-nums">{opa}</span>
              </div>
            </>)}

            {/* Selection actions */}
            {hasSel && (<>
              <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-0.5 flex-shrink-0" />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button type="button" title="Send backward" onClick={() => moveLayer('backward')} className={subBtn}><MoveDown className="w-3.5 h-3.5" /></button>
                <button type="button" title="Bring forward" onClick={() => moveLayer('forward')} className={subBtn}><MoveUp className="w-3.5 h-3.5" /></button>
                <button type="button" title="Duplicate" onClick={handleDuplicate} className={subBtn}><Copy className="w-3.5 h-3.5" /></button>
                <button type="button" title="Delete" onClick={handleDelete} className={cn(subBtn, 'hover:!bg-red-100 hover:!text-red-600 dark:hover:!bg-red-900/30 dark:hover:!text-red-400')}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </>)}
          </div>

          {/* Right scroll button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollBy('right')}
              className={cn(
                'absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-3 pt-5',
                'bg-gradient-to-l from-white/90 via-white/60 to-transparent',
                'dark:from-[#1a1a1a]/90 dark:via-[#1a1a1a]/60 dark:to-transparent',
                'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                'transition-colors',
              )}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ===== ZOOM (bottom-right) ===== */}
      <div
        className={cn(
          'glass-toolbar fixed flex items-center gap-0.5 px-1.5 py-1 z-[10030] shadow-md right-3',
        )}
        style={{ bottom: isMobile ? 'max(16px, env(safe-area-inset-bottom, 16px))' : '12px' }}
      >
        <button type="button" title="Zoom out" onClick={() => handleZoom('out')} className={subBtn}><ZoomOut className="w-4 h-4" /></button>
        <button type="button" title="Reset zoom" onClick={() => handleZoom('reset')}
          className={cn(subBtn, 'text-[11px] font-medium w-auto px-1.5 tabular-nums')}>{zoomPct}%</button>
        <button type="button" title="Zoom in" onClick={() => handleZoom('in')} className={subBtn}><ZoomIn className="w-4 h-4" /></button>
      </div>
    </>
  );
};

export default ExcalidrawToolbar;
