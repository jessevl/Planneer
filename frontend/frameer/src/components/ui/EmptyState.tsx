import React from 'react';
import { H2, Text, Button } from './index';
import IconWrapper from './IconWrapper';
import Stack from './Stack';
import { cn } from '@frameer/lib/design-system';
import { 
  Inbox, 
  CalendarDays, 
  CalendarRange, 
  CheckCircle2, 
  FileText, 
  Folder, 
  Pencil,
  Sparkles,
  ListTodo,
  Plus,
  StickyNote,
  Layers,
} from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Predefined empty state types */
  type?: 'tasks' | 'collection' | 'pages' | 'custom';
  /** Additional class names */
  className?: string;
}

const emptyStateConfig = {
  tasks: {
    icon: <ListTodo className="w-12 h-12" />,
    title: 'No tasks yet',
    description: 'Add tasks using the quick add button below',
    gradient: 'from-violet-400 to-purple-500',
  },
  collection: {
    icon: <Folder className="w-12 h-12" />,
    title: 'This collection is empty',
    description: 'Add notes, collections, or whiteboards to organize your content.',
    gradient: 'from-amber-400 to-orange-500',
  },
  pages: {
    icon: <FileText className="w-12 h-12" />,
    title: 'No pages yet',
    description: 'Create notes, collections, or whiteboards to capture your ideas.',
    gradient: 'from-cyan-400 to-blue-500',
  },
  custom: {
    icon: <Pencil className="w-12 h-12" />,
    title: 'Nothing here yet',
    description: 'Get started by creating something new.',
    gradient: 'from-gray-400 to-gray-500',
  },
};

const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  actionLabel, 
  onAction,
  type = 'custom',
  className
}) => {
  const config = emptyStateConfig[type];
  const displayIcon = icon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-8 text-center',
      className
    )}>
      {/* Gradient icon container */}
      <div className={cn(
        'relative mb-6 p-4 rounded-2xl',
        'bg-gradient-to-br opacity-80',
        config.gradient
      )}>
        <div className="text-white/90">
          {displayIcon}
        </div>
        {/* Subtle glow effect */}
        <div className={cn(
          'absolute inset-0 rounded-2xl blur-xl opacity-30',
          'bg-gradient-to-br',
          config.gradient
        )} />
      </div>

      {/* Title */}
      <H2 className="!text-xl !md:text-xl mb-2">
        {displayTitle}
      </H2>

      {/* Description */}
      <Text className="text-[var(--color-text-tertiary)] max-w-sm mb-6">
        {displayDescription}
      </Text>

      {/* Action button */}
      {actionLabel && onAction && (
        <Button 
          onClick={onAction} 
          variant="primary" 
          size="md"
          className="gap-2"
        >
          <Plus size={16} />
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
