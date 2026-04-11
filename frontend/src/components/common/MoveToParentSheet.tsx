/**
 * @file MoveToParentSheet.tsx
 * @description Simple mobile sheet for quickly moving a page to a parent
 * 
 * Used after creating a page via quick-add to organize it into a collection/folder.
 * Shows available parent options (collections and notes that can have children).
 */
import React, { useMemo } from 'react';
import { MobileSheet, LucideIcon } from '@/components/ui';
import { usePagesStore } from '@/stores/pagesStore';
import { 
  StylizedCollectionIcon, 
  StylizedNoteIcon 
} from '@/components/common/ItemPropertiesModal';
import { Folder } from 'lucide-react';

interface MoveToParentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  pageTitle: string;
}

export const MoveToParentSheet: React.FC<MoveToParentSheetProps> = ({
  isOpen,
  onClose,
  pageId,
  pageTitle,
}) => {
  const pagesById = usePagesStore((s) => s.pagesById);
  const movePage = usePagesStore((s) => s.movePage);
  
  // Get potential parents: any non-daily page (not self)
  const availableParents = useMemo(() => {
    return Object.values(pagesById)
      .filter(page => {
        // Exclude self
        if (page.id === pageId) return false;
        // Exclude daily notes
        if (page.isDailyNote) return false;
        // Exclude task pages
        if (page.viewMode === 'tasks') return false;
        return true;
      })
      .sort((a, b) => {
        // Collections first, then by title
        if (a.viewMode === 'collection' && b.viewMode !== 'collection') return -1;
        if (b.viewMode === 'collection' && a.viewMode !== 'collection') return 1;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 15); // Limit to 15 options for quick selection
  }, [pagesById, pageId]);
  
  const handleSelectParent = (parentId: string) => {
    movePage(pageId, parentId);
    onClose();
  };
  
  const handleMoveToRoot = () => {
    movePage(pageId, null);
    onClose();
  };
  
  const renderIcon = (page: typeof availableParents[0]) => {
    if (page.icon) {
      return (
        <LucideIcon 
          name={page.icon} 
          className="w-5 h-5" 
          style={{ color: page.color || '#64748b' }} 
        />
      );
    }
    if (page.viewMode === 'collection') {
      return <StylizedCollectionIcon size="md" color={page.color} />;
    }
    return <StylizedNoteIcon size="md" color={page.color} />;
  };
  
  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Move "${pageTitle}"`}
    >
      <div className="px-4 pb-6 pt-2 space-y-1">
        {/* Root level option */}
        <button
          onClick={handleMoveToRoot}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-secondary)]">
            <Folder className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">
              Root Level
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              No parent (top-level page)
            </div>
          </div>
        </button>
        
        {availableParents.length > 0 && (
          <>
            <div className="px-3 pt-2 pb-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                Collections & Notes
              </span>
            </div>
            
            {availableParents.map((parent) => (
              <button
                key={parent.id}
                onClick={() => handleSelectParent(parent.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                <div 
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ 
                    backgroundColor: parent.color ? `${parent.color}15` : undefined,
                    border: parent.color ? `1px solid ${parent.color}30` : undefined,
                  }}
                >
                  {renderIcon(parent)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {parent.title || 'Untitled'}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] capitalize">
                    {parent.viewMode}
                  </div>
                </div>
              </button>
            ))}
          </>
        )}
        
        {availableParents.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-[var(--color-text-secondary)]">
            No collections or notes to move to.
            <br />
            Create a collection first!
          </div>
        )}
      </div>
    </MobileSheet>
  );
};

export default MoveToParentSheet;
