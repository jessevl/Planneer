# Known Issues

Use this file for confirmed defects and hard product limitations. Do not use it as a second backlog.

## Open Bugs

| Area | Issue | Impact |
| --- | --- | --- |
| Offline sync | Concurrent offline delete vs edit of the same block can resurrect deleted content | Data consistency edge case |
| Selection | Multi-select can remain active after some bulk actions | UI inconsistency |
| Sidebar drag and drop | Drop targeting can be wrong in some tree interactions | Navigation and organization friction |
| Editor media | Image replacement and cleanup behavior is incomplete | Storage leaks and confusing UX |

## Verified Limitations

- Old completed tasks are intentionally not kept in full offline scope forever.
- Offline-first behavior is robust, but not every merge conflict is semantically perfect.
- Large exports may still put pressure on the backend for very large workspaces.

## Tracking Rule

- Product ideas go to [../product/BACKLOG.md](../product/BACKLOG.md).
- Historical investigation notes belong in [../Archive/README.md](../Archive/README.md).