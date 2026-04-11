/**
 * @file ConfirmModal.tsx
 * @description Generic confirmation modal
 * @app SHARED - Renders at app level to confirm various actions
 * 
 * Listens to confirmStore and displays confirmation when requested.
 * Supports different variants (default, warning, danger) for visual styling.
 * 
 * Render this once at the app level (e.g., in page.tsx or layout).
 */
'use client';

import React from 'react';
import { Modal, Text, ModalFooter } from '@frameer/components/ui';
import { useConfirmStore, type ConfirmVariant } from '@frameer/stores/confirmStore';

const ConfirmModal: React.FC = () => {
  const { 
    isOpen, 
    title, 
    message, 
    detail, 
    confirmLabel, 
    cancelLabel, 
    variant,
    confirm, 
    cancel 
  } = useConfirmStore();
  
  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={cancel} 
      footer={
        <ModalFooter
          onCancel={cancel}
          cancelLabel={cancelLabel}
          onSubmit={confirm}
          submitLabel={confirmLabel}
          submitVariant={buttonVariant}
        />
      }
    >
      <Text>{message}</Text>
      {detail && (
        <Text className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {detail}
        </Text>
      )}
    </Modal>
  );
};

export default ConfirmModal;
