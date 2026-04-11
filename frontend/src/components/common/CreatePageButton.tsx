/**
 * @file CreatePageButton.tsx
 * @description Split button for creating pages with different default view modes
 * 
 * Main button creates a standard page, dropdown allows choosing other view modes.
 * Similar to macOS/iOS "New Folder" split buttons.
 */
import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon, ChevronDownIcon } from '../common/Icons';
import type { PageViewMode } from '@/types/page';
import { createPageOptions } from '@/lib/viewModeConfig';

interface CreatePageButtonProps {
  onCreatePage: (viewMode: PageViewMode) => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CreatePageButton: React.FC<CreatePageButtonProps> = ({ 
  onCreatePage, 
  label = 'New Page',
  variant = 'primary',
  size = 'md',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMainClick = () => {
    onCreatePage('note'); // Default to note (standard page with editor)
  };

  const handleOptionClick = (viewMode: PageViewMode) => {
    onCreatePage(viewMode);
    setIsOpen(false);
  };

  const buttonBaseClass = size === 'lg'
    ? 'px-6 py-3 text-lg'
    : size === 'sm' 
      ? 'px-3 py-1.5 text-sm' 
      : 'px-4 py-2 text-base';

  const getVariantClasses = () => {
    if (variant === 'primary') {
      return {
        main: `${buttonBaseClass} inline-flex items-center gap-2 font-semibold bg-[var(--color-interactive-bg-strong)] hover:brightness-110 text-white rounded-l-lg transition-colors`,
        dropdown: `${buttonBaseClass} inline-flex items-center justify-center font-semibold bg-[var(--color-interactive-bg-strong)] hover:brightness-110 text-white border-l border-white/20 rounded-r-lg transition-colors`
      };
    } else if (variant === 'secondary') {
      return {
        main: `${buttonBaseClass} inline-flex items-center gap-2 font-semibold bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] rounded-l-lg transition-colors border border-[var(--color-border-default)]`,
        dropdown: `${buttonBaseClass} inline-flex items-center justify-center font-semibold bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border-l-0 border border-[var(--color-border-default)] rounded-r-lg transition-colors`
      };
    } else {
      return {
        main: `${buttonBaseClass} inline-flex items-center gap-2 font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] rounded-l-lg transition-colors`,
        dropdown: `${buttonBaseClass} inline-flex items-center justify-center font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] border-l border-[var(--color-border-default)] rounded-r-lg transition-colors`
      };
    }
  };

  const variantClasses = getVariantClasses();

  return (
    <div className={`relative inline-flex ${className}`} ref={dropdownRef}>
      {/* Main button */}
      <button
        onClick={handleMainClick}
        className={variantClasses.main}
      >
        <PlusIcon className="w-4 h-4" />
        <span>{label}</span>
      </button>

      {/* Dropdown trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={variantClasses.dropdown}
        title="Choose page type"
      >
        <ChevronDownIcon className="w-3 h-3" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-[var(--color-surface-primary)] border border-[var(--color-border-default)] rounded-xl shadow-lg z-50 p-1">
          {/* Header */}
          <div className="px-3 py-2 border-b border-[var(--color-border-default)]">
            <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
              Create New
            </span>
          </div>

          {/* Options */}
          {createPageOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-md transition-colors"
              >
                <OptionIcon className="w-5 h-5" />
                <div className="flex flex-col">
                  <span className="font-medium">{option.label}</span>
                  {option.description && (
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">{option.description}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CreatePageButton;
