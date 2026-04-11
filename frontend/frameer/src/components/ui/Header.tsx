import React from 'react';

interface HeaderProps {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  children, 
  className = '',
  sticky = true 
}) => {
  const stickyClasses = sticky ? 'sticky top-0 z-20' : '';
  
  return (
    <header className={`${stickyClasses} bg-white/60 dark:bg-[var(--color-surface-secondary)]/60 backdrop-blur-2xl border-b border-white/20 dark:border-white/10 eink-shell-surface-secondary ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent dark:from-white/5 pointer-events-none" />
      <div className="relative">
        {children}
      </div>
    </header>
  );
};

export default Header;
