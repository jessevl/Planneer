/**
 * @file EditorFloatingBlockActions.tsx
 * @description Floating block actions (plus button, drag handle with block options)
 *   for the Yoopta editor v6. Follows the stock v6 pattern exactly:
 *   - Plus button: inserts a new paragraph block below
 *   - Drag handle: click opens BlockOptions (Duplicate, Copy Link, Delete)
 *   - Drag handle: drag to reorder blocks via BlockDndContext
 *
 * Block-specific options (code language, callout theme, etc.) are NOT in this menu.
 * Those are handled by local plugin element renders.
 *
 * @app PAGES - Used inside PageEditor as a child of YooptaEditor
 *
 * Used by:
 * - PageEditor (as a YooptaEditor child, inside BlockDndContext)
 */
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Blocks, useYooptaEditor } from '@yoopta/editor';
import { FloatingBlockActions } from '@yoopta/ui/floating-block-actions';
import { BlockOptions, useBlockActions } from '@yoopta/ui/block-options';
import { DragHandle } from '@yoopta/ui/block-dnd';
import { PlusIcon, GripVertical, ChevronRight } from 'lucide-react';
import type { ColumnsMetadata } from '@/hooks/useEditorRowLayout';
import { insertBlockWithFocus } from '@/plugins/yoopta/utils/insertBlockWithFocus';
import { BLOCK_OPTIONS } from '@/plugins/yoopta/shared/menu/actionMenuData';

// Block types that support content-preserving "Turn Into" conversion
const TURN_INTO_TYPES = new Set([
  'Paragraph', 'HeadingOne', 'HeadingTwo', 'HeadingThree',
  'BulletedList', 'NumberedList', 'TodoList', 'Blockquote', 'Callout',
]);

// ============================================================================
// BLOCK OPTIONS (opened by clicking the drag handle)
// ============================================================================

interface EditorBlockOptionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockId: string | null;
  anchor: HTMLButtonElement | null;
}

const EditorBlockOptions: React.FC<EditorBlockOptionsProps> = ({
  open,
  onOpenChange,
  blockId,
  anchor,
}) => {
  const editor = useYooptaEditor();
  const { duplicateBlock, copyBlockLink, deleteBlock } = useBlockActions();
  const [showTurnInto, setShowTurnInto] = useState(false);

  // Reset submenu state when dropdown closes
  useEffect(() => {
    if (!open) setShowTurnInto(false);
  }, [open]);

  // Current block type for the targeted block
  const currentBlockType = useMemo(() => {
    if (!blockId) return null;
    const block = Blocks.getBlock(editor, { id: blockId });
    return block?.type ?? null;
  }, [editor, blockId]);

  // Filter "Turn Into" options: only text-compatible types, excluding current type
  const turnIntoOptions = useMemo(() => {
    return BLOCK_OPTIONS.filter(
      (opt) => TURN_INTO_TYPES.has(opt.type) && opt.type !== currentBlockType,
    );
  }, [currentBlockType]);

  const onDuplicate = () => {
    if (!blockId) return;
    duplicateBlock(blockId);
    onOpenChange(false);
  };

  const onCopyLink = () => {
    if (!blockId) return;
    copyBlockLink(blockId);
    onOpenChange(false);
  };

  const onDelete = () => {
    if (!blockId) return;
    deleteBlock(blockId);
    onOpenChange(false);
  };

  const onTurnInto = (type: string) => {
    if (!blockId) return;
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block) return;
    editor.setPath({ current: block.meta.order });
    editor.toggleBlock(type, { focus: true });
    onOpenChange(false);
  };

  // "Turn Into" submenu view
  if (showTurnInto) {
    return (
      <BlockOptions open={open} onOpenChange={onOpenChange} anchor={anchor}>
        <BlockOptions.Content side="right" align="start">
          <BlockOptions.Group>
            <BlockOptions.Item
              onSelect={() => setShowTurnInto(false)}
              icon={<ChevronRight className="w-4 h-4 rotate-180" />}
              keepOpen
            >
              Back
            </BlockOptions.Item>
          </BlockOptions.Group>
          <BlockOptions.Separator />
          <BlockOptions.Group>
            {turnIntoOptions.map((opt) => (
              <BlockOptions.Item
                key={opt.type}
                onSelect={() => onTurnInto(opt.type)}
                icon={
                  <span className="flex items-center justify-center w-5 h-5">
                    {opt.icon}
                  </span>
                }
              >
                {opt.title}
              </BlockOptions.Item>
            ))}
          </BlockOptions.Group>
        </BlockOptions.Content>
      </BlockOptions>
    );
  }

  // Default actions view
  return (
    <BlockOptions open={open} onOpenChange={onOpenChange} anchor={anchor}>
      <BlockOptions.Content side="right" align="end">
        <BlockOptions.Group>
          {currentBlockType && TURN_INTO_TYPES.has(currentBlockType) && (
            <BlockOptions.Item
              onSelect={() => setShowTurnInto(true)}
              icon={<ChevronRight className="w-4 h-4" />}
              keepOpen
            >
              Turn into
            </BlockOptions.Item>
          )}
          <BlockOptions.Item onSelect={onDuplicate}>Duplicate</BlockOptions.Item>
          <BlockOptions.Item onSelect={onCopyLink}>Copy link to block</BlockOptions.Item>
          <BlockOptions.Separator />
          <BlockOptions.Item variant="destructive" onSelect={onDelete}>
            Delete
          </BlockOptions.Item>
        </BlockOptions.Group>
      </BlockOptions.Content>
    </BlockOptions>
  );
};

