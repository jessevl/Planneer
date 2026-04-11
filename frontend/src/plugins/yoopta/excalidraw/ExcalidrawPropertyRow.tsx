/**
 * @file ExcalidrawPropertyRow.tsx
 * @description Second toolbar row showing element properties (stroke, background, width, opacity, etc.)
 * @app PAGES - Craft-inspired inline property controls for Excalidraw
 *
 * Features:
 * - Appears below tool bar when shape/drawing elements are selected or a draw tool is active
 * - Stroke + background color pickers with preset swatches
 * - Stroke width selector (thin / medium / thick)
 * - Stroke style selector (solid / dashed / dotted)
 * - Sloppiness / roughness selector
 * - Edge rounding toggle (sharp / round)
 * - Opacity slider
 * - Layer ordering actions (front / back / forward / backward)
 * - Delete + duplicate actions
 *
 * Used by:
 * - ExcalidrawToolbar.tsx
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { FillStyle, StrokeStyle } from '@excalidraw/excalidraw/element/types';
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import {
  Minus,
  MoveDown,
  MoveUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Trash2,
  Link,
} from 'lucide-react';
import { cn } from '@/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

// ============================================================================
// TYPES
// ============================================================================

interface ExcalidrawPropertyRowProps {
  api: ExcalidrawImperativeAPI;
  appState: AppState;
  selectedElements: readonly ExcalidrawElement[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STROKE_COLORS = [
  { color: '#1e1e1e', label: 'Black' },
  { color: '#e03131', label: 'Red' },
  { color: '#2f9e44', label: 'Green' },
  { color: '#1971c2', label: 'Blue' },
  { color: '#f08c00', label: 'Orange' },
];

const BG_COLORS = [
  { color: 'transparent', label: 'None' },
  { color: '#ffc9c9', label: 'Light Red' },
  { color: '#b2f2bb', label: 'Light Green' },
  { color: '#a5d8ff', label: 'Light Blue' },
  { color: '#ffec99', label: 'Light Yellow' },
];

const STROKE_WIDTHS: { value: number; label: string }[] = [
  { value: 1, label: 'Thin' },
  { value: 2, label: 'Medium' },
  { value: 4, label: 'Thick' },
];

const STROKE_STYLES: { value: StrokeStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

const ROUGHNESS_VALUES: { value: number; label: string }[] = [
  { value: 0, label: 'Architect' },
  { value: 1, label: 'Artist' },
  { value: 2, label: 'Cartoonist' },
];

// ============================================================================
// HELPERS
// ============================================================================

/** True for tools/elements that support shape styling. */
function isStylableTool(tool: string) {
  return ['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'selection'].includes(tool);
}

/** Read the common style value from selected elements; returns undefined if mixed. */
function getCommonValue<K extends keyof ExcalidrawElement>(
  elements: readonly ExcalidrawElement[],
  key: K,
): ExcalidrawElement[K] | undefined {
  if (elements.length === 0) return undefined;
  const first = elements[0][key];
  return elements.every((el) => el[key] === first) ? first : undefined;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const ColorSwatch: React.FC<{
  color: string;
  isActive: boolean;
  onClick: () => void;
  label: string;
  size?: 'sm' | 'md';
}> = ({ color, isActive, onClick, label, size = 'md' }) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    className={cn(
      'rounded-md border-2 transition-all flex-shrink-0',
      size === 'md' ? 'w-7 h-7' : 'w-6 h-6',
      isActive
        ? 'border-[var(--color-accent-primary)] ring-1 ring-[var(--color-accent-primary)] scale-110'
        : 'border-gray-200 dark:border-gh-border-default hover:border-gray-400 dark:hover:border-gh-border-muted',
    )}
    style={{
      backgroundColor: color === 'transparent' ? undefined : color,
      backgroundImage:
        color === 'transparent'
          ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)'
          : undefined,
      backgroundSize: color === 'transparent' ? '8px 8px' : undefined,
      backgroundPosition: color === 'transparent' ? '0 0, 4px 4px' : undefined,
    }}
  />
);

const CustomColorInput: React.FC<{
  value: string;
  onChange: (color: string) => void;
}> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative w-7 h-7 flex-shrink-0">
      <button
        type="button"
        title="Custom color"
        onClick={() => inputRef.current?.click()}
        className="w-7 h-7 rounded-md border-2 border-gray-200 dark:border-gh-border-default overflow-hidden"
        style={{ backgroundColor: value === 'transparent' ? '#ffffff' : value }}
      />
      <input
        ref={inputRef}
        type="color"
        value={value === 'transparent' ? '#ffffff' : value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};

