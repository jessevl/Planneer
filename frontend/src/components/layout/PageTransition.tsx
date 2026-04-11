import React, { useRef } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * PageTransition component that handles slide animations between routes.
 * It uses a key-based approach to trigger animations on route change.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const prevPathRef = useRef(location.pathname);
  const directionRef = useRef<'forward' | 'back'>('forward');

  // Determine direction when path changes
  if (location.pathname !== prevPathRef.current) {
    directionRef.current = getNavigationDirection(prevPathRef.current, location.pathname);
    prevPathRef.current = location.pathname;
  }

  // SAFARI FIX: Desktop uses NO animation. Any opacity animation on an ancestor
  // of contenteditable blocks causes Safari to promote it to a compositor layer,
  // and child blocks fail to repaint (they vanish). Mobile still animates because
  // the editor is not typically active during navigation transitions.
  const animationClass = isMobile 
    ? (directionRef.current === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left')
    : '';

  return (
    <div 
      key={location.pathname} 
      className={`flex-1 flex flex-col overflow-hidden w-full h-full ${animationClass}`}
    >
      {children}
    </div>
  );
};

/**
 * Heuristic to determine if we are going "forward" (deeper) or "back" (upwards)
 */
function getNavigationDirection(from: string, to: string): 'forward' | 'back' {
  // Define hierarchy levels
  const getLevel = (path: string) => {
    if (path === '/') return 0;
    if (path.startsWith('/pages')) {
      if (path === '/pages' || path === '/pages/') return 1;
      return 2; // Specific page
    }
    if (path.startsWith('/tasks')) return 1;
    return 1;
  };

  // Define horizontal order for top-level tabs
  const getOrder = (path: string) => {
    if (path === '/') return 0;
    if (path.startsWith('/pages')) return 1;
    if (path.startsWith('/tasks')) return 2;
    return 3;
  };

  const fromLevel = getLevel(from);
  const toLevel = getLevel(to);

  // Vertical navigation (deeper vs shallower)
  if (toLevel > fromLevel) return 'forward';
  if (toLevel < fromLevel) return 'back';
  
  // Horizontal navigation (between tabs or between pages at same level)
  const fromOrder = getOrder(from);
  const toOrder = getOrder(to);
  
  return toOrder >= fromOrder ? 'forward' : 'back';
}

export default PageTransition;
