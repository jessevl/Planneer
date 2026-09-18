import type { SlateEditor, SlateElement } from '@yoopta/editor';
import { Operation, Range } from 'slate';

import { getCellRect, getCellsInRect, isMultiCellRect } from '../utils/cellRange';
import type { SlateNodeEntry } from '../utils/weakMaps';
import { EDITOR_TO_SELECTION, TABLE_SLATE_TO_SELECTION_SET } from '../utils/weakMaps';

export function withSelection(slate: SlateEditor): SlateEditor {
  const { apply } = slate;

  const clear = () => {
    TABLE_SLATE_TO_SELECTION_SET.delete(slate);
    EDITOR_TO_SELECTION.delete(slate);
  };

  slate.apply = (op) => {
    if (!Operation.isSelectionOperation(op) || !op.newProperties) {
      clear();
      return apply(op);
    }

    const selection = {
      ...slate.selection,
      ...op.newProperties,
    };

    // Selecting across cells selects the whole rectangle between them,
    // matching what copy, cut and delete act on
    const rect = Range.isRange(selection) ? getCellRect(slate, selection) : null;
    if (!isMultiCellRect(rect)) {
      clear();
      return apply(op);
    }

    const selectedSet = new WeakSet<SlateElement>();
    const selected: SlateNodeEntry[] = [];

    for (const row of getCellsInRect(slate, rect)) {
      for (const entry of row) {
        selectedSet.add(entry[0] as unknown as SlateElement);
        selected.push(entry);
      }
    }

    EDITOR_TO_SELECTION.set(slate, selected);
    TABLE_SLATE_TO_SELECTION_SET.set(slate, selectedSet);

    apply(op);
  };

  return slate;
}
