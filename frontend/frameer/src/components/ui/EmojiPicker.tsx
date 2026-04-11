'use client';

import React, { useState } from 'react';
import { cn } from '@frameer/lib/design-system';
import { CloseIcon } from '../common/Icons';

export interface EmojiPickerProps {
  selectedEmoji: string | null;
  onChange: (emoji: string | null) => void;
  className?: string;
  /** Show option to remove/clear emoji */
  allowClear?: boolean;
}

// Common emojis organized by category
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😊', '🥰', '😎', '🤔', '😴', '🥳', '🤩'],
  'Objects': ['📁', '📂', '📄', '📝', '📚', '📖', '📋', '📌', '📎', '✏️', '📊', '📈'],
  'Work': ['💼', '💻', '🖥️', '📱', '⌨️', '🖱️', '💡', '⚙️', '🔧', '🛠️', '📧', '📤'],
  'Home': ['🏠', '🏡', '🛋️', '🛏️', '🚿', '🍳', '🧹', '🧺', '🧴', '🪴', '🌱', '🌿'],
  'Nature': ['🌲', '🌳', '🌴', '🌵', '🍀', '🌸', '🌺', '🌻', '🌼', '🌷', '🍁', '🍂'],
  'Food': ['🍎', '🍊', '🍋', '🍇', '🍓', '🥑', '🥕', '🥦', '🍕', '🍔', '☕', '🍵'],
  'Activities': ['⚽', '🏀', '🎾', '🏃', '🚴', '🏊', '⛷️', '🎮', '🎲', '🎯', '🎨', '🎭'],
  'Travel': ['✈️', '🚗', '🚌', '🚂', '🚢', '🏖️', '🏔️', '🗺️', '🧭', '⛺', '🌍', '🌎'],
  'Symbols': ['❤️', '⭐', '🔥', '⚡', '💎', '🎯', '✅', '❌', '⚠️', '💯', '🔔', '🏷️'],
};

/**
 * EmojiPicker - Emoji selection component with categories
 * 
 * @example
 * <EmojiPicker
 *   selectedEmoji={note.icon}
 *   onChange={(emoji) => updateNote({ icon: emoji })}
 *   allowClear
 * />
 */
const EmojiPicker: React.FC<EmojiPickerProps> = ({
  selectedEmoji,
  onChange,
  className,
  allowClear = true,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>(Object.keys(EMOJI_CATEGORIES)[0]);

  const categories = Object.keys(EMOJI_CATEGORIES);
  const emojis = EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES] || [];

  return (
    <div className={cn('space-y-3', className)}>
      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors',
              activeCategory === category
                ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-1">
        {/* Clear/remove option */}
        {allowClear && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              'w-8 h-8 flex items-center justify-center rounded transition-all text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
              'border-2',
              selectedEmoji === null
                ? 'border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]'
                : 'border-transparent hover:bg-[var(--color-surface-secondary)]'
            )}
            title="Remove icon"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
        
        {emojis.map((emoji) => {
          const isSelected = emoji === selectedEmoji;
          
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange(emoji)}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded text-xl transition-all',
                'border-2',
                isSelected
                  ? 'border-[var(--color-interactive-border)] bg-[var(--color-interactive-bg)] scale-110'
                  : 'border-transparent hover:bg-[var(--color-surface-secondary)] hover:scale-105'
              )}
              aria-label={`Select emoji ${emoji}`}
              aria-pressed={isSelected}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EmojiPicker;
