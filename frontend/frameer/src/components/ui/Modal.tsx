import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@frameer/lib/design-system';
import { H2 } from './Typography';
import { XIcon } from '../common/Icons';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  /** Hide the header entirely (for custom content) */
  hideHeader?: boolean;
  /** Show close button in corner */
  showCloseButton?: boolean;
  /** Force full-screen on mobile (default: true for lg/xl sizes) */
  mobileFullScreen?: boolean;
  /** Custom z-index (default: 200, above MobileSheet which is 150) */
  zIndex?: number;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = 'md',
  hideHeader = false,
  showCloseButton = true,
  mobileFullScreen,
  zIndex = 200,
}) => {
  // Animate on mount
  const [mounted, setMounted] = useState(false);
  // Track if we're in browser for portal
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  // Mobile detection for full-screen mode
  const isMobile = useIsMobile();
  
  // Determine if we should use full-screen on mobile
  // Default: true for md/lg/xl sizes (all modals except sm), false for sm only
  const useFullScreen = isMobile && (mobileFullScreen ?? (size !== 'sm'));
  
  useEffect(() => {
    // Set portal container on mount (client-side only)
    setPortalContainer(document.body);
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow CSS transition to trigger
      const t = setTimeout(() => setMounted(true), 10);
      // Lock body scroll on mobile full-screen
      if (useFullScreen) {
        document.body.style.overflow = 'hidden';
      }
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
      };
    } else {
      setMounted(false);
    }
  }, [isOpen, useFullScreen]);

  if (!isOpen || !portalContainer) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full',
  };

  // Full-screen mobile modal
  if (useFullScreen) {
    return createPortal(
      <div 
        className={`fixed inset-0 flex flex-col bg-[var(--color-surface-secondary)] transition-all duration-300 eink-shell-surface-secondary ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ 
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex,
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Mobile header with close button */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 pt-5 pb-1">
          <h2 className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest truncate">
            {title || ''}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors eink-header-button"
              aria-label="Close"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {children}
        </div>

        {/* Footer - fixed at bottom */}
        {footer && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-[var(--color-border-default)] flex gap-2 justify-end bg-[var(--color-surface-secondary)] eink-shell-surface-secondary">
            {footer}
          </div>
        )}
      </div>,
      portalContainer
    );
  }

  // Standard centered modal (desktop and small mobile modals)
  return createPortal(
    <div 
      className={`fixed inset-0 flex items-center justify-center transition-all duration-300 eink-modal-backdrop ${mounted ? 'bg-black/30 backdrop-blur-[3px]' : 'bg-black/0 backdrop-blur-0'}`}
      style={{ zIndex, transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      onClick={onClose}
    >
      <div
        className={`relative bg-[var(--color-surface-secondary)] rounded-xl w-full ${sizeClasses[size]} mx-4 shadow-2xl shadow-black/20 dark:shadow-black/40 border border-[var(--color-border-subtle)] transform transition-all duration-300 eink-shell-surface-secondary eink-modal-surface-secondary ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.95]'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors eink-header-button"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        {!hideHeader && title && (
          <div className="px-6 pt-5 pb-1">
            <h2 className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest pr-8">
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        <div className={cn(
          "px-6 pb-2",
          (hideHeader || !title) && "pt-8"
        )}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--color-border-subtle)] flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    portalContainer
  );
};

export default Modal;
