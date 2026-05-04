/**
 * @file blockMarkdownShortcuts.ts
 * @description Local fallback matcher for block markdown shortcuts that must
 *              remain reliable even when Yoopta's built-in matcher misses.
 */

export type BlockShortcutType = 'BulletedList' | 'NumberedList' | 'TodoList';

export interface BlockShortcutMatch {
  blockType: BlockShortcutType;
}

const BLOCK_SHORTCUT_PATTERNS: Array<{
  pattern: RegExp;
  blockType: BlockShortcutType;
}> = [
  { pattern: /^\s*(?:-|\*)$/, blockType: 'BulletedList' },
  { pattern: /^\s*\d+\.$/, blockType: 'NumberedList' },
  { pattern: /^\s*(?:\[\]|\[ \]|- \[\]|- \[ \])$/i, blockType: 'TodoList' },
];

export function matchBlockMarkdownShortcut(text: string): BlockShortcutMatch | null {
  for (const shortcut of BLOCK_SHORTCUT_PATTERNS) {
    if (shortcut.pattern.test(text)) {
      return { blockType: shortcut.blockType };
    }
  }

  return null;
}
