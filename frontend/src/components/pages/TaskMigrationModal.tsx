/**
 * @file TaskMigrationModal.tsx
 * @description Confirmation modal for migrating tasks to inbox when changing page mode
 * @app PAGES - Used when converting task collection pages to other modes
 */
'use client';

import React from 'react';
import { Modal, Button, Text, TextSmall, ModalFooter } from '@/components/ui';

interface TaskMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskCount: number;
  pageName: string;
}

/**
 * TaskMigrationModal - Confirms migration of tasks to inbox when changing from tasks mode
 * 
 * Displays when user tries to change a task collection page to another mode (note, collection)
 * and there are existing tasks assigned to that page.
 */
const TaskMigrationModal: React.FC<TaskMigrationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  taskCount,
  pageName,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          onSubmit={onConfirm}
          submitLabel="Move to Inbox"
        />
      }
    >
      <div className="space-y-4">
        <Text>
          This page currently has <strong>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</strong> assigned to it.
        </Text>
        
        <Text>
          Changing the page mode will move {taskCount === 1 ? 'this task' : 'these tasks'} to your Inbox. 
          You can reassign {taskCount === 1 ? 'it' : 'them'} to a different tasks page later.
        </Text>
      </div>
    </Modal>
  );
};

export default TaskMigrationModal;
