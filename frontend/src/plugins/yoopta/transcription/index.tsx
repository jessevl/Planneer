/**
 * @file index.tsx
 * @description Transcription plugin for Yoopta Editor
 * 
 * Adds voice-to-text transcription using Whisper AI running locally in the browser.
 * 
 * Features:
 * - Record audio from microphone
 * - Transcribe using local Whisper model
 * - Display transcript with timestamps
 * - Copy individual segments or full transcript
 */
import { YooptaPlugin, buildBlockElementsStructure, serializeTextNodes } from '@yoopta/editor';
import { Mic } from 'lucide-react';

import type { TranscriptionElementMap } from './types';
import { TRANSCRIPTION_ELEMENTS, DEFAULT_TRANSCRIPTION_PROPS } from './types';
import { TranscriptionCommands } from './commands';
import { TranscriptionRender } from './TranscriptionRender';

export const TranscriptionPlugin = new YooptaPlugin<TranscriptionElementMap>({
  type: 'Transcription',
  elements: {
    'transcription': {
      asRoot: true,
      render: TranscriptionRender,
      props: DEFAULT_TRANSCRIPTION_PROPS,
    },
  },
  commands: TranscriptionCommands,
  options: {
    display: {
      title: 'Voice Transcription (Alpha)',
      description: 'Record and transcribe speech with AI',
      icon: <Mic size={24} />,
    },
    shortcuts: ['transcribe', 'voice', 'record', 'whisper', 'speech'],
  },
  parsers: {
    html: {
      deserialize: {
        nodeNames: ['BLOCKQUOTE'],
        parse: (el, editor) => {
          // Check if it's a transcription blockquote
          if (el.getAttribute('data-transcription') === 'true') {
            const transcript = el.getAttribute('data-transcript') || el.textContent || '';
            
            const elementsStructure = buildBlockElementsStructure(editor, 'Transcription', {
              [TRANSCRIPTION_ELEMENTS.Transcription]: '',
            });
            
            // Update the element with transcript data
            if (Array.isArray(elementsStructure) && elementsStructure.length > 0) {
              const firstElement = elementsStructure[0] as any;
              if (firstElement) {
                firstElement.props = {
                  ...DEFAULT_TRANSCRIPTION_PROPS,
                  transcript,
                };
              }
            }
            
            return elementsStructure;
          }
        },
      },
      serialize: (element, text, blockMeta) => {
        const { align = 'left', depth = 0 } = blockMeta || {};
        const props = (element as any).props || {};
        const transcript = props.transcript || '';
        
        return `<blockquote 
          data-transcription="true" 
          data-transcript="${transcript}"
          data-meta-align="${align}" 
          data-meta-depth="${depth}"
          style="border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0;"
        >
          <strong>🎤 Voice Transcription</strong><br/>
          ${transcript}
        </blockquote>`;
      },
    },
  },
});

// Re-export commands and types
export { TranscriptionCommands } from './commands';
export type { 
  TranscriptionElementMap, 
  TranscriptionProps, 
  TranscriptionChunk,
  TranscriptionElement,
} from './types';
