/**
 * @file EditorSlashMenu.tsx
 * @description Custom v6 slash command menu with grouped items, custom icons,
 *   InternalLink support, and keyboard shortcuts — built on @yoopta/ui's
 *   SlashCommandMenu compound components.
 * @app PAGES - Used inside PageEditor
 *
 * Features:
 * - Grouped items (Basic blocks, Content, Links & Media)
 * - Custom Lucide icons per block type
 * - Keyboard shortcut hints
 * - InternalLink custom action (opens link picker instead of inserting a block)
 * - Search input with filtering
 * - Footer with navigation hints
 *
 * Positioning: Uses the stock @yoopta/ui SlashCommandMenu which internally
 * uses @floating-ui/react with strategy: "fixed". No portal needed — the
 * component is rendered as a child of YooptaEditor.
 */
import React, { useMemo, useCallback } from 'react';
import { useYooptaEditor } from '@yoopta/editor';
import { SlashCommandMenu } from '@yoopta/ui/slash-command-menu';
import type { SlashCommandItemType } from '@yoopta/ui/slash-command-menu';
import { BLOCK_OPTIONS, GROUP_ORDER, getBlockIcon } from '../shared/menu';
import type { PlanneerEditor } from '@/lib/createPlanneerEditor';
import type { ColumnsMetadata } from '@/hooks/useEditorRowLayout';

interface EditorSlashMenuProps {
  /** Callback when InternalLink is selected. Receives the current block ID to delete. */
  onInternalLinkClick?: (blockIdToDelete?: string) => void;
  /** Callback when Columns is selected. Creates a 2-column layout at the current position. */
  onColumnsClick?: (blockIdToReplace?: string) => void;
  /** Callback when a BOOX page embed is selected. Receives the current block ID to delete. */
  onBooxPageClick?: (blockIdToDelete?: string) => void;
  /** Column metadata ref — used to hide Columns option when already in a column */
  colMetaRef?: React.RefObject<ColumnsMetadata>;
}

const EditorSlashMenu: React.FC<EditorSlashMenuProps> = ({
  onInternalLinkClick,
  onColumnsClick,
  onBooxPageClick,
  colMetaRef,
}) => {
  const editor = useYooptaEditor();

  // Build v6 SlashCommandItem[] from our shared BLOCK_OPTIONS data
  const items: SlashCommandItemType[] = useMemo(() => {
    // Hide Columns option when the current block is already inside a column
    const currentBlock =
      editor.path.current !== null
        ? editor.getBlock({ at: editor.path.current })
        : null;
    const isInColumn =
      currentBlock && colMetaRef?.current?.blocks[currentBlock.id] != null;

    return BLOCK_OPTIONS.filter(
      (opt) => !(opt.type === 'Columns' && isInColumn),
    ).map((opt) => ({
      id: opt.type,
      title: opt.title,
      description: opt.description,
      icon: opt.icon ?? getBlockIcon(opt.type),
      group: opt.group,
      keywords: opt.shortcut ? [opt.shortcut] : undefined,
      // InternalLink uses a custom handler instead of the default toggleBlock
      ...(opt.type === 'InternalLink' && onInternalLinkClick
        ? {
            onSelect: () => {
              // Get the current block (the one with "/" text) to delete later
              const currentBlock =
                editor.path.current !== null
                  ? editor.getBlock({ at: editor.path.current })
                  : null;
              const blockIdToDelete = currentBlock?.id;
              // Delay to let the menu close first
              setTimeout(() => onInternalLinkClick(blockIdToDelete), 50);
            },
          }
        : {}),
      // Columns uses a custom handler to create side-by-side blocks
      ...(opt.type === 'Columns' && onColumnsClick
        ? {
            onSelect: () => {
              const currentBlock =
                editor.path.current !== null
                  ? editor.getBlock({ at: editor.path.current })
                  : null;
              const blockIdToReplace = currentBlock?.id;
              setTimeout(() => onColumnsClick(blockIdToReplace), 50);
            },
          }
        : {}),
      ...(opt.type === 'BooxPageEmbed' && onBooxPageClick
        ? {
            onSelect: () => {
              const currentBlock =
                editor.path.current !== null
                  ? editor.getBlock({ at: editor.path.current })
                  : null;
              const blockIdToDelete = currentBlock?.id;
              setTimeout(() => onBooxPageClick(blockIdToDelete), 50);
            },
          }
        : {}),
    }));
  }, [editor, onInternalLinkClick, onColumnsClick, onBooxPageClick, colMetaRef]);

  // Bypass our preserveContent:true wrapper for slash menu selections.
  // When the user picks a block type from the "/" menu, the slash text
  // should be cleared — not preserved.  We call originalToggleBlock which
  // is the unwrapped library method.
  const handleSlashSelect = useCallback(
    (item: SlashCommandItemType) => {
      // Items with custom onSelect (InternalLink, Columns) handle themselves
      if (item.onSelect) return;
      (editor as unknown as PlanneerEditor).originalToggleBlock(item.id, {
        scope: 'auto',
        focus: true,
        preserveContent: false,
      });
    },
    [editor],
  );

  return (
    <SlashCommandMenu items={items} onSelect={handleSlashSelect}>
      {({ groupedItems }) => (
        <SlashCommandMenu.Content>
          <SlashCommandMenu.List>
            <SlashCommandMenu.Empty>No matching blocks found</SlashCommandMenu.Empty>
            {GROUP_ORDER.map((groupName) => {
              const groupItems = groupedItems.get(groupName);
              if (!groupItems || groupItems.length === 0) return null;
              return (
                <SlashCommandMenu.Group key={groupName} heading={groupName}>
                  {groupItems.map((item) => (
                    <SlashCommandMenu.Item
                      key={item.id}
                      value={item.id}
                      title={item.title}
                      description={item.description}
                      icon={item.icon}
                      onSelect={item.onSelect}
                    />
                  ))}
                </SlashCommandMenu.Group>
              );
            })}
          </SlashCommandMenu.List>
          <SlashCommandMenu.Footer />
        </SlashCommandMenu.Content>
      )}
    </SlashCommandMenu>
  );
};

export default EditorSlashMenu;