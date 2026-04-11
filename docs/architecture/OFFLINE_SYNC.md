# Offline Sync

Offline behavior is a core product requirement, not a fallback mode.

## Design Rules

- IndexedDB is the local source of truth for synced content.
- The UI should remain usable when the server is unavailable.
- Local changes are queued and reconciled automatically.
- Realtime updates should merge into local state without forcing full reloads.

## Main Pieces

| Piece | Responsibility |
| --- | --- |
| Zustand stores | UI-facing state |
| Sync engine | Queueing, persistence, merges, realtime orchestration |
| IndexedDB | Cached records and pending changes |
| PocketBase | Durable server state and realtime delivery |

## Boot Sequence

1. Hydrate persisted store metadata.
2. Load cached tasks and pages from IndexedDB.
3. Render immediately from local data.
4. Refresh metadata and start remote sync if online.
5. Subscribe to realtime updates after initial state is available.

## Write Path

1. A component triggers a store action.
2. The sync engine records the change locally.
3. IndexedDB is updated and the record is marked pending.
4. The change is sent immediately if online, or queued until connectivity returns.
5. Server confirmation and realtime events reconcile local state.

## Merge Model

- Scalar fields use per-field last-writer-wins metadata.
- Page content is merged at block or element granularity.
- Deletions require tombstone-style tracking to avoid naive resurrection.
- Active local edits are favored short-term to prevent keystroke loss while a user is typing.

## Realtime Model

The client keeps long-lived SSE subscriptions for page and task changes. The sync engine, not individual components, owns those subscriptions.

## Efficiency Choices

- Page lists sync mostly as metadata.
- Full page content loads on demand.
- Patch-style updates send only changed blocks or elements where possible.
- Local-first search keeps the UI responsive while server search catches up.

## Known Limitation

The hardest remaining edge case is concurrent offline deletion versus offline editing of the same block. The current behavior is documented in [../development/BUGS.md](../development/BUGS.md).

## When To Read More

Read this file before changing:

- sync engine behavior
- IndexedDB retention rules
- realtime subscription patterns
- page patch endpoints