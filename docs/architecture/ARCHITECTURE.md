# Architecture

Planneer is an offline-first productivity app built as a monorepo with a React frontend and a Go/PocketBase backend.

## What Matters

- The product ships as a single container in production.
- PocketBase serves both API routes and the built frontend.
- The frontend is local-first: it boots from persisted state and IndexedDB before it depends on the network.
- Everything document-like is a page, and rich content lives inside page content blocks. The `viewMode` decides how a page behaves.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 6, TypeScript, Tailwind 4 |
| Routing | TanStack Router |
| State | Zustand 5 |
| Rich editor | Yoopta |
| Whiteboard | Excalidraw |
| Local storage | IndexedDB via Dexie |
| Backend | Go 1.23 + PocketBase |
| Database | SQLite |

## Repository Layout

```text
frontend/
  src/
    api/         PocketBase-facing client code
    components/  UI by feature area
    hooks/       Custom hooks
    lib/         Sync engine, utilities, and app infrastructure
    plugins/     Yoopta extensions
    routes/      TanStack file-based routes
    stores/      Zustand stores
    types/       Shared frontend types
  e2e/           Playwright coverage

backend/
  main.go        PocketBase app bootstrap and middleware
  routes.go      Custom endpoints
  hooks.go       PocketBase event hooks
  migrations/    Idempotent schema migrations
  templates/     New-user starter content
```

## Unified Pages Model

Planneer does not have separate top-level document systems for notes and task collections. It has one `pages` collection, plus embedded rich-content blocks inside page content.

| `viewMode` | UI label | Primary behavior |
| --- | --- | --- |
| `note` | Note | Rich text editing in Yoopta |
| `collection` | Collection | Child page container |
| `tasks` | Tasks | Task list or kanban board |

Standalone whiteboard pages are no longer part of the page model. Drawing now lives as inline Excalidraw blocks inside notes.

That model is the main reason the app can reuse hierarchy, icons, covers, pins, navigation, sync behavior, and mirrored-source handling across different content types.

## Source-Backed Pages

Some pages are not authored directly in Planneer. They are mirrored from external sources and represented as read-only pages in the same `pages` collection.

Current example:

- BOOX notebook mirroring creates a read-only `Boox Notes` root page plus notebook child pages.

Source-backed pages are marked with metadata such as:

- `isReadOnly`
- `sourceOrigin`
- `sourceItemType`
- `sourceExternalId`
- `sourcePath`
- sync timestamps and remote metadata fields

This allows mirrored notebook content to participate in normal navigation and hierarchy without pretending it is editable Yoopta content.

## Runtime Flow

### Frontend boot

1. Zustand stores hydrate persisted metadata.
2. Auth, workspace, and config state are restored or refreshed.
3. The sync engine loads cached records from IndexedDB.
4. The UI renders from local data immediately.
5. Network sync and realtime subscriptions start when the server is reachable.

### Normal data flow

```text
UI interaction
  -> store action
  -> sync engine writes local state
  -> IndexedDB updated
  -> server request queued or sent
  -> PocketBase persists change
  -> realtime event sent back to clients
  -> sync engine merges event into local state
```

## Frontend Responsibilities

- Views and components read state from stores directly.
- Stores model application state and UI state, not transport details.
- The sync engine owns server synchronization, local persistence, queueing, and merge behavior.
- The editor, drawing blocks, and mirrored-source views stay page-centric instead of inventing separate top-level data models.

## Backend Responsibilities

- PocketBase handles auth, collections, file storage, and realtime delivery.
- Custom routes cover search, exports, patch-style updates, and app-specific APIs such as BOOX integration and sync.
- Hooks enforce business rules and enrich realtime payloads.
- Migrations are the source of truth for schema changes and must stay idempotent.

## Operational Constraints

- SQLite is the main scaling limit for write-heavy workloads.
- Realtime currently means long-lived SSE connections per user.
- Local cache and fallback behavior are product features, not incidental implementation details.
- Production assumes same-origin API access. The standard deployment does not require a separate frontend host.

## Read Next

- [SCHEMA.md](SCHEMA.md)
- [OFFLINE_SYNC.md](OFFLINE_SYNC.md)
- [../operations/DEPLOYMENT.md](../operations/DEPLOYMENT.md)