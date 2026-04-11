/**
 * @file MobileEditorToolbar.tsx
 * @description Legacy shim for editor toolbar behavior now handled by FloatingActionBar
 * @app PAGES
 * 
 * Used by:
 * - PageEditor
 */
import React from 'react';

interface MobileEditorToolbarProps {
  editor: any;
  isEditorFocused?: boolean;
  onSlashCommand?: () => void;
  onInternalLinkClick?: () => void;
  onInsertBlock?: (blockType: string) => void;
}

/**
 * Toolbar behavior is owned by FloatingActionBar.
 */
const MobileEditorToolbar: React.FC<MobileEditorToolbarProps> = () => null;

export default MobileEditorToolbar;
