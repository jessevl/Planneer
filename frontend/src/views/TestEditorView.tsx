import { useMemo } from 'react';
import YooptaEditor, { createYooptaEditor } from '@yoopta/editor';
import Paragraph from '@yoopta/paragraph';
import { HeadingOne, HeadingTwo, HeadingThree } from '@yoopta/headings';
import Blockquote from '@yoopta/blockquote';
import Callout from '@yoopta/callout';
import Divider from '@yoopta/divider';
import Link from '@yoopta/link';
import { BulletedList, NumberedList, TodoList } from '@yoopta/lists';
import { Bold, Italic, Underline, Strike, Highlight, CodeMark } from '@yoopta/marks';
import { SlashCommandMenu } from '@yoopta/ui/slash-command-menu';
import { FloatingToolbar } from '@yoopta/ui/floating-toolbar';
import { FloatingBlockActions } from '@yoopta/ui/floating-block-actions';

const PLUGINS = [
  Paragraph, HeadingOne, HeadingTwo, HeadingThree,
  Blockquote, Callout, Divider,
  Link, BulletedList, NumberedList, TodoList,
];
const MARKS = [Bold, Italic, CodeMark, Underline, Strike, Highlight];

export default function TestEditorView() {
  const editor = useMemo(
    () => createYooptaEditor({ plugins: PLUGINS, marks: MARKS }),
    []
  );

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 20 }}>
      <h1 style={{ marginBottom: 16 }}>Yoopta v6 Stock Test</h1>
      <YooptaEditor
        editor={editor}
        autoFocus
        placeholder="Type / to open menu..."
        style={{ width: '100%', paddingBottom: 100 }}
      >
        <SlashCommandMenu.Root>
          {(props) => (
            <SlashCommandMenu.Content>
              <SlashCommandMenu.List>
                <SlashCommandMenu.Empty>No blocks found</SlashCommandMenu.Empty>
                {props.items.map((item) => (
                  <SlashCommandMenu.Item
                    key={item.id}
                    value={item.id}
                    title={item.title}
                    description={item.description}
                    icon={item.icon}
                  />
                ))}
              </SlashCommandMenu.List>
            </SlashCommandMenu.Content>
          )}
        </SlashCommandMenu.Root>
        <FloatingToolbar.Root>
          <FloatingToolbar.Content>
            <FloatingToolbar.Group>
              <FloatingToolbar.Button
                active={false}
                onClick={() => editor.formats?.bold?.toggle()}
              >
                B
              </FloatingToolbar.Button>
              <FloatingToolbar.Button
                active={false}
                onClick={() => editor.formats?.italic?.toggle()}
              >
                I
              </FloatingToolbar.Button>
              <FloatingToolbar.Button
                active={false}
                onClick={() => editor.formats?.underline?.toggle()}
              >
                U
              </FloatingToolbar.Button>
            </FloatingToolbar.Group>
          </FloatingToolbar.Content>
        </FloatingToolbar.Root>
        <FloatingBlockActions>
          {({ blockId }) => (
            <FloatingBlockActions.Button
              onClick={() => {
                if (!blockId) return;
                const block = editor.getBlock({ id: blockId });
                if (block) {
                  editor.insertBlock('Paragraph', { at: block.meta.order + 1, focus: true });
                }
              }}
              title="Add block"
            >
              +
            </FloatingBlockActions.Button>
          )}
        </FloatingBlockActions>
      </YooptaEditor>
    </div>
  );
}
