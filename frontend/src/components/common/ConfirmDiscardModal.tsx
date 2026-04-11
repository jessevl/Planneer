/**
 * @file ConfirmDiscardModal.tsx
 * @description Shared confirmation dialog for discarding unsaved changes
 * @app SHARED - Used by both Tasks App and Notes App
 * 
 * Displays when the user attempts to navigate away from a form with unsaved changes.
 * Works with useFormState hook to manage dirty state tracking.
 * 
 * Usage:
 * - Task editing forms (Tasks App)
 * - Note editing (Notes App)
 * - Project/section editing modals
 * 
 * Mobile: Uses MobileSheet drawer for better UX (appears on top of editing modal)
 * Desktop: Uses standard Modal
 */
import React from 'react';
import { Modal, MobileSheet, Text, ModalFooter } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

interface Props {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  message?: string;
}

const ConfirmDiscardModal: React.FC<Props> = ({ open, onCancel, onDiscard, message }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileSheet
        isOpen={open}
        onClose={onCancel}
        maxHeight="auto"
      >
        <div className="p-4 space-y-4">
          <Text className="text-[var(--color-text-secondary)]">
            {message ?? 'You have unsaved changes. Discard them?'}
          </Text>
          <ModalFooter
            onCancel={onCancel}
            cancelLabel="Cancel"
            onDelete={onDiscard}
            deleteLabel="Discard"
            size="lg"
          />
        </div>
      </MobileSheet>
    );
  }

  return (
    <Modal 
      isOpen={open} 
      onClose={onCancel} 
      footer={
        <ModalFooter
          onCancel={onCancel}
          cancelLabel="Cancel"
          onDelete={onDiscard}
          deleteLabel="Discard"
        />
      }
    >
      <Text>{message ?? 'You have unsaved changes. Discard them?'}</Text>
    </Modal>
  );
};

export default ConfirmDiscardModal;
