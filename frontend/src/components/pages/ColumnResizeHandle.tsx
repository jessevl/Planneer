/**
 * @file ColumnResizeHandle.tsx
 * @description Draggable resize handle between columns in a column group.
 *   Renders a thin vertical divider that can be dragged to resize adjacent columns.
 * @app PAGES - Used inside PageEditor renderBlock anchor
 */
import React, { useCallback, useRef } from 'react';

const MIN_COLUMN_FRACTION = 0.15; // ~15% minimum width

interface ColumnResizeHandleProps {
  /** The group being resized */
  groupId: string;
  /** Index of the column to the left of this handle */
  leftColIndex: number;
  /** Current fractional widths for all columns in the group */
  columnWidths: number[];
  /** Callback to persist new widths */
  onResize: (groupId: string, newWidths: number[]) => void;
  /** Callback on resize end to persist to draft */
  onResizeEnd?: () => void;
}

const ColumnResizeHandle: React.FC<ColumnResizeHandleProps> = React.memo(
  ({ groupId, leftColIndex, columnWidths, onResize, onResizeEnd }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const leftIdx = leftColIndex;
        const rightIdx = leftColIndex + 1;
        const startWidths = [...columnWidths];

        // Get the column group container width
        const handle = containerRef.current;
        const groupContainer = handle?.closest(
          '[data-column-group-container]',
        ) as HTMLElement | null;
        if (!groupContainer) return;
        const containerWidth = groupContainer.getBoundingClientRect().width;
        if (containerWidth === 0) return;

        const onPointerMove = (ev: PointerEvent) => {
          const deltaX = ev.clientX - startX;
          const deltaFraction = deltaX / containerWidth;

          let newLeft = startWidths[leftIdx] + deltaFraction;
          let newRight = startWidths[rightIdx] - deltaFraction;

          // Enforce minimum widths
          if (newLeft < MIN_COLUMN_FRACTION) {
            newRight += newLeft - MIN_COLUMN_FRACTION;
            newLeft = MIN_COLUMN_FRACTION;
          }
          if (newRight < MIN_COLUMN_FRACTION) {
            newLeft += newRight - MIN_COLUMN_FRACTION;
            newRight = MIN_COLUMN_FRACTION;
          }

          const newWidths = [...startWidths];
          newWidths[leftIdx] = +newLeft.toFixed(4);
          newWidths[rightIdx] = +newRight.toFixed(4);
          onResize(groupId, newWidths);
        };

        const onPointerUp = () => {
          document.removeEventListener('pointermove', onPointerMove);
          document.removeEventListener('pointerup', onPointerUp);
          onResizeEnd?.();
        };

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
      },
      [groupId, leftColIndex, columnWidths, onResize, onResizeEnd],
    );

    return (
      <div
        ref={containerRef}
        data-column-resize-handle
        style={{
          width: 24,
          position: 'relative',
          flexShrink: 0,
          // Let pointer events pass through to blocks underneath;
          // only the inner hit-zone captures them.
          pointerEvents: 'none',
        }}
      >
        {/* Hit-zone extends above/below the column content so resize is
            reachable in the gaps where no block exists. Block drag handles
            render on top (higher z-index) so they always win when overlapping. */}
        <div
          onPointerDown={handlePointerDown}
          className="group/resize"
          style={{
            position: 'absolute',
            left: 6,
            right: 6,
            top: -12,
            bottom: -12,
            cursor: 'col-resize',
            pointerEvents: 'auto',
            touchAction: 'none',
            zIndex: 2,
          }}
        >
          {/* Visible line — subtle by default, highlights on hover */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-3 bottom-3 w-px transition-colors bg-black/[0.06] dark:bg-white/[0.08] group-hover/resize:bg-blue-400 group-hover/resize:dark:bg-blue-400"
          />
        </div>
      </div>
    );
  },
);

ColumnResizeHandle.displayName = 'ColumnResizeHandle';
export default ColumnResizeHandle;
