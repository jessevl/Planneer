/**
 * @file MobileDrawer.tsx
 * @description Mobile full-screen drawer wrapper for sidebar content
 * @app MOBILE - Transforms sidebar into full-screen overlay on mobile
 * 
 * Wraps children (typically UnifiedSidebar content) in a full-screen drawer
 * that appears from the left edge on mobile devices.
 * 
 * Features:
 * - Full-screen on mobile for maximum content area
 * - Swipe-to-close gesture (swipe left to close)
 * - Slide in/out animation
 * - Safe area padding for notched devices
 * - Keyboard escape to close
 * - Focus trap when open
 * - Body scroll lock when open
 * - FAB button handles open/close (no close button in drawer)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/design-system';
import { usePrefersReducedMotion } from '@frameer/hooks/useMobileDetection';

// ============================================================================
// TYPES
// ============================================================================

interface MobileDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Content to render inside the drawer */
  children: React.ReactNode;
  /** Optional: position from which drawer slides (default: bottom) */
  position?: 'left' | 'right' | 'bottom';
  /** Optional: additional class for the drawer panel */
  className?: string;
}

// Swipe threshold in pixels (increased to prevent accidental closes)
const SWIPE_THRESHOLD = 150;

// ============================================================================
// COMPONENT
// ============================================================================

