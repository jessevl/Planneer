/**
 * @file EditorFloatingToolbar.tsx
 * @description Desktop floating toolbar for text formatting, rendered as a child of YooptaEditor.
 *              Uses Yoopta's FloatingToolbar.Root/Content for selection-aware positioning and
 *              shared ToolbarFormatButton for consistent button styling across desktop & mobile.
 * @app PAGES - Used inside PageEditor
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { FloatingToolbar } from '@yoopta/ui/floating-toolbar';
import { HighlightColorPicker } from '@yoopta/ui/highlight-color-picker';
import { Marks, useYooptaEditor } from '@yoopta/editor';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Code as CodeIcon,
  Highlighter as HighlighterIcon,
} from 'lucide-react';
import { ToolbarFormatButton } from '@/components/ui';

const ICON = 16;

const EditorFloatingToolbar: React.FC = () => {
  const editor = useYooptaEditor();
  const [frozen, setFrozen] = useState(false);
  const rafRef = useRef(0);

  // Cancel any pending unfreeze on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /** Freeze toolbar, run action, schedule unfreeze */
  const withFrozen = useCallback((action: () => void) => {
    flushSync(() => setFrozen(true));
    try { editor.focus(); } catch { /* no-op */ }
    action();
    rafRef.current = requestAnimationFrame(() => setFrozen(false));
  }, [editor]);

  const toggle = useCallback((type: 'bold' | 'italic' | 'underline' | 'strike' | 'code') => {
    withFrozen(() => Marks.toggle(editor, { type }));
  }, [editor, withFrozen]);

  return (
    <FloatingToolbar.Root frozen={frozen}>
      <FloatingToolbar.Content>
        <div className="flex items-center gap-0.5">
          <ToolbarFormatButton label="Bold" isActive={Marks.isActive(editor, { type: 'bold' })} onClick={() => toggle('bold')}>
            <BoldIcon size={ICON} />
          </ToolbarFormatButton>
          <ToolbarFormatButton label="Italic" isActive={Marks.isActive(editor, { type: 'italic' })} onClick={() => toggle('italic')}>
            <ItalicIcon size={ICON} />
          </ToolbarFormatButton>
          <ToolbarFormatButton label="Underline" isActive={Marks.isActive(editor, { type: 'underline' })} onClick={() => toggle('underline')}>
            <UnderlineIcon size={ICON} />
          </ToolbarFormatButton>
          <ToolbarFormatButton label="Strikethrough" isActive={Marks.isActive(editor, { type: 'strike' })} onClick={() => toggle('strike')}>
            <StrikethroughIcon size={ICON} />
          </ToolbarFormatButton>
          <ToolbarFormatButton label="Code" isActive={Marks.isActive(editor, { type: 'code' })} onClick={() => toggle('code')}>
            <CodeIcon size={ICON} />
          </ToolbarFormatButton>

          <div className="w-px h-5 bg-[var(--color-border-default)] opacity-50 mx-0.5" />

          <HighlightColorPicker
            onChange={(values) => {
              withFrozen(() => Marks.add(editor, { type: 'highlight', value: values }));
            }}
          >
            <ToolbarFormatButton label="Highlight" onClick={() => {}} isActive={Marks.isActive(editor, { type: 'highlight' })}>
              <HighlighterIcon size={ICON} />
            </ToolbarFormatButton>
          </HighlightColorPicker>
        </div>
      </FloatingToolbar.Content>
    </FloatingToolbar.Root>
  );
};

export default EditorFloatingToolbar;
