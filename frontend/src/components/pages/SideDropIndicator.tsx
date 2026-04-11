/**
 * @file SideDropIndicator.tsx
 * @description Visual indicator for column drops during block DnD.
 *              Detects two types of drops:
 *              1. NEW COLUMN: dragging to the left/right edge of any block
 *              2. INTO COLUMN: dragging to the center of a block already in a column
 * @app PAGES - Column layout via drag-and-drop (Notion-style)
 *
 * Used by:
 * - PageEditor.tsx (rendered inside ForceUpdateBlockDndContext)
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useBlockDndContext } from '@yoopta/ui/block-dnd';
import type { ColumnsMetadata } from '@/hooks/useEditorRowLayout';
import { MAX_COLUMNS } from '@/hooks/useEditorRowLayout';

// ============================================================================
// TYPES
// ============================================================================

export type DropPending =
  | { type: 'new-column'; targetBlockId: string; side: 'left' | 'right' }
  | { type: 'into-column'; targetBlockId: string; groupId: string; columnIndex: number; position: 'above' | 'below' };

interface SideDropIndicatorProps {
  dropPendingRef: React.MutableRefObject<DropPending | null>;
  onNewColumn: (draggedBlockIds: string[], targetBlockId: string, side: 'left' | 'right') => void;
  onColumnInsert: (draggedBlockIds: string[], targetBlockId: string, groupId: string, columnIndex: number, position: 'above' | 'below') => void;
  /** Called when column blocks are dropped onto a full-width zone (remove from column).
   *  preferBefore=true means the pointer was above the group — block should land before the group. */
  onRemoveFromColumn: (blockIds: string[], preferBefore: boolean) => void;
  colMetaRef: React.MutableRefObject<ColumnsMetadata>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Vertical tolerance (px) — pointer can be slightly above/below a block and still match */
const Y_TOLERANCE_PX = 10;
/** Edge zone extending outside the block (into the page margin) in px */
const OUTER_EDGE_PX = 60;

// ============================================================================
// HELPERS
// ============================================================================

/** @internal Exported for testing */
export function detectEdge(pointerX: number, rect: DOMRect): 'left' | 'right' | null {
  if (pointerX < rect.left && pointerX >= rect.left - OUTER_EDGE_PX) return 'left';
  if (pointerX > rect.right && pointerX <= rect.right + OUTER_EDGE_PX) return 'right';
  return null;
}

/** Check if adding a column to the block's group would exceed MAX_COLUMNS */
function isAtColumnLimit(blockId: string, meta: ColumnsMetadata): boolean {
  const entry = meta.blocks[blockId];
  if (!entry) return false;
  const group = meta.groups[entry.groupId];
  return group ? group.columnCount >= MAX_COLUMNS : false;
}

interface DropResult {
  found: DropPending | null;
  indicator: IndicatorState | null;
}

/**
 * Pure function: Given pointer position and DOM elements, determine the drop
 * target and indicator placement. Runs through 4 phases:
 *   1. Direct block hit (edge → new-column, center → into-column)
 *   2. Column container gap (above/below blocks in a column)
 *   3. Outer-margin fallback (nearest block in margin zone)
 */
