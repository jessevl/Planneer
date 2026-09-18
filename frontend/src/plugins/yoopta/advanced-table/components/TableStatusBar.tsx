/**
 * @file TableStatusBar.tsx
 * @description Spreadsheet-style status bar and zoom controls for the table's full view
 *
 * - Bottom-left: cell reference (C4 or B2:D5) and table size, or for a range of
 *   cells the count, sum, average, min and max of its numbers
 * - Bottom-right: zoom out / reset / zoom in, styled like the whiteboard's zoom pill
 *
 * Used by:
 * - AdvancedTable.tsx (full view only)
 */
import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

import { cn } from '@/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import type { AdvancedTableElement, NumberFormat } from '../types';
import type { CellRect } from '../utils/cellRange';
import { isMultiCellRect } from '../utils/cellRange';
import { formatNumber } from '../utils/numberFormat';
import { columnLetter } from './TableToolbar';

export const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

type Props = {
  table: AdvancedTableElement;
  rect: CellRect | null;
  visibleRowCount: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

export type RangeStats = { count: number; numbers: number; sum: number; average: number; min: number; max: number };

/** Count of non-empty cells and statistics over the numeric ones */
export function getRangeStats(table: AdvancedTableElement, rect: CellRect): RangeStats {
  const rows = table.children as any[];
  let count = 0;
  const values: number[] = [];

  for (let r = rect.top; r <= rect.bottom; r++) {
    for (let c = rect.left; c <= rect.right; c++) {
      const text = (rows[r]?.children?.[c]?.children ?? []).map((t: any) => t.text ?? '').join('').trim();
      if (!text) continue;
      count++;
      if (/^-?\d*\.?\d+$/.test(text)) values.push(Number(text));
    }
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count,
    numbers: values.length,
    sum,
    average: values.length ? sum / values.length : 0,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
  };
}

const TableStatusBar: React.FC<Props> = ({ table, rect, visibleRowCount, zoom, onZoomChange }) => {
  const isMobile = useIsMobile();
  const rows = table.children as any[];
  const rowCount = rows.length;
  const columnCount = rows[0]?.children?.length ?? 0;
  const props = table.props ?? {};

  // Use the column's number format when the whole range shares one
  let format: NumberFormat | undefined;
  if (rect) {
    const formats = new Set<string>();
    for (let c = rect.left; c <= rect.right; c++) formats.add(JSON.stringify(props.columnFormats?.[c] ?? null));
    if (formats.size === 1) format = props.columnFormats?.[rect.left];
  }
  const fmt = (value: number) => formatNumber(value, format ?? { style: 'number', grouping: true, decimals: Number.isInteger(value) ? 0 : 2 });

  const isRange = isMultiCellRect(rect);
  const reference = rect
    ? `${columnLetter(rect.left)}${rect.top + 1}${isRange ? `:${columnLetter(rect.right)}${rect.bottom + 1}` : ''}`
    : null;

  const stats = rect && isRange ? getRangeStats(table, rect) : null;
  const filtered = visibleRowCount < rowCount;

  const zoomIndex = ZOOM_LEVELS.findIndex((z) => Math.abs(z - zoom) < 0.001);
  const stepZoom = (dir: 1 | -1) => {
    const index = zoomIndex === -1 ? ZOOM_LEVELS.indexOf(1) : zoomIndex;
    onZoomChange(ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + dir))]);
  };

  const subBtn = cn(
    'flex items-center justify-center rounded-full flex-shrink-0 glass-header-btn text-[var(--color-text-tertiary)] disabled:opacity-35',
    isMobile ? 'w-9 h-9' : 'w-7 h-7',
  );
  const bottom = isMobile ? 'max(16px, env(safe-area-inset-bottom, 16px))' : '12px';
  const item = (label: string, value: string) => (
    <span className="whitespace-nowrap">
      <span className="text-[var(--color-text-tertiary)]">{label}</span>{' '}
      <span className="text-[var(--color-text-primary)] tabular-nums">{value}</span>
    </span>
  );

  return (
    <>
      <div
        className="glass-toolbar fixed left-3 z-[240] shadow-md flex items-center gap-3 px-3.5 py-1.5 text-[12px] max-w-[calc(100vw-160px)] overflow-x-auto excalidraw-toolbar-scroll"
        style={{ bottom }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {reference && <span className="font-medium text-[var(--color-text-secondary)] tabular-nums">{reference}</span>}
        {stats ? (
          <>
            {item('Count', String(stats.count))}
            {stats.numbers > 0 && (<>
              {item('Sum', fmt(stats.sum))}
              {!isMobile && item('Average', fmt(stats.average))}
              {!isMobile && item('Min', fmt(stats.min))}
              {!isMobile && item('Max', fmt(stats.max))}
            </>)}
          </>
        ) : (
          <span className="whitespace-nowrap text-[var(--color-text-tertiary)]">
            {filtered ? `${visibleRowCount} of ${rowCount} rows` : `${rowCount} ${rowCount === 1 ? 'row' : 'rows'}`}
            {' · '}
            {columnCount} {columnCount === 1 ? 'column' : 'columns'}
          </span>
        )}
      </div>

      <div
        className="glass-toolbar fixed right-3 z-[240] shadow-md flex items-center gap-0.5 px-1.5 py-1"
        style={{ bottom }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <button type="button" title="Zoom out" disabled={zoomIndex === 0} onClick={() => stepZoom(-1)} className={subBtn}>
          <ZoomOut className="w-4 h-4" />
        </button>
        <button type="button" title="Reset zoom" onClick={() => onZoomChange(1)} className={cn(subBtn, 'text-[11px] font-medium w-auto px-1.5 tabular-nums')}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" title="Zoom in" disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => stepZoom(1)} className={subBtn}>
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </>
  );
};

export default TableStatusBar;
