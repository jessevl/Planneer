/**
 * @file insertBlockWithFocus.test.ts
 * @description Regression coverage for shared block insertion + caret restoration.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { insertBlockAtCurrentPath, insertBlockWithFocus } from './insertBlockWithFocus';
import { focusBlockAtOrder } from './focusBlockAtOrder';

vi.mock('./focusBlockAtOrder', () => ({
  focusBlockAtOrder: vi.fn(),
}));

function makeEditor() {
  return {
    path: { current: 2 },
    insertBlock: vi.fn(),
    focus: vi.fn(),
    focusBlock: vi.fn(),
    getEditorValue: vi.fn(() => ({})),
    setPath: vi.fn(),
  } as any;
}

describe('insertBlockWithFocus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts at an explicit order and restores caret focus', () => {
    const editor = makeEditor();
    const scrollContainer = { scrollLeft: 4, scrollTop: 8 };
    vi.mocked(focusBlockAtOrder).mockReturnValue('b3');

    expect(insertBlockWithFocus(editor, 'Paragraph', { order: 2, scrollContainer })).toBe(2);

    expect(editor.insertBlock).toHaveBeenCalledWith('Paragraph', { at: 2, focus: false });
    expect(focusBlockAtOrder).toHaveBeenCalledWith(editor, {
      order: 2,
      scrollContainer,
    });
    expect(editor.focus).not.toHaveBeenCalled();
  });

  it('falls back to editor focus when block focus recovery fails', () => {
    const editor = makeEditor();
    vi.mocked(focusBlockAtOrder).mockReturnValue(null);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    insertBlockWithFocus(editor, 'Paragraph', { order: 2 });

    expect(editor.focus).toHaveBeenCalledTimes(1);
  });

  it('uses the current editor path when available', () => {
    const editor = makeEditor();
    vi.mocked(focusBlockAtOrder).mockReturnValue('b3');

    insertBlockAtCurrentPath(editor, 'TodoList');

    expect(editor.insertBlock).toHaveBeenCalledWith('TodoList', { at: 2, focus: false });
  });

  it('falls back to Yoopta default focus behavior when there is no current path', () => {
    const editor = makeEditor();
    editor.path.current = null;

    expect(insertBlockAtCurrentPath(editor, 'BulletedList')).toBeNull();
    expect(editor.insertBlock).toHaveBeenCalledWith('BulletedList', { focus: true });
    expect(focusBlockAtOrder).not.toHaveBeenCalled();
  });
});