/**
 * @file markdownShortcutCommands.ts
 * @description Shared Yoopta markdown shortcut command helpers for PageEditor.
 */
import type { YooEditor } from '@yoopta/editor';
import { Editor as SlateEditor, Range, Transforms } from 'slate';
import { matchBlockMarkdownShortcut } from './blockMarkdownShortcuts';

type InlineMarkdownMark = 'bold' | 'italic' | 'strike' | 'code';

interface InlineMarkdownShortcut {
  pattern: RegExp;
  marks: InlineMarkdownMark[];
}

interface TextNodeLike {
  text?: string;
}

type SlateEditorLike = YooEditor['blockEditorsMap'][string];

export interface CurrentSlateContext {
  blockId: string;
  slateEditor: SlateEditorLike;
}

type ShortcutCapableEditor = Pick<
  YooEditor,
  'blockEditorsMap' | 'getBlock' | 'getEditorValue' | 'path' | 'toggleBlock'
>;

const INLINE_MARKDOWN_SHORTCUTS: InlineMarkdownShortcut[] = [
  { pattern: /(^|\s)(\*\*\*([^*\n]+)\*\*\*)$/, marks: ['bold', 'italic'] },
  { pattern: /(^|\s)(___([^_\n]+)___)$/, marks: ['bold', 'italic'] },
  { pattern: /(^|\s)(\*\*([^*\n]+)\*\*)$/, marks: ['bold'] },
  { pattern: /(^|\s)(__([^_\n]+)__)$/, marks: ['bold'] },
  { pattern: /(^|\s)(\*([^*\n]+)\*)$/, marks: ['italic'] },
  { pattern: /(^|\s)(_([^_\n]+)_)$/, marks: ['italic'] },
  { pattern: /(^|\s)(~~([^~\n]+)~~)$/, marks: ['strike'] },
  { pattern: /(^|\s)(~([^~\n]+)~)$/, marks: ['strike'] },
  { pattern: /(^|\s)(`([^`\n]+)`)$/, marks: ['code'] },
];

function getSelectedTextNode(slateEditor: SlateEditorLike): {
  selection: NonNullable<SlateEditorLike['selection']>;
  textNode: TextNodeLike;
  textBeforeCursor: string;
} | null {
  const selection = slateEditor.selection;
  if (!selection || !Range.isCollapsed(selection)) return null;

  const node = SlateEditor.node(slateEditor, selection.anchor.path);
  const textNode = node[0] as TextNodeLike;
  if (!textNode || typeof textNode.text !== 'string') return null;

  return {
    selection,
    textNode,
    textBeforeCursor: textNode.text.slice(0, selection.anchor.offset),
  };
}

export function getCurrentSlateContext(editor: ShortcutCapableEditor): CurrentSlateContext | null {
  const currentOrder = editor.path.current;
  if (currentOrder === null || currentOrder === undefined) return null;

  const currentBlock = Object.values(editor.getEditorValue()).find(
    (block: any) => block?.meta?.order === currentOrder,
  ) as any;
  if (!currentBlock?.id) return null;

  const slateEditor = editor.blockEditorsMap[currentBlock.id];
  if (!slateEditor) return null;

  return { blockId: currentBlock.id as string, slateEditor };
}

export function applyInlineMarkdownShortcut(
  editor: ShortcutCapableEditor,
  trailingText: string,
): boolean {
  const context = getCurrentSlateContext(editor);
  if (!context) return false;

  const { slateEditor } = context;
  const selectedTextNode = getSelectedTextNode(slateEditor);
  if (!selectedTextNode) return false;

  const { selection, textBeforeCursor } = selectedTextNode;

  for (const shortcut of INLINE_MARKDOWN_SHORTCUTS) {
    const match = textBeforeCursor.match(shortcut.pattern);
    if (!match) continue;

    const matchedToken = match[2];
    const content = match[3];
    if (!matchedToken || !content) continue;

    const startOffset = selection.anchor.offset - matchedToken.length;
    if (startOffset < 0) continue;

    Transforms.select(slateEditor, {
      anchor: { path: selection.anchor.path, offset: startOffset },
      focus: { path: selection.anchor.path, offset: selection.anchor.offset },
    });
    Transforms.delete(slateEditor);

    const formattedLeaf = shortcut.marks.reduce<Record<string, unknown>>(
      (acc, mark) => {
        acc[mark] = true;
        return acc;
      },
      { text: content },
    );
    const nodesToInsert = trailingText
      ? [formattedLeaf, { text: trailingText }]
      : [formattedLeaf, { text: '' }];
    Transforms.insertNodes(slateEditor, nodesToInsert as any);
    return true;
  }

  return false;
}

export function applyBlockMarkdownShortcut(editor: ShortcutCapableEditor): boolean {
  const context = getCurrentSlateContext(editor);
  if (!context) return false;

  const { blockId, slateEditor } = context;
  const block = editor.getBlock({ id: blockId });
  if (!block || (block.type !== 'Paragraph' && block.type !== 'BulletedList')) return false;

  const selectedTextNode = getSelectedTextNode(slateEditor);
  if (!selectedTextNode) return false;

  const { selection, textNode, textBeforeCursor } = selectedTextNode;
  if (selection.anchor.offset !== textNode.text?.length) return false;

  const shortcut = matchBlockMarkdownShortcut(textBeforeCursor);
  if (!shortcut) return false;
  if (block.type === 'BulletedList' && shortcut.blockType !== 'TodoList') return false;

  Transforms.select(slateEditor, {
    anchor: { path: selection.anchor.path, offset: 0 },
    focus: { path: selection.anchor.path, offset: selection.anchor.offset },
  });
  Transforms.delete(slateEditor);

  editor.toggleBlock(shortcut.blockType, {
    scope: 'block',
    focus: true,
  });

  return true;
}