// ============================================================================
// COLUMN-AWARE POSITION CORRECTION
// ============================================================================

/**
 * FloatingBlockActions detects blocks by Y position using `data-yoopta-block`
 * wrappers. For column blocks the anchor wrapper spans the whole group, so the
 * library always provides the anchor's blockId / position, not the individual
 * column block the user is hovering.
 *
 * This hook ONLY intervenes when the cursor is over a block that lives inside
 * a column group. It applies a CSS-class-based offset to the floating element
 * so there is no conflict with the library's React-managed inline styles.
 * Returns the corrected blockId. For non-column blocks the hook does nothing
 * and returns null, letting the library handle positioning entirely.
 *
 * How it works:
 * The library always detects the first [data-yoopta-block] matching the cursor
 * Y — for column groups this is the leftmost column's block. It positions the
 * floating element at that block's rect. We compute the OFFSET from that block
 * to the actual column block under the cursor, then apply the offset as
 * margin-left / margin-top via a CSS class + custom properties. This avoids
 * direct manipulation of top/left/transform which fights React's style state.
 * On exit, removing the class instantly removes the offset — the library's
 * React-managed position (based on the leftmost block) takes over, which
 * matches full-width blocks' position since they share the same left edge.
 */
function useColumnPositionFix(colMetaRef?: React.RefObject<ColumnsMetadata>, frozen = false): string | null {
  const correctedRef = useRef<string | null>(null);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen; // sync on every render without re-running the effect
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!colMetaRef) return;

    let rafId = 0;
    const onMouseMove = (e: MouseEvent) => {
      if (rafId) return;            // already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        onMouseMoveInner(e);
      });
    };

    const onMouseMoveInner = (e: MouseEvent) => {
      // When the block options menu is open, freeze position correction so
      // moving the cursor toward a menu item doesn't reset the column offset,
      // which would move the anchor and reposition the open menu.
      if (frozenRef.current) return;
      const floatingEl = document.querySelector<HTMLElement>(
        '.yoopta-ui-floating-block-actions',
      );
      if (!floatingEl) return;

      // If the floating element is hidden by the library, reset our state
      if (floatingEl.style.opacity !== '1') {
        if (correctedRef.current !== null) {
          correctedRef.current = null;
          floatingEl.classList.remove('column-corrected');
        }
        return;
      }

      // If the cursor is over the floating element itself (e.g. reaching
      // for the drag handle), keep the current correction stable.
      const floatingRect = floatingEl.getBoundingClientRect();
      if (
        correctedRef.current !== null &&
        e.clientX >= floatingRect.left &&
        e.clientX <= floatingRect.right &&
        e.clientY >= floatingRect.top &&
        e.clientY <= floatingRect.bottom
      ) {
        return;
      }

      // Search ONLY inside column group containers — not all blocks.
      // This avoids interfering with full-width block positioning at all.
      const meta = colMetaRef.current;
      let foundEl: HTMLElement | null = null;
      let foundId: string | null = null;

      const containers = document.querySelectorAll<HTMLElement>(
        '[data-column-group-container]',
      );
      for (const container of containers) {
        const containerRect = container.getBoundingClientRect();
        // Quick bounds check — skip containers the cursor isn't near
        if (
          e.clientY < containerRect.top ||
          e.clientY > containerRect.bottom ||
          e.clientX < containerRect.left ||
          e.clientX > containerRect.right
        ) continue;

        const colBlocks = container.querySelectorAll<HTMLElement>(
          '[data-column-block-id]',
        );
        for (const el of colBlocks) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            const id = el.getAttribute('data-column-block-id');
            if (id && meta.blocks[id]) {
              foundEl = el;
              foundId = id;
            }
            break;
          }
        }
        if (foundEl) break;
      }

      if (foundEl && foundId) {
        // The library positions based on the first [data-yoopta-block] at this
        // Y (the leftmost column block). Find that reference block so we can
        // compute the offset from the library's position to the actual target.
        const blockEls = document.querySelectorAll<HTMLElement>('[data-yoopta-block]');
        let libraryBlock: HTMLElement | null = null;
        for (const blk of blockEls) {
          const r = blk.getBoundingClientRect();
          if (r.height === 0) continue;
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            libraryBlock = blk;
            break;
          }
        }

        if (libraryBlock) {
          const targetRect = foundEl.getBoundingClientRect();
          const libRect = libraryBlock.getBoundingClientRect();

          // Compute margin-top offset: account for element marginTop
          // (the library uses [data-element-type] marginTop on its detected block)
          const targetElType = foundEl.querySelector('[data-element-type]');
          const targetMt = targetElType
            ? parseFloat(getComputedStyle(targetElType).marginTop) || 0
            : 0;
          const libElType = libraryBlock.querySelector('[data-element-type]');
          const libMt = libElType
            ? parseFloat(getComputedStyle(libElType).marginTop) || 0
            : 0;

          const offsetX = targetRect.left - libRect.left;
          const offsetY = (targetRect.top + targetMt) - (libRect.top + libMt);

          floatingEl.classList.add('column-corrected');
          floatingEl.style.setProperty('--col-offset-x', `${offsetX}px`);
          floatingEl.style.setProperty('--col-offset-y', `${offsetY}px`);
        }

        if (correctedRef.current !== foundId) {
          correctedRef.current = foundId;
          forceUpdate();
        }
      } else if (correctedRef.current !== null) {
        // Check if cursor is still inside a container (e.g. resize handle gap
        // between columns).  If so, stay stable — don't jump away.
        let stillInContainer = false;
        for (const container of containers) {
          const r = container.getBoundingClientRect();
          if (
            e.clientX >= r.left && e.clientX <= r.right &&
            e.clientY >= r.top && e.clientY <= r.bottom
          ) {
            stillInContainer = true;
            break;
          }
        }
        if (stillInContainer) return;

        // Leaving column area — remove the CSS correction class.
        // The library's React-managed position takes over immediately.
        correctedRef.current = null;
        floatingEl.classList.remove('column-corrected');
        floatingEl.style.removeProperty('--col-offset-x');
        floatingEl.style.removeProperty('--col-offset-y');
        forceUpdate();
      }
      // If correctedRef is already null and we're not in a column,
      // do nothing — the library owns positioning.
    };

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [colMetaRef]);

  return correctedRef.current;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface EditorFloatingBlockActionsProps {
  colMetaRef?: React.RefObject<ColumnsMetadata>;
}

