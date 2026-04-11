# Planneer — Backend

> Go/PocketBase server. Part of the [Planneer monorepo](../README.md).

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Go 1.23 | Runtime |
| PocketBase 0.24 | Framework (auth, DB, realtime, file storage) |
| SQLite | Database |

## Development

```bash
# From monorepo root
make backend-dev        # http://localhost:8090

# Or directly
cd backend && go run . serve --dev
```

In dev mode, PocketBase admin UI is available at http://localhost:8090/_/.

### Commands

| Command | Description |
|---------|-------------|
| `go run . serve --dev` | Start dev server |
| `go test -v ./...` | Run tests |
| `go build -o planneer .` | Build binary |

## Project Structure

```
backend/
├── main.go            # Entry point, static file serving, security headers
├── hooks.go           # PocketBase event hooks (SSE, onboarding, workspace usage)
├── routes.go          # Custom API routes (search, export, page patch)
├── export.go          # Workspace/page export (JSON, CSV, Markdown)
├── boox_integration.go # BOOX device integration
├── config/
│   └── app_config.go  # Runtime configuration (env vars)
├── migrations/        # Database schema migrations (MUST be idempotent!)
├── templates/         # New user starter content
└── pagepreview/       # Excerpt/preview generation
```

## Static File Serving

In production, PocketBase serves the frontend static files from `frontend/dist`. The discovery order:

1. `/app/frontend/dist` — Docker container
2. `../frontend/dist` — Running from `backend/` in development
3. `./frontend/dist` — Running from repo root
4. `./pb_public` — PocketBase default fallback

SPA routing is supported: all non-API routes fall back to `index.html`.

## Migrations

All migrations **must be idempotent** — they're embedded in the binary and run on every startup.

```go
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
