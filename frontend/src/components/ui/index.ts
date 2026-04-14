// UI Component Library - Planneer UI
// Re-exports generic components from Frameer and adds domain-specific components

// ============================================================================
// GENERIC COMPONENTS - Re-exported from Frameer
// ============================================================================

// Form Components
export { Button, Input, Textarea, Toggle, Checkbox, ColorPicker, EmojiPicker, IconPicker, LucideIcon } from '@frameer/components/ui';

// Layout Components  
export { Card, Panel, Container, Sidebar, Header, Modal, ModalFooter, PropertyRow, Divider, Stack, FlexGroup, HorizontalScrollContainer, ResizeHandle, MobileSheet, useSheet } from '@frameer/components/ui';
export type { PanelProps, ModalFooterProps, PropertyRowProps } from '@frameer/components/ui';

// Feedback Components
export { ErrorBanner, StatusBanner } from '@frameer/components/ui';
export type { StatusBannerVariant } from '@frameer/components/ui';

// Navigation Components
export { NavItem, NavigationHistoryButtons, useNavigationHistory, useNavigationHistoryStore } from '@frameer/components/ui';

// Data Display Components
export { DataTable, Badge, Select, Popover, ColorDot, IconButton, IconWrapper, EmptyState, SectionHeader, ContextMenu, ContextMenuContent, Dropdown, DropdownItem, SmartEmptyState, CompactEmptyState, ToggleTile, toggleTileStyles } from '@frameer/components/ui';
export type { DataTableColumn, DataTableGroup, DataTableProps, SelectOption, ContextMenuItem, ToggleTileProps } from '@frameer/components/ui';

// Typography
export { H1, H2, H3, H4, Text, TextSmall, Label } from '@frameer/components/ui';

// Icon Utilities
export { Icon, withStandardIcon } from '@frameer/components/ui';
export type { IconProps } from '@frameer/components/ui';

// Toast Notifications
export { ToastContainer, useToastStore, toastSuccess, toastError, toastWarning, toastInfo, toastSuccessWithAction } from '@frameer/components/ui';
export type { ToastType } from '@frameer/components/ui';

// Settings UI Primitives
export {
  SettingsToggle,
  SettingsToggleRow,
  SegmentedControl,
  SliderRow,
  SettingsSectionHeader,
  SettingsSeparator,
  SettingsCard,
  SettingsStatusMessage,
  SettingsCollapsible,
  SettingsSaveButton,
  SettingsActionButton,
  SettingsNumberInput,
  formatBytes,
  sliderClass,
  settingsInputClass,
} from '@frameer/components/ui';
export type { SegmentOption } from '@frameer/components/ui';

// ============================================================================
// DOMAIN-SPECIFIC COMPONENTS - Planneer-specific, stay in this repo
// ============================================================================

// Task-related Components
export { default as TaskCheckbox } from './TaskCheckbox';
export { default as DateBadge } from './DateBadge';
export { default as PriorityBadge } from './PriorityBadge';
export { default as SubtaskBadge } from './SubtaskBadge';

// Page-related Components
export { default as PageBadge } from './PageBadge';

// Tag-related Components
export { default as TagBadge } from './TagBadge';
export { default as InlineTagInput } from './InlineTagInput';
export { default as TagPickerMenu } from './TagPickerMenu';

// View-related Components
export { default as ViewLayoutToggle } from './ViewLayoutToggle';

// Shared Layout Components
export { default as GlassToolbar } from './GlassToolbar';
export type { GlassToolbarProps } from './GlassToolbar';
export { default as FloatingPanel } from './FloatingPanel';
export type { FloatingPanelProps } from './FloatingPanel';
export { FLOATING_SURFACE_CLASSNAME } from './FloatingPanel';
export { FLOATING_PANEL_SURFACE_CLASSNAME } from './FloatingPanel';
export { default as ToolbarFormatButton } from './ToolbarFormatButton';
export type { ToolbarFormatButtonProps } from './ToolbarFormatButton';
export { SavedViewsBar, ViewEditorModal } from './SavedViewsBar';
export { default as SortFilterViewBar } from '../layout/SortFilterViewBar';
export type { SortFilterViewBarProps } from '../layout/SortFilterViewBar';
export type { ViewEditorModalProps } from './SavedViewsBar';

// Page Cover - integrated into PageHero
export { COVER_GRADIENTS } from '../pages/PageHero';
