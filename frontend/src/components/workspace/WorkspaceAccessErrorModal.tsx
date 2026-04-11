/**
 * @file WorkspaceAccessErrorModal.tsx
 * @description Modal shown when user loses access to a workspace
 * @app WORKSPACE - Access error handling
 *
 * Displayed when:
 * - User was removed from a workspace
 * - Workspace was deleted
 * - User tries to access a workspace they don't have access to
 */
import React from 'react';
import { AlertTriangle, Home, FolderOpen } from 'lucide-react';
import { Modal } from '@/components/ui';
import { Button } from '@/components/ui';
import { ModalFooter } from '@/components/ui';

interface WorkspaceAccessErrorModalProps {
  isOpen: boolean;
  /** Type of access error */
  errorType: 'removed' | 'deleted' | 'not_found';
  /** Name of the workspace (if known) */
  workspaceName?: string;
  /** Switch to another workspace */
  onSwitchWorkspace: () => void;
  /** Go to home/dashboard */
  onGoHome: () => void;
  /** Optional dismiss handler */
  onDismiss?: () => void;
}

const ERROR_MESSAGES = {
  removed: {
    title: 'Workspace Access Removed',
    message: 'You have been removed from this workspace by an administrator.',
    detail: 'Contact the workspace owner if you think this was a mistake.',
  },
  deleted: {
    title: 'Workspace Deleted',
    message: 'This workspace has been deleted.',
    detail: 'All data in this workspace has been permanently removed.',
  },
  not_found: {
    title: 'Workspace Not Found',
    message: 'The workspace you\'re trying to access doesn\'t exist.',
    detail: 'It may have been deleted or you may not have access to it.',
  },
};

/**
 * Modal displayed when user loses workspace access
 */
export const WorkspaceAccessErrorModal: React.FC<WorkspaceAccessErrorModalProps> = ({
  isOpen,
  errorType,
  workspaceName,
  onSwitchWorkspace,
  onGoHome,
  onDismiss,
}) => {
  const content = ERROR_MESSAGES[errorType];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDismiss || onGoHome}
      showCloseButton={false}
      footer={
        <ModalFooter
          onSubmit={onSwitchWorkspace}
          onCancel={onGoHome}
          submitLabel="Switch Workspace"
          cancelLabel="Go to Dashboard"
        />
      }
    >
      <div className="text-center py-4">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 
                      flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>

        {/* Workspace name */}
        {workspaceName && (
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            "{workspaceName}"
          </p>
        )}

        {/* Message */}
        <p className="text-[var(--color-text-secondary)] mb-2">
          {content.message}
        </p>
        
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {content.detail}
        </p>
      </div>
    </Modal>
  );
};

export default WorkspaceAccessErrorModal;
