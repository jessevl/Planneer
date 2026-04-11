/**
 * @file LocalPluginUI.tsx
 * @description Local Yoopta plugin UI renders adapted from Yoopta's default patterns
 * @app PAGES - Used by PageEditor plugin extensions
 *
 * Features:
 * - Local Tabs UI (container/list/item/content) without shadcn utility coupling
 * - Local BulletedList and NumberedList UI using app token-friendly classes
 * - Keeps Yoopta interaction patterns (add tab, delete tab, active tab persistence)
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Blocks, Elements, useBlockData, useYooptaEditor, useYooptaReadOnly, type PluginElementRenderProps } from '@yoopta/editor';
import { useNumberListCount } from '@yoopta/lists';
import { TabsCommands } from '@yoopta/tabs';

import { Transforms, Element as SlateElement } from 'slate';
import { AlertCircle, Plus, X } from 'lucide-react';

type TabsContextValue = {
  activeTabId: string | null;
  setActiveTabId: (tabId: string) => void;
  containerBlockId: string;
  readOnly: boolean;
};

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => useContext(TabsContext);

const stopSlatePropagation = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

const preventSlateAndDefault = (event: React.SyntheticEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

const tabListStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  width: '100%',
  marginTop: '0.5rem',
  overflowX: 'auto',
  padding: '0.25rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--color-border-default, #d6d3d1)',
  backgroundColor: 'var(--color-border-subtle, #e7e5e4)',
};

const tabTriggerBaseStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  minWidth: 0,
  borderRadius: '0.375rem',
  padding: '0.25rem 1.875rem 0.25rem 0.75rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  border: '1px solid transparent',
  cursor: 'pointer',
  transition: 'background-color 150ms, border-color 150ms, color 150ms, box-shadow 150ms',
};

const listItemBaseStyle: React.CSSProperties = {
  margin: '0 0 0 0.75rem',
  lineHeight: 1.75,
};

const getDepthOffsetStyle = (meta: any): React.CSSProperties => {
  const depth = Number(meta?.depth ?? 0);
  const safeDepth = Number.isFinite(depth) && depth > 0 ? depth : 0;
  const baseLeft = 0.75;
  const depthStep = 1;
  return {
    marginLeft: `${baseLeft + safeDepth * depthStep}rem`,
    paddingLeft: '0',
  };
};

const toAlphabetic = (value: number): string => {
  if (value <= 0) return 'a';
  let n = value;
  let result = '';
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
};

const toRoman = (value: number): string => {
  if (value <= 0) return 'i';
  const romanMap: Array<[number, string]> = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let n = value;
  let result = '';
  for (const [num, symbol] of romanMap) {
    while (n >= num) {
      result += symbol;
      n -= num;
    }
  }
  return result;
};

const getNumberedLabel = (index: number, depth: number): string => {
  const mode = Math.max(0, depth) % 3;
  if (mode === 1) return `${toAlphabetic(index)}.`;
  if (mode === 2) return `${toRoman(index)}.`;
  return `${index}.`;
};

const TabsContainerRender = (props: PluginElementRenderProps) => {
  const { attributes, children, blockId, element } = props;
  const editor = useYooptaEditor();

  const activeTabId = (element.props?.activeTabId as string | undefined) ?? null;

  const setActiveTabId = useCallback((tabId: string) => {
    const blockSlate = Blocks.getBlockSlate(editor, { id: blockId });
    if (!blockSlate) return;

    Transforms.setNodes(
      blockSlate as any,
      { props: { ...(element.props ?? {}), activeTabId: tabId } } as any,
      {
        at: [0],
        match: (node: any) => SlateElement.isElement(node as any) && (node as any).type === 'tabs-container',
      } as any,
    );
  }, [editor, blockId, element.props]);

  const contextValue = useMemo<TabsContextValue>(() => ({
    activeTabId,
    setActiveTabId,
    containerBlockId: blockId,
    readOnly: !!editor.readOnly,
  }), [activeTabId, setActiveTabId, blockId, editor.readOnly]);

  return (
    <TabsContext.Provider value={contextValue}>
      <div {...attributes} data-element-type="tabs-container" style={{ width: '100%' }}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsListRender = (props: PluginElementRenderProps) => {
  const { attributes, children } = props;
  const editor = useYooptaEditor();
  const tabsContext = useTabsContext();

  if (!tabsContext) {
    return <div {...attributes}>{children}</div>;
  }

  return (
    <div style={{ width: '100%' }}>
      <div {...attributes} role="tablist" aria-orientation="horizontal" style={tabListStyle}>
        {children}
        {!tabsContext.readOnly && (
          <button
            type="button"
            contentEditable={false}
            onPointerDown={(event) => {
              preventSlateAndDefault(event);
              TabsCommands.addTabItem(editor, tabsContext.containerBlockId);
            }}
            onMouseDown={preventSlateAndDefault}
            onTouchStart={preventSlateAndDefault}
            title="Add tab"
            aria-label="Add tab"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border-default, #d6d3d1)',
              backgroundColor: 'var(--color-surface-primary, #ffffff)',
              color: 'var(--color-text-tertiary, #78716c)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

const TabsItemHeadingRender = (props: PluginElementRenderProps) => {
  const { attributes, children, element, blockId } = props;
  const editor = useYooptaEditor();
  const tabsContext = useTabsContext();

  if (!tabsContext) {
    return <div {...attributes}>{children}</div>;
  }

  const tabId = element.id;
  const isActive = tabId === tabsContext.activeTabId;

  return (
    <div
      {...attributes}
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      onPointerDown={() => {
        tabsContext.setActiveTabId(tabId);
      }}
      onMouseDown={(event) => {
        // Keep standard Slate editing behavior so tab heading text remains
        // editable/renamable while still activating the clicked tab.
        tabsContext.setActiveTabId(tabId);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          tabsContext.setActiveTabId(tabId);
        }
      }}
      style={{
        ...tabTriggerBaseStyle,
        backgroundColor: isActive
          ? 'var(--color-surface-primary, #ffffff)'
          : 'var(--color-border-subtle, #e7e5e4)',
        color: isActive
          ? 'var(--color-text-primary, #1c1917)'
          : 'var(--color-text-secondary, #57534e)',
        borderColor: isActive
          ? 'var(--color-border-default, #d6d3d1)'
          : 'transparent',
        boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{children}</span>
      {!tabsContext.readOnly && (
        <button
          type="button"
          contentEditable={false}
          onPointerDown={(event) => {
            preventSlateAndDefault(event);
            TabsCommands.deleteTabItem(editor, blockId, { tabId });
          }}
          onMouseDown={preventSlateAndDefault}
          onTouchStart={preventSlateAndDefault}
          title="Close tab"
          aria-label="Close tab"
          data-tab-close="true"
          style={{
            position: 'absolute',
            right: '0.3rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1rem',
            height: '1rem',
            borderRadius: '0.25rem',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-tertiary, #78716c)',
            cursor: 'pointer',
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

const TabsItemContentRender = (props: PluginElementRenderProps) => {
  const { attributes, children, element } = props;
  const tabsContext = useTabsContext();

  if (!tabsContext) {
    return <div {...attributes}>{children}</div>;
  }

  const referenceId = (element.props?.referenceId as string | undefined) ?? null;
  const isActive = referenceId !== null && referenceId === tabsContext.activeTabId;

  return (
    <div
      {...attributes}
      role="tabpanel"
      data-state={isActive ? 'active' : 'inactive'}
      hidden={!isActive}
      style={{
        marginTop: '0.5rem',
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid var(--color-border-default, #d6d3d1)',
        borderRadius: '0.5rem',
        backgroundColor: 'var(--color-surface-primary, #ffffff)',
        padding: '0.75rem',
      }}
    >
      {isActive ? children : null}
    </div>
  );
};

const BulletedListRender = (props: PluginElementRenderProps) => {
  const { attributes, children, blockId } = props;
  const blockData = useBlockData(blockId);
  const depthStyle = getDepthOffsetStyle((blockData as any)?.meta);

  return (
    <ul
      {...attributes}
      data-element-type="bulleted-list"
      style={{
        ...listItemBaseStyle,
        ...depthStyle,
        listStyleType: 'disc',
        paddingInlineStart: '1rem',
      }}
    >
      <li style={{ paddingLeft: '0.35rem' }}>{children}</li>
    </ul>
  );
};

const NumberedListRender = (props: PluginElementRenderProps) => {
  const { attributes, children, blockId } = props;
  const blockData = useBlockData(blockId);
  const index = useNumberListCount(blockData);
  const depth = Number((blockData as any)?.meta?.depth ?? 0);
  const safeDepth = Number.isFinite(depth) && depth > 0 ? depth : 0;
  const depthStyle = getDepthOffsetStyle((blockData as any)?.meta);
  const label = getNumberedLabel(index, safeDepth);

  return (
    <div
      {...attributes}
      data-element-type="numbered-list"
      style={{ ...listItemBaseStyle, ...depthStyle }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <span contentEditable={false} style={{ opacity: 0.75, minWidth: '1.25rem' }}>
          {label}
        </span>
        <span style={{ flex: 1 }}>{children}</span>
      </div>
    </div>
  );
};

export const LocalListsUI = {
  BulletedList: {
    'bulleted-list': {
      render: BulletedListRender,
    },
  },
  NumberedList: {
    'numbered-list': {
      render: NumberedListRender,
    },
  },
};

export const LocalTabsUI = {
  'tabs-container': {
    render: TabsContainerRender,
  },
  'tabs-list': {
    render: TabsListRender,
  },
  'tabs-item-heading': {
    render: TabsItemHeadingRender,
  },
  'tabs-item-content': {
    render: TabsItemContentRender,
  },
};

type CalloutTheme = 'default' | 'info' | 'success' | 'warning' | 'error';

const CALLOUT_THEMES: Array<{ value: CalloutTheme; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

const getCalloutThemeStyle = (theme: CalloutTheme): React.CSSProperties => {
  switch (theme) {
    case 'info':
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.10)',
        color: 'var(--color-text-primary, #1c1917)',
        borderLeftColor: 'rgb(59, 130, 246)',
      };
    case 'success':
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.10)',
        color: 'var(--color-text-primary, #1c1917)',
        borderLeftColor: 'rgb(34, 197, 94)',
      };
    case 'warning':
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        color: 'var(--color-text-primary, #1c1917)',
        borderLeftColor: 'rgb(245, 158, 11)',
      };
    case 'error':
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.10)',
        color: 'var(--color-text-primary, #1c1917)',
        borderLeftColor: 'rgb(239, 68, 68)',
      };
    default:
      return {
        backgroundColor: 'var(--color-accent-muted, #f1f5f9)',
        color: 'var(--color-text-primary, #1c1917)',
        borderLeftColor: 'var(--color-accent-primary, #3b82f6)',
      };
  }
};

const CalloutRender = (props: PluginElementRenderProps) => {
  const { attributes, children, element, blockId } = props;
  const editor = useYooptaEditor();
  const readOnly = useYooptaReadOnly();
  const theme = ((element.props?.theme as CalloutTheme | undefined) ?? 'default');

  const onThemeChange = useCallback((nextTheme: string) => {
    Elements.updateElement(editor, {
      blockId,
      type: 'callout',
      props: { ...(element.props ?? {}), theme: nextTheme },
    });
  }, [blockId, editor, element.props]);

  const commitThemeFromSelect = useCallback((event: React.SyntheticEvent<HTMLSelectElement>) => {
    event.stopPropagation();
    onThemeChange(event.currentTarget.value);
  }, [onThemeChange]);

  return (
    <div
      {...attributes}
      data-element-type="callout"
      style={{
        marginTop: 0,
        marginBottom: '0.5rem',
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid',
        borderRadius: '0.5rem',
        padding: '0.75rem 0.875rem',
        position: 'relative',
        ...getCalloutThemeStyle(theme),
      }}
    >
      {!readOnly && (
        <select
          contentEditable={false}
          value={theme}
          onPointerDown={stopSlatePropagation}
          onMouseDown={stopSlatePropagation}
          onTouchStart={stopSlatePropagation}
          onClick={stopSlatePropagation}
          onChange={commitThemeFromSelect}
          onInput={commitThemeFromSelect}
          onBlur={commitThemeFromSelect}
          style={{
            position: 'absolute',
            top: '0.4rem',
            right: '0.4rem',
            ...selectBaseStyle,
            borderRadius: '0.375rem',
            border: '1px solid var(--color-border-default, #d6d3d1)',
            backgroundColor: 'var(--color-surface-primary, #fff)',
            color: 'var(--color-text-secondary, #44403c)',
            padding: '0.15rem 0.35rem',
            fontSize: '0.75rem',
          }}
          aria-label="Callout theme"
        >
          {CALLOUT_THEMES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      )}
      {children}
    </div>
  );
};

const selectBaseStyle: React.CSSProperties = {
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  appearance: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%2378716c' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.35rem center',
  backgroundSize: '0.9rem 0.9rem',
  paddingRight: '1.35rem',
};



export const LocalCalloutUI = {
  callout: {
    render: CalloutRender,
  },
};
