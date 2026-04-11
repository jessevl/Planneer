import React from 'react';

interface FlexGroupProps {
  children: React.ReactNode;
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  direction?: 'row' | 'col';
  wrap?: boolean;
  className?: string;
}

const FlexGroup: React.FC<FlexGroupProps> = ({ 
  children, 
  gap = 'md',
  align = 'center',
  justify = 'start',
  direction = 'row',
  wrap = false,
  className = ''
}) => {
  const gapClasses = {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-6',
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  };

  const directionClasses = {
    row: 'flex-row',
    col: 'flex-col',
  };

  const wrapClass = wrap ? 'flex-wrap' : '';

  return (
    <div className={`flex ${directionClasses[direction]} ${gapClasses[gap]} ${alignClasses[align]} ${justifyClasses[justify]} ${wrapClass} ${className}`}>
      {children}
    </div>
  );
};

export default FlexGroup;
