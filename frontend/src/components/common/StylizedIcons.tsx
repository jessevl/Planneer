/**
 * @file StylizedIcons.tsx
 * @description Stylized SVG icons for page view modes (Note, Collection, Tasks, Daily)
 * @app SHARED - Used across sidebar, modals, toggles, and badges
 * 
 * Extracted to a standalone file to avoid circular dependency issues
 * (e.g. PageModeToggle ↔ ItemPropertiesModal).
 */
import React from 'react';

export interface StylizedIconProps {
  color?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
};

/**
 * Stylized Note Icon - Modern document with gradient capability
 */
export const StylizedNoteIcon: React.FC<StylizedIconProps> = ({ color = '#64748b', className, size = 'md' }) => {
  const fillColor = color || '#64748b';
  
  return (
    <svg 
      className={`${sizeClasses[size]} ${className || ''}`}
      viewBox="0 0 24 24" 
      fill="none"
    >
      <path 
        d="M6 3C5.44772 3 5 3.44772 5 4V20C5 20.5523 5.44772 21 6 21H18C18.5523 21 19 20.5523 19 20V8L14 3H6Z"
        fill={fillColor}
        opacity="0.15"
      />
      <path 
        d="M14 3H6C5.44772 3 5 3.44772 5 4V20C5 20.5523 5.44772 21 6 21H18C18.5523 21 19 20.5523 19 20V8L14 3ZM14 3V7C14 7.55228 14.4477 8 15 8H19"
        stroke={fillColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M8 12H16M8 16H13" stroke={fillColor} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
};

/**
 * Stylized Collection Icon - Folder/container with stacked appearance
 */
export const StylizedCollectionIcon: React.FC<StylizedIconProps> = ({ color = '#64748b', className, size = 'md' }) => {
  const fillColor = color || '#64748b';
  
  return (
    <svg 
      className={`${sizeClasses[size]} ${className || ''}`}
      viewBox="0 0 24 24" 
      fill="none"
    >
      <rect x="5" y="4" width="14" height="16" rx="2" fill={fillColor} opacity="0.15" />
      <path 
        d="M4 8C4 6.89543 4.89543 6 6 6H9L10.5 8H18C19.1046 8 20 8.89543 20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V8Z"
        fill={fillColor}
        opacity="0.25"
      />
      <path 
        d="M4 8C4 6.89543 4.89543 6 6 6H9L10.5 8H18C19.1046 8 20 8.89543 20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V8Z"
        stroke={fillColor}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
};

/**
 * Stylized Task Icon - Square with checkmark, colorable with closed area
 */
export const StylizedTaskIcon: React.FC<StylizedIconProps> = ({ color = '#64748b', className, size = 'md' }) => {
  const fillColor = color || '#64748b';
  
  return (
    <svg 
      className={`${sizeClasses[size]} ${className || ''}`}
      viewBox="0 0 24 24" 
      fill="none"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" fill={fillColor} opacity="0.15" />
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={fillColor} strokeWidth="1.5" fill="none" />
      <path d="M8 12l3 3 5-6" stroke={fillColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
};

/**
 * Stylized Daily/Calendar Icon - Calendar with date number
 */
export const StylizedDailyIcon: React.FC<StylizedIconProps> = ({ color = '#64748b', className, size = 'md' }) => {
  const fillColor = color || '#64748b';
  const dayNumber = new Date().getDate();
  
  return (
    <svg 
      className={`${sizeClasses[size]} ${className || ''}`}
      viewBox="0 0 24 24" 
      fill="none"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" fill={fillColor} opacity="0.15" />
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={fillColor} strokeWidth="1.5" fill="none" />
      <path d="M16 3v4M8 3v4" stroke={fillColor} strokeWidth="1.5" strokeLinecap="round" />
      <text
        x="12" y="16" textAnchor="middle" fill={fillColor}
        fontSize="8" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif"
      >
        {dayNumber}
      </text>
    </svg>
  );
};
