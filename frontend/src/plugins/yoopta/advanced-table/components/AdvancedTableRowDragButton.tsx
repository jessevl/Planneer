import { useState } from 'react';
import { autoUpdate, flip, inline, offset, shift, useFloating } from '@floating-ui/react';
import type { SlateElement, YooEditor } from '@yoopta/editor';
import { Elements } from '@yoopta/editor';
import { Transforms } from 'slate';
import { GripHorizontal } from 'lucide-react';

import { AdvancedTableRowOptions } from './AdvancedTableRowOptions';

type Props = {
  editor: YooEditor;
  blockId: string;
  tdElement: SlateElement;
};

const AdvancedTableRowDragButton = ({ editor, blockId, tdElement }: Props) => {
  const [isTableRowActionsOpen, setIsTableRowActionsOpen] = useState(false);

  const { refs, floatingStyles } = useFloating({
    placement: 'right-start',
    open: isTableRowActionsOpen,
    onOpenChange: setIsTableRowActionsOpen,
    middleware: [inline(), flip(), shift(), offset(10)],
    whileElementsMounted: autoUpdate,
  });

  const onClick = () => {
    if (editor.readOnly) return;

    const slate = editor.blockEditorsMap[blockId];
    const tdElementPath = Elements.getElementPath(editor, { blockId, element: tdElement });
    if (!tdElementPath) return;

    Transforms.select(slate, { path: tdElementPath.concat([0]), offset: 0 });
    setIsTableRowActionsOpen(true);
  };

  const onClose = () => {
    setIsTableRowActionsOpen(false);
  };

  return (
    <>
      <AdvancedTableRowOptions
        refs={refs}
        isOpen={isTableRowActionsOpen}
        onClose={onClose}
        style={floatingStyles}
        editor={editor}
        blockId={blockId}
        tdElement={tdElement}
      />
      <button
        ref={refs.setReference}
        type="button"
        onClick={onClick}
        contentEditable={false}
        className="yoopta-advanced-table-row-button"
        style={isTableRowActionsOpen ? { opacity: 1 } : undefined}
      >
        <GripHorizontal className="yoopta-advanced-table-drag-icon" />
      </button>
    </>
  );
};

export { AdvancedTableRowDragButton };
