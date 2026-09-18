import type { SlateEditor } from '@yoopta/editor';
import { EDITOR_TO_FORCE_RENDER } from 'slate-dom';

/**
 * Keeps row and column removals from crashing the editor.
 *
 * Yoopta turns every Slate operation into a React state update straight away,
 * while slate-react only updates once Slate flushes its changes a moment
 * later. React can render the Yoopta update first: elements re-render from
 * the new document while slate-react's node → path records are still old, so
 * cells of a removed row are still mounted and resolve to paths that no longer
 * exist. slate-react's own hooks then throw ("Cannot find a descendant at
 * path"), e.g. when deleting the last row or undoing an added row.
 *
 * Asking slate-react's editable to re-render as soon as a row or cell is
 * removed puts both updates in the same React render. The table re-renders
 * from the new document top-down, so the removed row unmounts before anything
 * in it renders.
 */
export function withStableRemovals(slate: SlateEditor): SlateEditor {
  const { apply } = slate;

  slate.apply = (op) => {
    apply(op);

    // Rows are at [table, row], cells at [table, row, cell]
    if (op.type === 'remove_node' && (op.path.length === 2 || op.path.length === 3)) {
      EDITOR_TO_FORCE_RENDER.get(slate as any)?.();
    }
  };

  return slate;
}
