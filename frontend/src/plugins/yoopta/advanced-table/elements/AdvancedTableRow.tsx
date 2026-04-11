import type { PluginElementRenderProps } from '@yoopta/editor';
import { resolveColor } from '@/lib/editorColors';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';

import type { AdvancedTableRowElement } from '../types';

const AdvancedTableRow = ({
  attributes,
  children,
  element,
  blockId,
  HTMLAttributes,
}: PluginElementRenderProps) => {
  const isDark = useIsDarkMode();
  const rowElement = element as unknown as AdvancedTableRowElement;
  const backgroundColor = rowElement?.props?.backgroundColor;

  const { className = '', ...htmlAttrs } = HTMLAttributes || {};

  const resolvedColor = resolveColor(backgroundColor, isDark);
  const style: React.CSSProperties = {};
  
  if (resolvedColor) {
    style.backgroundColor = resolvedColor.bg;
    style.color = resolvedColor.text;
  }

  return (
    <tr
      {...htmlAttrs}
      className={`yoopta-advanced-table-row ${className}`}
      data-element-id={element.id}
      style={style}
      {...attributes}
    >
      {children}
    </tr>
  );
};

export { AdvancedTableRow };
