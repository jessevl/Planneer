/**
 * @file blockMarkdownShortcuts.test.ts
 * @description Regression coverage for local block markdown shortcut matching.
 */
import { describe, expect, it } from 'vitest';
import { matchBlockMarkdownShortcut } from './blockMarkdownShortcuts';

describe('matchBlockMarkdownShortcut', () => {
  it('matches numbered list shortcuts', () => {
    expect(matchBlockMarkdownShortcut('1.')).toEqual({ blockType: 'NumberedList' });
    expect(matchBlockMarkdownShortcut('12.')).toEqual({ blockType: 'NumberedList' });
  });

  it('matches todo list shortcut variants', () => {
    expect(matchBlockMarkdownShortcut('[]')).toEqual({ blockType: 'TodoList' });
    expect(matchBlockMarkdownShortcut('[ ]')).toEqual({ blockType: 'TodoList' });
    expect(matchBlockMarkdownShortcut('- []')).toEqual({ blockType: 'TodoList' });
    expect(matchBlockMarkdownShortcut('- [ ]')).toEqual({ blockType: 'TodoList' });
  });

  it('matches bullet list shortcuts', () => {
    expect(matchBlockMarkdownShortcut('-')).toEqual({ blockType: 'BulletedList' });
    expect(matchBlockMarkdownShortcut('*')).toEqual({ blockType: 'BulletedList' });
  });

  it('does not match regular content', () => {
    expect(matchBlockMarkdownShortcut('hello')).toBeNull();
    expect(matchBlockMarkdownShortcut('1. hello')).toBeNull();
    expect(matchBlockMarkdownShortcut('- [ ] hello')).toBeNull();
  });
});
