# Planneer Makefile
# ============================
# Unified build commands for the monorepo

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
DOCKER_IMAGE = planneer

.PHONY: all dev build clean test lint docker-build docker-run help \
        frontend-install frontend-build frontend-dev frontend-test frontend-lint \
        backend-build backend-dev backend-test

# ──────────────────────────────────────────────────
# Defaults
# ──────────────────────────────────────────────────
all: frontend-install frontend-build backend-build

help:
	@echo "Planneer Monorepo"
	@echo "═════════════════════════════════════════"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start frontend + backend (requires two terminals)"
	@echo "  make frontend-dev     Start Vite dev server (port 3000)"
	@echo "  make backend-dev      Start PocketBase dev server (port 8090)"
	@echo ""
	@echo "Build:"
	@echo "  make all              Install deps + build frontend + build backend"
	@echo "  make frontend-build   Build frontend (Vite)"
	@echo "  make backend-build    Build backend (Go)"
	@echo "  make docker-build     Build single-container Docker image"
	@echo ""
	@echo "Test:"
	@echo "  make test             Run all tests"
	@echo "  make frontend-test    Run frontend unit tests (Vitest)"
	@echo "  make frontend-lint    Lint + type-check frontend"
	@echo "  make backend-test     Run backend tests (Go)"
	@echo ""
	@echo "Deploy:"
	@echo "  make docker-build     Build Docker image"
	@echo "  make docker-run       Run Docker container locally"
	@echo ""
	@echo "Utilities:"
	@echo "  make backup           Backup PocketBase data"
	@echo "  make restore FILE=x   Restore from backup"
	@echo "  make clean            Remove build artifacts"

# ──────────────────────────────────────────────────
# Development
# ──────────────────────────────────────────────────
dev:
	@echo "Start both servers in separate terminals:"
	@echo "  Terminal 1: make frontend-dev"
	@echo "  Terminal 2: make backend-dev"
	@echo ""
	@echo "Or use: ./scripts/dev.sh"

frontend-dev:
	cd frontend && npm run dev

backend-dev:
	cd backend && go run . serve --dev

# ──────────────────────────────────────────────────
# Frontend
# ──────────────────────────────────────────────────
frontend-install:
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm_config_cache=../.npm-cache npm ci --legacy-peer-deps

frontend-build: frontend-install
	@echo "🔨 Building frontend..."
	cd frontend && npm run build

frontend-test:
	cd frontend && npm run test:run

frontend-lint:
	cd frontend && npx tsc --noEmit
	cd frontend && npm run lint

# ──────────────────────────────────────────────────
# Backend
# ──────────────────────────────────────────────────
backend-deps:
	cd backend && go mod download && go mod tidy

backend-build:
	@echo "🔨 Building backend..."
	cd backend && CGO_ENABLED=0 go build -ldflags "-s -w -X main.Version=$(VERSION)" -o planneer .
	@echo "✅ Built backend/planneer"

backend-test:
	cd backend && go test -v ./...

# ──────────────────────────────────────────────────
# Combined
# ──────────────────────────────────────────────────
test: frontend-test backend-test

lint: frontend-lint

build: frontend-build backend-build

# ──────────────────────────────────────────────────
# Docker (single container)
# ──────────────────────────────────────────────────
docker-build:
	@echo "🐳 Building Docker image..."
	docker build --build-arg VERSION=$(VERSION) -t $(DOCKER_IMAGE):$(VERSION) -t $(DOCKER_IMAGE):latest .
	@echo "✅ Built $(DOCKER_IMAGE):$(VERSION)"

docker-run:
	docker run -d --name planneer \
		-p 8090:8090 \
		-v planneer-data:/app/pb_data \
		$(DOCKER_IMAGE):latest

docker-stop:
	docker stop planneer || true
	docker rm planneer || true

# ──────────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────────
backup:
	./scripts/backup.sh

restore:
ifndef FILE
	$(error FILE is required. Usage: make restore FILE=backup.zip)
endif
	./scripts/restore.sh $(FILE)

clean:
	@echo "🧹 Cleaning build artifacts..."
	cd backend && go clean
	@echo "✅ Clean"
