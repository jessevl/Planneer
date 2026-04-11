# Planneer — Frontend

> React web application. Part of the [Planneer monorepo](../README.md).

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| Vite 6 | Build tool with HMR |
| TypeScript | Type safety |
| TanStack Router | File-based routing |
| Zustand 5 | State management |
| Tailwind CSS 4 | Styling |
| Yoopta Editor | Rich text editing |
| Excalidraw | Whiteboard canvas |
| Dexie.js | IndexedDB for offline |

## Development

```bash
# From monorepo root
make frontend-dev       # http://localhost:3000

# Or directly
cd frontend && npm run dev
```

The Vite dev server proxies `/api` to the backend at `localhost:8090`.  
In production, PocketBase serves the built frontend — no separate server needed.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type check |

## Project Structure

```
src/
├── main.tsx              # Entry point
├── routeTree.gen.ts      # Auto-generated routes
├── routes/               # File-based routes
├── views/                # Page components
├── components/           # UI components
│   ├── ui/              # Reusable primitives
│   ├── tasks/           # Task components
│   ├── pages/           # Page components
│   └── layout/          # Layout components
├── stores/               # Zustand stores
├── hooks/                # Custom hooks
├── api/                  # API layer
├── lib/                  # Utilities
└── types/                # TypeScript types
```

## API Configuration

The PocketBase URL is resolved automatically:

1. **Development:** `window.location.origin` → Vite proxy → `localhost:8090`
2. **Production:** `window.location.origin` → same-origin (PocketBase serves frontend)
3. **Override:** Set `VITE_POCKETBASE_URL` env var if backend is on a different host
