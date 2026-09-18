import type { SlateEditor, YooEditor } from '@yoopta/editor';

import { withDelete } from './withDelete';
import { withSelection } from './withSelection';
import { withAdvancedTableNormalize } from './withAdvancedTableNormalize';
import { withStableRemovals } from './withStableRemovals';

export function withAdvancedTable(slate: SlateEditor, editor: YooEditor) {
  slate = withSelection(slate);
  slate = withAdvancedTableNormalize(slate, editor);
  slate = withDelete(slate);
  slate = withStableRemovals(slate);

  return slate;
}
