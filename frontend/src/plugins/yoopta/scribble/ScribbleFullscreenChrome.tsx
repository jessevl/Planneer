/**
 * @file ScribbleFullscreenChrome.tsx
 * @description Lazy-loaded fullscreen chrome for Scribble editing
 * @app PAGES - Fullscreen scribble editing overlay
 *
 * Features:
 * - Tool toolbar with per-tool settings popovers
 * - Background pattern picker and page actions
 * - Fullscreen page info and navigation chrome
 *
 * Used by:
 * - ScribbleRender
 */
import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  Grid2x2,
  Highlighter,
  Minimize2,
  Pencil,
  PenTool,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/design-system';
import useClickOutside from '@/hooks/useClickOutside';

import type {
  ScribbleBackgroundPattern,
  ScribblePenFlow,
  ScribblePencilTexture,
  ScribbleSharedToolState,
  ScribbleTool,
  ScribbleToolSettings,
} from './types';

interface ScribbleFullscreenChromeProps {
  toolState: ScribbleSharedToolState;
  backgroundPattern: ScribbleBackgroundPattern;
  isReadOnly: boolean;
  pageNumber: number;
  totalPages: number;
  strokeCount: number;
  lastEdited: string | null;
  canGoPrevious: boolean;
  isLastPage: boolean;
  onToolSelect: (tool: ScribbleTool) => void;
  onToolSettingsChange: <T extends ScribbleTool>(tool: T, patch: Partial<ScribbleToolSettings[T]>) => void;
  onBackgroundPatternChange: (pattern: ScribbleBackgroundPattern) => void;
  onUndo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFullscreen: () => void;
  onGoPrevious: () => void;
  onGoNextOrAdd: () => void;
}

interface ScribbleToolbarProps {
  toolState: ScribbleSharedToolState;
  backgroundPattern: ScribbleBackgroundPattern;
  isReadOnly: boolean;
  onToolSelect: (tool: ScribbleTool) => void;
  onToolSettingsChange: <T extends ScribbleTool>(tool: T, patch: Partial<ScribbleToolSettings[T]>) => void;
  onBackgroundPatternChange: (pattern: ScribbleBackgroundPattern) => void;
  onUndo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFullscreen: () => void;
}

interface ScribbleFullscreenInfoBarProps {
  pageNumber: number;
  totalPages: number;
  strokeCount: number;
  lastEdited: string | null;
  canGoPrevious: boolean;
  isLastPage: boolean;
  onGoPrevious: () => void;
  onGoNextOrAdd: () => void;
}

type BackgroundPatternOption = {
  value: ScribbleBackgroundPattern;
  label: string;
  density: string;
};

const TOOL_ORDER: ScribbleTool[] = ['pen', 'pencil', 'marker', 'eraser'];

const TOOL_LABELS: Record<ScribbleTool, string> = {
  pen: 'Pen',
  pencil: 'Pencil',
  gel: 'Gel pen',
  marker: 'Marker',
  eraser: 'Eraser',
};

const PEN_WIDTHS = [1.4, 2.2, 3.1, 4.4] as const;
const PEN_FLOWS: Array<{ value: ScribblePenFlow; label: string }> = [
  { value: 'ballpoint', label: 'Pen' },
  { value: 'ink', label: 'Ink' },
  { value: 'fountain', label: 'Fountain' },
];
const PENCIL_WIDTHS = [1.4, 2.2, 3.2] as const;
const PENCIL_TEXTURES: Array<{ value: ScribblePencilTexture; label: string }> = [
  { value: 'hb', label: 'HB' },
  { value: '2b', label: '2B' },
  { value: '4b', label: '4B' },
];
const MARKER_WIDTHS = [8, 12, 16] as const;
const PEN_COLORS = ['#1f2937', '#1d4ed8', '#0f766e', '#7c2d12'] as const;
const PENCIL_COLORS = ['#475569', '#52525b', '#334155'] as const;
const MARKER_COLORS = ['#fde68a', '#93c5fd', '#86efac', '#fca5a5', '#d8b4fe'] as const;
const BACKGROUND_PATTERN_OPTIONS: BackgroundPatternOption[] = [
  { value: 'plain', label: 'Blank', density: 'None' },
  { value: 'lines-tight', label: 'Lines', density: 'Tight' },
  { value: 'lines-regular', label: 'Lines', density: 'Regular' },
  { value: 'lines-wide', label: 'Lines', density: 'Wide' },
  { value: 'dots-tight', label: 'Dots', density: 'Tight' },
  { value: 'dots-regular', label: 'Dots', density: 'Regular' },
  { value: 'dots-wide', label: 'Dots', density: 'Wide' },
  { value: 'grid-tight', label: 'Squares', density: 'Tight' },
  { value: 'grid-regular', label: 'Squares', density: 'Regular' },
  { value: 'grid-wide', label: 'Squares', density: 'Wide' },
];

