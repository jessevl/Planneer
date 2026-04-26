import type { YooEditor, YooptaPathIndex } from '@yoopta/editor';
import { Blocks, buildBlockData, generateId } from '@yoopta/editor';

import {
  DEFAULT_SCRIBBLE_PROPS,
  type ScribbleBlockElement,
  type ScribbleElementProps,
} from './types';

type ScribbleElementOptions = {
  props?: Partial<Omit<ScribbleElementProps, 'nodeType'>>;
};

type InsertScribbleOptions = ScribbleElementOptions & {
  at?: YooptaPathIndex;
  focus?: boolean;
};

export type ScribbleCommandsType = {
  buildScribbleElement: (editor: YooEditor, options?: Partial<ScribbleElementOptions>) => ScribbleBlockElement;
  insertScribble: (editor: YooEditor, options?: Partial<InsertScribbleOptions>) => string;
  deleteScribble: (editor: YooEditor, blockId: string) => void;
};

export const ScribbleCommands: ScribbleCommandsType = {
  buildScribbleElement: (_editor, options = {}) => {
    const props = {
      ...DEFAULT_SCRIBBLE_PROPS,
      ...options.props,
      nodeType: 'void' as const,
    };

    return {
      id: generateId(),
      type: 'scribble' as const,
      children: [{ text: '' }],
      props,
    };
  },

  insertScribble: (editor, options = {}) => {
    const blockId = generateId();
    const scribble = ScribbleCommands.buildScribbleElement(editor, options);
    const block = buildBlockData({
      id: blockId,
      value: [scribble],
      type: 'Scribble',
      meta: { align: 'center', depth: 0, order: 0 },
    });

    Blocks.insertBlock(editor, block.type, {
      at: options.at,
      focus: options.focus,
      blockData: block,
    });

    return blockId;
  },

  deleteScribble: (editor, blockId) => {
    Blocks.deleteBlock(editor, { blockId });
  },
};