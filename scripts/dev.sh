#!/usr/bin/env bash
# dev.sh — Start both frontend and backend dev servers
#
# Frontend: http://localhost:3000  (Vite, proxies /api to backend)
# Backend:  http://localhost:8090  (PocketBase)
#
# Usage: ./scripts/dev.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
NPM_CACHE_DIR="$ROOT_DIR/.npm-cache"

ensure_frontend_deps() {
    if [[ -x "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
        return
    fi

    echo "Frontend dependencies not found. Installing..."
    mkdir -p "$NPM_CACHE_DIR"

    if ! (
        cd "$FRONTEND_DIR"
        npm_config_cache="$NPM_CACHE_DIR" npm ci --legacy-peer-deps
    ); then
        echo ""
        echo "Frontend dependency install failed."
        echo "Retry with: cd frontend && npm_config_cache=../.npm-cache npm ci --legacy-peer-deps"
        exit 1
    fi
}

cleanup() {
    echo ""
    echo "Shutting down..."
    kill 0 2>/dev/null
    wait 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "═══════════════════════════════════════"
echo "  Planneer Development Server"
echo "═══════════════════════════════════════"
echo ""
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8090"
echo "  Admin:    http://localhost:8090/_/"
echo ""

ensure_frontend_deps

# Start backend
echo "Starting backend..."
cd "$ROOT_DIR/backend" && go run . serve --dev &

# Wait a moment for backend to start
sleep 2

# Start frontend
echo "Starting frontend..."
cd "$FRONTEND_DIR" && npm run dev &

# Wait for any process to exit
wait
