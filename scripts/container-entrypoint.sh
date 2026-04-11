#!/bin/sh
set -eu

DATA_DIR="/app/pb_data"
WRITE_TEST="$DATA_DIR/.planneer-write-test"
PLANNEER_UID="10001"
PLANNEER_GID="10001"

mkdir -p "$DATA_DIR/storage"

if [ "$(id -u)" = "0" ]; then
  chown -R "$PLANNEER_UID:$PLANNEER_GID" "$DATA_DIR"
  exec su-exec "$PLANNEER_UID:$PLANNEER_GID" /app/entrypoint.sh "$@"
fi

if ! touch "$WRITE_TEST" 2>/dev/null; then
  cat >&2 <<'EOF'
Planneer cannot write to /app/pb_data.

If you are using a bind mount, make sure the host directory exists and is writable by UID/GID 10001:10001.

If you are using a named Docker volume, it may contain files created by an older image with different ownership. Restarting with the updated image should repair that automatically.

Example:
  mkdir -p /srv/planneer/pb_data
  chown -R 10001:10001 /srv/planneer/pb_data

Then restart the container.
EOF
  exit 1
fi

rm -f "$WRITE_TEST"

exec /app/planneer "$@"