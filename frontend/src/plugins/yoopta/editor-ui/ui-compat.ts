/**
 * @file ui-compat.ts
 * @description Compatibility shim for the old `UI` namespace from @yoopta/editor v4.
 * In v6, UI primitives moved to @yoopta/ui subpath exports.
 * This shim maps old names to new v6 components so custom plugins keep working.
 *
 * Old v4 usage:
 *   import { UI } from '@yoopta/editor';
 *   const { Portal, Overlay } = UI;
 *
 * New v6 usage via this shim:
 *   import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
 *   const { Portal, Overlay } = UI;
 *
 * Note: v6's BlockOptions is a compound component (BlockOptions / BlockOptions.Trigger /
 * BlockOptions.Content / BlockOptions.Item / etc.) used directly by EditorFloatingBlockActions.
 * Custom plugins (AdvancedTable, Image) use Portal + Popover for their own dropdown menus.
 */
import { Portal } from '@yoopta/ui/portal';
import { Overlay } from '@yoopta/ui/overlay';

export const UI = {
  Portal,
  Overlay,
};