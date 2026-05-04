/**
 * @file markdownShortcutCommands.test.ts
 * @description Regression coverage for extracted Yoopta markdown shortcut commands.
 */
import { createEditor, Editor as SlateEditor, Transforms } from 'slate';
import { describe, expect, it, vi } from 'vitest';
import {
  applyBlockMarkdownShortcut,
  applyInlineMarkdownShortcut,
  getCurrentSlateContext,
} from './markdownShortcutCommands';

function makeSlateEditor(text: string) {
  const editor = createEditor();
  editor.children = [{ type: 'paragraph', children: [{ text }] }] as any;
  Transforms.select(editor, {
    anchor: { path: [0, 0], offset: text.length },
    focus: { path: [0, 0], offset: text.length },
  });
  return editor;
}

function makeYooptaEditor(text: string, blockType = 'Paragraph') {
  const slateEditor = makeSlateEditor(text);

  return {
    path: { current: 0 },
    getEditorValue: () => ({
      b1: {
        id: 'b1',
        type: blockType,
        meta: { order: 0, depth: 0 },
      },
    }),
    blockEditorsMap: { b1: slateEditor },
    getBlock: vi.fn(() => ({ id: 'b1', type: blockType })),
    toggleBlock: vi.fn(),
  } as any;
}

describe('markdownShortcutCommands', () => {
  it('resolves the current slate context from editor order', () => {
    const editor = makeYooptaEditor('hello');

    expect(getCurrentSlateContext(editor)).toMatchObject({
      blockId: 'b1',
      slateEditor: editor.blockEditorsMap.b1,
    });
  });

  it('applies inline markdown shortcuts in place', () => {
    const editor = makeYooptaEditor('**bold**');

    expect(applyInlineMarkdownShortcut(editor, ' ')).toBe(true);

    const leaves = (editor.blockEditorsMap.b1.children[0] as any).children;
    expect(leaves[0]).toMatchObject({ text: 'bold', bold: true });
    expect(leaves[1]).toMatchObject({ text: ' ' });
    expect(SlateEditor.string(editor.blockEditorsMap.b1, [])).toBe('bold ');
  });

  it('applies block markdown shortcuts through toggleBlock', () => {
    const editor = makeYooptaEditor('1.');

    expect(applyBlockMarkdownShortcut(editor)).toBe(true);
    expect(editor.toggleBlock).toHaveBeenCalledWith('NumberedList', {
      scope: 'block',
      focus: true,
    });
    expect(SlateEditor.string(editor.blockEditorsMap.b1, [])).toBe('');
  });

  it('promotes a bullet list item into a todo list when checkbox syntax is typed', () => {
    const editor = makeYooptaEditor('[ ]', 'BulletedList');

    expect(applyBlockMarkdownShortcut(editor)).toBe(true);
    expect(editor.toggleBlock).toHaveBeenCalledWith('TodoList', {
      scope: 'block',
      focus: true,
    });
    expect(SlateEditor.string(editor.blockEditorsMap.b1, [])).toBe('');
  });

  it('does not apply block shortcuts when the current block is not a paragraph', () => {
    const editor = makeYooptaEditor('1.', 'HeadingOne');

    expect(applyBlockMarkdownShortcut(editor)).toBe(false);
    expect(editor.toggleBlock).not.toHaveBeenCalled();
  });
});