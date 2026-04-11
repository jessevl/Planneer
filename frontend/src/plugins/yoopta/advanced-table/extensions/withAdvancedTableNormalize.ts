import type { SlateEditor, YooEditor } from '@yoopta/editor';
import { generateId } from '@yoopta/editor';
import { Element, Node, Transforms } from 'slate';

export function withAdvancedTableNormalize(slate: SlateEditor, editor: YooEditor): SlateEditor {
  const { normalizeNode } = slate;

  slate.normalizeNode = (entry, options) => {
    const [node, path] = entry;

    if (Element.isElement(node) && (node as unknown as { type: string }).type === 'table-data-cell') {
      for (const [child, childPath] of Node.children(slate, path)) {
        if (Element.isElement(child) && (child as unknown as { type: string }).type === 'table') {
          Transforms.unwrapNodes(slate, { at: childPath });
          return;
        }

        if (Element.isElement(child) && (child as unknown as { type: string }).type === 'table-row') {
          Transforms.unwrapNodes(slate, { at: childPath });
          return;
        }

        if (Element.isElement(child) && (child as unknown as { type: string }).type === 'table-data-cell') {
          Transforms.unwrapNodes(slate, { at: childPath });
          return;
        }
      }
    }

    if (Element.isElement(node) && (node as unknown as { type: string }).type === 'table-row') {
      for (const [child, childPath] of Node.children(slate, path)) {
        if (!Element.isElement(child) || (child as unknown as { type: string }).type !== 'table-data-cell') {
          const newCell = {
            id: generateId(),
            type: 'table-data-cell' as const,
            children: [child],
            props: {
              width: 200,
              asHeader: false,
              backgroundColor: null,
            },
          };
          return Transforms.wrapNodes(slate, newCell, { at: childPath });
        }
      }
    }

    normalizeNode(entry, options);
  };

  return slate;
}
