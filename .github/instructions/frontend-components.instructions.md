---
applyTo: "frontend/src/components/**/*.tsx"
---

# React Component Instructions

## Required Structure

Every component file MUST have:

1. **File Header Comment** at the top:
```typescript
/**
 * @file ComponentName.tsx
 * @description What this component does
 * @app TASKS|PAGES|SHARED - Where it's used
 * 
 * Features:
 * - Feature 1
 * - Feature 2
 * 
 * Used by:
 * - ParentComponent
 */
```

2. **Typed Props Interface**:
```typescript
interface ComponentNameProps {
  // All props with types and JSDoc
  /** Description of prop */
  propName: PropType;
}
```

3. **React.memo for list items** (if used in lists):
```typescript
const ComponentName: React.FC<Props> = React.memo(({ ... }) => {
  // ...
});
```

## UI Component Usage

Use primitives from `@/components/ui`:
- `Button`, `IconButton` - Not raw `<button>`
- `Modal`, `MobileSheet` - Not custom overlays
- `Panel`, `Card` - Not custom containers
- `Input`, `Textarea`, `Select` - Not raw form elements

## Styling Requirements

- Use `cn()` from `@/lib/design-system` for conditional classes
- Every background color needs dark mode: `bg-white dark:bg-gh-canvas-default`
- Every text color needs dark mode: `text-gray-900 dark:text-gh-fg-default`
- Use `colors` object from design-system for semantic colors

## State Access

- Views access stores directly
- Components receive data via props (no store access in small components)
- Use `useShallow` for multi-property selectors:
```typescript
const { a, b } = useStore(useShallow(s => ({ a: s.a, b: s.b })));
```

## Avoid Duplication

Before adding logic, check if hooks exist:
- Selection: `useSelectable` (planned)
- Long press: `useLongPress`
- Context menu: `useTaskContextMenu`, `usePageContextMenu`
- Click outside: `useClickOutside`
