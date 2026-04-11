/**
 * @file AdvancedTableBlockOptions.tsx
 * @description Block-level options for advanced table blocks.
 *
 * Renders as a small "⋯" trigger button (visible on table-block hover) that
 * opens a portal-based Popover positioned below-end.
 * Uses the same Portal + Popover + PluginMenuItem pattern as
 * AdvancedTableColumnOptions — no Yoopta BlockOptions dependency.
 *
 * @app PAGES - Used by AdvancedTable
 */
import { useRef, useState } from 'react';
import type { YooEditor, YooptaBlockData } from '@yoopta/editor';
import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { Calculator, Check, MoreHorizontal, Rows } from 'lucide-react';
import { Popover } from '@/components/ui';

import { AdvancedTableCommands } from '../commands';
import type { AdvancedTableElement } from '../types';
import { PluginMenuItem, PluginMenuSeparator } from '@/plugins/yoopta/shared/PluginMenuItems';

const { Portal } = UI;

type Props = {
  editor: YooEditor;
  block: YooptaBlockData;
  table: AdvancedTableElement;
};

const AdvancedTableBlockOptions = ({ editor, block, table }: Props) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-end',
    open,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const tableProps = table.props;
  const isAlternatingRowsEnabled = tableProps?.alternatingRows;
  const isCalculationRowEnabled = tableProps?.showCalculationRow;

  const setTriggerRef = (el: HTMLButtonElement | null) => {
    (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    refs.setReference(el);
  };

  return (
    <>
      <button
        ref={setTriggerRef}
        type="button"
        aria-label="Table options"
        contentEditable={false}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="
          flex items-center justify-center w-7 h-7 rounded
          text-[var(--color-text-tertiary)]
          hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]
          transition-colors
        "
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <Portal id={`table-block-options-${block.id}`}>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />

          <Popover
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 9999 }}
            width="auto"
            padding="sm"
            className="min-w-[200px]"
          >
            <PluginMenuItem
              onClick={() => {
                AdvancedTableCommands.toggleAlternatingRows(editor, block.id);
                // keep menu open so multiple options can be toggled
              }}
              active={isAlternatingRowsEnabled}
            >
              <Rows className="w-4 h-4 shrink-0" />
              <span className="flex-1">Alternating colors</span>
              {isAlternatingRowsEnabled && (
                <Check className="w-4 h-4 shrink-0 text-[var(--color-accent-primary)]" />
              )}
            </PluginMenuItem>

            <PluginMenuSeparator />

            <PluginMenuItem
              onClick={() => {
                AdvancedTableCommands.toggleCalculationRow(editor, block.id);
              }}
              active={isCalculationRowEnabled}
            >
              <Calculator className="w-4 h-4 shrink-0" />
              <span className="flex-1">Calculation row</span>
              {isCalculationRowEnabled && (
                <Check className="w-4 h-4 shrink-0 text-[var(--color-accent-primary)]" />
              )}
            </PluginMenuItem>
          </Popover>
        </Portal>
      )}
    </>
  );
};

export { AdvancedTableBlockOptions };
