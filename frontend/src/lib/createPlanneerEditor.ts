/**
 * @file createPlanneerEditor.ts
 * @description Factory that wraps Yoopta's createYooptaEditor with Planneer-
 *              specific workarounds. Consolidates all monkey-patches in one
 *              place so they are easy to audit when upgrading Yoopta.
 *
 * Workarounds applied:
 *  1. toggleBlock — always passes preserveContent:true so markdown shortcuts
 *     (## , - , etc.) don't wipe block content.
 *  2. moveBlock — suppressed when a column drop is pending (dropPendingRef).
 *  3. isRemoteSlateOp — flag checked by Yoopta's Slate apply interceptor to
 *     bypass the operation wrapper during remote content sync.
 */
import { createYooptaEditor, type YooEditor } from '@yoopta/editor';
import type { DropPending } from '@/components/pages/SideDropIndicator';

export interface PlanneerEditorRefs {
  /** When non-null, moveBlock is suppressed (column drop in progress) */
  dropPendingRef: React.MutableRefObject<DropPending | null>;
  /** When true, Yoopta's Slate interceptor bypasses its operation wrapper */
  isApplyingRemoteRef: React.MutableRefObject<boolean>;
}

export interface PlanneerEditor extends YooEditor {
  /** Original unwrapped moveBlock for use in column handlers */
  originalMoveBlock: YooEditor['moveBlock'];
  /** Original unwrapped toggleBlock — used by slash menu to avoid preserveContent override */
  originalToggleBlock: YooEditor['toggleBlock'];
}

/**
 * Create a Yoopta editor with Planneer workarounds already applied.
 * Returns an augmented editor with `originalMoveBlock` for direct use.
 */
export function createPlanneerEditor(
  opts: Parameters<typeof createYooptaEditor>[0],
  refs: PlanneerEditorRefs,
): PlanneerEditor {
  const editor = createYooptaEditor(opts) as PlanneerEditor;

  // --- Workaround 1: preserveContent on toggleBlock ---
  const originalToggleBlock = editor.toggleBlock.bind(editor);
  editor.originalToggleBlock = originalToggleBlock;
  editor.toggleBlock = (type: string, options: any = {}) => {
    return originalToggleBlock(type, { ...options, preserveContent: true });
  };

  // --- Workaround 2: suppress moveBlock during column drops ---
  const originalMoveBlock = editor.moveBlock.bind(editor);
  editor.originalMoveBlock = originalMoveBlock;
  editor.moveBlock = (blockId: string, path: number | null) => {
    if (refs.dropPendingRef.current) return;
    try {
      originalMoveBlock(blockId, path);
    } catch {
      // Slate selection may reference stale paths after block reorders
    }
  };

  // --- Workaround 3: remote Slate op flag ---
  (editor as any).isRemoteSlateOp = () => refs.isApplyingRemoteRef.current;

  return editor;
}
