import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'default' | 'large';
}

const Container: React.FC<ContainerProps> = ({ 
  children, 
  className = '',
  size = 'default'
}) => {
  const maxWidth = size === 'large' ? 'max-w-7xl' : 'max-w-5xl';
  
  return (
    <div className={`${maxWidth} mx-auto px-6 ${className}`}>
      {children}
    </div>
  );
};

export default Container;
