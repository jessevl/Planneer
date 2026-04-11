/**
 * @file MobileSheet.tsx
 * @description Bottom sheet component for mobile-friendly dialogs and menus
 * @app MOBILE - Alternative to modals/dropdowns on touch devices
 * 
 * A slide-up sheet that appears from the bottom of the screen, providing
 * a more natural interaction pattern on mobile devices.
 * 
 * Features:
 * - Slides up from bottom with animation
 * - Backdrop with click-to-close
 * - Safe area padding for home indicator
 * - Drag handle for visual affordance
 * - Keyboard escape to close
 * - Focus trap when open
 * - Body scroll lock
 * - Drag-to-close gesture (swipe down)
 * 
 * Touch Interaction Architecture:
 * - Interactive elements (buttons, inputs) use standard onClick handlers
 * - Swipe-to-close gesture is ONLY attached to the drag handle area
 * - Content area has NO touch handlers - buttons work naturally with onClick
 * - This prevents conflicts between taps and swipes by spatial separation
 * 
 * Performance:
 * - Swipe gestures use direct DOM manipulation via inline styles
 * - CSS animations for open/close (no JS animation loop)
 * - To prevent choppy swiping, ensure children are properly memoized
 *   and avoid expensive computations during renders
 * 
 * Usage Pattern for Children:
 * - Use simple onClick handlers for buttons (no pointer events, no preventDefault)
 * - The sheet automatically handles the tap vs swipe distinction
 * - Example: <button onClick={() => handleAction()}>Action</button>
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { usePrefersReducedMotion } from '@frameer/hooks/useMobileDetection';
import { IconButton } from '@frameer/components/ui';

// ============================================================================
// CONSTANTS
// ============================================================================

const SWIPE_THRESHOLD = 150; // Minimum distance to trigger close (increased to prevent accidental closes)

// ============================================================================
// TYPES
// ============================================================================

interface MobileSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Callback when sheet should close */
  onClose: () => void;
  /** Content to render inside the sheet */
  children: React.ReactNode;
  /** Optional title for the sheet header */
  title?: string;
  /** Optional: show close button in header (default: true) */
  showCloseButton?: boolean;
  /** Optional: show drag handle at top (default: true) */
  showDragHandle?: boolean;
  /** Optional: max height as percentage or CSS value (default: 90vh) */
  maxHeight?: string;
  /** Optional: whether clicking backdrop closes sheet (default: true) */
  closeOnBackdropClick?: boolean;
  /** Optional: additional class for the sheet panel */
  className?: string;
  /** Optional: prevent swipe-to-close gesture (for forms with unsaved changes) */
  preventSwipeClose?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

