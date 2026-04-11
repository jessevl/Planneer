import React from 'react';

interface DividerProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

const Divider: React.FC<DividerProps> = ({ 
  className = '', 
  orientation = 'horizontal' 
}) => {
  const baseClasses = 'border-[var(--color-border-subtle)]';
  const orientationClass = orientation === 'horizontal' 
    ? 'border-t my-1.5' 
    : 'border-l mx-1.5';
  
  return <div className={`${baseClasses} ${orientationClass} ${className}`} />;
};

export default Divider;
