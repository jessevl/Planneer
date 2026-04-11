/**
 * @file InternalLinkPlugin.ts
 * @description Custom Yoopta plugin for internal links to tasks and pages
 * @app NOTES APP ONLY - Links editor blocks to other content
 * 
 * Creates a void block element that displays linked items inline in the editor.
 * Similar to Notion's inline database mentions or linked pages.
 * 
 * Element props:
 * - linkType: 'task' | 'note'
 * - linkedId: ID of the linked task or note
 * - title: Display title (stored for offline/unresolved display)
 * - completed: For tasks - whether task is completed
 * - icon: For pages - emoji icon
 */
import { YooptaPlugin } from '@yoopta/editor';
import InternalLinkRender from './InternalLinkRender';

// ============================================================================
// TYPES
// ============================================================================

export interface InternalLinkElementProps {
  nodeType: 'void';
  linkType: 'task' | 'note';
  linkedId: string;
  title: string;
  completed?: boolean;
  icon?: string | null;
}

// ============================================================================
// PLUGIN DEFINITION
// ============================================================================

/**
 * InternalLink plugin for Yoopta editor.
 * 
 * This is a void block element - it doesn't have editable content,
 * just displays the linked item in a TaskRow/NoteCard-like style.
 * 
 * Usage:
 * - Select from action menu (/) -> "Link to Task/Page"
 * - Opens InternalLinkPicker modal
 * - On selection, inserts this block with linked item data
 */
const InternalLink = new YooptaPlugin({
  type: 'InternalLink',
  elements: {
    'internal-link': {
      render: InternalLinkRender,
      props: {
        nodeType: 'void',
        linkType: 'note',
        linkedId: '',
        title: '',
        completed: false,
        icon: null,
      },
    },
  },
  options: {
    // Don't show in action menu - we add our own entry in actionMenuData
    display: {
      title: 'Link to Task/Page',
      description: 'Link to another task or page in your workspace',
      icon: '🔗',
    },
    shortcuts: [],
  },
});

export default InternalLink;
