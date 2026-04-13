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

const HIGHLIGHT_OPTIONS = [
  {
    id: 'sun',
    label: 'Yellow marker',
    values: { backgroundColor: 'rgba(250, 204, 21, 0.38)' },
    swatchClassName: 'bg-yellow-300 dark:bg-yellow-400',
  },
  {
    id: 'mint',
    label: 'Mint marker',
    values: { backgroundColor: 'rgba(74, 222, 128, 0.28)' },
    swatchClassName: 'bg-emerald-300 dark:bg-emerald-400',
  },
  {
    id: 'sky',
    label: 'Blue marker',
    values: { backgroundColor: 'rgba(96, 165, 250, 0.28)' },
    swatchClassName: 'bg-sky-300 dark:bg-sky-400',
  },
  {
    id: 'rose',
    label: 'Red marker',
    values: { backgroundColor: 'rgba(248, 113, 113, 0.26)' },
    swatchClassName: 'bg-red-300 dark:bg-red-400',
  },
] as const;

const EditorFloatingToolbar: React.FC = () => {
  const editor = useYooptaEditor();
  const [frozen, setFrozen] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const rafRef = useRef(0);

  // Cancel any pending unfreeze on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    if (!highlightMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-highlight-menu]')) return;
      setHighlightMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [highlightMenuOpen]);

  /** Freeze toolbar, run action, schedule unfreeze */
  const withFrozen = useCallback((action: () => void) => {
    flushSync(() => setFrozen(true));
    action();
    rafRef.current = requestAnimationFrame(() => setFrozen(false));
  }, []);

  const toggle = useCallback((type: 'bold' | 'italic' | 'underline' | 'strike' | 'code') => {
    withFrozen(() => Marks.toggle(editor, { type }));
  }, [editor, withFrozen]);

  const applyHighlight = useCallback((values: { backgroundColor: string }) => {
    withFrozen(() => Marks.add(editor, { type: 'highlight', value: values }));
    setHighlightMenuOpen(false);
  }, [editor, withFrozen]);

  const clearHighlight = useCallback(() => {
    withFrozen(() => Marks.remove(editor, { type: 'highlight' }));
    setHighlightMenuOpen(false);
  }, [editor, withFrozen]);

  return (
    <FloatingToolbar.Root frozen={frozen}>
      <FloatingToolbar.Content>
        <div className="relative flex items-center gap-0.5" data-highlight-menu>
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

          <ToolbarFormatButton
            label="Highlight"
            onClick={() => setHighlightMenuOpen((current) => !current)}
            isActive={Marks.isActive(editor, { type: 'highlight' }) || highlightMenuOpen}
          >
            <HighlighterIcon size={ICON} />
          </ToolbarFormatButton>

          {highlightMenuOpen && (
            <div className="absolute left-full top-1/2 ml-2 flex -translate-y-1/2 items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-base)]/95 px-2 py-1 shadow-lg backdrop-blur-xl">
              {HIGHLIGHT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  title={option.label}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-subtle)] transition-transform hover:scale-105 hover:border-[var(--color-border-default)]"
                  onClick={() => applyHighlight(option.values)}
                >
                  <span className={`h-4 w-4 rounded-full ${option.swatchClassName}`} />
                </button>
              ))}
              <button
                type="button"
                aria-label="Remove highlight"
                title="Remove highlight"
                className="ml-1 inline-flex h-7 items-center justify-center rounded-full border border-[var(--color-border-subtle)] px-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]"
                onClick={clearHighlight}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </FloatingToolbar.Content>
    </FloatingToolbar.Root>
  );
};

export default EditorFloatingToolbar;
