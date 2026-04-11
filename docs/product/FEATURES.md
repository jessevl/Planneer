# Features

This is the current feature snapshot for the product, grouped by the surfaces users actually interact with.

## Pages

- Unified page model with `note`, `collection`, and `tasks` modes
- Hierarchical page nesting with parent-child navigation
- Icons, colors, covers, pinning, and page properties
- Daily-note pages tied to calendar dates
- Source-backed read-only pages for mirrored external content

## Notes

- Yoopta-based rich text editing
- Headings, lists, quotes, dividers, callouts, and formatting marks
- Internal links to tasks and pages
- Tables, images, bookmarks, and PDF embeds
- Inline Excalidraw drawing blocks inside notes; these replaced the older standalone whiteboard page type
- BOOX page snapshot embeds for mirrored handwritten notebooks
- Table of contents blocks for longer documents
- Local transcription blocks powered by Whisper in the browser
- Auto-generated excerpts and table-of-contents support
- Debounced autosave

## Collections

- Pages can act as containers for other pages
- List, gallery, board, inline, and table-style child presentation
- Sorting and grouping options for child pages
- Split-view browsing with a resizable detail pane on larger screens

## Tasks

- Inbox, Today, Upcoming, and all-tasks views
- Task pages with sections and list, kanban, or table layouts
- Priorities, due dates, subtasks, recurrence, and bulk actions
- Inline and modal-based task editing
- Drag-and-drop reordering and section changes

## Handwritten Notes And Device Integration

- Dedicated handwritten-notes library for mirrored BOOX notebooks
- Read-only notebook browsing and page viewing for synced handwritten content
- Workspace-level BOOX integration settings and manual sync controls
- BOOX notebook content can be embedded back into normal notes as snapshot blocks

## Search and Navigation

- Command palette and search
- Local-first search merged with backend full-text results
- Sidebar tree navigation with pinned pages
- Multi-tab workflow for keeping multiple pages open
- Dedicated relationship graph view for pages, tasks, links, and tags

## Collaboration and Workspaces

- Multi-workspace model
- Workspace members with roles
- Realtime updates through PocketBase SSE

## Productivity And Focus

- Pomodoro timer with configurable work and break durations
- Focus-task support during timer sessions
- Immersive focus mode for distraction-reduced work sessions

## Offline and Resilience

- IndexedDB-backed local cache
- Queued writes when offline
- Boot-from-cache behavior for degraded or disconnected sessions
- Delta-oriented syncing for tasks and pages
- Realtime merge flow layered on top of local-first state

## Accessibility And Display

- Light, dark, and system theme support
- Warm and cool visual styles with selectable accent colors
- Dedicated e-ink mode for high-contrast monochrome rendering

## Current Caveats

- Some edge cases in offline block conflict handling remain open.
- Direct file download authorization still needs hardening.
- See [../development/BUGS.md](../development/BUGS.md) for known defects.
- See [BACKLOG.md](BACKLOG.md) for gaps that are intentional roadmap items rather than bugs.