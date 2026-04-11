# Planneer — GitHub Copilot Instructions

> These instructions are automatically included in all Copilot requests for this repository.

## Project Overview

**Planneer** is a productivity app combining task management, note-taking, and whiteboard features with offline-first architecture. It runs as a **single container** — PocketBase serves both the API and the frontend.

**Tech Stack:**
- Frontend: Vite 6 + React 19 + TypeScript + Tailwind 4
- Routing: TanStack Router (file-based)
- State: Zustand 5 with persist middleware
- Rich Editor: Yoopta Editor (Slate-based)
- Whiteboard: Excalidraw v0.18
- Backend: PocketBase 0.24.4 (Go)
- Offline: IndexedDB via Dexie.js
- Icons: Lucide React

---

## Quick Commands

```bash
# Start development (both frontend and backend)
./scripts/dev.sh

# Frontend only
cd frontend && npm run dev

# Backend only (requires Go)
cd backend && go run . serve --dev

# Run tests
cd frontend && npm run test        # Unit tests (Vitest)
cd frontend && npm run test:e2e    # E2E tests (Playwright)
cd backend && go test ./... -v     # Backend tests

# Type check
cd frontend && npx tsc --noEmit

# Build Docker image
make docker-build
```

**URLs:**
- Frontend: http://localhost:3000 (dev, proxies to backend)
- Backend API: http://localhost:8090
- PocketBase Admin: http://localhost:8090/_/
- Production: http://localhost:8090 (single port, PocketBase serves frontend)

---

## Monorepo Structure

```
planneer/
├── frontend/            # React/Vite web application
│   ├── src/
│   │   ├── routes/     # TanStack Router file-based routes
│   │   ├── views/      # Page views (HomeView, TasksView, PagesView)
│   │   ├── components/ # UI components organized by feature
│   │   ├── stores/     # Zustand stores
│   │   ├── api/        # PocketBase API functions
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utilities (dateUtils, syncEngine, design-system)
│   │   ├── plugins/    # Yoopta editor plugins
│   │   └── types/      # TypeScript interfaces
│   ├── e2e/            # Playwright E2E tests
│   └── frameer/        # UI component library (submodule)
│
├── backend/             # Go/PocketBase server
│   ├── main.go         # Entry point, static file serving, security
│   ├── hooks.go        # PocketBase event hooks
│   ├── routes.go       # Custom API route handlers
│   ├── config/         # App configuration and plan limits
│   ├── migrations/     # Database schema migrations (must be idempotent!)
│   ├── templates/      # New user starter content
│   └── pagepreview/    # Page preview generation
│
├── docs/                # All documentation
├── deploy/              # Docker Compose production config
├── scripts/             # Dev, backup, restore scripts
├── Dockerfile           # Single-container multi-stage build
└── Makefile             # Unified build commands
```

---

## Core Architecture: Unified Pages Model

**Everything is a "Page"** — the central architectural pattern.

| `viewMode` | UI Label | Description |
|------------|----------|-------------|
| `note` | Note | Rich text documents (Yoopta editor) |
| `collection` | Collection | Folders/containers for other pages |
| `tasks` | Tasks | Task lists with sections (Kanban) |
| `whiteboard` | Whiteboard | Excalidraw infinite canvas |

---

## API Configuration (Frontend ↔ Backend)

The frontend connects to PocketBase using **same-origin** in production:
- **Production:** `window.location.origin` — PocketBase serves the frontend, so API is same origin
- **Development:** `window.location.origin` through Vite proxy → `localhost:8090`
- **Docker:** Frontend dist is baked into the Go binary's Docker image

No `VITE_POCKETBASE_URL` is needed in the standard single-container deployment.

---

## Coding Standards

### TypeScript

```typescript
// ✅ Good: Explicit types for function parameters
function createTask(data: CreateTaskInput): Promise<Task> { }

// ❌ Bad: Implicit any
function createTask(data) { }
```

### React Components

```typescript
// ✅ Good: Memoize list items
const TaskRow: React.FC<TaskRowProps> = React.memo(({ task, ... }) => { });

// ✅ Good: Access stores directly in views
const tasks = useTasksStore((s) => s.tasksById);

// ✅ Good: useShallow for multi-property selectors
const { viewMode, sortBy } = useNavigationStore(
  useShallow((s) => ({ viewMode: s.viewMode, sortBy: s.sortBy }))
);
```

### State Management

```typescript
// ✅ Good: Data flows through sync engine → stores → components
syncEngine.recordPageChange(page, ['content']);

// ❌ Bad: Direct API calls from components
await pb.collection('pages').update(id, data);
```

### Styling (Tailwind)

```tsx
// ✅ Light + dark mode required
<div className="bg-white dark:bg-gh-canvas-default">

// ✅ Use cn() for conditional classes
<div className={cn("px-4 py-2", isActive && "bg-blue-100 dark:bg-gh-accent-muted")}>
```

### Go Backend

```go
// ✅ All migrations MUST be idempotent!
func init() {
    m.Register(func(app core.App) error {
        _, err := app.FindCollectionByNameOrId("my_collection")
        if err == nil {
            return nil  // Already exists, skip
        }
        // ... create collection
    }, nil)
}
```

---

## Before Submitting Changes

1. **Type check**: `cd frontend && npx tsc --noEmit`
2. **Lint check**: `cd frontend && npm run lint`
3. **Run tests**: `make test`
4. **Test dark mode**: Toggle theme and verify UI
5. **Test mobile**: Check responsive behavior
