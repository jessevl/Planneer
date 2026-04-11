/**
 * @file types.ts
 * @description Type definitions for the Transcription plugin
 */
import type { SlateElement } from '@yoopta/editor';

export type TranscriptionElementKeys = 'transcription';

export interface TranscriptionChunk {
  text: string;
  timestamp: [number, number | null];
}

export interface TranscriptionProps {
  /** The full transcribed text */
  transcript: string;
  /** Individual chunks with timestamps */
  chunks: TranscriptionChunk[];
  /** When the transcription was created */
  createdAt: string;
  /** Duration of the recording in seconds */
  duration?: number;
}

export type TranscriptionElement = SlateElement<'transcription', TranscriptionProps>;

export type TranscriptionElementMap = {
  'transcription': TranscriptionElement;
};

export const TRANSCRIPTION_ELEMENTS = {
  Transcription: 'transcription',
} as const;

export const DEFAULT_TRANSCRIPTION_PROPS: TranscriptionProps = {
  transcript: '',
  chunks: [],
  createdAt: new Date().toISOString(),
  duration: undefined,
};
