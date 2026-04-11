# Schema

This is the practical schema reference for the current product. It focuses on the collections and fields that shape application behavior.

## Core Relationships

```text
users <-> workspaces through workspace_members
workspaces -> pages
workspaces -> tasks
workspaces -> boox_integrations
pages -> pages through parentId
tasks -> pages through parentPageId
```

## Collections

### users

PocketBase auth users plus app preferences.

Important fields:

- `email`
- `name`
- `avatar`
- `timezone`
- `theme`
- `defaultWorkspace`

### workspaces

Top-level tenant boundary.

Important fields:

- `name`
- `description`
- `icon`
- `color`
- `owner`
- `isPersonal`

### workspace_members

Membership and role mapping.

Important fields:

- `user`
- `workspace`
- `role`

Role values:

- `owner`
- `admin`
- `member`

### pages

The main content collection.

Important identity and hierarchy fields:

- `workspace`
- `title`
- `parentId`
- `order`
- `viewMode`

Important content and display fields:

- `content`
- `excerpt`
- `icon`
- `color`
- `images`
- `files`
- `previewThumbnail`

Important mirrored-source fields:

- `isReadOnly`
- `sourceOrigin`
- `sourceItemType`
- `sourceExternalId`
- `sourcePath`
- `sourceLastSyncedAt`
- `sourceCreatedAt`
- `sourceModifiedAt`
- `sourceContentLength`
- `sourceETag`
- `sourcePageCount`

Important behavior fields:

- `childrenViewMode`
- `collectionSortBy`
- `collectionSortDirection`
- `collectionGroupBy`
- `sections`
- `tasksViewMode`
- `tasksGroupBy`
- `showCompletedTasks`
- `showChildrenInSidebar`

Daily-note fields:

- `isDailyNote`
- `dailyNoteDate`

Mirrored-source usage:

- BOOX notebook mirroring uses normal page records instead of a parallel notebook table.
- A workspace gets a read-only root page with `sourceOrigin = 'boox'` and `sourceItemType = 'root'`.
- Mirrored notebooks are child pages with `sourceOrigin = 'boox'` and `sourceItemType = 'notebook'`.

### boox_integrations

Workspace-scoped integration settings for BOOX notebook mirroring.

Important fields:

- `workspace`
- `enabled`
- `serverUrl`
- `username`
- `password`
- `rootPath`
- `lastSyncAt`
- `lastSyncStatus`
- `lastSyncError`

### tasks

Task records are separate from pages but may belong to a task page.

Important fields:

- `workspace`
- `title`
- `description`
- `dueDate`
- `priority`
- `parentPageId`
- `sectionId`
- `completed`
- `completedAt`
- `subtasks`
- `recurrence`
- `order`
- `assignee`

## Page Modes

| `viewMode` | Meaning |
| --- | --- |
| `note` | Rich text document |
| `collection` | Container for other pages |
| `tasks` | Task list or board |

Drawings are now embedded inside note content as Excalidraw blocks, not stored as a separate page mode.

## Indexes and Query Shape

The product relies heavily on these access paths:

- tasks by `workspace`
- tasks by `parentPageId`
- tasks by `dueDate`
- pages by `workspace`
- pages by `parentId`
- pages by `viewMode`
- pages by `sourceOrigin` and `sourceItemType` for mirrored-source flows
- pages by `dailyNoteDate`
- workspace membership by unique `user + workspace`
- BOOX integrations by unique `workspace`

## Search

Search is split by content type and backed by PocketBase-side FTS tables.

- Tasks search uses titles and descriptions.
- Pages search uses titles and excerpts.
- The frontend merges server results with local-first results for responsiveness.

## Access Model

Workspace membership is the core authorization rule. Every workspace-scoped read or write must be justified by membership in that workspace.

## Migration Rules

- Migrations live in `backend/migrations`.
- They run on startup.
- They must be idempotent.
- They should guard against partially applied state before mutating a collection.

For implementation details, read the migration instructions in `.github/instructions/backend-migrations.instructions.md` alongside the existing migration files.