# Planneer — Single Container Build
# Builds the frontend (Vite/React) and backend (Go/PocketBase) into one image.
# PocketBase serves the frontend static files directly.
#
# Build: docker build -t planneer .
# Run:   docker run -p 8090:8090 -v planneer-data:/app/pb_data planneer

# ============================================================
# Stage 1: Build Frontend
# ============================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /build

# Install git for submodule support (frameer)
RUN apk add --no-cache git

# Copy package files first for layer caching
COPY frontend/package*.json frontend/.npmrc ./
RUN npm ci --legacy-peer-deps

# Copy frontend source
COPY frontend/ .

# Initialize submodules if .git exists and frameer is empty
RUN if [ -d .git ] && [ ! -f frameer/package.json ]; then \
      git submodule update --init --recursive; \
    fi

# Build the frontend (no VITE_POCKETBASE_URL needed — uses same origin)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ============================================================
# Stage 2: Build Backend
# ============================================================
FROM golang:1.23-alpine AS backend-builder
ARG VERSION=dev
WORKDIR /build

RUN apk add --no-cache git

# Copy go mod files first for layer caching
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy backend source
COPY backend/ .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.Version=${VERSION}" \
    -o planneer .

# ============================================================
# Stage 3: Production Runtime
# ============================================================
FROM alpine:3.20

ARG PLANNEER_UID=10001
ARG PLANNEER_GID=10001

# Runtime dependencies
RUN apk add --no-cache ca-certificates tzdata poppler-utils su-exec

WORKDIR /app

# Copy backend binary
COPY --from=backend-builder /build/planneer /app/planneer
COPY --from=backend-builder /build/pb_hooks /app/pb_hooks
COPY --from=backend-builder /build/pb_migrations /app/pb_migrations
COPY scripts/container-entrypoint.sh /app/entrypoint.sh

# Copy frontend dist — PocketBase serves this via its static file handler
COPY --from=frontend-builder /build/dist /app/frontend/dist

# Create non-root user
RUN addgroup -S -g ${PLANNEER_GID} planneer && \
    adduser -S -D -H -u ${PLANNEER_UID} -G planneer planneer

# Create data directory with restricted permissions
RUN mkdir -p /app/pb_data/storage && \
    chown -R ${PLANNEER_UID}:${PLANNEER_GID} /app/pb_data /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh && \
    chmod -R 700 /app/pb_data

VOLUME /app/pb_data
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:8090/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["serve", "--http=0.0.0.0:8090"]
