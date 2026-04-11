/**
 * @file VerticalDropIndicator.tsx
 * @description Custom vertical drop indicator for block DnD that replaces
 *              Yoopta's built-in indicator (which often shows at the wrong position).
 *              Tracks pointer position during drag and renders a blue line
 *              at the nearest gap between blocks.
 * @app PAGES - Used inside ForceUpdateBlockDndContext in PageEditor
 *
 * Used by:
 * - PageEditor.tsx (rendered inside ForceUpdateBlockDndContext)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useBlockDndContext } from '@yoopta/ui/block-dnd';

interface IndicatorPosition {
  top: number;
  left: number;
  width: number;
}

interface Gap {
  y: number;
  left: number;
  width: number;
}

const VerticalDropIndicator: React.FC = React.memo(() => {
  const { isDragging, draggedIds } = useBlockDndContext();
  const [position, setPosition] = useState<IndicatorPosition | null>(null);
  const rafRef = useRef<number>(0);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        // Don't show when a column drop is active (SideDropIndicator handles that)
        const editorContainer = document.querySelector<HTMLElement>('.yoopta-editor-container');
        if (editorContainer?.classList.contains('column-drop-active')) {
          setPosition(null);
          return;
        }

        const pointerY = e.clientY;

        // Collect all visible block wrappers, skipping dragged ones
        const draggedSet = new Set(draggedIds.map(String));
        const allBlocks = Array.from(
          document.querySelectorAll<HTMLElement>('[data-yoopta-block]'),
        );
        const blocks = allBlocks.filter(
          (el) => !draggedSet.has(el.dataset.yooptaBlock ?? ''),
        );

        if (blocks.length === 0) {
          setPosition(null);
          return;
        }

        // Get bounding rects
        const rects = blocks.map((el) => el.getBoundingClientRect());

        // Find the editor container for horizontal bounds
        const containerRect = editorContainer?.getBoundingClientRect();

        // Build candidate gap positions (between consecutive blocks + top of first + bottom of last)
        const gaps: Gap[] = [];

        const left = containerRect?.left ?? rects[0].left;
        const width = containerRect?.width ?? rects[0].width;

        // Gap above the first block
        gaps.push({ y: rects[0].top, left, width });

        // Gaps between consecutive blocks
        for (let i = 0; i < rects.length - 1; i++) {
          const gap: Gap = {
            y: (rects[i].bottom + rects[i + 1].top) / 2,
            left,
            width,
          };
          gaps.push(gap);
        }

        // Gap below the last block
        gaps.push({ y: rects[rects.length - 1].bottom, left, width });

        // Find closest gap to pointer
        let closestGap = gaps[0];
        let minDist = Math.abs(pointerY - gaps[0].y);
        for (let i = 1; i < gaps.length; i++) {
          const dist = Math.abs(pointerY - gaps[i].y);
          if (dist < minDist) {
            minDist = dist;
            closestGap = gaps[i];
          }
        }

        setPosition({
          top: closestGap.y,
          left: closestGap.left,
          width: closestGap.width,
        });
      });
    },
    [draggedIds],
  );

  useEffect(() => {
    if (!isDragging) {
      setPosition(null);
      return;
    }

    document.addEventListener('pointermove', handlePointerMove);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging, handlePointerMove]);

  if (!position) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: position.top - 1.5,
        left: position.left,
        width: position.width,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'var(--color-interactive-accent, #3b82f6)',
        opacity: 0.85,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {/* Left dot */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: -4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'inherit',
          transform: 'translateY(-50%)',
        }}
      />
      {/* Right dot */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: -4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'inherit',
          transform: 'translateY(-50%)',
        }}
      />
    </div>
  );
});
VerticalDropIndicator.displayName = 'VerticalDropIndicator';

export default VerticalDropIndicator;
