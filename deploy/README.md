# Planneer — Deployment

Docker Compose configuration for running Planneer in production as a single container.

The image is built and published by GitHub Actions on pushes to `main` and release tags like `v1.2.3` at `ghcr.io/jessevl/planneer`.

Pushes to `main` publish `latest` plus the auto-incremented patch version from [VERSION](../VERSION). Manual major or minor changes in `VERSION` are preserved. Release tags publish semver container tags and create a GitHub Release.

## Architecture

Planneer runs as a **single container**: PocketBase serves both the API and the frontend static files on port `8090`.

## Quick Start

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=your-secure-password
PLANNEER_CLOSED_BETA=true
```

### 2. Start

```bash
docker compose up -d
```

Planneer is available at **http://localhost:8090**.

If you want to pin a specific build, set `VERSION` in `.env` to a published tag such as `latest`, `sha-<commit>`, or a release tag like `1.2.3`.

### Using a Host-Mapped Data Directory

The default compose file uses a named Docker volume:

```yaml
volumes:
  - planneer-data:/app/pb_data
```

With the current image, named-volume ownership is repaired automatically on container startup before Planneer drops to its non-root runtime user.

If you already have an older named volume created by a previous image and startup still fails, recreate the container so the new entrypoint runs, or reset the volume if the data is disposable:

```bash
docker compose down
docker volume rm planneer-data
docker compose up -d
```

Only remove the volume if you do not need the existing data.

If you want the PocketBase data to live in a specific host directory instead, change the service volume to a bind mount:

```yaml
services:
  planneer:
    volumes:
      - /srv/planneer/pb_data:/app/pb_data
```

Prepare the directory with the container runtime user before first start:

```bash
sudo mkdir -p /srv/planneer/pb_data
sudo chown -R 10001:10001 /srv/planneer/pb_data
```

Or use a relative path next to the compose file:

```yaml
services:
  planneer:
    volumes:
      - ./data:/app/pb_data
```

Make sure the mapped directory exists and is writable by the container user `10001:10001`, otherwise SQLite will fail with errors such as `attempt to write a readonly database (8)` during startup or migrations.

### 3. Verify

```bash
docker compose ps
docker compose logs -f
```

## Reverse Proxy

Since everything runs on a single port, your reverse proxy config is straightforward:

```nginx
server {
    server_name app.planneer.com;

    location / {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE / Realtime support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
    }
}
```

## Data Management

### Backup

PocketBase data is stored in a named Docker volume (`planneer-data`).

```bash
# Using the backup script (from repo root)
./scripts/backup.sh

# Or manually from Docker
docker run --rm \
  -v planneer-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar cvf /backup/pb_data_$(date +%Y%m%d).tar /data
```

### Restore

```bash
# Stop the service
docker compose stop planneer

# Restore from backup
docker run --rm \
  -v planneer-data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd / && tar xvf /backup/pb_data_20240101.tar"

# Restart
docker compose start planneer
```

## Version Pinning

```bash
# In .env
VERSION=v1.2.0
```

For GitHub Container Registry builds, prefer one of:

```bash
VERSION=latest
VERSION=sha-<commit>
VERSION=1.2.3
```

## Useful Commands

```bash
docker compose ps           # Status
docker compose logs -f      # Live logs
docker compose restart      # Restart
docker compose down         # Stop and remove
docker compose pull         # Pull latest image
```

## Troubleshooting

### Service won't start

```bash
# Check logs
docker compose logs planneer

# Check health status
docker inspect planneer | jq '.[0].State.Health'
```

### Connection refused

Ensure the container is healthy and the port is published correctly:

```bash
# Check health endpoints
curl http://localhost:8090/api/health
curl http://localhost:8090
```

### Out of disk space

```bash
# Clean up unused Docker resources
docker system prune -a
```
