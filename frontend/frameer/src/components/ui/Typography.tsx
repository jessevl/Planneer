import React from 'react';

interface HeadingProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
  onClick?: () => void;
}

export const H1: React.FC<HeadingProps> = ({ children, className = '', gradient = false, onClick }) => {
  const gradientClass = gradient
    ? 'bg-gradient-to-br from-[var(--color-text-primary)] via-[var(--color-text-secondary)] to-[var(--color-text-primary)] bg-clip-text text-transparent'
    : 'text-[var(--color-text-primary)]';
  
  return (
    <h1 className={`text-4xl md:text-5xl font-bold tracking-tight ${gradientClass} ${className}`} onClick={onClick}>
      {children}
    </h1>
  );
};

export const H2: React.FC<HeadingProps> = ({ children, className = '', gradient = false, onClick }) => {
  const gradientClass = gradient
    ? 'bg-gradient-to-br from-[var(--color-text-primary)] via-[var(--color-text-secondary)] to-[var(--color-text-primary)] bg-clip-text text-transparent'
    : 'text-[var(--color-text-primary)]';
  
  return (
    <h2 className={`text-3xl md:text-4xl font-bold tracking-tight ${gradientClass} ${className}`} onClick={onClick}>
      {children}
    </h2>
  );
};

export const H3: React.FC<HeadingProps> = ({ children, className = '', gradient = false, onClick }) => {
  const gradientClass = gradient
    ? 'bg-gradient-to-br from-[var(--color-text-primary)] via-[var(--color-text-secondary)] to-[var(--color-text-primary)] bg-clip-text text-transparent'
    : 'text-[var(--color-text-primary)]';
  
  return (
    <h3 className={`text-2xl md:text-3xl font-bold tracking-tight ${gradientClass} ${className}`} onClick={onClick}>
      {children}
    </h3>
  );
};

export const H4: React.FC<HeadingProps> = ({ children, className = '', gradient = false, onClick }) => {
  const gradientClass = gradient
    ? 'bg-gradient-to-br from-[var(--color-text-primary)] via-[var(--color-text-secondary)] to-[var(--color-text-primary)] bg-clip-text text-transparent'
    : 'text-[var(--color-text-primary)]';
  
  return (
    <h4 className={`text-xl md:text-2xl font-bold tracking-tight ${gradientClass} ${className}`} onClick={onClick}>
      {children}
    </h4>
  );
};

interface TextProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Text: React.FC<TextProps> = ({ children, className = '', title }) => {
  return (
    <p className={`text-base font-medium text-[var(--color-text-secondary)] ${className}`} title={title}>
      {children}
    </p>
  );
};

export const TextSmall: React.FC<TextProps> = ({ children, className = '', title }) => {
  return (
    <span className={`text-sm font-medium text-[var(--color-text-tertiary)] ${className}`} title={title}>
      {children}
    </span>
  );
};

interface LabelProps {
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export const Label: React.FC<LabelProps> = ({ children, className = '', htmlFor }) => {
  return (
    <label htmlFor={htmlFor} className={`text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] ${className}`}>
      {children}
    </label>
  );
};
