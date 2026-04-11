/**
 * @file TodoListRender.tsx
 * @description Custom TodoList element render with visible checkbox
 * @app PAGES - Used by PageEditor to extend the stock TodoList plugin
 *
 * The stock @yoopta/lists TodoList plugin renders <ul><li>{children}</li></ul>
 * with a `checked` prop but NO visible checkbox.
 *
 * This custom render uses onMouseDown toggles to avoid requiring caret focus
 * and CSS-only styling via app tokens (no Tailwind utility generation
 * dependencies).
 */
import type { PluginElementRenderProps } from '@yoopta/editor';
import { Elements, useBlockData, useYooptaEditor, useYooptaReadOnly } from '@yoopta/editor';

/**
 * Custom TodoList element render with a theme-aware checkbox.
 * Uses the `aria-label` attribute so our globals.css styles can target
 * checked/unchecked states independently.
 */
export const TodoListRender = (props: PluginElementRenderProps) => {
  const { attributes, children, element, blockId } = props;
  const editor = useYooptaEditor();
  const blockData = useBlockData(blockId);
  const isReadOnly = useYooptaReadOnly();
  const checked = !!element.props?.checked;
  const depth = Number((blockData as any)?.meta?.depth ?? 0);
  const safeDepth = Number.isFinite(depth) && depth > 0 ? depth : 0;
  const marginLeft = `${0.75 + safeDepth * 1}rem`;

  const checkboxStyle = {
    width: '1.25rem',
    height: '1.25rem',
    minWidth: '1.25rem',
    minHeight: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: '0.25rem',
    borderStyle: 'solid',
    borderWidth: '2px',
    borderColor: checked
      ? 'var(--color-accent-primary, #3b82f6)'
      : 'hsl(var(--input))',
    backgroundColor: checked
      ? 'var(--color-accent-primary, #3b82f6)'
      : 'hsl(var(--background))',
    color: checked ? '#fff' : 'hsl(var(--input))',
    boxShadow: checked ? 'none' : 'inset 0 0 0 1px hsl(var(--input))',
    cursor: isReadOnly ? 'default' : 'pointer',
    transition: 'background-color 150ms, border-color 150ms, transform 120ms',
  } as const;

  const onToggle = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isReadOnly) return;

    // Use Elements.updateElement — the proper Yoopta API that goes through
    // Slate's transform pipeline, ensuring immediate visual re-render.
    Elements.updateElement(editor, {
      blockId,
      type: 'todo-list',
      props: { checked: !checked },
    });
  };

  return (
    <div
      {...attributes}
      data-element-type="todo-list"
      data-checked={checked}
      style={{
        marginTop: '0.25rem',
        marginBottom: '0.25rem',
        marginLeft,
        paddingLeft: 0,
        lineHeight: 1.75,
        listStyleType: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.25rem' }}>
        <button
          type="button"
          contentEditable={false}
          onMouseDown={onToggle}
          aria-label={checked ? 'Mark as unchecked' : 'Mark as checked'}
          tabIndex={-1}
          style={checkboxStyle}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {checked && <path d="M2 6L5 9L10 3" strokeWidth="2.4" />}
          </svg>
        </button>
        <span style={{ flex: 1, minHeight: '1.25rem', display: 'flex', alignItems: 'center', lineHeight: '1.25rem', textDecoration: checked ? 'line-through' : undefined, color: checked ? 'var(--color-text-tertiary, hsl(var(--muted-foreground)))' : undefined }}>
          {children}
        </span>
      </div>
    </div>
  );
};

/**
 * Element map compatible with TodoList.extend({ elements: ... }).
 * Drop-in replacement for ListsUI.TodoList.
 */
export const CustomTodoListElements = {
  'todo-list': {
    render: TodoListRender,
  },
};
