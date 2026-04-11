/**
 * @file Loader.tsx
 * @description Loading spinner component
 * Custom styling for Planneer
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/design-system';

type Props = {
  className?: string;
  children?: ReactNode;
  width?: number;
  height?: number;
};

export const Loader = ({ className, width = 24, height = 24, children }: Props) => (
  <div className={cn('inline-flex items-center', className)}>
    {children}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>
);
