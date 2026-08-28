/**
 * @file EditorMobileBlockSelection.test.tsx
 * @description Unit tests for the touch block-selection path: promoting a
 * boundary-clamped text selection to whole blocks, extending it by tap, and
 * copying the result.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

type Path = { current: number | null; selected?: number[] | null };

const listeners = new Map<string, Set<(payload: unknown) => void>>();
let path: Path = { current: null };

const children = {
  b1: { id: 'b1', type: 'paragraph', value: [], meta: { order: 0, depth: 0 } },
  b2: { id: 'b2', type: 'paragraph', value: [], meta: { order: 1, depth: 0 } },
  b3: { id: 'b3', type: 'paragraph', value: [], meta: { order: 2, depth: 0 } },
};

const editor = {
  children,
  getEditorValue: () => children,
  getHTML: vi.fn(() => '<body id="yoopta-clipboard">blocks</body>'),
  getPlainText: vi.fn(() => 'Alpha\nBravo'),
  blur: vi.fn(),
  setPath: vi.fn((next: Path) => {
    path = next;
    listeners.get('path-change')?.forEach((fn) => fn(next));
  }),
  on: (event: string, fn: (payload: unknown) => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
  },
  off: (event: string, fn: (payload: unknown) => void) => {
    listeners.get(event)?.delete(fn);
  },
};

vi.mock('@yoopta/editor', () => ({
  useYooptaEditor: () => editor,
  Paths: { getSelectedPaths: () => path.selected ?? null },
}));

const { default: EditorMobileBlockSelection } = await import('./EditorMobileBlockSelection');

/** Stands in for the block wrappers Yoopta renders around each editable. */
const renderBlocks = () => {
  const host = document.createElement('div');
  host.innerHTML = `
    <div data-yoopta-block data-yoopta-block-id="b1"><p>Alpha alpha one</p></div>
    <div data-yoopta-block data-yoopta-block-id="b2"><p>Bravo bravo two</p></div>
    <div data-yoopta-block data-yoopta-block-id="b3"><p>Charlie three</p></div>
  `;
  document.body.appendChild(host);
  return host;
};

const blockEl = (id: string) => document.querySelector(`[data-yoopta-block-id="${id}"]`)!;

/** Selects `text` inside a block; `toEnd` runs the selection to the block end. */
const selectInBlock = (id: string, { toEnd }: { toEnd: boolean }) => {
  const textNode = blockEl(id).querySelector('p')!.firstChild!;
  const range = document.createRange();
  range.setStart(textNode, toEnd ? 6 : 2);
  range.setEnd(textNode, toEnd ? textNode.textContent!.length : 5);

  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  act(() => {
    document.dispatchEvent(new Event('selectionchange'));
  });
};

const touch = (node: Element, type: string, x: number, y: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const points = [{ clientX: x, clientY: y }];
  Object.defineProperty(event, type === 'touchend' ? 'changedTouches' : 'touches', { value: points });
  act(() => {
    node.dispatchEvent(event);
  });
  return event;
};

const tapBlock = (id: string, drift = 0) => {
  const target = blockEl(id).querySelector('p')!;
  touch(target, 'touchstart', 50, 100);
  return touch(target, 'touchend', 50, 100 + drift);
};

const clipboardWrite = vi.fn(() => Promise.resolve());
const clipboardWriteText = vi.fn(() => Promise.resolve());

let host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  path = { current: null };
  host = renderBlocks();
  vi.stubGlobal('ClipboardItem', class { constructor(public items: unknown) {} });
  Object.defineProperty(navigator, 'clipboard', {
    value: { write: clipboardWrite, writeText: clipboardWriteText },
    configurable: true,
  });
});

afterEach(() => {
  host.remove();
  document.getSelection()?.removeAllRanges();
  vi.unstubAllGlobals();
});

describe('EditorMobileBlockSelection', () => {
  const pill = () => screen.queryByRole('button', { name: /select blocks/i });

  it('offers the pill once the selection reaches the block boundary', async () => {
    render(<EditorMobileBlockSelection />);
    selectInBlock('b1', { toEnd: true });

    await waitFor(() => expect(pill()).toBeInTheDocument());
  });

  it('stays out of the way for a selection in the middle of a block', async () => {
    render(<EditorMobileBlockSelection />);
    selectInBlock('b1', { toEnd: false });

    await waitFor(() => expect(pill()).not.toBeInTheDocument());
  });

  it('promotes to a whole-block selection, dropping the caret first', async () => {
    render(<EditorMobileBlockSelection />);
    selectInBlock('b1', { toEnd: true });
    await waitFor(() => expect(pill()).toBeInTheDocument());

    fireEvent.click(pill()!);

    // blur() resets the path, so it has to run before the selection is set.
    expect(editor.blur).toHaveBeenCalled();
    expect(editor.setPath).toHaveBeenLastCalledWith({ current: 0, selected: [0] });
    expect(document.getSelection()?.rangeCount).toBe(0);
    expect(pill()).not.toBeInTheDocument();
  });

  const promote = async () => {
    render(<EditorMobileBlockSelection />);
    selectInBlock('b1', { toEnd: true });
    await waitFor(() => expect(pill()).toBeInTheDocument());
    fireEvent.click(pill()!);
    await screen.findByRole('toolbar', { name: /block selection/i });
  };

  it('extends the range to a tapped block', async () => {
    await promote();
    const event = tapBlock('b3');

    expect(editor.setPath).toHaveBeenLastCalledWith({ current: 2, selected: [0, 1, 2] });
    // The tap must not place a caret, which would drop the selection.
    expect(event.defaultPrevented).toBe(true);
    expect(await screen.findByText('3 selected')).toBeInTheDocument();
  });

  it('collapses back to the anchor when the anchor is tapped again', async () => {
    await promote();
    tapBlock('b3');
    tapBlock('b1');

    expect(editor.setPath).toHaveBeenLastCalledWith({ current: 0, selected: [0] });
  });

  it('leaves the selection alone when the touch was a scroll', async () => {
    await promote();
    editor.setPath.mockClear();
    tapBlock('b3', 80);

    expect(editor.setPath).not.toHaveBeenCalled();
  });

  it('selects every block from the All button', async () => {
    await promote();
    fireEvent.click(screen.getByRole('button', { name: /select all blocks/i }));

    expect(editor.setPath).toHaveBeenLastCalledWith({ current: 2, selected: [0, 1, 2] });
  });

  it('copies the selection as both HTML and plain text', async () => {
    await promote();
    fireEvent.click(screen.getByRole('button', { name: /copy selected blocks/i }));

    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledTimes(1));
    expect(editor.getHTML).toHaveBeenCalled();
    expect(editor.getPlainText).toHaveBeenCalled();
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('falls back to plain text when the rich clipboard is unavailable', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    await promote();
    fireEvent.click(screen.getByRole('button', { name: /copy selected blocks/i }));

    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalledWith('Alpha\nBravo'));
    expect(clipboardWrite).not.toHaveBeenCalled();
  });

  it('clears the selection from the dismiss button', async () => {
    await promote();
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));

    expect(editor.setPath).toHaveBeenLastCalledWith({ current: null });
    await waitFor(() =>
      expect(screen.queryByRole('toolbar', { name: /block selection/i })).not.toBeInTheDocument()
    );
  });

  it('ignores taps that land on its own controls', async () => {
    await promote();
    editor.setPath.mockClear();
    const bar = screen.getByRole('toolbar', { name: /block selection/i });
    touch(bar, 'touchstart', 50, 100);
    touch(bar, 'touchend', 50, 100);

    expect(editor.setPath).not.toHaveBeenCalled();
  });
});
