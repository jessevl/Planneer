import React from 'react';
import Panel from './Panel';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1.5 tracking-tight">
            {label}
          </label>
        )}
        <Panel opacity="subtle" className="rounded-xl">
          <textarea
            ref={ref}
            className={`w-full px-4 py-2.5 text-base font-medium bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-emphasis)]/50 transition-all resize-none ${className}`}
            {...props}
          />
        </Panel>
        {error && (
          <p className="mt-1.5 text-sm font-medium text-[var(--color-state-error)]">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
