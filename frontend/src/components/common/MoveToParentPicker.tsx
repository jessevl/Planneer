/**
 * @file MoveToParentPicker.tsx
 * @description Unified picker for moving a page to a parent collection
 * 
 * Shows as:
 * - MobileSheet on mobile devices
 * - Modal on desktop devices
 * 
 * Only shows collections (viewMode='collection'), sorted by recently updated,
 * limited to 50 results for performance.
 * 
 * Shows breadcrumb for parent context (e.g. "Personal > Tasks")
 */
import React, { useEffect, useState, useMemo } from 'react';
import { MobileSheet, Modal, LucideIcon } from '@/components/ui';
import { usePagesStore } from '@/stores/pagesStore';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { StylizedCollectionIcon } from '@/components/common/StylizedIcons';
import { fetchPages } from '@/api/pagesApi';
import type { Page } from '@/types/page';
import { Folder, Loader2, ChevronRight } from 'lucide-react';

interface MoveToParentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  pageTitle: string;
}

export const MoveToParentPicker: React.FC<MoveToParentPickerProps> = ({
  isOpen,
  onClose,
  pageId,
  pageTitle,
}) => {
  const movePage = usePagesStore((s) => s.movePage);
  const pagesById = usePagesStore((s) => s.pagesById);
  const isMobile = useIsMobile();
  
  // Fetch collections from API
  const [collections, setCollections] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    // Fetch collections as potential parents
    fetchPages({
      viewMode: 'collection',
      sortBy: 'updated',
      sortDirection: 'desc',
      limit: 50,
    })
      .then(result => {
        // Filter out self and daily notes
        setCollections(result.pages.filter(p => p.id !== pageId && !p.isDailyNote));
      })
      .catch(err => {
        console.error('Failed to fetch collections:', err);
        setCollections([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, pageId]);
  
  const handleSelectParent = (parentId: string) => {
    movePage(pageId, parentId);
    onClose();
  };
  
  const handleMoveToRoot = () => {
    movePage(pageId, null);
    onClose();
  };
  
  // Get parent title for breadcrumb display (one level only)
  const getParentBreadcrumb = (page: Page): string | null => {
    if (!page.parentId) return null;
    const parent = pagesById[page.parentId];
    return parent?.title || null;
  };
  
  const renderIcon = (page: Page) => {
    if (page.icon) {
      return (
        <LucideIcon 
          name={page.icon} 
          className="w-5 h-5" 
          style={{ color: page.color || '#64748b' }} 
        />
      );
    }
    return <StylizedCollectionIcon size="md" color={page.color} />;
  };
  
  const content = (
    <div className="space-y-1">
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
      
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-tertiary)]" />
        </div>
      ) : collections.length > 0 ? (
        <>
          <div className="px-3 pt-2 pb-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
              Collections
            </span>
          </div>
          
          <div className="max-h-[50vh] overflow-y-auto">
            {collections.map((collection) => {
              const parentBreadcrumb = getParentBreadcrumb(collection);
              return (
                <button
                  key={collection.id}
                  onClick={() => handleSelectParent(collection.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--color-surface-secondary)] transition-colors"
                >
                  <div 
                    className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ 
                      backgroundColor: collection.color ? `${collection.color}15` : undefined,
                      border: collection.color ? `1px solid ${collection.color}30` : undefined,
                    }}
                  >
                    {renderIcon(collection)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Show parent breadcrumb if exists */}
                    {parentBreadcrumb && (
                      <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] mb-0.5">
                        <span className="truncate max-w-[120px]">{parentBreadcrumb}</span>
                        <ChevronRight className="w-3 h-3 flex-shrink-0" />
                      </div>
                    )}
                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {collection.title || 'Untitled'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="px-3 py-4 text-center text-sm text-[var(--color-text-secondary)]">
          No collections found.
          <br />
          Create a collection first!
        </div>
      )}
    </div>
  );
  
  // On mobile, use MobileSheet
  if (isMobile) {
    return (
      <MobileSheet
        isOpen={isOpen}
        onClose={onClose}
        title={`Move "${pageTitle}"`}
      >
        <div className="px-4 pb-6 pt-2">
          {content}
        </div>
      </MobileSheet>
    );
  }
  
  // On desktop, use Modal
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Move "${pageTitle}"`}
      size="sm"
    >
      <div className="p-4">
        {content}
      </div>
    </Modal>
  );
};

export default MoveToParentPicker;
