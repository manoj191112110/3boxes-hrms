#!/usr/bin/env bash
#
# Per-boot startup for Cloud Agents: ensure PostgreSQL and the local Neon
# WebSocket proxy are running, then return. Idempotent and safe to re-run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

PG_CLUSTER=main
PROXY_PORT="${NEON_WS_PROXY_PORT:-5433}"

PG_VER="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -1)"

echo "==> Starting PostgreSQL cluster"
if [ -n "$PG_VER" ]; then
  sudo pg_ctlcluster "$PG_VER" "$PG_CLUSTER" start 2>/dev/null || true
fi
for _ in $(seq 1 30); do
  if sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "==> Starting Neon ws proxy on port ${PROXY_PORT} (if not already running)"
if ! (exec 3<>"/dev/tcp/127.0.0.1/${PROXY_PORT}") 2>/dev/null; then
  NEON_WS_PROXY_PORT="$PROXY_PORT" nohup node scripts/local-dev/neon-ws-proxy.cjs \
    >/tmp/neon-ws-proxy.log 2>&1 &
  disown || true
  sleep 1
  echo "   started ws proxy (logs: /tmp/neon-ws-proxy.log)"
else
  echo "   ws proxy already listening"
fi

echo "==> Startup complete"
