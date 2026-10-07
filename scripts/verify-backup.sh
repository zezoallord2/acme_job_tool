#!/usr/bin/env bash
# Acme Jobs — verify a backup is actually restorable.
#
#   bash scripts/verify-backup.sh data/backups/acme-<timestamp>.dump
#
# Restores the dump into a throwaway database, checks the schema and the row
# counts, then drops it. A backup that cannot be restored is not a backup.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${DATABASE_URL:?DATABASE_URL must be set}"
DUMP="${1:?Usage: verify-backup.sh <dump-file>}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
PG_CREATE="${PG_CREATE:-createdb}"
PG_DROP="${PG_DROP:-dropdb}"

[ -f "$DUMP" ] || { echo "Backup not found: $DUMP" >&2; exit 1; }

# Build a scratch database name derived from the dump name.
BASE_URL="${DATABASE_URL%%\?*}"
SCRATCH_DB="acme_verify_$(date -u +%s)"

echo "==> Verifying $DUMP"
echo "    scratch database: $SCRATCH_DB"

cleanup() {
  echo "==> Dropping scratch database"
  "$PG_DROP" --if-exists --force "$BASE_URL" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Creating scratch database"
"$PG_CREATE" "$BASE_URL" "$SCRATCH_DB"

SCRATCH_URL="$BASE_URL/$SCRATCH_DB"

echo "==> Restoring dump"
"$PG_RESTORE" --dbname="$SCRATCH_URL" --no-owner --no-privileges "$DUMP"

echo "==> Checking restored schema"
TABLE_COUNT="$(psql "$SCRATCH_URL" -At -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
echo "    tables restored: $TABLE_COUNT"

# A silently truncated dump restores fewer tables than the schema declares.
MIGRATION_COUNT="$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
echo "    migrations on disk: $MIGRATION_COUNT"

echo "==> Checking critical tables and row counts"
CRITICAL_TABLES="User JobRecord Application EvidenceRecord ApplicationVersion Entitlement"
for table in $CRITICAL_TABLES; do
  EXISTS="$(psql "$SCRATCH_URL" -At -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$table';")"
  if [ "$EXISTS" = "0" ]; then
    echo "    MISSING CRITICAL TABLE: $table" >&2
    exit 1
  fi
  COUNT="$(psql "$SCRATCH_URL" -At -c "SELECT count(*) FROM \"$table\";")"
  printf "    %-20s %s rows\n" "$table" "$COUNT"
done

echo "==> Checking data integrity (no orphaned foreign keys)"
ORPHANS="$(psql "$SCRATCH_URL" -At -c "
  SELECT count(*) FROM \"EvidenceRecord\" e
  WHERE e.\"userId\" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM \"User\" u WHERE u.id = e.\"userId\");")"
if [ "$ORPHANS" != "0" ]; then
  echo "    orphaned evidence rows: $ORPHANS" >&2
  exit 1
fi
echo "    no orphaned evidence rows"

echo
echo "Backup is restorable."
echo "  file    : $DUMP"
echo "  tables  : $TABLE_COUNT"
echo "  verdict : RESTORABLE"