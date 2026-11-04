#!/usr/bin/env bash
# Daily backup: database dump + product images, kept on the server and copied off it.
# Run from cron (see DEPLOY.md, "Backups"):   0 2 * * * /var/www/luckybrand-next/deploy/backup.sh >> /var/log/luckybrand-backup.log 2>&1
#
# Off-server copy uses rclone (https://rclone.org) with a remote named "offsite" (set up once with `rclone config`,
# e.g. Vultr Object Storage, Backblaze B2 or any S3-compatible bucket). Without it, backups stay on the server only.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-/var/backups/luckybrand}"
KEEP_DAYS="${KEEP_DAYS:-14}"          # local copies
REMOTE="${BACKUP_REMOTE:-offsite:luckybrand-backups}"
stamp="$(date +%F-%H%M)"
mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] backup start"
# -Fc: compressed custom format, restored with pg_restore (see restore-test.sh)
docker compose -f deploy/docker-compose.yml exec -T db pg_dump -U luckybrand -Fc luckybrand > "$BACKUP_DIR/db-$stamp.dump.part"
mv "$BACKUP_DIR/db-$stamp.dump.part" "$BACKUP_DIR/db-$stamp.dump"
size=$(stat -c %s "$BACKUP_DIR/db-$stamp.dump")
[ "$size" -gt 10000 ] || { echo "dump is only $size bytes: something is wrong"; exit 1; }
echo "database: db-$stamp.dump ($size bytes)"

find "$BACKUP_DIR" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete

if command -v rclone >/dev/null && rclone listremotes | grep -q "^${REMOTE%%:*}:"; then
  # dumps: copy (old ones are kept off-server until the bucket's own lifecycle rule removes them)
  rclone copy "$BACKUP_DIR" "$REMOTE/db" --include 'db-*.dump'
  # images: mirror, with anything deleted or replaced on the server kept for 30 days under uploads-old/
  rclone sync storage/uploads "$REMOTE/uploads" --backup-dir "$REMOTE/uploads-old/$stamp"
  echo "copied off-server to $REMOTE"
else
  echo "WARNING: no rclone remote '${REMOTE%%:*}' set up: this backup exists on the server only"
fi
echo "[$(date -Is)] backup done"
