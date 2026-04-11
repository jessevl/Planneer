import { useState, type CSSProperties } from 'react';
import type { SlateElement, YooEditor } from '@yoopta/editor';
import { Elements } from '@yoopta/editor';
import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
import {
  CornerDownRight,
  CornerUpRight,
  MoveDownIcon,
  MoveUpIcon,
  TrashIcon,
  Paintbrush,
} from 'lucide-react';
import { Editor, Element } from 'slate';

import { AdvancedTableCommands } from '../commands';
import { ColorPicker } from './ColorPicker';
import type { AdvancedTableRowElement, BackgroundColor } from '../types';
import { Popover } from '@/components/ui';
import { PluginMenuItem, PluginMenuSeparator } from '@/plugins/yoopta/shared/PluginMenuItems';

const { Portal } = UI;

export type Props = {
  isOpen: boolean;
  onClose: () => void;
  refs: any;
  style: CSSProperties;
  children?: React.ReactNode;
  actions?: ['delete', 'duplicate', 'turnInto', 'copy'] | null;
} & {
  editor: YooEditor;
  blockId: string;
  tdElement: SlateElement;
};

const AdvancedTableRowOptions = ({ editor, blockId, onClose, tdElement, ...props }: Props) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const slate = editor.blockEditorsMap[blockId];

  // Get row index - use selection as fallback if path lookup fails
  const tdPath = Elements.getElementPath(editor, { blockId, element: tdElement }) ?? slate.selection;
  const rowEntry = tdPath ? Editor.above(slate, {
    at: tdPath,
    match: (n) => Element.isElement(n) && (n as any).type === 'table-row',
  }) : null;
  
  const trElement = rowEntry ? rowEntry[0] as unknown as AdvancedTableRowElement : null;
  const rowPath = rowEntry ? rowEntry[1] : null;
  const rowIndex = rowPath?.[rowPath.length - 1] || 0;

  // Get current row background color
  const currentRowColor = trElement?.props?.backgroundColor || null;

  const insertRowBefore = () => {
    if (!rowPath) return;
    AdvancedTableCommands.insertTableRow(editor, blockId, { insertMode: 'before', path: rowPath, select: true });
    onClose();
  };

  const insertRowAfter = () => {
    if (!rowPath) return;
    AdvancedTableCommands.insertTableRow(editor, blockId, { insertMode: 'after', path: rowPath, select: true });
    onClose();
  };

  const deleteTableRow = () => {
    if (!rowPath) return;

    AdvancedTableCommands.deleteTableRow(editor, blockId, { path: rowPath });
    onClose();
  };

  const moveRowDown = () => {
    if (!rowPath) return onClose();

    const nextElementEntry = Editor.next(slate, {
      at: rowPath,
      match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-row',
    });

    if (!nextElementEntry) return onClose();
    AdvancedTableCommands.moveTableRow(editor, blockId, { from: rowPath, to: nextElementEntry[1] });
    onClose();
  };

  const moveRowUp = () => {
    if (!rowPath) return onClose();

    const prevElementEntry = Editor.previous(slate, {
      at: rowPath,
      match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-row',
    });

    if (!prevElementEntry) return onClose();
    AdvancedTableCommands.moveTableRow(editor, blockId, { from: rowPath, to: prevElementEntry[1] });
    onClose();
  };

  const handleColorSelect = (color: BackgroundColor) => {
    AdvancedTableCommands.setRowBackgroundColor(editor, blockId, rowIndex, color);
    setShowColorPicker(false);
    onClose();
  };

  if (!props.isOpen) return null;

  return (
    <Portal id={`row-options-${blockId}`}>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      {/* Menu */}
      <Popover
        ref={props.refs.setFloating}
        style={{ ...props.style, zIndex: 9999 }}
        width="auto"
        padding="sm"
        className="min-w-[180px]"
      >
        {/* Insert options */}
        <PluginMenuItem onClick={insertRowBefore}>
          <CornerUpRight className="w-4 h-4 shrink-0" />
          Insert above
        </PluginMenuItem>
        <PluginMenuItem onClick={insertRowAfter}>
          <CornerDownRight className="w-4 h-4 shrink-0" />
          Insert below
        </PluginMenuItem>

        <PluginMenuSeparator />

        {/* Move options */}
        <PluginMenuItem onClick={moveRowUp}>
          <MoveUpIcon className="w-4 h-4 shrink-0" />
          Move up
        </PluginMenuItem>
        <PluginMenuItem onClick={moveRowDown}>
          <MoveDownIcon className="w-4 h-4 shrink-0" />
          Move down
        </PluginMenuItem>

        <PluginMenuSeparator />

        {/* Background color */}
        <PluginMenuItem onClick={() => setShowColorPicker(!showColorPicker)}>
          <Paintbrush className="w-4 h-4 shrink-0" />
          Row color
          {currentRowColor && (
            <span
              className="yoopta-advanced-table-color-preview"
              style={{ backgroundColor: currentRowColor }}
            />
          )}
        </PluginMenuItem>

        {showColorPicker && (
          <div className="yoopta-advanced-table-color-picker-container">
            <ColorPicker
              selectedColor={currentRowColor}
              onColorSelect={handleColorSelect}
            />
          </div>
        )}

        <PluginMenuSeparator />

        {/* Delete */}
        <PluginMenuItem onClick={deleteTableRow} destructive>
          <TrashIcon className="w-4 h-4 shrink-0" />
          Delete row
        </PluginMenuItem>
      </Popover>
    </Portal>
  );
};

export { AdvancedTableRowOptions };
