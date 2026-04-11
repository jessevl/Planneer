import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ 
  checked, 
  onChange, 
  label,
  disabled = false 
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 ${
        checked 
          ? 'bg-[var(--color-control-checked-bg)] border-[var(--color-control-checked-border)]' 
          : 'bg-[var(--color-surface-tertiary)] border-[var(--color-border-default)]'
      } border disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span
        className={`inline-block w-5 h-5 transform rounded-full bg-white border border-[var(--color-border-default)] transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
};

export default Toggle;
