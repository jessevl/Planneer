/**
 * @file contexts/index.ts
 * @description Barrel exports for React contexts
 */

export {
  MobileLayoutProvider,
  useMobileLayout,
  useMobileLayoutSafe,
  type MobileLayoutContextValue,
} from './MobileLayoutContext';

export {
  PageEditorProvider,
  usePageEditorContext,
  useCurrentPageId,
} from './PageEditorContext';
