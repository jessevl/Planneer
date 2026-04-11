/**
 * @file TableOfContentsPlugin.tsx
 * @description Custom Yoopta plugin that generates a table of contents from headings
 * @app NOTES APP ONLY - Dynamic TOC that updates based on document headings
 * 
 * Features:
 * - Automatically scans document for H1, H2, H3 headings
 * - Click to navigate to heading
 * - Proper indentation based on heading level
 * - Real-time updates as headings change
 * - Tailwind styling with dark mode support
 */
import React, { useMemo, memo, useCallback, useEffect, useState } from 'react';
import { YooptaPlugin, PluginElementRenderProps, useYooptaEditor, generateId, buildBlockData } from '@yoopta/editor';
import { useSettingsStore } from '@/stores/settingsStore';
import { TableOfContentsIcon, HashIcon } from '@/components/common/Icons';
import { cn } from '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface TOCItem {
  id: string;
  blockId: string;
  text: string;
  level: 1 | 2 | 3;
  order: number;
}

interface TOCElementProps {
  nodeType: 'void';
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

const useIsDarkMode = (): boolean => {
  const theme = useSettingsStore(s => s.theme);
  return theme === 'dark' || 
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

// ============================================================================
// TOC RENDER COMPONENT
// ============================================================================

const TableOfContentsRender: React.FC<PluginElementRenderProps> = memo(({
  attributes,
  children,
}) => {
  const isDark = useIsDarkMode();
  const editor = useYooptaEditor();
  
  // Use a counter to force re-render when editor content changes
  const [updateCounter, setUpdateCounter] = useState(0);
  
  // Subscribe to editor changes to update TOC in real-time
  useEffect(() => {
    const handleChange = () => {
      setUpdateCounter(c => c + 1);
    };
    
    editor.on('change', handleChange);
    return () => {
      editor.off('change', handleChange);
    };
  }, [editor]);

  // Extract headings from editor content
  // updateCounter is a dependency to force recalculation on changes
  const tocItems = useMemo((): TOCItem[] => {
    // Use updateCounter to ensure this runs when content changes
    void updateCounter;
    
    const items: TOCItem[] = [];
    const editorValue = editor.getEditorValue();
    
    if (!editorValue) return items;

    // Sort blocks by order
    const sortedBlocks = Object.values(editorValue)
      .filter(block => block && block.type)
      .sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0));

    for (const block of sortedBlocks) {
      const type = block.type;
      let level: 1 | 2 | 3 | null = null;

      if (type === 'HeadingOne') level = 1;
      else if (type === 'HeadingTwo') level = 2;
      else if (type === 'HeadingThree') level = 3;

      if (level) {
        // Extract text from the block's value
        const firstElement = block.value?.[0];
        // Type guard: check if firstElement has children (it's an Element, not Text)
        const children = firstElement && 'children' in firstElement 
          ? (firstElement.children as Array<{ text?: string }>)
          : null;
        const text = children
          ?.map((child) => child.text || '')
          .join('') || '';

        if (text.trim()) {
          items.push({
            id: generateId(),
            blockId: block.id,
            text: text.trim(),
            level,
            order: block.meta?.order ?? 0,
          });
        }
      }
    }

    return items;
  }, [editor, updateCounter]);

  // Navigate to a heading block
  const handleNavigate = useCallback((blockId: string) => {
    // Find the block element in the DOM
    const blockElement = document.querySelector(`[data-yoopta-block-id="${blockId}"]`);
    if (blockElement) {
      blockElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Focus the editor on that block
      const block = editor.getBlock({ id: blockId });
      if (block) {
        editor.setPath({ current: block.meta?.order ?? 0 });
        editor.focus();
      }
    }
  }, [editor]);

  // Get indentation based on heading level
  const getIndentClass = (level: 1 | 2 | 3): string => {
    switch (level) {
      case 1: return 'pl-0';
      case 2: return 'pl-4';
      case 3: return 'pl-8';
    }
  };

  // Get font styling based on heading level
  const getFontClass = (level: 1 | 2 | 3): string => {
    switch (level) {
      case 1: return 'font-semibold text-sm';
      case 2: return 'font-medium text-sm';
      case 3: return 'font-normal text-sm';
    }
  };

  const hasHeadings = tocItems.length > 0;

  return (
    <div {...attributes} contentEditable={false}>
      <div className="my-4 rounded-lg border p-4 bg-[var(--color-surface-secondary)] border-[var(--color-border-default)]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-border-subtle)]">
          <TableOfContentsIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Table of Contents
          </span>
        </div>

        {/* TOC Items */}
        {hasHeadings ? (
          <nav className="space-y-1">
            {tocItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.blockId)}
                className={cn(
                  'w-full text-left py-1.5 px-2 rounded transition-colors flex items-center gap-2',
                  getIndentClass(item.level),
                  getFontClass(item.level),
                  'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-interactive-text-strong)]'
                )}
              >
                <HashIcon className="w-3 h-3 flex-shrink-0 text-[var(--color-text-tertiary)]" />
                <span className="truncate">{item.text}</span>
              </button>
            ))}
          </nav>
        ) : (
          <div className="text-sm py-4 text-center text-[var(--color-text-secondary)]">
            Add headings to your document to generate a table of contents.
          </div>
        )}
      </div>
      {children}
    </div>
  );
});

TableOfContentsRender.displayName = 'TableOfContentsRender';

// ============================================================================
// PLUGIN DEFINITION
// ============================================================================

const TableOfContentsPlugin = new YooptaPlugin({
  type: 'TableOfContents',
  elements: {
    'table-of-contents': {
      render: TableOfContentsRender,
      props: {
        nodeType: 'void',
      },
    },
  },
  options: {
    display: {
      title: 'Table of Contents',
      description: 'Navigate document headings',
      icon: '📑',
    },
    shortcuts: ['toc'],
  },
});

// ============================================================================
// COMMANDS
// ============================================================================

export const TableOfContentsCommands = {
  buildTOCElement: () => {
    return {
      id: generateId(),
      type: 'table-of-contents',
      children: [{ text: '' }],
      props: {
        nodeType: 'void' as const,
      },
    };
  },
  insertTableOfContents: (editor: ReturnType<typeof useYooptaEditor>, options: { at?: number; focus?: boolean } = {}) => {
    const { at, focus = true } = options;
    const elementData = TableOfContentsCommands.buildTOCElement();
    const blockData = buildBlockData({
      type: 'TableOfContents',
      value: [elementData],
    });
    
    editor.insertBlock(blockData.type, {
      at,
      focus,
      blockData,
    });
  },
};

export default TableOfContentsPlugin;