const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  children,
  position = 'bottom',
  className = '',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Use refs for swipe tracking to avoid re-renders during gesture
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartOnHandleRef = useRef<boolean>(false);
  const swipeOffsetRef = useRef(0);
  
  // Only use state for isSwiping to control animation class
  const [isSwiping, setIsSwiping] = useState(false);
  
  // Animation state (mounted pattern for CSS transitions - like Modal)
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  
  // Trigger animation after mount
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to allow CSS transition to trigger
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
      // Wait for animation to complete before unmounting
      const t = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);
  
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
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  // Focus trap - focus close button when opened
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const closeButton = drawerRef.current.querySelector('[data-drawer-close]');
      if (closeButton) {
        (closeButton as HTMLElement).focus();
      }
    }
  }, [isOpen]);
  
  // Reset swipe state when closed
  useEffect(() => {
    if (!isOpen) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      swipeOffsetRef.current = 0;
      setIsSwiping(false);
    }
  }, [isOpen]);
  
  // Handle touch start - track both X and Y
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't interfere with interactive elements (buttons, inputs, links, etc.)
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, textarea, select, [role="button"]');
    const isHandle = target.closest('[data-drawer-handle]');
    
    touchStartOnHandleRef.current = !!isHandle;

    if (isInteractive && !isHandle) {
      // Don't interfere with button clicks - just don't track this touch
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return; // Don't track swipes for interactive elements
    }
    
    // Only track touches on non-interactive areas or the handle
    touchStartXRef.current = e.targetTouches[0].clientX;
    touchStartYRef.current = e.targetTouches[0].clientY;
    swipeOffsetRef.current = 0;
    // Don't set isSwiping state yet - wait for actual movement
  }, []);
  
  // Handle touch move - update DOM directly for smooth animation
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    
    const currentTouchX = e.targetTouches[0].clientX;
    const currentTouchY = e.targetTouches[0].clientY;
    
    // Calculate offset based on position
    let diff: number;
    if (position === 'bottom') {
      // For bottom drawer: swipe down to close
      diff = currentTouchY - touchStartYRef.current;
    } else if (position === 'left') {
      // For left drawer: swipe left to close
      diff = touchStartXRef.current - currentTouchX;
    } else {
      // For right drawer: swipe right to close
      diff = currentTouchX - touchStartXRef.current;
    }
    
    // Only consider it a swipe if moved more than 10px (distinguish tap from swipe)
    if (Math.abs(diff) > 10 && !isSwiping) {
      // For bottom drawer, only allow swiping if it started on the handle
      if (position === 'bottom' && !touchStartOnHandleRef.current) {
        return;
      }
      setIsSwiping(true);
    }
    
    // Only allow positive offset (pulling away to close)
    const maxOffset = position === 'bottom' ? window.innerHeight : window.innerWidth;
    const newOffset = diff > 0 ? Math.min(diff, maxOffset) : 0;
    swipeOffsetRef.current = newOffset;
    
    // Only apply transform if actually swiping
    if (isSwiping && newOffset > 10) {
      // Update DOM directly for smooth animation (no React re-render)
      if (drawerRef.current) {
        let transform: string;
        if (position === 'bottom') {
          transform = `translateY(${newOffset}px)`;
        } else if (position === 'left') {
          transform = `translateX(${-newOffset}px)`;
        } else {
          transform = `translateX(${newOffset}px)`;
        }
        drawerRef.current.style.transform = transform;
      }
      if (backdropRef.current) {
        const opacity = Math.max(0, 0.5 - (newOffset / maxOffset) * 0.5);
        backdropRef.current.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
      }
    }
  }, [position, isSwiping]);
  
  // Handle touch end
  const onTouchEnd = useCallback(() => {
    const offset = swipeOffsetRef.current;
    
    // If swiped far enough, close the drawer
    if (offset > SWIPE_THRESHOLD) {
      onClose();
    } else {
      // Reset position with animation
      if (drawerRef.current) {
        drawerRef.current.style.transition = 'transform 0.2s ease-out';
        drawerRef.current.style.transform = '';
        setTimeout(() => {
          if (drawerRef.current) {
            drawerRef.current.style.transition = '';
          }
        }, 200);
      }
      if (backdropRef.current) {
        backdropRef.current.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      }
    }
    
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    swipeOffsetRef.current = 0;
    setIsSwiping(false);
  }, [onClose]);
  
  // Don't render anything if closed (for better performance)
  if (!shouldRender) return null;
  
  const transitionDuration = prefersReducedMotion ? 'duration-0' : 'duration-200';
  
  // Transition classes based on position and mounted state
  const getTransformClasses = () => {
    if (isSwiping) return ''; // No transition class during swipe
    
    if (position === 'bottom') {
      return `transition-transform ${transitionDuration} ${mounted ? 'translate-y-0' : 'translate-y-full'}`;
    } else if (position === 'left') {
      return `transition-transform ${transitionDuration} ${mounted ? 'translate-x-0' : '-translate-x-full'}`;
    } else {
      return `transition-transform ${transitionDuration} ${mounted ? 'translate-x-0' : 'translate-x-full'}`;
    }
  };
  
  return createPortal(
    <div 
      className={`fixed inset-0 z-[220] ${!isOpen ? 'pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div 
        ref={backdropRef}
        className={`
          fixed inset-0
          backdrop-blur-sm
          transition-all ${transitionDuration}
          ${mounted ? 'bg-black/50' : 'bg-black/0'}
          eink-modal-backdrop
        `}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className={`
          fixed
          ${position === 'bottom' ? 'bottom-0 left-0 right-0 rounded-t-2xl' : position === 'left' ? 'left-0 top-0 bottom-0 w-[85vw] max-w-[320px]' : 'right-0 top-0 bottom-0 w-[85vw] max-w-[320px]'}
          bg-[var(--color-surface-base)]
          overflow-hidden
          flex flex-col
          ${getTransformClasses()}
          ${position !== 'bottom' ? 'shadow-2xl' : ''}
          eink-shell-surface
          ${className}
          ${position === 'bottom' ? 'shadow-2xl shadow-black/25 dark:shadow-black/50 border-t border-[var(--color-border-default)]' : ''}
        `}
        style={{
          ...(position === 'bottom' 
            ? { 
                maxHeight: 'calc(100dvh - env(safe-area-inset-top) - 1rem)',
                height: '100%',
                minHeight: '40vh',
                top: 'auto',
                bottom: 0,
                paddingBottom: 'env(safe-area-inset-bottom)',
              }
            : {
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: position === 'left' ? 'env(safe-area-inset-left)' : undefined,
                paddingRight: position === 'right' ? 'env(safe-area-inset-right)' : undefined,
              }
          ),
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Handle bar for bottom drawer */}
        {position === 'bottom' && (
          <div 
            data-drawer-handle="true"
            className="flex justify-center py-2 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border-subtle)] flex-shrink-0 cursor-grab active:cursor-grabbing eink-shell-surface-secondary"
          >
            <div className="w-10 h-1 bg-[var(--color-border-default)] rounded-full" />
          </div>
        )}
        
        {/* Close button for side drawers */}
        {position !== 'bottom' && (
          <button
            onClick={onClose}
            data-drawer-close
            className="
              absolute top-3 right-3 z-10
              w-8 h-8 rounded-full
              flex items-center justify-center
              bg-[var(--color-surface-secondary)]
              text-[var(--color-text-secondary)]
              hover:bg-[var(--color-surface-hover)]
              transition-colors
              eink-header-button
            "
            style={{ marginTop: 'env(safe-area-inset-top)' }}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        )}
        
        {/* Content */}
        <div className={cn(
          'flex-1 flex flex-col min-h-0 overflow-y-auto',
          position !== 'bottom' && 'pt-12'
        )}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileDrawer;
