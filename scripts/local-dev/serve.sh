#!/usr/bin/env bash
#
# Per-boot runtime for Cloud Agents: ensure PostgreSQL + the local Neon ws proxy
# are up, then run the Next.js dev server in the foreground (stays attached).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

export PATH="$HOME/.bun/bin:$PATH"

# Bring up Postgres + the ws proxy (idempotent, returns quickly).
bash scripts/local-dev/start.sh

echo "==> Starting Next.js dev server on http://localhost:3000"
exec npm run dev
