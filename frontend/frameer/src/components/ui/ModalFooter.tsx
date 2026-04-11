/**
 * @file ModalFooter.tsx
 * @description Reusable modal footer with consistent button styling
 * @app SHARED - Standard footer pattern for all modals
 * 
 * Based on AddTaskForm button styles with glass/glow effects:
 * - Cancel button: ghost variant with subtle border
 * - Save/Submit button: primary variant with blue glow shadow
 * - Delete button: danger-outline variant with red outline styling
 * 
 * Mobile: Full-width stacked buttons
 * Desktop: Right-aligned inline buttons
 */
import React from 'react';
import Button from './Button';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { cn } from '@frameer/lib/design-system';

export interface ModalFooterProps {
  /** Cancel button click handler - will render Cancel button if provided */
  onCancel?: () => void;
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string;
  /** Submit/Save button click handler - will render primary button if provided */
  onSubmit?: (e?: any) => void;
  /** Submit button label (default: "Save") */
  submitLabel?: string;
  /** Whether submit button is disabled */
  submitDisabled?: boolean;
  /** Whether submit action is in progress (shows loading state) */
  isSubmitting?: boolean;
  /** Submit button variant (default: "primary") */
  submitVariant?: 'primary' | 'danger' | 'secondary' | 'ghost';
  /** Delete button click handler - will render danger button if provided */
  onDelete?: () => void;
  /** Delete button label (default: "Delete") */
  deleteLabel?: string;
  /** Custom buttons to render (overrides standard buttons) */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Button size override */
  size?: 'sm' | 'md' | 'lg';
  /** Form ID to associate the submit button with */
  formId?: string;
}

/**
 * ModalFooter - Standardized modal footer with glass/glow button styling
 * 
 * Uses AddTaskForm button patterns:
 * - Cancel: ghost + border border-[var(--color-border-default)]
 * - Delete: danger-outline variant
 * - Submit: primary + shadow-lg shadow-blue-500/20 (glow effect)
 */
const ModalFooter: React.FC<ModalFooterProps> = ({
  onCancel,
  cancelLabel = 'Cancel',
  onSubmit,
  submitLabel = 'Save',
  submitDisabled = false,
  isSubmitting = false,
  submitVariant = 'primary',
  onDelete,
  deleteLabel = 'Delete',
  children,
  className = '',
  size,
  formId,
}) => {
  const isMobile = useIsMobile();
  
  // Determine button size
  const buttonSize = size || (isMobile ? 'lg' : 'md');
  
  // Common button styles matching AddTaskForm
  const cancelButtonClass = "border border-[var(--color-border-default)]";
  const submitButtonClass = submitVariant === 'primary' ? "shadow-lg shadow-[var(--color-interactive-bg-strong)]/20" : "";
  
  // If custom children are provided, render those
  if (children) {
    return (
      <div className={cn(
        "flex gap-2 w-full",
        isMobile ? "flex-col" : "justify-end",
        className
      )}>
        {children}
      </div>
    );
  }
  
  // Standard layout: delete on left, cancel/submit on right
  return (
    <div className={cn(
      "flex gap-2 w-full",
      isMobile ? "flex-col" : "justify-between items-center",
      className
    )}>
      {isMobile ? (
        // Mobile: stacked buttons
        <>
          {onDelete && (
            <Button
              type="button"
              onClick={onDelete}
              variant="danger-outline"
              size={buttonSize}
              className="w-full"
            >
              {deleteLabel}
            </Button>
          )}
          <div className="flex gap-2">
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                variant="ghost"
                size={buttonSize}
                className={cn("flex-1", cancelButtonClass)}
              >
                {cancelLabel}
              </Button>
            )}
            {onSubmit || formId ? (
              <Button
                type="submit"
                form={formId}
                onClick={onSubmit}
                variant={submitVariant}
                size={buttonSize}
                disabled={submitDisabled || isSubmitting}
                className={cn("flex-1", submitButtonClass)}
              >
                {isSubmitting ? 'Saving...' : submitLabel}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        // Desktop: delete on left, others on right
        <>
          <div>
            {onDelete && (
              <Button
                type="button"
                onClick={onDelete}
                variant="danger-outline"
                size={buttonSize}
              >
                {deleteLabel}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                variant="ghost"
                size={buttonSize}
                className={cancelButtonClass}
              >
                {cancelLabel}
              </Button>
            )}
            {onSubmit || formId ? (
              <Button
                type="submit"
                form={formId}
                onClick={onSubmit}
                variant={submitVariant}
                size={buttonSize}
                disabled={submitDisabled || isSubmitting}
                className={submitButtonClass}
              >
                {isSubmitting ? 'Saving...' : submitLabel}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default ModalFooter;