const Separator: React.FC = () => (
  <div className="w-px h-5 bg-gray-200 dark:bg-gh-border-default mx-1 flex-shrink-0" />
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-medium text-gray-400 dark:text-gh-fg-subtle uppercase tracking-wider flex-shrink-0 select-none">
    {children}
  </span>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ExcalidrawPropertyRow: React.FC<ExcalidrawPropertyRowProps> = ({
  api,
  appState,
  selectedElements,
}) => {
  const isMobile = useIsMobile();
  const [showOpacity, setShowOpacity] = useState(false);

  const hasSelection = selectedElements.length > 0;
  const toolType = appState.activeTool?.type ?? 'selection';

  // Read current values — from selected elements or from appState defaults
  const strokeColor = hasSelection
    ? (getCommonValue(selectedElements, 'strokeColor') ?? appState.currentItemStrokeColor)
    : appState.currentItemStrokeColor;

  const bgColor = hasSelection
    ? (getCommonValue(selectedElements, 'backgroundColor') ?? appState.currentItemBackgroundColor)
    : appState.currentItemBackgroundColor;

  const strokeWidth = hasSelection
    ? (getCommonValue(selectedElements, 'strokeWidth') ?? appState.currentItemStrokeWidth)
    : appState.currentItemStrokeWidth;

  const strokeStyle = hasSelection
    ? (getCommonValue(selectedElements, 'strokeStyle') ?? appState.currentItemStrokeStyle)
    : appState.currentItemStrokeStyle;

  const roughness = hasSelection
    ? (getCommonValue(selectedElements, 'roughness') ?? appState.currentItemRoughness)
    : appState.currentItemRoughness;

  const opacity = hasSelection
    ? (getCommonValue(selectedElements, 'opacity') ?? appState.currentItemOpacity)
    : appState.currentItemOpacity;

  const roundness = hasSelection
    ? (selectedElements.every((el) => el.roundness !== null) ? 'round' : (selectedElements.every((el) => el.roundness === null) ? 'sharp' : undefined))
    : appState.currentItemRoundness;

  // Update helper: mutates selected elements + sets appState defaults
  const updateStyle = useCallback(
    (
      elementPatch: Record<string, unknown>,
      appStatePatch: Record<string, unknown>,
    ) => {
      const elements = api.getSceneElements().map((el) => {
        if (appState.selectedElementIds[el.id]) {
          return { ...el, ...elementPatch } as typeof el;
        }
        return el;
      });

      api.updateScene({
        elements,
        appState: appStatePatch as Pick<AppState, keyof AppState>,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api, appState.selectedElementIds],
  );

  // ---- Event handlers ----

  const handleStrokeColor = useCallback(
    (color: string) => {
      updateStyle(
        { strokeColor: color },
        { currentItemStrokeColor: color },
      );
    },
    [updateStyle],
  );

  const handleBgColor = useCallback(
    (color: string) => {
      updateStyle(
        { backgroundColor: color, fillStyle: color === 'transparent' ? 'solid' as FillStyle : appState.currentItemFillStyle },
        { currentItemBackgroundColor: color },
      );
    },
    [updateStyle, appState.currentItemFillStyle],
  );

  const handleStrokeWidth = useCallback(
    (width: number) => {
      updateStyle(
        { strokeWidth: width },
        { currentItemStrokeWidth: width },
      );
    },
    [updateStyle],
  );

  const handleStrokeStyle = useCallback(
    (style: StrokeStyle) => {
      updateStyle(
        { strokeStyle: style },
        { currentItemStrokeStyle: style },
      );
    },
    [updateStyle],
  );

  const handleRoughness = useCallback(
    (value: number) => {
      updateStyle(
        { roughness: value },
        { currentItemRoughness: value },
      );
    },
    [updateStyle],
  );

  const handleRoundness = useCallback(
    (type: 'sharp' | 'round') => {
      const newRoundness = type === 'round' ? { type: 3 as const, value: 32 } : null;
      updateStyle(
        { roundness: newRoundness },
        { currentItemRoundness: type },
      );
    },
    [updateStyle],
  );

  const handleOpacity = useCallback(
    (value: number) => {
      updateStyle({ opacity: value }, { currentItemOpacity: value });
    },
    [updateStyle],
  );

  // ---- Layer actions (selection-only) ----
  const moveLayer = useCallback(
    (direction: 'front' | 'back' | 'forward' | 'backward') => {
      if (!hasSelection) return;

      const allElements = [...api.getSceneElements()];
      const selectedIds = new Set(Object.keys(appState.selectedElementIds));
      const selectedEls = allElements.filter((el) => selectedIds.has(el.id));
      const rest = allElements.filter((el) => !selectedIds.has(el.id));

      let newElements: ExcalidrawElement[];
      switch (direction) {
        case 'front':
          newElements = [...rest, ...selectedEls];
          break;
        case 'back':
          newElements = [...selectedEls, ...rest];
          break;
        case 'forward': {
          // Move selected elements one step forward in z-order
          newElements = [...allElements];
          for (let i = newElements.length - 2; i >= 0; i--) {
            if (selectedIds.has(newElements[i].id) && !selectedIds.has(newElements[i + 1].id)) {
              [newElements[i], newElements[i + 1]] = [newElements[i + 1], newElements[i]];
            }
          }
          break;
        }
        case 'backward': {
          newElements = [...allElements];
          for (let i = 1; i < newElements.length; i++) {
            if (selectedIds.has(newElements[i].id) && !selectedIds.has(newElements[i - 1].id)) {
              [newElements[i], newElements[i - 1]] = [newElements[i - 1], newElements[i]];
            }
          }
          break;
        }
      }

      api.updateScene({
        elements: newElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api, appState.selectedElementIds, hasSelection],
  );

  // ---- Delete & Duplicate ----
  const handleDelete = useCallback(() => {
    if (!hasSelection) return;
    const elements = api.getSceneElements().map((el) =>
      appState.selectedElementIds[el.id] ? { ...el, isDeleted: true } as typeof el : el,
    );
    api.updateScene({
      elements,
      appState: { selectedElementIds: {} } as Pick<AppState, keyof AppState>,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [api, appState.selectedElementIds, hasSelection]);

  const handleDuplicate = useCallback(() => {
    if (!hasSelection) return;
    const allElements = api.getSceneElements();
    const newElements: ExcalidrawElement[] = [...allElements];
    const newSelectedIds: Record<string, true> = {};

    for (const el of allElements) {
      if (appState.selectedElementIds[el.id]) {
        const dup = {
          ...el,
          id: `${el.id}_dup_${Date.now()}`,
          x: el.x + 20,
          y: el.y + 20,
          seed: Math.floor(Math.random() * 2147483647),
        };
        newElements.push(dup as ExcalidrawElement);
        newSelectedIds[dup.id] = true;
      }
    }

    api.updateScene({
      elements: newElements,
      appState: { selectedElementIds: newSelectedIds } as Pick<AppState, keyof AppState>,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [api, appState.selectedElementIds, hasSelection]);

  // Don't show if not a stylable tool and nothing selected
  const shouldShow = isStylableTool(toolType) || hasSelection;
  if (!shouldShow) return null;

  const btnClass = cn(
    'flex items-center justify-center rounded-lg transition-colors flex-shrink-0',
    isMobile ? 'w-9 h-9' : 'w-7 h-7',
  );

  const activeBtnClass = 'bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]';
  const inactiveBtnClass =
    'text-gray-500 dark:text-gh-fg-muted hover:bg-gray-100 dark:hover:bg-gh-canvas-subtle';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full max-w-[calc(100vw-2rem)] overflow-x-auto',
        'bg-white/95 dark:bg-gh-canvas-default/95 backdrop-blur-sm',
        'border border-gray-200 dark:border-gh-border-default',
        'shadow-lg',
        isMobile
          ? 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[10030]'
          : 'fixed top-14 left-1/2 -translate-x-1/2 z-[10030]',
      )}
    >
      {/* Stroke */}
      <SectionLabel>Stroke</SectionLabel>
      <div className="flex items-center gap-1">
        {STROKE_COLORS.map((c) => (
          <ColorSwatch
            key={c.color}
            color={c.color}
            isActive={strokeColor === c.color}
            onClick={() => handleStrokeColor(c.color)}
            label={c.label}
            size="sm"
          />
        ))}
        <CustomColorInput
          value={strokeColor}
          onChange={handleStrokeColor}
        />
      </div>

      <Separator />

      {/* Background */}
      <SectionLabel>Background</SectionLabel>
      <div className="flex items-center gap-1">
        {BG_COLORS.map((c) => (
          <ColorSwatch
            key={c.color}
            color={c.color}
            isActive={bgColor === c.color}
            onClick={() => handleBgColor(c.color)}
            label={c.label}
            size="sm"
          />
        ))}
        <CustomColorInput
          value={bgColor}
          onChange={handleBgColor}
        />
      </div>

      <Separator />

      {/* Stroke width */}
      <SectionLabel>Width</SectionLabel>
      <div className="flex items-center gap-0.5">
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w.value}
            type="button"
            title={w.label}
            onClick={() => handleStrokeWidth(w.value)}
            className={cn(btnClass, strokeWidth === w.value ? activeBtnClass : inactiveBtnClass)}
          >
            <Minus className="w-4 h-4" style={{ strokeWidth: w.value + 1 }} />
          </button>
        ))}
      </div>

      <Separator />

      {/* Stroke style */}
      <SectionLabel>Style</SectionLabel>
      <div className="flex items-center gap-0.5">
        {STROKE_STYLES.map((s) => (
          <button
            key={s.value}
            type="button"
            title={s.label}
            onClick={() => handleStrokeStyle(s.value)}
            className={cn(btnClass, strokeStyle === s.value ? activeBtnClass : inactiveBtnClass)}
          >
            {s.value === 'solid' && <Minus className="w-4 h-4" />}
            {s.value === 'dashed' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="8" x2="5" y2="8" />
                <line x1="7" y1="8" x2="11" y2="8" />
                <line x1="13" y1="8" x2="15" y2="8" />
              </svg>
            )}
            {s.value === 'dotted' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="2" cy="8" r="1" fill="currentColor" />
                <circle cx="6" cy="8" r="1" fill="currentColor" />
                <circle cx="10" cy="8" r="1" fill="currentColor" />
                <circle cx="14" cy="8" r="1" fill="currentColor" />
              </svg>
            )}
          </button>
        ))}
      </div>

      <Separator />

      {/* Sloppiness */}
      <SectionLabel>Sloppiness</SectionLabel>
      <div className="flex items-center gap-0.5">
        {ROUGHNESS_VALUES.map((r) => (
          <button
            key={r.value}
            type="button"
            title={r.label}
            onClick={() => handleRoughness(r.value)}
            className={cn(btnClass, roughness === r.value ? activeBtnClass : inactiveBtnClass)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              {r.value === 0 && <path d="M2 12 L14 4" />}
              {r.value === 1 && <path d="M2 12 Q8 2 14 4" />}
              {r.value === 2 && <path d="M2 12 Q5 4 8 8 Q11 2 14 4" />}
            </svg>
          </button>
        ))}
      </div>

      <Separator />

      {/* Edges */}
      <SectionLabel>Edges</SectionLabel>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title="Sharp edges"
          onClick={() => handleRoundness('sharp')}
          className={cn(btnClass, roundness === 'sharp' ? activeBtnClass : inactiveBtnClass)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2">
            <rect x="2" y="4" width="12" height="8" />
          </svg>
        </button>
        <button
          type="button"
          title="Round edges"
          onClick={() => handleRoundness('round')}
          className={cn(btnClass, roundness === 'round' ? activeBtnClass : inactiveBtnClass)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2">
            <rect x="2" y="4" width="12" height="8" rx="3" />
          </svg>
        </button>
      </div>

      <Separator />

      {/* Opacity */}
      <SectionLabel>Opacity</SectionLabel>
      <div className="flex items-center gap-1 relative">
        <button
          type="button"
          title={`Opacity: ${opacity}%`}
          onClick={() => setShowOpacity((v) => !v)}
          className={cn(btnClass, 'text-xs font-medium w-auto px-1.5', inactiveBtnClass)}
        >
          {opacity}
        </button>
        {showOpacity && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-white dark:bg-gh-canvas-default border border-gray-200 dark:border-gh-border-default shadow-lg flex items-center gap-2 z-10">
            <span className="text-xs text-gray-400">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => handleOpacity(Number(e.target.value))}
              className="w-28 accent-[var(--color-accent-primary)]"
            />
            <span className="text-xs text-gray-400">100</span>
          </div>
        )}
      </div>

      {/* Selection-only actions */}
      {hasSelection && (
        <>
          <Separator />

          {/* Layers */}
          <SectionLabel>Layers</SectionLabel>
          <div className="flex items-center gap-0.5">
            <button type="button" title="Send to back" onClick={() => moveLayer('back')} className={cn(btnClass, inactiveBtnClass)}>
              <ChevronsDown className="w-4 h-4" />
            </button>
            <button type="button" title="Send backward" onClick={() => moveLayer('backward')} className={cn(btnClass, inactiveBtnClass)}>
              <MoveDown className="w-4 h-4" />
            </button>
            <button type="button" title="Bring forward" onClick={() => moveLayer('forward')} className={cn(btnClass, inactiveBtnClass)}>
              <MoveUp className="w-4 h-4" />
            </button>
            <button type="button" title="Bring to front" onClick={() => moveLayer('front')} className={cn(btnClass, inactiveBtnClass)}>
              <ChevronsUp className="w-4 h-4" />
            </button>
          </div>

          <Separator />

          {/* Actions */}
          <SectionLabel>Actions</SectionLabel>
          <div className="flex items-center gap-0.5">
            <button type="button" title="Duplicate" onClick={handleDuplicate} className={cn(btnClass, inactiveBtnClass)}>
              <Copy className="w-4 h-4" />
            </button>
            <button type="button" title="Delete" onClick={handleDelete} className={cn(btnClass, 'text-gray-500 dark:text-gh-fg-muted hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400')}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ExcalidrawPropertyRow;
