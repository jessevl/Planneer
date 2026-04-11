# Planneer Backend Makefile
# ============================
# Build commands for the backend (run from backend/ directory)

# Variables
BINARY_NAME=planneer
DOCKER_IMAGE=planneer
VERSION?=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME=$(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS=-ldflags "-X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)"

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
CGO_ENABLED ?= 1

.PHONY: all build clean test deps dev docker-build docker-run help

# Default target
all: deps build

# Install dependencies
deps:
	@echo "📦 Installing dependencies..."
	$(GOMOD) download
	$(GOMOD) tidy

# Build the binary
build:
	@echo "🔨 Building $(BINARY_NAME)..."
	CGO_ENABLED=$(CGO_ENABLED) $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME) .
	@echo "✅ Built $(BINARY_NAME)"

# Build for Linux (for Docker)
build-linux:
	@echo "🔨 Building $(BINARY_NAME) for Linux..."
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-linux-amd64 .
	@echo "✅ Built $(BINARY_NAME)-linux-amd64"

# Run in development mode
dev:
	@echo "🚀 Starting development server..."
	$(GOCMD) run . serve --dev

# Run the built binary
run:
	@echo "🚀 Starting server..."
	./$(BINARY_NAME) serve

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -f $(BINARY_NAME) $(BINARY_NAME)-linux-amd64
	rm -rf pb_data/
	@echo "✅ Cleaned"

# Run tests
test:
	@echo "🧪 Running tests..."
	$(GOTEST) -v ./...

# Migration commands
migrate-create:
ifndef NAME
	$(error NAME is required. Usage: make migrate-create NAME="your_migration_name")
endif
	@echo "📝 Creating migration: $(NAME)"
	$(GOCMD) run . migrate create "$(NAME)"

migrate-up:
	@echo "⬆️  Applying migrations..."
	./$(BINARY_NAME) migrate up

migrate-down:
	@echo "⬇️  Reverting last migration..."
	./$(BINARY_NAME) migrate down

migrate-status:
	@echo "📊 Migration status..."
	./$(BINARY_NAME) migrate history-sync

migrate-collections:
	@echo "📸 Creating collections snapshot..."
	$(GOCMD) run . migrate collections

# Docker commands
docker-build:
	@echo "🐳 Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(VERSION) -t $(DOCKER_IMAGE):latest .
	@echo "✅ Built $(DOCKER_IMAGE):$(VERSION)"

docker-run:
	@echo "🐳 Running Docker container..."
	docker run -d --name $(BINARY_NAME) \
		-p 8090:8090 \
		-v $(PWD)/pb_data:/pb/pb_data \
		$(DOCKER_IMAGE):latest

docker-stop:
	@echo "🛑 Stopping Docker container..."
	docker stop $(BINARY_NAME) || true
	docker rm $(BINARY_NAME) || true

docker-push:
ifndef REGISTRY
	$(error REGISTRY is required. Usage: make docker-push REGISTRY=your-registry.com)
endif
	@echo "📤 Pushing to $(REGISTRY)..."
	docker tag $(DOCKER_IMAGE):$(VERSION) $(REGISTRY)/$(DOCKER_IMAGE):$(VERSION)
	docker tag $(DOCKER_IMAGE):latest $(REGISTRY)/$(DOCKER_IMAGE):latest
	docker push $(REGISTRY)/$(DOCKER_IMAGE):$(VERSION)
	docker push $(REGISTRY)/$(DOCKER_IMAGE):latest

# Backup and restore
backup:
	@echo "💾 Creating backup..."
	./scripts/backup.sh

restore:
ifndef FILE
	$(error FILE is required. Usage: make restore FILE=backup.tar.gz)
endif
	@echo "📥 Restoring from $(FILE)..."
	./scripts/restore.sh $(FILE)

# Create superuser
superuser:
ifndef EMAIL
	$(error EMAIL is required. Usage: make superuser EMAIL=admin@example.com PASS=password)
endif
ifndef PASS
	$(error PASS is required. Usage: make superuser EMAIL=admin@example.com PASS=password)
endif
	@echo "👤 Creating superuser..."
	./$(BINARY_NAME) superuser create $(EMAIL) $(PASS)

# Help
help:
	@echo "Planneer Backend - Available Commands"
	@echo "======================================"
	@echo ""
	@echo "Development:"
	@echo "  make deps              - Install Go dependencies"
	@echo "  make build             - Build production binary"
	@echo "  make dev               - Run development server"
	@echo "  make run               - Run built binary"
	@echo "  make clean             - Clean build artifacts"
	@echo "  make test              - Run tests"
	@echo ""
	@echo "Migrations:"
	@echo "  make migrate-create NAME=x  - Create new migration"
	@echo "  make migrate-up             - Apply pending migrations"
	@echo "  make migrate-down           - Revert last migration"
	@echo "  make migrate-status         - Show migration status"
	@echo "  make migrate-collections    - Snapshot current collections"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build           - Build Docker image"
	@echo "  make docker-run             - Run Docker container"
	@echo "  make docker-stop            - Stop Docker container"
	@echo "  make docker-push REGISTRY=x - Push to registry"
	@echo ""
	@echo "Maintenance:"
	@echo "  make backup                 - Create backup"
	@echo "  make restore FILE=x         - Restore from backup"
	@echo "  make superuser EMAIL=x PASS=y - Create superuser"
	@echo ""
