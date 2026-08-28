/**
 * @file SubtaskList.test.tsx
 * @description Unit tests for subtask Enter handling, focused on the Android
 * soft keyboard: its IME action must add a subtask instead of advancing focus
 * to the next form field.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { Subtask } from '@/types/task';
import SubtaskList from './SubtaskList';

const existing: Subtask[] = [{ id: 'st-1', title: 'Existing', completed: false }];

const setup = (subtasks: Subtask[] = existing) => {
  const onChange = vi.fn();
  render(<SubtaskList subtasks={subtasks} onChange={onChange} />);
  return { onChange, input: screen.getByPlaceholderText('Add subtask...') };
};

/** Android delivers the soft-keyboard line break as a beforeinput. */
const fireLineBreak = (node: Element) => {
  const event = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertLineBreak',
  });
  // Dispatched natively, outside React's synthetic event system, so the state
  // update it triggers needs an explicit act().
  act(() => {
    node.dispatchEvent(event);
  });
  return event;
};

describe('SubtaskList Enter handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds the subtask on Enter keydown', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: 'New subtask' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
    expect(onChange.mock.calls[0][0][1]).toMatchObject({ title: 'New subtask', completed: false });
  });

  it('adds the subtask when the IME reports the Enter as a line break', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: 'Composed subtask' } });
    const event = fireLineBreak(input);

    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][1]).toMatchObject({ title: 'Composed subtask' });
  });

  it('adds only once when keydown and beforeinput both fire', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: 'Once only' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireLineBreak(input);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clears the input and keeps focus so the next subtask can be typed', () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: 'First' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('ignores an empty submission', () => {
    const { onChange, input } = setup();
    fireEvent.keyDown(input, { key: 'Enter' });
    fireLineBreak(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('asks the IME for an Enter key rather than the focus-advancing Next', () => {
    const { input } = setup();
    expect(input).toHaveAttribute('enterkeyhint', 'enter');
  });

  it('attaches the fallback to the input revealed by "Add subtasks"', () => {
    const onChange = vi.fn();
    render(<SubtaskList subtasks={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add subtasks/i }));

    const input = screen.getByPlaceholderText('Add subtask...');
    fireEvent.change(input, { target: { value: 'From empty state' } });
    fireLineBreak(input);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('saves an edited subtask on the IME line break', () => {
    const onChange = vi.fn();
    render(<SubtaskList subtasks={existing} onChange={onChange} />);
    act(() => {
      fireEvent.click(screen.getByText('Existing'));
    });

    const editInput = screen.getByDisplayValue('Existing');
    expect(editInput).toHaveAttribute('enterkeyhint', 'done');

    fireEvent.change(editInput, { target: { value: 'Renamed' } });
    fireLineBreak(editInput);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ id: 'st-1', title: 'Renamed' });
  });
});