const EditorFloatingBlockActions: React.FC<EditorFloatingBlockActionsProps> = ({ colMetaRef }) => {
  const editor = useYooptaEditor();
  const dragHandleRef = useRef<HTMLButtonElement>(null);
  const [blockOptionsOpen, setBlockOptionsOpen] = useState(false);

  // Fix FloatingBlockActions position and blockId for column blocks.
  // Frozen when the block options menu is open — prevents the correction from
  // resetting while the user moves their cursor toward a menu option.
  const correctedBlockId = useColumnPositionFix(colMetaRef, blockOptionsOpen);

  const onPlusClick = (blockId: string | null) => {
    if (!blockId) return;
    const floatingBlock = Blocks.getBlock(editor, { id: blockId });
    if (!floatingBlock) return;
    const nextOrder = floatingBlock.meta.order + 1;
    insertBlockWithFocus(editor, 'Paragraph', { order: nextOrder });
  };

  const onDragClick = (blockId: string | null) => {
    if (!blockId) return;
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block) return;
    editor.setPath({ current: block.meta.order });
    setBlockOptionsOpen(true);
  };

  return (
    <FloatingBlockActions frozen={blockOptionsOpen} style={{ zIndex: 9999 }}>
      {({ blockId: libraryBlockId }) => {
        const blockId = correctedBlockId ?? libraryBlockId;
        return (
          <>
            <FloatingBlockActions.Button
              onClick={() => onPlusClick(blockId)}
              title="Add block"
            >
              <PlusIcon />
            </FloatingBlockActions.Button>
            <DragHandle blockId={blockId} ref={dragHandleRef} asChild>
              <FloatingBlockActions.Button
                onClick={() => onDragClick(blockId)}
                title="Drag to reorder"
              >
                <GripVertical />
              </FloatingBlockActions.Button>
            </DragHandle>
            <EditorBlockOptions
              open={blockOptionsOpen}
              onOpenChange={setBlockOptionsOpen}
              blockId={blockId}
              anchor={dragHandleRef.current}
            />
          </>
        );
      }}
    </FloatingBlockActions>
  );
};

export default EditorFloatingBlockActions;