function ScribbleToolIcon({ tool, className }: { tool: ScribbleTool; className?: string }) {
  if (tool === 'pencil') return <Pencil className={className} />;
  if (tool === 'marker') return <Highlighter className={className} />;
  if (tool === 'eraser') return <Eraser className={className} />;
  return <PenTool className={className} />;
}

function getPatternPreviewStyle(pattern: ScribbleBackgroundPattern): React.CSSProperties {
  const tone = 'rgba(71, 85, 105, 0.22)';

  if (pattern === 'plain') {
    return { backgroundColor: '#fffdf8' };
  }

  if (pattern.startsWith('lines-')) {
    const spacing = pattern === 'lines-tight' ? 24 : pattern === 'lines-wide' ? 46 : 34;
    return {
      backgroundColor: '#fffdf8',
      backgroundImage: `linear-gradient(to bottom, transparent calc(${spacing - 1}px), ${tone} calc(${spacing - 1}px), ${tone} ${spacing}px)`,
      backgroundSize: `100% ${spacing}px`,
    };
  }

  if (pattern.startsWith('grid-')) {
    const spacing = pattern === 'grid-tight' ? 20 : pattern === 'grid-wide' ? 38 : 28;
    const gridSize = Math.max(8, Math.round(spacing / 1.6));
    return {
      backgroundColor: '#fffdf8',
      backgroundImage: `linear-gradient(${tone} 1px, transparent 1px), linear-gradient(90deg, ${tone} 1px, transparent 1px)`,
      backgroundSize: `${gridSize}px ${gridSize}px`,
    };
  }

  const spacing = pattern === 'dots-tight' ? 20 : pattern === 'dots-wide' ? 38 : 28;
  const dotSize = Math.max(8, Math.round(spacing / 1.5));

  return {
    backgroundColor: '#fffdf8',
    backgroundImage: `radial-gradient(circle, ${tone} 1px, transparent 1.4px)`,
    backgroundSize: `${dotSize}px ${dotSize}px`,
  };
}

function getActiveToolDetail(toolState: ScribbleSharedToolState): string | null {
  if (toolState.activeTool === 'pen') {
    return PEN_FLOWS.find((option) => option.value === toolState.settings.pen.flow)?.label ?? 'Pen';
  }

  if (toolState.activeTool === 'pencil') {
    return PENCIL_TEXTURES.find((option) => option.value === toolState.settings.pencil.texture)?.label ?? '2B';
  }

  if (toolState.activeTool === 'marker') {
    return `${toolState.settings.marker.width}px`;
  }

  if (toolState.activeTool === 'eraser') {
    return `${toolState.settings.eraser.width}px`;
  }

  return null;
}

