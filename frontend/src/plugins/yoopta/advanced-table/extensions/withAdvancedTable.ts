import type { SlateEditor, YooEditor } from '@yoopta/editor';

import { withDelete } from './withDelete';
import { withSelection } from './withSelection';
import { withAdvancedTableNormalize } from './withAdvancedTableNormalize';

export function withAdvancedTable(slate: SlateEditor, editor: YooEditor) {
  slate = withSelection(slate);
  slate = withAdvancedTableNormalize(slate, editor);
  slate = withDelete(slate);

  return slate;
}