const MobileSheet: React.FC<MobileSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
  showDragHandle = true,
  maxHeight = '90vh',
  closeOnBackdropClick = true,
  className = '',
  preventSwipeClose = false,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Use refs for swipe tracking to avoid re-renders during gesture
  const touchStartYRef = useRef<number | null>(null);
  const swipeOffsetRef = useRef(0);
  const isSwipingRef = useRef(false);
  
  // Only use state for isSwiping to control animation class
  const [isSwiping, setIsSwiping] = useState(false);
  
  // Animation state (mounted pattern for CSS transitions - like Modal)
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Trigger animation after mount
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow CSS transition to trigger
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
    }
  }, [isOpen]);
  
  // Animated close handler
  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setMounted(false);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);
  
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isClosing) {
        handleAnimatedClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isClosing, handleAnimatedClose]);
  
  // Focus trap - focus sheet when opened
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      const focusable = sheetRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        (focusable[0] as HTMLElement).focus();
      }
    }
  }, [isOpen]);
  
  // Reset swipe state when closed
  useEffect(() => {
    if (!isOpen) {
      touchStartYRef.current = null;
      swipeOffsetRef.current = 0;
      isSwipingRef.current = false;
      setIsSwiping(false);
      setIsClosing(false);
    }
  }, [isOpen]);
  
  // Handle touch start for drag-to-close (only on drag handle and header)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // If swipe close is prevented, don't track touch
    if (preventSwipeClose) return;
    
    // Track the start position
    touchStartYRef.current = e.targetTouches[0].clientY;
    swipeOffsetRef.current = 0;
    isSwipingRef.current = false;
    // Don't set isSwiping state yet - wait for actual movement
  }, [preventSwipeClose]);
  
  // Handle touch move - update DOM directly for smooth animation
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    
    const currentTouchY = e.targetTouches[0].clientY;
    const diff = currentTouchY - touchStartYRef.current;
    
    // Only consider it a swipe if moved more than 10px (distinguish tap from swipe)
    if (Math.abs(diff) > 10 && !isSwipingRef.current) {
      isSwipingRef.current = true;
      setIsSwiping(true);
    }
    
    // Only allow positive offset (pulling down to close)
    const newOffset = diff > 0 ? Math.min(diff, window.innerHeight) : 0;
    swipeOffsetRef.current = newOffset;
    
    // Only apply transform if actually swiping
    if (isSwipingRef.current) {
      // Update DOM directly for smooth animation (no React re-render)
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${newOffset}px)`;
      }
      if (backdropRef.current) {
        const opacity = Math.max(0, 0.5 - (newOffset / window.innerHeight) * 0.5);
        backdropRef.current.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
      }
    }
  }, []);
  
  // Handle touch end
  const onTouchEnd = useCallback(() => {
    const offset = swipeOffsetRef.current;
    
    // If swiped far enough, close the sheet
    if (offset > SWIPE_THRESHOLD) {
      onClose();
    } else {
      // Reset position with animation
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.2s ease-out';
        sheetRef.current.style.transform = 'translateY(0)';
        setTimeout(() => {
          if (sheetRef.current) {
            sheetRef.current.style.transition = '';
          }
        }, 200);
      }
      if (backdropRef.current) {
        backdropRef.current.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      }
    }
    
    touchStartYRef.current = null;
    swipeOffsetRef.current = 0;
    isSwipingRef.current = false;
    setIsSwiping(false);
  }, [onClose]);
  
  if (!isOpen) return null;
  
  const transitionDuration = prefersReducedMotion ? 'duration-0' : 'duration-200';
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[200] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'mobile-sheet-title' : undefined}
    >
      {/* Backdrop */}
      <div 
        ref={backdropRef}
        className={`
          absolute inset-0
          backdrop-blur-sm
          transition-all ${transitionDuration}
          ${mounted ? 'bg-black/50' : 'bg-black/0'}
          pointer-events-auto
          eink-modal-backdrop
        `}
        onClick={closeOnBackdropClick ? (e) => {
          // Only close if clicking the backdrop itself, not child elements
          if (e.target === e.currentTarget && !isClosing) {
            handleAnimatedClose();
          }
        } : undefined}
        aria-hidden="true"
      />
      
      {/* Sheet Panel */}
      <div
        ref={sheetRef}
        className={`
          absolute bottom-0 left-0 right-0
          bg-[var(--color-surface-secondary)]
          rounded-t-2xl
          shadow-2xl
          overflow-hidden
          flex flex-col
          transform transition-transform ${transitionDuration}
          ${mounted && !isSwiping && !isClosing ? 'translate-y-0' : 'translate-y-full'}
          pointer-events-auto
          eink-shell-surface-secondary eink-modal-surface-secondary
          ${className}
        `}
        style={{ 
          maxHeight,
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        {showDragHandle && (
          <div 
            className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-[var(--color-border-emphasis)]" />
          </div>
        )}
        
        {/* Header (if title or close button) - also supports swipe-to-close */}
        {(title || showCloseButton) && (
          <div 
            className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-default)] eink-shell-surface-secondary"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {title && (
              <h2 
                id="mobile-sheet-title"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                {title}
              </h2>
            )}
            {!title && <div />}
            {showCloseButton && (
              <IconButton
                onClick={handleAnimatedClose}
                variant="ghost"
                size="sm"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </IconButton>
            )}
          </div>
        )}
        
        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ 
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileSheet;

// ============================================================================
// UTILITY: useSheet hook for easier sheet management
// ============================================================================

export function useSheet() {
  const [isOpen, setIsOpen] = useState(false);
  
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  
  return { isOpen, open, close, toggle };
}