function ScribbleToolbar({
  toolState,
  backgroundPattern,
  isReadOnly,
  onToolSelect,
  onToolSettingsChange,
  onBackgroundPatternChange,
  onUndo,
  onDuplicate,
  onDelete,
  onToggleFullscreen,
}: ScribbleToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [openPopover, setOpenPopover] = useState<ScribbleTool | 'background' | null>(null);
  const activeTool = toolState.activeTool;

  useClickOutside(
    openPopover
      ? [{ ref: toolbarRef, onOutside: () => setOpenPopover(null) }]
      : [],
  );

  const pillButtonClass = 'flex h-10 w-10 items-center justify-center rounded-full border border-transparent transition-colors eink-scribble-toolbar-button';
  const settingsSectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]';
  const activeToolDetail = getActiveToolDetail(toolState);

  const handleToolButton = (tool: ScribbleTool) => {
    if (tool === activeTool && tool !== 'eraser') {
      setOpenPopover((current) => (current === tool ? null : tool));
      return;
    }

    onToolSelect(tool);
    setOpenPopover(null);
  };

  const renderWidthChoices = (values: readonly number[], activeValue: number, onSelect: (value: number) => void) => (
    <div className="flex gap-1">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          data-active={activeValue === value ? 'true' : 'false'}
          className={cn(
            'flex h-9 min-w-9 items-center justify-center rounded-2xl border px-2 transition-colors eink-scribble-toolbar-option',
            activeValue === value
              ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
              : 'border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
          )}
          onClick={() => onSelect(value)}
          title={`${value}px`}
        >
          <span className="block rounded-full bg-current" style={{ width: `${Math.max(4, value * 2)}px`, height: `${Math.max(4, value * 2)}px` }} />
        </button>
      ))}
    </div>
  );

  const renderColorChoices = (colors: readonly string[], activeColor: string, onSelect: (value: string) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          data-active={activeColor === color ? 'true' : 'false'}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border transition-transform hover:scale-[1.03] eink-scribble-toolbar-swatch',
            activeColor === color ? 'border-[var(--color-border-strong)] ring-1 ring-[var(--color-border-strong)]' : 'border-[var(--color-border-subtle)]',
          )}
          style={{ backgroundColor: color }}
          onClick={() => onSelect(color)}
          title={color}
        >
          {activeColor === color && <span className="h-2 w-2 rounded-full bg-white/90 shadow-sm" />}
        </button>
      ))}
    </div>
  );

  const renderPopover = (content: React.ReactNode) => (
    <div className="absolute left-1/2 top-full z-20 mt-2 w-[17rem] -translate-x-1/2 rounded-[24px] border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-base)_94%,white_6%)] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
      <div className="flex flex-col gap-3">{content}</div>
    </div>
  );

  return (
    <div ref={toolbarRef} className="pointer-events-auto glass-toolbar flex max-w-full flex-wrap items-center gap-1 px-2 py-1 shadow-lg">
      {!isReadOnly && TOOL_ORDER.map((tool) => {
        const isActive = activeTool === tool;
        const isConfigurable = tool !== 'eraser';

        return (
          <div key={tool} className="relative">
            <button
              type="button"
              data-active={isActive ? 'true' : 'false'}
              data-open={openPopover === tool ? 'true' : 'false'}
              className={cn(
                pillButtonClass,
                isActive
                  ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text-strong)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
              )}
              onClick={() => handleToolButton(tool)}
              title={TOOL_LABELS[tool]}
            >
              <ScribbleToolIcon tool={tool} className="h-[18px] w-[18px]" />
            </button>

            {openPopover === tool && isConfigurable && tool === 'pen' && renderPopover(
              <>
                <div>
                  <div className={settingsSectionLabel}>Pen width</div>
                  <div className="mt-2">{renderWidthChoices(PEN_WIDTHS, toolState.settings.pen.width, (value) => onToolSettingsChange('pen', { width: value }))}</div>
                </div>
                <div>
                  <div className={settingsSectionLabel}>Tool style</div>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {PEN_FLOWS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-active={toolState.settings.pen.flow === option.value ? 'true' : 'false'}
                        className={cn(
                          'rounded-2xl border px-2 py-2 text-xs font-medium transition-colors eink-scribble-toolbar-option',
                          toolState.settings.pen.flow === option.value
                            ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                            : 'border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
                        )}
                        onClick={() => onToolSettingsChange('pen', { flow: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={settingsSectionLabel}>Ink color</div>
                  <div className="mt-2">{renderColorChoices(PEN_COLORS, toolState.settings.pen.color, (value) => onToolSettingsChange('pen', { color: value }))}</div>
                </div>
              </>,
            )}

            {openPopover === tool && isConfigurable && tool === 'pencil' && renderPopover(
              <>
                <div>
                  <div className={settingsSectionLabel}>Pencil weight</div>
                  <div className="mt-2">{renderWidthChoices(PENCIL_WIDTHS, toolState.settings.pencil.width, (value) => onToolSettingsChange('pencil', { width: value }))}</div>
                </div>
                <div>
                  <div className={settingsSectionLabel}>Graphite</div>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {PENCIL_TEXTURES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-active={toolState.settings.pencil.texture === option.value ? 'true' : 'false'}
                        className={cn(
                          'rounded-2xl border px-2 py-2 text-xs font-medium transition-colors eink-scribble-toolbar-option',
                          toolState.settings.pencil.texture === option.value
                            ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                            : 'border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
                        )}
                        onClick={() => onToolSettingsChange('pencil', { texture: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={settingsSectionLabel}>Tone</div>
                  <div className="mt-2">{renderColorChoices(PENCIL_COLORS, toolState.settings.pencil.color, (value) => onToolSettingsChange('pencil', { color: value }))}</div>
                </div>
              </>,
            )}

            {openPopover === tool && isConfigurable && tool === 'marker' && renderPopover(
              <>
                <div>
                  <div className={settingsSectionLabel}>Marker width</div>
                  <div className="mt-2">{renderWidthChoices(MARKER_WIDTHS, toolState.settings.marker.width, (value) => onToolSettingsChange('marker', { width: value }))}</div>
                </div>
                <div>
                  <div className={settingsSectionLabel}>Marker color</div>
                  <div className="mt-2">{renderColorChoices(MARKER_COLORS, toolState.settings.marker.color, (value) => onToolSettingsChange('marker', { color: value }))}</div>
                </div>
              </>,
            )}
          </div>
        );
      })}

      {!isReadOnly && activeToolDetail && (
        <div
          data-active="true"
          className="hidden rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-hover)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-primary)] eink-scribble-toolbar-option sm:inline-flex"
        >
          {activeToolDetail}
        </div>
      )}

      {!isReadOnly && <div className="mx-1 hidden h-6 w-px bg-[var(--color-border-subtle)] sm:block" />}

      {!isReadOnly && (
        <>
          <button type="button" className={cn(pillButtonClass, 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]')} onClick={onUndo} title="Undo last stroke">
            <RotateCcw className="h-[18px] w-[18px]" />
          </button>
          <div className="relative">
            <button
              type="button"
              data-active={openPopover === 'background' ? 'true' : 'false'}
              data-open={openPopover === 'background' ? 'true' : 'false'}
              className={cn(
                pillButtonClass,
                openPopover === 'background'
                  ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text-strong)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
              )}
              onClick={() => setOpenPopover((current) => (current === 'background' ? null : 'background'))}
              title="Page background"
            >
              <Grid2x2 className="h-[18px] w-[18px]" />
            </button>

            {openPopover === 'background' && renderPopover(
              <>
                <div>
                  <div className={settingsSectionLabel}>Page background</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {BACKGROUND_PATTERN_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-active={backgroundPattern === option.value ? 'true' : 'false'}
                        className={cn(
                          'flex items-center gap-2 rounded-2xl border p-2 text-left transition-colors eink-scribble-toolbar-option',
                          backgroundPattern === option.value
                            ? 'border-[var(--color-border-strong)] bg-[var(--color-surface-hover)]'
                            : 'border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]',
                        )}
                        onClick={() => onBackgroundPatternChange(option.value)}
                      >
                        <span className="h-10 w-10 rounded-xl border border-[var(--color-border-subtle)]" style={getPatternPreviewStyle(option.value)} />
                        <span>
                          <span className="block text-xs font-semibold text-[var(--color-text-primary)]">{option.label}</span>
                          <span className="block text-[11px] text-[var(--color-text-secondary)]">{option.density}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>,
            )}
          </div>
          <button type="button" className={cn(pillButtonClass, 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]')} onClick={onDuplicate} title="Duplicate page">
            <Copy className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            className={cn(pillButtonClass, 'text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400')}
            onClick={onDelete}
            title="Delete page"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        </>
      )}

      <div className="ml-auto" />
      <button
        type="button"
        className={cn(pillButtonClass, 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]')}
        onClick={onToggleFullscreen}
        title="Exit fullscreen"
      >
        <Minimize2 className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

function ScribbleFullscreenInfoBar({
  pageNumber,
  totalPages,
  strokeCount,
  lastEdited,
  canGoPrevious,
  isLastPage,
  onGoPrevious,
  onGoNextOrAdd,
}: ScribbleFullscreenInfoBarProps) {
  return (
    <div className="pointer-events-auto glass-toolbar-lighter flex items-center gap-2 rounded-full px-3 py-2 text-xs text-[var(--color-text-primary)] shadow-lg">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onGoPrevious}
        title="Previous page"
        disabled={!canGoPrevious}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="font-medium">Page {pageNumber} of {totalPages}</span>
      <span className="text-[var(--color-text-secondary)]">{strokeCount === 0 ? 'Blank' : `${strokeCount} ${strokeCount === 1 ? 'stroke' : 'strokes'}`}</span>
      {lastEdited && <span className="hidden text-[var(--color-text-secondary)] sm:inline">Edited {new Date(lastEdited).toLocaleDateString()}</span>}
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
        onClick={onGoNextOrAdd}
        title={isLastPage ? 'Add page' : 'Next page'}
      >
        {isLastPage ? <Plus className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

const ScribbleFullscreenChrome: React.FC<ScribbleFullscreenChromeProps> = ({
  toolState,
  backgroundPattern,
  isReadOnly,
  pageNumber,
  totalPages,
  strokeCount,
  lastEdited,
  canGoPrevious,
  isLastPage,
  onToolSelect,
  onToolSettingsChange,
  onBackgroundPatternChange,
  onUndo,
  onDuplicate,
  onDelete,
  onToggleFullscreen,
  onGoPrevious,
  onGoNextOrAdd,
}) => {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
        <ScribbleToolbar
          toolState={toolState}
          backgroundPattern={backgroundPattern}
          isReadOnly={isReadOnly}
          onToolSelect={onToolSelect}
          onToolSettingsChange={onToolSettingsChange}
          onBackgroundPatternChange={onBackgroundPatternChange}
          onUndo={onUndo}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleFullscreen={onToggleFullscreen}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
        <ScribbleFullscreenInfoBar
          pageNumber={pageNumber}
          totalPages={totalPages}
          strokeCount={strokeCount}
          lastEdited={lastEdited}
          canGoPrevious={canGoPrevious}
          isLastPage={isLastPage}
          onGoPrevious={onGoPrevious}
          onGoNextOrAdd={onGoNextOrAdd}
        />
      </div>

      <div className="absolute inset-y-0 left-3 z-20 hidden items-center md:flex">
        <button
          type="button"
          className="glass-toolbar flex h-14 w-14 items-center justify-center rounded-full text-[var(--color-text-primary)] shadow-lg transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onGoPrevious}
          disabled={!canGoPrevious}
          title="Previous page"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      </div>

      <div className="absolute inset-y-0 right-3 z-20 hidden items-center md:flex">
        <button
          type="button"
          className="glass-toolbar flex h-14 w-14 items-center justify-center rounded-full text-[var(--color-text-primary)] shadow-lg transition-transform hover:scale-[1.02]"
          onClick={onGoNextOrAdd}
          title={isLastPage ? 'Add page' : 'Next page'}
        >
          {isLastPage ? <Plus className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
};

export default ScribbleFullscreenChrome;