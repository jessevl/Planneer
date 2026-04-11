# Planneer Docs

The docs are organized by intent, not by when a file happened to be created.

## Start Here

- [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) - System overview, runtime model, and core constraints
- [architecture/SCHEMA.md](architecture/SCHEMA.md) - PocketBase collections and important fields
- [architecture/OFFLINE_SYNC.md](architecture/OFFLINE_SYNC.md) - Offline-first model, sync flow, and conflict handling
- [operations/DEPLOYMENT.md](operations/DEPLOYMENT.md) - Production deployment for the single-container build
- [development/TESTING.md](development/TESTING.md) - How to run and debug frontend and backend tests

## Sections

### Architecture

- [architecture/README.md](architecture/README.md)
- Durable technical reference for the app's structure and data model.

### Product

- [product/README.md](product/README.md)
- What exists today and what is intentionally still on the roadmap.

### Development

- [development/README.md](development/README.md)
- Day-to-day engineering guidance, active plans, BOOX work, testing, and known issues.

### Operations

- [operations/README.md](operations/README.md)
- Deployment, security posture, and performance expectations.

### Research

- [research/README.md](research/README.md)
- Exploratory design work and speculative plans. These files are not commitments.

### Archive

- [Archive/README.md](Archive/README.md)
- Historical material kept for context but no longer treated as active guidance.

## Quick Commands

```bash
./scripts/dev.sh

cd frontend && npm run dev
cd backend && go run . serve --dev

cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run test:run
cd frontend && npm run test:e2e
cd backend && go test ./... -v
```

## Reality Check

- Production runs as a single container.
- PocketBase serves both the API and the frontend on port `8090`.
- The frontend dev server runs on port `3000` and proxies API requests to the backend.
- The core model is still unified pages: `note`, `collection`, `tasks`, and `whiteboard` are all page variants.