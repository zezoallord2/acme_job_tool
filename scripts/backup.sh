#!/usr/bin/env bash
# Acme Jobs — $0 backup.
#
#   bash scripts/backup.sh
#
# Produces:
#   data/backups/acme-<timestamp>.dump   pg_dump custom format
#   data/backups/data-<timestamp>.tar.gz  uploads, exports, generated, logs
#   data/backups/MANIFEST.txt            checksums + row counts
#
# Restore:
#   bash scripts/restore.sh data/backups/acme-<timestamp>.dump

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${DATABASE_URL:?DATABASE_URL must be set}"
DATA_DIR="${DATA_DIR:-./data}"
BACKUP_DIR="$DATA_DIR/backups"
PG_BIN="${PG_BIN:-pg_dump}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/acme-$STAMP.dump"
DATA_ARCHIVE="$BACKUP_DIR/data-$STAMP.tar.gz"
MANIFEST="$BACKUP_DIR/MANIFEST-$STAMP.txt"

echo "==> Backing up database to $DUMP"
# Custom format so a restore can be selective (pg_restore --table).
"$PG_BIN" --format=custom --no-owner --no-privileges --file="$DUMP" "$DATABASE_URL"

echo "==> Backing up local data directory"
# Only persistent user artefacts; nothing ephemeral is included.
ARCHIVE_PATHS=()
for dir in uploads exports generated logs; do
  [ -d "$DATA_DIR/$dir" ] && ARCHIVE_PATHS+=("$DATA_DIR/$dir")
done
if [ ${#ARCHIVE_PATHS[@]} -gt 0 ]; then
  tar -czf "$DATA_ARCHIVE" "${ARCHIVE_PATHS[@]}"
else
  tar -czf "$DATA_ARCHIVE" --files-from /dev/null
fi

echo "==> Writing manifest"
{
  echo "Acme Jobs backup"
  echo "created_at: $STAMP"
  echo "schema_version: $(grep -o 'SCHEMA_VERSION=.*' .env 2>/dev/null | head -1 || echo unknown)"
  echo
  echo "files:"
  sha256sum "$DUMP" "$DATA_ARCHIVE"
  echo
  echo "table row counts:"
  "$PG_BIN" --version >/dev/null
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -At -c "
      SELECT relname || ' = ' || n_live_tup
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
      LIMIT 40;"
  fi
} > "$MANIFEST"

# Retention: keep the newest 10 database dumps.
ls -1t "$BACKUP_DIR"/acme-*.dump 2>/dev/null | tail -n +11 | while read -r old; do
  echo "==> Pruning old backup $old"
  rm -f "$old"
done

echo
echo "Backup complete."
echo "  database : $DUMP"
echo "  data     : $DATA_ARCHIVE"
echo "  manifest : $MANIFEST"
echo
echo "Verify with:  bash scripts/verify-backup.sh $DUMP"