/**
 * @file PageEditorContext.tsx
 * @description Context for sharing page-related data with Yoopta plugins
 * 
 * This context provides the current page ID to all editor plugins,
 * enabling them to upload files, link to the page, etc.
 */
import { createContext, useContext, type ReactNode } from 'react';

interface PageEditorContextValue {
  /**
   * The ID of the page currently being edited
   */
  pageId: string | null;
}

const PageEditorContext = createContext<PageEditorContextValue | null>(null);

interface PageEditorProviderProps {
  pageId: string | null;
  children: ReactNode;
}

/**
 * Provider component that wraps the Yoopta editor
 */
export function PageEditorProvider({ pageId, children }: PageEditorProviderProps) {
  return (
    <PageEditorContext.Provider value={{ pageId }}>
      {children}
    </PageEditorContext.Provider>
  );
}

/**
 * Hook to access the page editor context
 * @throws Error if used outside of PageEditorProvider
 */
export function usePageEditorContext(): PageEditorContextValue {
  const context = useContext(PageEditorContext);
  if (!context) {
    throw new Error('usePageEditorContext must be used within a PageEditorProvider');
  }
  return context;
}

/**
 * Hook to get the current page ID, returns null if not in a provider
 */
export function useCurrentPageId(): string | null {
  const context = useContext(PageEditorContext);
  return context?.pageId ?? null;
}
