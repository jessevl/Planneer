'use client';

/**
 * @file IconPicker.tsx
 * @description Modern icon picker with curated Lucide icons
 * @app SHARED - Used by ItemPropertiesModal for task page/note icons
 * 
 * Features:
 * - 200+ curated Lucide icons across categories
 * - Smooth, compact grid layout
 * - Real-time search with keyboard navigation
 * - Icons colored by selected color
 * - Clean, modern 2025 aesthetic
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@frameer/lib/design-system';
import * as LucideIcons from 'lucide-react';

export interface IconPickerProps {
  selectedIcon: string | null;
  onChange: (iconName: string | null) => void;
  className?: string;
  /** Show option to remove/clear icon */
  allowClear?: boolean;
  /** Color to preview icons with (hex) */
  previewColor?: string;
  /** Compact mode for use in tight spaces like dropdown menus */
  compact?: boolean;
}

// Type for Lucide icon components
type IconComponent = React.FC<{ className?: string; style?: React.CSSProperties }>;

// Expanded curated icon set - ~250 icons
const ICON_CATEGORIES: Record<string, string[]> = {
  'Popular': [
    'Star', 'Heart', 'Bookmark', 'Flag', 'Zap', 'Flame', 'Sparkles', 'Crown',
    'Target', 'Gem', 'Award', 'Trophy', 'Medal', 'CircleDot', 'Asterisk', 'Hash',
  ],
  'Files & Folders': [
    'File', 'FileText', 'FileCode', 'FileJson', 'FileSpreadsheet', 'FileImage',
    'FileVideo', 'FileAudio', 'FileArchive', 'FileCog', 'FileCheck', 'FilePlus',
    'Folder', 'FolderOpen', 'FolderClosed', 'FolderHeart', 'FolderKanban', 'FolderGit',
    'Archive', 'Inbox', 'Package', 'Box', 'Boxes', 'Container',
  ],
  'Communication': [
    'Mail', 'MailOpen', 'MailPlus', 'Send', 'Forward', 'Reply', 'ReplyAll',
    'MessageSquare', 'MessageCircle', 'MessagesSquare', 'MessageSquarePlus',
    'Phone', 'PhoneCall', 'PhoneIncoming', 'PhoneOutgoing', 'Video', 'VideoOff',
    'Mic', 'MicOff', 'Volume2', 'Bell', 'BellRing', 'BellOff', 'Megaphone', 'Radio',
    'AtSign', 'Rss', 'Share', 'Share2', 'Link', 'Link2', 'Unlink', 'ExternalLink',
  ],
  'Tasks & Planning': [
    'CheckCircle', 'CheckCircle2', 'CircleCheck', 'SquareCheck', 'ListChecks',
    'ListTodo', 'List', 'ListOrdered', 'ListTree', 'ClipboardList', 'ClipboardCheck',
    'Calendar', 'CalendarDays', 'CalendarCheck', 'CalendarClock', 'CalendarPlus',
    'Clock', 'Clock2', 'Clock4', 'Timer', 'TimerOff', 'Hourglass', 'AlarmClock',
    'CircleDashed', 'Circle', 'Loader', 'RefreshCw', 'RotateCcw', 'Repeat', 'Repeat2',
  ],
  'Work & Business': [
    'Briefcase', 'Building', 'Building2', 'Factory', 'Landmark', 'Store',
    'Laptop', 'Laptop2', 'Monitor', 'Tv', 'Smartphone', 'Tablet', 'Watch',
    'Keyboard', 'Mouse', 'Printer', 'Scanner', 'Webcam', 'Headphones', 'Speaker',
    'Presentation', 'BarChart', 'BarChart2', 'BarChart3', 'PieChart', 'LineChart',
    'TrendingUp', 'TrendingDown', 'Activity', 'Gauge', 'Signal', 'Wifi',
    'DollarSign', 'Euro', 'PoundSterling', 'Coins', 'Banknote', 'CreditCard', 'Wallet', 'Receipt',
  ],
  'Creative & Design': [
    'Palette', 'Paintbrush', 'Brush', 'PenTool', 'Pencil', 'PencilLine', 'Highlighter',
    'Eraser', 'Pipette', 'Layers', 'Layout', 'LayoutGrid', 'Grid3x3', 'Columns',
    'Camera', 'Aperture', 'Image', 'ImagePlus', 'Images', 'Film', 'Clapperboard',
    'Music', 'Music2', 'Music3', 'Music4', 'Disc', 'Disc3', 'Radio',
    'Gamepad', 'Gamepad2', 'Joystick', 'Puzzle', 'Dice1', 'Dice5', 'Dices',
    'Wand', 'Wand2', 'Sparkle', 'PartyPopper', 'Gift', 'Cake', 'IceCream',
  ],
  'Nature & Weather': [
    'Sun', 'Moon', 'CloudSun', 'Cloud', 'CloudRain', 'CloudSnow', 'CloudLightning',
    'CloudFog', 'Wind', 'Tornado', 'Snowflake', 'Droplet', 'Droplets', 'Waves',
    'Leaf', 'TreeDeciduous', 'TreePine', 'Trees', 'Flower', 'Flower2', 'Clover',
    'Sprout', 'Vegan', 'Apple', 'Cherry', 'Citrus', 'Grape', 'Banana',
    'Carrot', 'Salad', 'Beef', 'Egg', 'Fish', 'Bird', 'Bug', 'Cat', 'Dog', 'Rabbit',
  ],
  'Home & Life': [
    'Home', 'House', 'Building2', 'Castle', 'Church', 'School', 'Hospital',
    'DoorOpen', 'DoorClosed', 'Key', 'KeyRound', 'Lock', 'LockOpen', 'Unlock',
    'Sofa', 'Armchair', 'Bed', 'Bath', 'Shower', 'Lamp', 'LampDesk', 'Fan',
    'Utensils', 'ChefHat', 'CookingPot', 'Refrigerator', 'Microwave', 'Coffee',
    'Wine', 'Beer', 'Martini', 'GlassWater', 'Cup', 'Milk', 'IceCream2',
    'Shirt', 'Baby', 'Accessibility', 'PersonStanding', 'Users', 'UserCircle',
  ],
  'Travel & Transport': [
    'Plane', 'PlaneTakeoff', 'PlaneLanding', 'Car', 'CarFront', 'Bus', 'Train',
    'TrainFront', 'Tram', 'Ship', 'Sailboat', 'Anchor', 'Bike', 'Footprints',
    'MapPin', 'MapPinned', 'Map', 'Compass', 'Navigation', 'Navigation2',
    'Globe', 'Globe2', 'Earth', 'Mountain', 'MountainSnow', 'Tent', 'Campfire',
    'Backpack', 'Luggage', 'Ticket', 'TicketCheck', 'Palmtree', 'Umbrella', 'Sunrise', 'Sunset',
  ],
  'Health & Fitness': [
    'Heart', 'HeartPulse', 'HeartHandshake', 'Activity', 'Stethoscope', 'Thermometer',
    'Pill', 'Tablets', 'Syringe', 'Bandage', 'Cross', 'ShieldPlus', 'Hospital',
    'Brain', 'Eye', 'EyeOff', 'Ear', 'Hand', 'Footprints', 'Bone',
    'Dumbbell', 'PersonStanding', 'Bike', 'Timer', 'Flame', 'Zap',
    'Apple', 'Salad', 'Vegan', 'GlassWater', 'Moon', 'BedDouble', 'Smile', 'Frown',
  ],
  'Science & Tech': [
    'Atom', 'Beaker', 'FlaskConical', 'FlaskRound', 'TestTube', 'TestTubes', 'Microscope',
    'Dna', 'Orbit', 'Rocket', 'Satellite', 'SatelliteDish', 'Radio', 'Radar',
    'Cpu', 'CircuitBoard', 'HardDrive', 'Server', 'Database', 'CloudCog',
    'Binary', 'Braces', 'Code', 'Code2', 'Terminal', 'SquareTerminal', 'FileCode2',
    'GitBranch', 'GitCommit', 'GitMerge', 'GitPullRequest', 'Github', 'Gitlab',
    'Wifi', 'Bluetooth', 'Nfc', 'Usb', 'Cable', 'Plug', 'Power', 'Battery', 'BatteryFull',
  ],
  'Education': [
    'GraduationCap', 'School', 'BookOpen', 'BookOpenCheck', 'Book', 'BookMarked',
    'Library', 'Notebook', 'NotebookPen', 'ScrollText', 'FileText', 'Newspaper',
    'PenLine', 'Pencil', 'Highlighter', 'Languages', 'Spellcheck', 'Type',
    'Quote', 'FileQuestion', 'HelpCircle', 'Info', 'Lightbulb', 'BrainCircuit',
    'Calculator', 'Percent', 'Pi', 'Sigma', 'Ruler', 'Compass', 'Shapes', 'Triangle',
  ],
  'Arrows & UI': [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUpRight', 'ArrowDownLeft',
    'ChevronUp', 'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronsUp', 'ChevronsDown',
    'CornerDownRight', 'CornerUpLeft', 'MoveUp', 'MoveDown', 'MoveHorizontal', 'MoveVertical',
    'Maximize', 'Maximize2', 'Minimize', 'Minimize2', 'Expand', 'Shrink',
    'Plus', 'Minus', 'X', 'Check', 'Equal', 'Divide', 'Percent',
    'Search', 'ZoomIn', 'ZoomOut', 'Filter', 'SlidersHorizontal', 'Settings', 'Settings2',
  ],
};