function findDropTarget(
  px: number,
  py: number,
  blockEls: NodeListOf<HTMLElement>,
  draggedIds: string[],
  meta: ColumnsMetadata,
): DropResult {
  // Phase 1: Direct block hit
  for (const el of blockEls) {
    const blockId = el.getAttribute('data-column-block-id');
    if (!blockId || draggedIds.includes(blockId)) continue;

    const rect = el.getBoundingClientRect();
    if (py < rect.top - Y_TOLERANCE_PX || py > rect.bottom + Y_TOLERANCE_PX) continue;
    if (px < rect.left - OUTER_EDGE_PX || px > rect.right + OUTER_EDGE_PX) continue;

    const side = detectEdge(px, rect);
    if (side) {
      const blocked = isAtColumnLimit(blockId, meta);
      return {
        found: { type: 'new-column', targetBlockId: blockId, side },
        indicator: {
          type: 'vertical', top: rect.top,
          left: side === 'left' ? rect.left - 3 : rect.right - 3,
          width: 6, height: rect.height, blocked,
        },
      };
    }

    const blockEntry = meta.blocks[blockId];
    if (blockEntry) {
      const position: 'above' | 'below' = py < rect.top + rect.height / 2 ? 'above' : 'below';
      return {
        found: { type: 'into-column', targetBlockId: blockId, groupId: blockEntry.groupId, columnIndex: blockEntry.columnIndex, position },
        indicator: {
          type: 'horizontal', top: position === 'above' ? rect.top - 2 : rect.bottom - 2,
          left: rect.left, width: rect.width, height: 3, blocked: false,
        },
      };
    }
    // Full-width block center → no column action
  }

  // Phase 2: Column container gaps (above/below all blocks in a column)
  const containers = document.querySelectorAll<HTMLElement>('[data-column-group-container]');
  for (const container of containers) {
    const cRect = container.getBoundingClientRect();
    if (px < cRect.left || px > cRect.right || py < cRect.top || py > cRect.bottom) continue;

    const colDivs = container.querySelectorAll<HTMLElement>('[data-column-index]');
    for (const colDiv of colDivs) {
      const colRect = colDiv.getBoundingClientRect();
      if (px < colRect.left || px > colRect.right) continue;

      const groupId = colDiv.getAttribute('data-column-group') ?? '';
      const colIdx = Number(colDiv.getAttribute('data-column-index') ?? 0);

      const sorted = [...colDiv.querySelectorAll<HTMLElement>('[data-column-block-id]')]
        .filter(b => !draggedIds.includes(b.getAttribute('data-column-block-id') ?? ''))
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      if (sorted.length === 0) break;

      const firstRect = sorted[0].getBoundingClientRect();
      const lastRect = sorted[sorted.length - 1].getBoundingClientRect();

      let targetId: string;
      let pos: 'above' | 'below';
      let indicatorY: number;

      if (py < firstRect.top) {
        targetId = sorted[0].getAttribute('data-column-block-id')!;
        pos = 'above'; indicatorY = firstRect.top - 2;
      } else if (py > lastRect.bottom) {
        targetId = sorted[sorted.length - 1].getAttribute('data-column-block-id')!;
        pos = 'below'; indicatorY = lastRect.bottom - 2;
      } else {
        // Between blocks — find nearest edge
        targetId = sorted[0].getAttribute('data-column-block-id')!;
        pos = 'above'; indicatorY = firstRect.top;
        let best = Infinity;
        for (const b of sorted) {
          const bRect = b.getBoundingClientRect();
          const bId = b.getAttribute('data-column-block-id')!;
          if (Math.abs(py - bRect.top) < best) { best = Math.abs(py - bRect.top); targetId = bId; pos = 'above'; indicatorY = bRect.top - 2; }
          if (Math.abs(py - bRect.bottom) < best) { best = Math.abs(py - bRect.bottom); targetId = bId; pos = 'below'; indicatorY = bRect.bottom - 2; }
        }
      }

      return {
        found: { type: 'into-column' as const, targetBlockId: targetId, groupId, columnIndex: colIdx, position: pos },
        indicator: { type: 'horizontal' as const, top: indicatorY, left: colRect.left, width: colRect.width, height: 3, blocked: false },
      };
    }
  }

  // Phase 3: Outer-margin fallback (nearest block in the margin zone)
  let bestEl: HTMLElement | null = null;
  let bestDist = Infinity;
  let bestSide: 'left' | 'right' | null = null;

  for (const el of blockEls) {
    const blockId = el.getAttribute('data-column-block-id');
    if (!blockId || draggedIds.includes(blockId)) continue;

    const rect = el.getBoundingClientRect();
    const side = (px < rect.left && px >= rect.left - OUTER_EDGE_PX) ? 'left'
      : (px > rect.right && px <= rect.right + OUTER_EDGE_PX) ? 'right' : null;
    if (!side) continue;

    const dist = Math.abs(py - (rect.top + rect.bottom) / 2);
    if (dist < bestDist) { bestDist = dist; bestEl = el; bestSide = side; }
  }

  if (bestEl && bestSide) {
    const blockId = bestEl.getAttribute('data-column-block-id')!;
    const rect = bestEl.getBoundingClientRect();
    const blocked = isAtColumnLimit(blockId, meta);
    return {
      found: { type: 'new-column', targetBlockId: blockId, side: bestSide },
      indicator: {
        type: 'vertical', top: rect.top,
        left: bestSide === 'left' ? rect.left - 3 : rect.right - 3,
        width: 6, height: rect.height, blocked,
      },
    };
  }

  return { found: null, indicator: null };
}

// ============================================================================
// INDICATOR STATE
// ============================================================================

interface IndicatorState {
  type: 'vertical' | 'horizontal';
  top: number;
  left: number;
  width: number;
  height: number;
  blocked: boolean; // true when MAX_COLUMNS reached
}

// ============================================================================
// COMPONENT
// ============================================================================

