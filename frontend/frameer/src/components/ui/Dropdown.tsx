import React from 'react';

interface DropdownProps {
  children: React.ReactNode;
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-[var(--color-surface-primary)] border border-[var(--color-border-default)] rounded-xl p-1 ${className}`}>
      {children}
    </div>
  );
};

interface DropdownItemProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({ 
  children, 
  active = false, 
  onClick,
  icon,
  className = '' 
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)] border border-[var(--color-accent-emphasis)]/30'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-transparent'
      } ${className}`}
    >
      {icon && <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>}
      <span className="flex-1 text-left">{children}</span>
    </button>
  );
};

export default Dropdown;
