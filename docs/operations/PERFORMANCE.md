# Performance

This file is for realistic capacity planning, not aspirational scaling narratives.

## Main Constraints

- SQLite is the primary write bottleneck.
- Page patching and whiteboard persistence are the most CPU-expensive user actions.
- Realtime traffic creates long-lived connection pressure rather than huge per-request payloads.

## Why The App Performs Reasonably Well

- Page content sync is patch-oriented instead of full-document on every edit.
- Metadata-heavy lists avoid loading full document bodies unnecessarily.
- Local-first boot avoids waiting on the network for normal navigation.

## Expected Load Shape

| User state | Typical behavior |
| --- | --- |
| Idle | Mostly SSE plus light health traffic |
| Browsing | Small metadata fetches and occasional page-content fetches |
| Editing | Frequent small patch requests |
| Heavy whiteboard use | Larger JSON merges and more CPU pressure |

## Practical Planning Guidance

- Small teams can run comfortably on modest infrastructure.
- Write-heavy shared workspaces will hit SQLite limits before they hit raw bandwidth limits.
- File-descriptor limits matter because realtime uses persistent connections.

## When To Revisit The Architecture

Revisit the current backend model when you see any of these regularly:

- queued or slow writes during peak editing
- persistent high CPU during page patch processing
- connection exhaustion from many concurrent realtime users
- export or search workloads contending badly with normal editing

## Immediate Operational Advice

- Monitor container health and restart counts.
- Watch disk growth in `pb_data`.
- Raise file descriptor limits for larger deployments.
- Treat large exports and large-file-heavy workspaces as separate load tests.