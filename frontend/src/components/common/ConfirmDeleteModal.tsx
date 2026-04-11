/**
 * @file ConfirmDeleteModal.tsx
 * @description Global delete confirmation modal
 * @app SHARED - Renders at app level to confirm all delete actions
 * 
 * Listens to deleteConfirmStore and displays confirmation when requested.
 * Shows appropriate message based on item type and count.
 * 
 * For items with children, shows two options:
 * - "Delete only" - moves children to root/inbox
 * - "Delete all" - deletes item and all children
 * 
 * Mobile: Uses MobileSheet for better touch UX
 * Desktop: Uses centered Modal
 * 
 * Render this once at the app level (e.g., in page.tsx or layout).
 */
'use client';

import React from 'react';
import { Button, Modal, Text, MobileSheet } from '@/components/ui';
import { useDeleteConfirmStore, getDeleteItemLabel } from '@/stores/deleteConfirmStore';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { ModalFooter } from '@/components/ui';

const ConfirmDeleteModal: React.FC = () => {
  const { isOpen, itemType, count, customMessage, hasChildren, childCount, confirm, cancel } = useDeleteConfirmStore();
  const isMobile = useIsMobile();
  
  const itemLabel = getDeleteItemLabel(itemType, count);
  const defaultMessage = count === 1
    ? `Are you sure you want to permanently delete this ${itemLabel}?`
    : `Are you sure you want to permanently delete these ${count} ${itemLabel}?`;
  
  // Content for cascade delete (with subpages)
  const CascadeContent = () => (
    <>
      <Text>{customMessage ?? defaultMessage}</Text>
      <Text className="mt-3 text-sm">
        This {itemLabel} has <strong>{childCount === 1 ? '1 subpage' : `${childCount} subpages`}</strong>. What would you like to do?
      </Text>
      <div className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
        <div className="flex items-start gap-2">
          <span className="font-medium text-[var(--color-text-primary)]">Delete Only:</span>
          <span>Deletes only this {itemLabel}. Subpages will be preserved.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-medium text-red-600 dark:text-red-400">Delete All:</span>
          <span>Deletes this {itemLabel} and all {childCount} subpages permanently.</span>
        </div>
      </div>
    </>
  );

  // Content for standard delete (no subpages)
  const StandardContent = () => (
    <>
      <Text>{customMessage ?? defaultMessage}</Text>
      <Text className="mt-2 text-sm text-[var(--color-text-secondary)]">
        This action cannot be undone.
      </Text>
    </>
  );

  // Cascade footer buttons - for pages with children
  const CascadeFooter = () => (
    <div className={`flex gap-2 ${isMobile ? 'flex-wrap' : 'w-full'}`}>
      {isMobile ? (
        <>
          <Button 
            onClick={cancel} 
            variant="ghost" 
            size="lg" 
            className="flex-1 border border-[var(--color-border-default)]"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => confirm(false)} 
            variant="secondary" 
            size="lg"
            className="flex-1"
            title="Moves subpages to root level or inbox"
          >
            Delete Only
          </Button>
          <Button 
            onClick={() => confirm(true)} 
            variant="danger-outline" 
            size="lg"
            className="w-full"
          >
            Delete All ({childCount + 1} items)
          </Button>
        </>
      ) : (
        <>
          <Button 
            onClick={cancel} 
            variant="ghost" 
            size="md"
            className="border border-[var(--color-border-default)]"
          >
            Cancel
          </Button>
          <div className="flex-1" />
          <Button 
            onClick={() => confirm(false)} 
            variant="secondary" 
            size="md"
            title="Moves subpages to root level or inbox"
          >
            Delete Only
          </Button>
          <Button 
            onClick={() => confirm(true)} 
            variant="danger-outline" 
            size="md"
          >
            Delete All
          </Button>
        </>
      )}
    </div>
  );

  // Standard footer buttons
  const StandardFooter = () => (
    <ModalFooter
      onCancel={cancel}
      cancelLabel="Cancel"
      onDelete={() => confirm(false)}
      deleteLabel="Delete"
      size={isMobile ? 'lg' : 'md'}
    />
  );

  // Mobile: Use MobileSheet
  if (isMobile) {
    return (
      <MobileSheet
        isOpen={isOpen}
        onClose={cancel}
        title={hasChildren && count === 1 ? 'Delete with Subpages' : 'Confirm Delete'}
      >
        <div className="p-4 space-y-4">
          {hasChildren && count === 1 ? <CascadeContent /> : <StandardContent />}
          <div className="pt-2">
            {hasChildren && count === 1 ? <CascadeFooter /> : <StandardFooter />}
          </div>
        </div>
      </MobileSheet>
    );
  }
  
  // Desktop: Use Modal
  // For items with subpages, show cascade options
  if (hasChildren && count === 1) {
    return (
      <Modal 
        isOpen={isOpen} 
        onClose={cancel} 
        mobileFullScreen={false}
        footer={<CascadeFooter />}
      >
        <CascadeContent />
      </Modal>
    );
  }
  
  // Standard confirmation (no children)
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={cancel} 
      mobileFullScreen={false}
      footer={<StandardFooter />}
    >
      <StandardContent />
    </Modal>
  );
};

export default ConfirmDeleteModal;
