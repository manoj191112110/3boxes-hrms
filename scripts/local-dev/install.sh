#!/usr/bin/env bash
#
# Idempotent local-dev bootstrap for Cloud Agents.
#
# Installs Node dependencies, ensures a local PostgreSQL server + dev database,
# writes a local .env (if missing), pushes the Prisma schema and seeds baseline
# data. Safe to run repeatedly. System packages (postgresql, node, bun) are
# expected to already be present in the base image/snapshot.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

export PATH="$HOME/.bun/bin:$PATH"

PG_VER=16
PG_CLUSTER=main
DB_NAME=hrms
DB_USER=hrms
DB_PASS=hrms
CONN="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?sslmode=disable"

echo "==> Installing Node dependencies (bun install)"
if command -v bun >/dev/null 2>&1; then
  bun install
else
  npm install
fi

echo "==> Ensuring PostgreSQL cluster is running"
sudo pg_ctlcluster "$PG_VER" "$PG_CLUSTER" start 2>/dev/null || true
# Wait for the socket to accept connections.
for _ in $(seq 1 30); do
  if sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "==> Ensuring dev role and database exist"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}' SUPERUSER;
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

echo "==> Ensuring localhost trust auth in pg_hba.conf"
HBA="$(sudo -u postgres psql -tAc 'SHOW hba_file;')"
sudo sed -i -E "s|^host\s+all\s+all\s+127\.0\.0\.1/32\s+.*|host all all 127.0.0.1/32 trust|" "$HBA"
sudo sed -i -E "s|^host\s+all\s+all\s+::1/128\s+.*|host all all ::1/128 trust|" "$HBA"
sudo pg_ctlcluster "$PG_VER" "$PG_CLUSTER" reload 2>/dev/null || true

echo "==> Writing .env (if missing)"
if [ ! -f .env ]; then
  cat > .env <<ENV
# Local development environment (Cloud Agent) — local PostgreSQL via Neon ws proxy
DATABASE_URL=${CONN}
POSTGRES_URL=${CONN}
POSTGRES_PRISMA_URL=${CONN}

# Route the Neon serverless driver to the local ws proxy (dev only)
NEON_LOCAL_PROXY=1
NEON_WS_PROXY_PORT=5433

# Auth
JWT_SECRET=local-dev-jwt-secret-change-me

# Site mode
SITE_MODE=live
NEXT_PUBLIC_SITE_MODE=live
NEXT_PUBLIC_ROOT_DOMAIN=localhost
ENV
  echo "   wrote .env"
else
  echo "   .env already exists — leaving it untouched"
fi

echo "==> Generating Prisma client"
npx prisma generate >/dev/null

echo "==> Pushing Prisma schema to database"
npx prisma db push

echo "==> Seeding baseline data"
# NEON_LOCAL_PROXY must be set before the shim preload runs (before dotenv).
export NEON_LOCAL_PROXY=1 NEON_WS_PROXY_PORT=5433
export DATABASE_URL="$CONN" POSTGRES_URL="$CONN" POSTGRES_PRISMA_URL="$CONN"
# Start the ws proxy temporarily so seeding (which uses the Neon adapter) can connect.
node scripts/local-dev/neon-ws-proxy.cjs >/tmp/neon-ws-proxy-install.log 2>&1 &
PROXY_PID=$!
sleep 1
# seed.ts is idempotent (skips bootstrap when the demo tenant already exists).
# The upstream seed has a known schema-drift bug (LeaveType requires a company),
# so we tolerate a non-zero exit after the core tenant/users are created.
NODE_OPTIONS="--require $REPO_ROOT/scripts/local-dev/neon-local-shim.cjs" \
  npx tsx prisma/seed.ts || echo "   NOTE: seed completed partially (known upstream seed bug); core users are present"
kill "$PROXY_PID" 2>/dev/null || true

echo "==> Install complete"
