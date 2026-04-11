import React from 'react';

interface IconWrapperProps {
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'gradient';
  className?: string;
}

const IconWrapper: React.FC<IconWrapperProps> = ({ 
  children, 
  size = 'md',
  variant = 'gradient',
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-8 h-8',
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
  };

  const variantClasses = {
    default: 'bg-[var(--color-surface-secondary)]',
    gradient: 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl',
  };

  return (
    <div className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-2xl flex items-center justify-center ${className}`}>
      {children}
    </div>
  );
};

export default IconWrapper;
