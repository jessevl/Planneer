import React from 'react';

interface ColorDotProps {
  color: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const ColorDot: React.FC<ColorDotProps> = ({ 
  color, 
  size = 'sm',
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };
  
  return (
    <div
      className={`${sizeClasses[size]} rounded-full border border-[var(--color-border-default)] flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    />
  );
};

export default ColorDot;
