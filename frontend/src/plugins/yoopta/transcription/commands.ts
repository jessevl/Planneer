/**
 * @file commands.ts
 * @description Commands for the Transcription plugin
 */
import { Blocks, Elements, buildBlockData, generateId, type YooEditor } from '@yoopta/editor';
import { TRANSCRIPTION_ELEMENTS, DEFAULT_TRANSCRIPTION_PROPS, type TranscriptionProps } from './types';

export const TranscriptionCommands = {
  /**
   * Insert a new transcription block
   */
  insertTranscription: (editor: YooEditor, props?: Partial<TranscriptionProps>) => {
    const blockId = generateId();
    const elementId = generateId();
    
    const blockData = buildBlockData({
      id: blockId,
      type: 'Transcription',
      value: [
        {
          id: elementId,
          type: TRANSCRIPTION_ELEMENTS.Transcription,
          children: [{ text: '' }],
          props: {
            ...DEFAULT_TRANSCRIPTION_PROPS,
            ...props,
            createdAt: new Date().toISOString(),
          },
        },
      ],
    });
    
    Blocks.insertBlock(editor, blockId, { 
      blockData,
      focus: true,
    });
    
    return blockId;
  },
  
  /**
   * Update transcription content
   */
  updateTranscription: (
    editor: YooEditor, 
    blockId: string, 
    props: Partial<TranscriptionProps>
  ) => {
    Elements.updateElement(editor, {
      blockId,
      type: TRANSCRIPTION_ELEMENTS.Transcription,
      props,
    });
  },
};
