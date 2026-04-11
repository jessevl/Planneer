import type { PluginEventHandlerOptions, SlateEditor, YooEditor } from '@yoopta/editor';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Editor, Element, Node, Path, Range, Text, Transforms } from 'slate';

import { AdvancedTableCommands } from '../commands';
import { EDITOR_TO_SELECTION } from '../utils/weakMaps';

export function onKeyDown(
  editor: YooEditor,
  slate: SlateEditor,
  { hotkeys, currentBlock }: PluginEventHandlerOptions
) {
  return (event: ReactKeyboardEvent) => {
    if (!slate.selection) return;

    const dataCellEntry = Editor.above(slate, {
      match: (n) => Element.isElement(n) && (n as any).type === 'table-data-cell',
    });

    if (dataCellEntry && event.key === 'Tab') {
      const [, cellPath] = dataCellEntry;
      const rowPath = Path.parent(cellPath);
      const colIndex = cellPath[cellPath.length - 1];

      // Requested UX: Shift+Tab inserts a new line in the same cell.
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        slate.insertText('\n');
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      // Try next cell in the same row.
      try {
        const nextCellPath = Path.next(cellPath);
        Editor.node(slate, nextCellPath);
        Transforms.select(slate, Editor.start(slate, nextCellPath));
        return;
      } catch {
        // No-op: continue to next row handling.
      }

      // Try first/parallel cell in next row.
      try {
        const nextRowPath = Path.next(rowPath);
        const targetPath = nextRowPath.concat(colIndex);
        Editor.node(slate, targetPath);
        Transforms.select(slate, Editor.start(slate, targetPath));
        return;
      } catch {
        // No-op: create new row below.
      }

      // At table end: create a new row and focus same column in that row.
      const insertPath = Path.next(rowPath);
      AdvancedTableCommands.insertTableRow(editor, currentBlock.id, {
        path: rowPath,
        insertMode: 'after',
        select: false,
      });

      setTimeout(() => {
        try {
          const targetPath = insertPath.concat(colIndex);
          Transforms.select(slate, Editor.start(slate, targetPath));
        } catch {
          try {
            Transforms.select(slate, Editor.start(slate, insertPath));
          } catch {
            // no-op
          }
        }
      }, 0);
      return;
    }

    if (hotkeys.isBackspace(event)) {
      const parentPath = Path.parent(slate.selection.anchor.path);
      const isStart = Editor.isStart(slate, slate.selection.anchor, parentPath);

      const elementEntries = EDITOR_TO_SELECTION.get(slate);
      if (elementEntries) {
        event.preventDefault();

        Editor.withoutNormalizing(slate, () => {
          // just remove text in selected nodes
          for (const [, path] of elementEntries) {
            for (const [childNode, childPath] of Node.children(slate, path)) {
              if (Text.isText(childNode)) {
                const textLength = Node.string(childNode).length;
                if (textLength > 0) {
                  Transforms.delete(slate, {
                    at: {
                      anchor: { path: childPath, offset: 0 },
                      focus: { path: childPath, offset: textLength },
                    },
                  });
                }
              }
            }
          }

          Transforms.select(slate, { path: elementEntries[0][1].concat(0), offset: 0 });
        });
        return;
      }

      if (isStart && Range.isCollapsed(slate.selection)) {
        event.preventDefault();
        return;
      }
    }

    // add new row before current row
    if (hotkeys.isCmdShiftEnter(event)) {
      event.preventDefault();
      AdvancedTableCommands.insertTableRow(editor, currentBlock.id, { select: true, insertMode: 'before' });
      return;
    }

    // add new row after current row
    if (hotkeys.isCmdEnter(event)) {
      event.preventDefault();
      AdvancedTableCommands.insertTableRow(editor, currentBlock.id, { select: true, insertMode: 'after' });
      return;
    }

    if (hotkeys.isCmdShiftRight(event)) {
      event.preventDefault();
      AdvancedTableCommands.insertTableColumn(editor, currentBlock.id, {
        select: true,
        insertMode: 'after',
      });
      return;
    }

    if (hotkeys.isCmdShiftLeft(event)) {
      event.preventDefault();
      AdvancedTableCommands.insertTableColumn(editor, currentBlock.id, {
        select: true,
        insertMode: 'before',
      });
      return;
    }

    if (hotkeys.isCmdShiftDelete(event)) {
      event.preventDefault();
      AdvancedTableCommands.deleteTableRow(editor, currentBlock.id);
      return;
    }

    if (hotkeys.isCmdAltDelete(event)) {
      event.preventDefault();
      AdvancedTableCommands.deleteTableColumn(editor, currentBlock.id);
      return;
    }

    if (hotkeys.isArrowUp(event)) {
      event.preventDefault();

      const dataCellEntry = Editor.above(slate, {
        at: slate.selection.anchor,
        match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-data-cell',
      });

      if (!dataCellEntry) return;
      const [, dataCellpath] = dataCellEntry;

      try {
        const columnIndex = dataCellpath[dataCellpath.length - 1];
        const prevRowPath = Path.previous(dataCellpath.slice(0, -1));
        const prevDataCellPath = prevRowPath.concat(columnIndex);

        // throws error if no node found in the path
        Editor.node(slate, prevDataCellPath);
        Transforms.select(slate, prevDataCellPath);
      } catch {
        // no-op
      }

      return;
    }

    if (hotkeys.isArrowDown(event)) {
      event.preventDefault();

      const dataCellEntry = Editor.above(slate, {
        at: slate.selection.anchor,
        match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-data-cell',
      });

      if (!dataCellEntry) return;
      const [, dataCellpath] = dataCellEntry;

      try {
        const columnIndex = dataCellpath[dataCellpath.length - 1];
        const nextRowPath = Path.next(dataCellpath.slice(0, -1));
        const nextDataCellPath = nextRowPath.concat(columnIndex);

        // throws error if no node found in the path
        Editor.node(slate, nextDataCellPath);
        Transforms.select(slate, nextDataCellPath);
      } catch {
        // no-op
      }

      return;
    }

    if (hotkeys.isEnter(event)) {
      if (!dataCellEntry) return;

      const [node, cellPath] = dataCellEntry;
      if ((node as any).props?.asHeader) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rowPath = Path.parent(cellPath);
      const colIndex = cellPath[cellPath.length - 1];

      // Move to same column in next row if exists.
      try {
        const nextRowPath = Path.next(rowPath);
        const targetPath = nextRowPath.concat(colIndex);
        Editor.node(slate, targetPath);
        Transforms.select(slate, Editor.start(slate, targetPath));
        return;
      } catch {
        // No-op: create row below.
      }

      // No next row -> create one and move to same column.
      const insertPath = Path.next(rowPath);
      AdvancedTableCommands.insertTableRow(editor, currentBlock.id, {
        path: rowPath,
        insertMode: 'after',
        select: false,
      });

      setTimeout(() => {
        try {
          const targetPath = insertPath.concat(colIndex);
          Transforms.select(slate, Editor.start(slate, targetPath));
        } catch {
          try {
            Transforms.select(slate, Editor.start(slate, insertPath));
          } catch {
            // no-op
          }
        }
      }, 0);
      return;
    }

    // if first select then select the whole table
    if (hotkeys.isSelect(event)) {
      const tdElementEntry = Editor.above(slate, {
        match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-data-cell',
      });

      if (tdElementEntry) {
        event.preventDefault();
        const [, tdElementPath] = tdElementEntry;
        const string = Editor.string(slate, tdElementPath);

        if (Range.isExpanded(slate.selection) || string.length === 0) {
          editor.blur();
          editor.setPath({ current: null, selected: [currentBlock.meta.order] });
          return;
        }

        Transforms.select(slate, tdElementPath);
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'h') {
      event.preventDefault();
      AdvancedTableCommands.toggleHeaderRow(editor, currentBlock.id);
    }

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'v') {
      event.preventDefault();
      AdvancedTableCommands.toggleHeaderColumn(editor, currentBlock.id);
    }
  };
}