const SideDropIndicator: React.FC<SideDropIndicatorProps> = ({
  dropPendingRef,
  onNewColumn,
  onColumnInsert,
  onRemoveFromColumn,
  colMetaRef,
}) => {
  const { isDragging, activeId, draggedIds } = useBlockDndContext();
  const prevIsDraggingRef = useRef(false);
  const draggedBlockIdsRef = useRef<string[]>([]);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [indicator, setIndicator] = useState<IndicatorState | null>(null);

  // Stable refs for callbacks to avoid re-creating the pointer handler
  const callbacksRef = useRef({ onNewColumn, onColumnInsert, onRemoveFromColumn });
  callbacksRef.current = { onNewColumn, onColumnInsert, onRemoveFromColumn };

  // Capture draggedIds at drag-start
  useEffect(() => {
    if (isDragging && activeId != null) {
      draggedBlockIdsRef.current = draggedIds.map(String);
    }
  }, [isDragging, activeId, draggedIds]);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const blockEls = document.querySelectorAll<HTMLElement>('[data-column-block-id]');
      const { found, indicator: indicatorInfo } = findDropTarget(
        e.clientX, e.clientY, blockEls, draggedBlockIdsRef.current, colMetaRef.current,
      );

      dropPendingRef.current = found;
      setIndicator(indicatorInfo);

      const editorContainer = document.querySelector('.yoopta-editor-container');
      if (editorContainer) {
        editorContainer.classList.toggle('column-drop-active', found != null);
      }
    },
    [dropPendingRef, colMetaRef],
  );

  // Attach/detach pointer tracking
  useEffect(() => {
    if (!isDragging) {
      setIndicator(null);
      document.querySelector('.yoopta-editor-container')?.classList.remove('column-drop-active');
      return;
    }
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.querySelector('.yoopta-editor-container')?.classList.remove('column-drop-active');
    };
  }, [isDragging, handlePointerMove]);

  // Detect drag-end: isDragging true → false
  useEffect(() => {
    const wasDragging = prevIsDraggingRef.current;
    prevIsDraggingRef.current = isDragging;

    if (wasDragging && !isDragging) {
      const drop = dropPendingRef.current;
      const allDraggedIds = [...draggedBlockIdsRef.current];
      dropPendingRef.current = null;
      draggedBlockIdsRef.current = [];

      if (allDraggedIds.length > 0) {
        if (drop) {
          if (drop.type === 'new-column' && !isAtColumnLimit(drop.targetBlockId, colMetaRef.current)) {
            callbacksRef.current.onNewColumn(allDraggedIds, drop.targetBlockId, drop.side);
          } else if (drop.type === 'into-column') {
            callbacksRef.current.onColumnInsert(
              allDraggedIds, drop.targetBlockId, drop.groupId, drop.columnIndex, drop.position,
            );
          }
        } else {
          // No column drop: if dragged blocks were in a column, check if
          // the pointer is still inside their group container.
          const meta = colMetaRef.current;
          const inColumn = allDraggedIds.filter(id => meta.blocks[id]);
          if (inColumn.length > 0) {
            const ptr = lastPointerRef.current;
            let pointerInGroup = false;
            if (ptr) {
              const containers = document.querySelectorAll<HTMLElement>('[data-column-group-container]');
              for (const container of containers) {
                const r = container.getBoundingClientRect();
                if (ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom) {
                  const gId = container.getAttribute('data-column-group-container');
                  if (gId && inColumn.some(id => meta.blocks[id]?.groupId === gId)) {
                    pointerInGroup = true;
                    break;
                  }
                }
              }
            }
            if (!pointerInGroup) {
              let preferBefore = false;
              if (ptr) {
                const groupId = meta.blocks[inColumn[0]]?.groupId;
                if (groupId) {
                  const container = document.querySelector<HTMLElement>(
                    `[data-column-group-container="${groupId}"]`,
                  );
                  if (container) preferBefore = ptr.y < container.getBoundingClientRect().top;
                }
              }
              callbacksRef.current.onRemoveFromColumn(inColumn, preferBefore);
            }
          }
        }
      }
    }
  }, [isDragging, dropPendingRef, colMetaRef]);

  if (!indicator) return null;

  const accentColor = indicator.blocked
    ? 'var(--color-danger, #ef4444)'
    : 'var(--color-interactive-accent, #3b82f6)';

  return (
    <div
      style={{
        position: 'fixed',
        top: indicator.top,
        left: indicator.left,
        width: indicator.type === 'horizontal' ? indicator.width : indicator.width,
        height: indicator.type === 'horizontal' ? 3 : indicator.height,
        backgroundColor: accentColor,
        borderRadius: indicator.type === 'horizontal' ? 1.5 : 3,
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: indicator.blocked ? 0.4 : 0.85,
        transition: 'top 0.08s ease, left 0.08s ease',
      }}
    />
  );
};

export default React.memo(SideDropIndicator);
