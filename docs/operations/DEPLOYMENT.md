# Deployment

Planneer deploys as a single container. PocketBase serves both the API and the frontend on port `8090`.

## Quick Start

```bash
cd deploy
cp .env.example .env
docker compose up -d
```

The default compose file runs one service named `planneer` and stores PocketBase data in the `planneer-data` volume.

## Required Environment Variables

| Variable | Purpose |
| --- | --- |
| `PB_ADMIN_EMAIL` | Initial PocketBase admin email |
| `PB_ADMIN_PASSWORD` | Initial PocketBase admin password |
| `PLANNEER_CLOSED_BETA` | Restrict registration when needed |

## Optional Environment Variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Host port mapped to container port `8090` |
| `PLANNEER_ALLOW_ADMIN_UI` | Whether the PocketBase admin UI should be exposed |
| `UNSPLASH_ACCESS_KEY` | Cover-image integration |
| `VERSION` | Image tag to deploy |

## Runtime Model

- One container
- One externally relevant app port
- One PocketBase data directory at `/app/pb_data`
- Same-origin frontend and API in production

## Data Persistence

Default compose storage:

```yaml
volumes:
  - planneer-data:/app/pb_data
```

If you need a host bind mount instead, ensure the target directory is writable by the container runtime user.

## Reverse Proxy

Use a single-domain reverse proxy that forwards all traffic to the Planneer container. Realtime support requires HTTP/1.1 and disabled buffering.

## Health and Logs

```bash
docker compose ps
docker compose logs -f planneer
curl http://localhost:8090/api/health
```

## Backups

Preferred repo-level commands:

```bash
./scripts/backup.sh
./scripts/restore.sh path/to/backup.zip
```

## Upgrade Flow

```bash
docker compose pull
docker compose up -d
```

Pin `VERSION` when you need deterministic rollouts.

## Things This File Intentionally Does Not Describe

- Multi-container frontend/backend splits
- Separate landing-page deployment
- Cross-origin production setups

Those are not the current product deployment model.