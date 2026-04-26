import type { SlateElement } from '@yoopta/editor';

export type ScribbleTool = 'pen' | 'pencil' | 'gel' | 'marker' | 'eraser';
export type ScribblePenFlow = 'ballpoint' | 'ink' | 'fountain';
export type ScribblePencilTexture = 'hb' | '2b' | '4b';
export type ScribbleStrokeVariant = ScribblePenFlow | ScribblePencilTexture;
export type ScribbleBackgroundPattern =
  | 'plain'
  | 'lines-tight'
  | 'lines-regular'
  | 'lines-wide'
  | 'dots-tight'
  | 'dots-regular'
  | 'dots-wide'
  | 'grid-tight'
  | 'grid-regular'
  | 'grid-wide';

export interface ScribblePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface ScribbleStroke {
  id: string;
  tool: ScribbleTool;
  color: string;
  width: number;
  points: ScribblePoint[];
  variant?: ScribbleStrokeVariant;
  opacity?: number;
  svgPath?: string;
}

export interface ScribbleToolSettings {
  pen: { color: string; width: number; flow: ScribblePenFlow };
  pencil: { color: string; width: number; texture: ScribblePencilTexture };
  gel: { color: string; width: number };
  marker: { color: string; width: number };
  eraser: { width: number };
}

export interface ScribbleSharedToolState {
  activeTool: ScribbleTool;
  settings: ScribbleToolSettings;
}

export interface ScribbleSnapshot {
  version: 1;
  background: string;
  pageHeight: number;
  strokes: ScribbleStroke[];
}

export interface ScribbleElementProps {
  nodeType: 'void';
  svgFileName: string | null;
  strokeCount: number;
  lastEdited: string | null;
  pageHeight: number;
  background: string;
  backgroundPattern: ScribbleBackgroundPattern;
  preferredTool: ScribbleTool;
}

export type ScribbleBlockElement = SlateElement<'scribble', ScribbleElementProps>;

export type ScribbleElementMap = {
  scribble: ScribbleBlockElement;
};

export const DEFAULT_SCRIBBLE_PAGE_HEIGHT = 1123;
export const DEFAULT_SCRIBBLE_BACKGROUND = '#fffdf8';
export const EINK_SCRIBBLE_BACKGROUND = '#ffffff';

export const DEFAULT_SCRIBBLE_PROPS: ScribbleElementProps = {
  nodeType: 'void',
  svgFileName: null,
  strokeCount: 0,
  lastEdited: null,
  pageHeight: DEFAULT_SCRIBBLE_PAGE_HEIGHT,
  background: DEFAULT_SCRIBBLE_BACKGROUND,
  backgroundPattern: 'plain',
  preferredTool: 'pen',
};