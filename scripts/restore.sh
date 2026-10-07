#!/usr/bin/env bash
# Acme Jobs — restore from a backup.
#
#   bash scripts/restore.sh data/backups/acme-<timestamp>.dump [data-archive.tar.gz]
#
# This REPLACES the current database. It is intentionally explicit.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${DATABASE_URL:?DATABASE_URL must be set}"
DATA_DIR="${DATA_DIR:-./data}"
PG_BIN="${PG_BIN:-pg_restore}"

DUMP="${1:?Usage: restore.sh <dump-file> [data-archive.tar.gz]}"
DATA_ARCHIVE="${2:-}"

[ -f "$DUMP" ] || { echo "Backup not found: $DUMP" >&2; exit 1; }

echo "==> Target database: $(echo "$DATABASE_URL" | sed -E 's#//[^@]*@#//***@#')"

read -r -p "This will DROP and recreate all data in the target database. Type 'RESTORE' to continue: " confirm
[ "$confirm" = "RESTORE" ] || { echo "Aborted."; exit 1; }

echo "==> Cleaning existing objects"
# --if-exists makes this safe to run on a fresh or an existing database.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null

echo "==> Restoring database"
"$PG_BIN" --dbname="$DATABASE_URL" --no-owner --no-privileges --clean --if-exists "$DUMP"

if [ -n "$DATA_ARCHIVE" ]; then
  [ -f "$DATA_ARCHIVE" ] || { echo "Data archive not found: $DATA_ARCHIVE" >&2; exit 1; }
  echo "==> Restoring local data directory"
  tar -xzf "$DATA_ARCHIVE" -C "$ROOT"
fi

echo
echo "Restore complete. Verify with:"
echo "  npm run test:integration"
echo "  npx prisma migrate status"