// Get icon component by name
const getIconComponent = (name: string): IconComponent | null => {
   
  const icon = (LucideIcons as any)[name];
  return icon || null;
};

/**
 * IconPicker - Modern icon selection component with Lucide icons
 */
const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  onChange,
  className,
  allowClear = true,
  previewColor,
  compact = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('Popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [justSelectedIcon, setJustSelectedIcon] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const categories = Object.keys(ICON_CATEGORIES);
  
  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      return ICON_CATEGORIES[activeCategory] || [];
    }
    
    // Search across all categories
    const query = searchQuery.toLowerCase();
    const allIcons = [...new Set(Object.values(ICON_CATEGORIES).flat())];
    return allIcons.filter(name => 
      name.toLowerCase().includes(query)
    );
  }, [activeCategory, searchQuery]);

  // Auto-focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Handler for icon selection with bounce animation
  const handleIconSelect = (iconName: string) => {
    setJustSelectedIcon(iconName);
    onChange(iconName);
    // Clear after animation completes
    setTimeout(() => setJustSelectedIcon(null), 400);
  };

  const iconColor = previewColor || '#6b7280';
  const ClearIcon = LucideIcons.X;
  const SearchIcon = LucideIcons.Search;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Search bar */}
      <div className={cn("relative", compact ? "mb-1" : "mb-3")}>
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "w-full pl-9 pr-3 text-sm rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-ring)]/30 focus:border-[var(--color-interactive-border)] transition-all",
            compact ? "py-1.5" : "py-2"
          )}
        />
      </div>

      {/* Category pills - flush against grid in compact mode */}
      {!searchQuery && (
        <div className={cn("flex gap-1 overflow-x-auto scrollbar-none", compact ? "mb-0 pb-0.5" : "mb-3 pb-1")}>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all',
                activeCategory === category
                  ? 'bg-[var(--color-text-primary)] text-[var(--color-surface-base)]'
                  : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-secondary)]'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Search results label */}
      {searchQuery && filteredIcons.length > 0 && (
        <div className="text-xs text-[var(--color-text-tertiary)] mb-2">
          {filteredIcons.length} icons found
        </div>
      )}

      {/* Clear icon button — only shown outside of compact mode */}
      {allowClear && selectedIcon && !compact && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex items-center gap-2 mb-3 px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all group"
        >
          <ClearIcon className="w-4 h-4" />
          <span>Remove icon (use color only)</span>
        </button>
      )}

      {/* Icon grid */}
      <div 
        ref={gridRef}
        className={cn(
          "grid gap-0.5 overflow-y-auto p-1 bg-[var(--color-surface-inset)] rounded-xl",
          compact ? "grid-cols-8 max-h-[160px]" : "grid-cols-10 max-h-[240px]"
        )}
      >
        {filteredIcons.map((iconName) => {
          const IconComp = getIconComponent(iconName);
          if (!IconComp) return null;
          
          const isSelected = iconName === selectedIcon;
          const wasJustSelected = isSelected && justSelectedIcon === iconName;
          
          return (
            <button
              key={iconName}
              type="button"
              onClick={() => handleIconSelect(iconName)}
              className={cn(
                'aspect-square flex items-center justify-center rounded-lg transition-all',
                isSelected
                  ? 'bg-[var(--color-interactive-bg)] ring-2 ring-[var(--color-interactive-ring)] ring-inset scale-110 z-10'
                  : 'hover:bg-[var(--color-surface-secondary)] hover:scale-105'
              )}
              aria-label={iconName}
              aria-pressed={isSelected}
              title={iconName.replace(/([A-Z])/g, ' $1').trim()}
            >
              <IconComp 
                className={cn('w-[18px] h-[18px]', wasJustSelected && 'icon-bounce')}
                style={{ color: isSelected ? previewColor || '#3b82f6' : iconColor }}
              />
            </button>
          );
        })}

        {/* Remove icon — as last grid cell in compact mode */}
        {compact && allowClear && selectedIcon && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="aspect-square flex items-center justify-center rounded-lg transition-all hover:bg-red-100 dark:hover:bg-red-900/30 group"
            title="Remove icon"
          >
            <ClearIcon className="w-[18px] h-[18px] text-[var(--color-text-tertiary)] group-hover:text-[var(--color-state-error,#ef4444)]" />
          </button>
        )}
      </div>
      
      {/* Empty state */}
      {filteredIcons.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-tertiary)]">
          <LucideIcons.SearchX className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-sm">No icons match &ldquo;{searchQuery}&rdquo;</span>
        </div>
      )}
    </div>
  );
};

export default IconPicker;
