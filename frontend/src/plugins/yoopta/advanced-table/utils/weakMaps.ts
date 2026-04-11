import type { SlateEditor, SlateElement } from '@yoopta/editor';
import type { NodeEntry, Path } from 'slate';

import type { AdvancedTableCellElement } from '../types';

export type SlateNodeEntry = [AdvancedTableCellElement, Path];

export const EDITOR_TO_SELECTION = new WeakMap<SlateEditor, SlateNodeEntry[]>();
export const TABLE_SLATE_TO_SELECTION_SET = new WeakMap<SlateEditor, WeakSet<SlateElement>>();
