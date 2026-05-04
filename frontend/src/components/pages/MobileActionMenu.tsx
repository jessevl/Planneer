/**
 * @file MobileActionMenu.tsx
 * @description Mobile-optimized action menu for inserting blocks in the editor
 * @app PAGES - Alternative to floating action menu on mobile
 * 
 * Renders block options in a scrollable MobileSheet with touch-friendly sizing.
 * Groups blocks into categories for easy discovery.
 */
import React, { memo, useCallback, useMemo } from 'react';
import { MobileSheet } from '@/components/ui';
import { insertBlockWithFocus } from '@/plugins/yoopta/utils/insertBlockWithFocus';
import { BLOCK_OPTIONS, groupBlockOptions, type BlockOption } from '@/plugins/yoopta/shared/menu';

// ============================================================================
// TYPES
// ============================================================================

interface MobileActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  editor: any;
  onInternalLinkClick: (blockIdToDelete?: string) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const MobileActionMenu: React.FC<MobileActionMenuProps> = ({
  isOpen,
  onClose,
  editor,
  onInternalLinkClick,
}) => {
  const groupedOptions = useMemo(
    () => groupBlockOptions(BLOCK_OPTIONS),
    [],
  );
  
  const handleSelect = useCallback((option: BlockOption) => {
    if (option.type === 'InternalLink') {
      // Get the current block ID before closing menu
      const currentBlock = editor.path?.current !== null
        ? editor.getBlock?.({ at: editor.path.current })
        : null;
      const blockIdToDelete = currentBlock?.id;
      
      onClose();
      // Delay to let sheet close first
      setTimeout(() => onInternalLinkClick(blockIdToDelete), 50);
    } else {
      // Insert block using Yoopta's API
      try {
        // Get current selection/path BEFORE closing sheet
        const currentPath = editor.path?.current;
        
        // Close sheet
        onClose();
        
        // Insert block immediately at current position
        requestAnimationFrame(() => {
          try {
            insertBlockWithFocus(editor, option.type, { order: currentPath ?? null });
          } catch (err) {
            console.error('[MobileActionMenu] Failed to insert block:', err);
          }
        });
      } catch (err) {
        console.error('[MobileActionMenu] Failed to prepare block insertion:', err);
        onClose();
      }
    }
  }, [editor, onClose, onInternalLinkClick]);

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Insert Block"
      maxHeight="70vh"
    >
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {Array.from(groupedOptions.entries()).map(([groupName, items]) => (
          items.length > 0 && (
            <div key={groupName} className="py-2">
              <div className="px-4 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                {groupName}
              </div>
              <div className="flex flex-col">
                {items.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(option); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[var(--color-surface-secondary)]"
                  >
                    <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                      {option.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium text-[var(--color-text-primary)]">
                        {option.title}
                      </div>
                      {option.description && (
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </MobileSheet>
  );
};

export default memo(MobileActionMenu);
