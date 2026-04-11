# Frameer

A reusable React UI framework with Tailwind CSS theming for building applications with consistent UI patterns.

## Features

- **43+ UI Components** - Buttons, Modals, Cards, Tables, Toasts, and more
- **Design Tokens** - Comprehensive theming system with light/dark mode
- **Responsive Hooks** - Mobile detection, click outside, long press gestures
- **State Management** - Settings and confirmation stores (Zustand-based)
- **TypeScript** - Full type safety throughout

## Installation

```bash
npm install @frameer/ui
# or
pnpm add @frameer/ui
```

## Usage

### Import Styles

In your app's global CSS file:

```css
@import "@frameer/ui/styles/tokens.css";
@import "@frameer/ui/styles/base.css";
```

### Use Components

```tsx
import { Button, Modal, Card, useIsMobile } from '@frameer/ui';

function App() {
  const isMobile = useIsMobile();
  
  return (
    <Card>
      <Button variant="primary">Click me</Button>
    </Card>
  );
}
```

### Theme Initialization

Add the ThemeInitializer to your app root:

```tsx
import { ThemeInitializer } from '@frameer/ui';

function App() {
  return (
    <>
      <ThemeInitializer />
      {/* Your app content */}
    </>
  );
}
```

## Package Exports

| Export | Description |
|--------|-------------|
| `@frameer/ui` | Main entry - all exports |
| `@frameer/ui/components` | All UI components |
| `@frameer/ui/components/ui` | Core UI primitives |
| `@frameer/ui/hooks` | React hooks |
| `@frameer/ui/stores` | Zustand stores |
| `@frameer/ui/lib` | Utility functions |
| `@frameer/ui/contexts` | React contexts |
| `@frameer/ui/styles/tokens.css` | Design tokens CSS |
| `@frameer/ui/styles/base.css` | Base styles CSS |

## Components

### Form Components
- Button, Input, Textarea, Toggle, Checkbox
- ColorPicker, EmojiPicker, IconPicker, Select

### Layout Components
- Card, Panel, Container, Sidebar, Header
- Modal, ModalFooter, Divider, Stack, FlexGroup
- MobileSheet, HorizontalScrollContainer

### Display Components
- Badge, Popover, ColorDot, EmptyState
- ContextMenu, Dropdown, DataTable

### Typography
- H1, H2, H3, H4, Text, TextSmall, Label

### Feedback
- Toast (with toastSuccess, toastError, etc.)
- ErrorBanner, StatusBanner
- SmartEmptyState

## Hooks

- `useIsMobile()` - Mobile viewport detection
- `useIsTablet()` - Tablet viewport detection
- `useIsDesktop()` - Desktop viewport detection
- `useMediaQuery(query)` - Custom media query hook
- `useClickOutside(refs)` - Click outside detection
- `useLongPress(options)` - Long press gesture
- `useAutoSave(callback, deps, delay)` - Debounced autosave

## Stores

- `useSettingsStore` - Theme, accent color, and app settings
- `useConfirmStore` - Confirmation modal state

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck
```

## License

MIT
