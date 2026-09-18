import type { SlateEditor } from '@yoopta/editor';
import { Editor, Element, Point, Range, Transforms } from 'slate';

import { clearCellRange } from '../commands';
import { getCellRect, isMultiCellRect } from '../utils/cellRange';

export function withDelete(slate: SlateEditor): SlateEditor {
  const { deleteBackward, deleteFragment } = slate;

  // Deleting a selection that spans cells empties those cells instead of
  // merging them into one, which would break the table's rows and columns
  slate.deleteFragment = (options) => {
    const rect = getCellRect(slate);
    if (isMultiCellRect(rect)) {
      clearCellRange(slate, rect);
      return;
    }
    deleteFragment(options);
  };

  slate.deleteBackward = (unit) => {
    const { selection } = slate;

    if (!selection || Range.isExpanded(selection)) {
      return deleteBackward(unit);
    }

    const [td] = Editor.nodes(slate, {
      match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-data-cell',
      at: selection,
    });

    const before = Editor.before(slate, selection, { unit });
    const [tdBefore] = before
      ? Editor.nodes(slate, {
          match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-data-cell',
          at: before,
        })
      : [undefined];

    if (!td && !tdBefore) {
      return deleteBackward(unit);
    }

    if (!td && tdBefore && before) {
      return Transforms.select(slate, before);
    }

    const [, tdPath] = td;
    const start = Editor.start(slate, tdPath);

    if (Point.equals(selection.anchor, start)) {
      return;
    }

    deleteBackward(unit);
  };

  return slate;
}
