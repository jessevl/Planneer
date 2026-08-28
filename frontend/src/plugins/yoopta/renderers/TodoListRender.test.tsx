/**
 * @file TodoListRender.test.tsx
 * @description Unit tests for the TodoList checkbox toggle, focused on the
 * touch path: on Android the editable keeps DOM focus, so an uncancelled tap
 * re-opens the soft keyboard and scrolls the stale caret back into view.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const updateElement = vi.fn();

vi.mock('@yoopta/editor', () => ({
  Elements: { updateElement: (...args: unknown[]) => updateElement(...args) },
  useYooptaEditor: () => ({ id: 'editor' }),
  useBlockData: () => ({ meta: { depth: 0 } }),
  useYooptaReadOnly: () => false,
}));

const { TodoListRender } = await import('./TodoListRender');

const renderTodo = (checked = false) =>
  render(
    <TodoListRender
      attributes={{} as never}
      element={{ id: 'el-1', type: 'todo-list', props: { checked }, children: [] } as never}
      blockId="block-1"
      HTMLAttributes={{}}
    >
      <span>Task</span>
    </TodoListRender>
  );

const touch = (x: number, y: number) => ({ clientX: x, clientY: y });

const fireTouch = (
  node: Element,
  type: 'touchstart' | 'touchend' | 'touchcancel',
  points: Array<{ clientX: number; clientY: number }>
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, type === 'touchend' ? 'changedTouches' : 'touches', {
    value: points,
  });
  node.dispatchEvent(event);
  return event;
};

const tap = (node: Element, from = touch(10, 10), to = from) => {
  fireTouch(node, 'touchstart', [from]);
  return fireTouch(node, 'touchend', [to]);
};

describe('TodoListRender', () => {
  beforeEach(() => {
    updateElement.mockClear();
  });

  it('toggles on mousedown for pointer devices', () => {
    renderTodo(false);
    screen.getByRole('button').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(updateElement).toHaveBeenCalledTimes(1);
    expect(updateElement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ blockId: 'block-1', props: { checked: true } })
    );
  });

  it('cancels the tap so Android does not re-open the keyboard at the stale caret', () => {
    renderTodo(false);
    const event = tap(screen.getByRole('button'));

    expect(event.defaultPrevented).toBe(true);
    expect(updateElement).toHaveBeenCalledTimes(1);
  });

  it('ignores the mouse events the browser synthesizes after a handled tap', () => {
    renderTodo(false);
    const button = screen.getByRole('button');
    tap(button);
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(updateElement).toHaveBeenCalledTimes(1);
  });

  it('does not toggle when the touch was a scroll rather than a tap', () => {
    renderTodo(false);
    tap(screen.getByRole('button'), touch(10, 10), touch(12, 90));

    expect(updateElement).not.toHaveBeenCalled();
  });

  it('does not toggle on a touchend without a preceding touchstart', () => {
    renderTodo(false);
    fireTouch(screen.getByRole('button'), 'touchend', [touch(10, 10)]);

    expect(updateElement).not.toHaveBeenCalled();
  });

  it('unchecks an already checked item', () => {
    renderTodo(true);
    tap(screen.getByRole('button'));

    expect(updateElement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ props: { checked: false } })
    );
  });
});
