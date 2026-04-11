/**
 * @file confirmStore.ts
 * @description Generic confirmation modal state management
 * @app SHARED - Used for any action requiring user confirmation
 * 
 * Similar to deleteConfirmStore but for generic confirmations.
 * Supports customizable title, message, confirm/cancel labels.
 * 
 * Usage:
 * 1. Call requestConfirm() with options and a callback
 * 2. ConfirmModal (rendered at app level) shows the confirmation
 * 3. On confirm, the callback is executed and modal closes
 * 4. On cancel, modal closes without action
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type ConfirmVariant = 'default' | 'warning' | 'danger';

interface ConfirmState {
  // Whether the modal is open
  isOpen: boolean;
  
  // Modal title
  title: string;
  
  // Main message
  message: string;
  
  // Secondary/detail message
  detail?: string;
  
  // Button labels
  confirmLabel: string;
  cancelLabel: string;
  
  // Visual variant
  variant: ConfirmVariant;
  
  // Callback to execute on confirmation
  onConfirm: (() => void) | null;
  
  // Actions
  requestConfirm: (options: {
    title: string;
    message: string;
    detail?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
    onConfirm: () => void;
  }) => void;
  
  confirm: () => void;
  cancel: () => void;
}

export const useConfirmStore = create<ConfirmState>()(
  devtools(
    (set, get) => ({
      isOpen: false,
      title: 'Confirm',
      message: '',
      detail: undefined,
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      variant: 'default',
      onConfirm: null,
      
      requestConfirm: ({ 
        title, 
        message, 
        detail, 
        confirmLabel = 'Confirm', 
        cancelLabel = 'Cancel',
        variant = 'default',
        onConfirm 
      }) => {
        set({
          isOpen: true,
          title,
          message,
          detail,
          confirmLabel,
          cancelLabel,
          variant,
          onConfirm,
        }, false, 'requestConfirm');
      },
      
      confirm: () => {
        const { onConfirm } = get();
        if (onConfirm) {
          onConfirm();
        }
        set({
          isOpen: false,
          onConfirm: null,
          detail: undefined,
        }, false, 'confirm');
      },
      
      cancel: () => {
        set({
          isOpen: false,
          onConfirm: null,
          detail: undefined,
        }, false, 'cancel');
      },
    }),
    { name: 'confirm-store' }
  )
);
