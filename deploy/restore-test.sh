#!/usr/bin/env bash
# Proves the newest backup can actually be restored: loads it into a throwaway database next to the real one,
# compares row counts, then drops it. The live database is never touched. Run monthly, or after changing backups.
#   deploy/restore-test.sh                 # newest dump in /var/backups/luckybrand
#   deploy/restore-test.sh path/to.dump    # a specific one (e.g. downloaded from off-server storage)
set -euo pipefail
cd "$(dirname "$0")/.."
dump="${1:-$(ls -1t "${BACKUP_DIR:-/var/backups/luckybrand}"/db-*.dump | head -1)}"
[ -f "$dump" ] || { echo "no dump found"; exit 1; }
dc() { docker compose -f deploy/docker-compose.yml exec -T db "$@"; }

echo "restoring $dump into luckybrand_restore_test…"
dc dropdb -U luckybrand --if-exists luckybrand_restore_test
dc createdb -U luckybrand luckybrand_restore_test
dc pg_restore -U luckybrand -d luckybrand_restore_test --no-owner < "$dump"

q="SELECT 'products', COUNT(*) FROM products UNION ALL SELECT 'orders', COUNT(*) FROM orders UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'media', COUNT(*) FROM media"
echo "table     backup  live"
paste <(dc psql -U luckybrand -d luckybrand_restore_test -tAF' ' -c "$q") <(dc psql -U luckybrand -d luckybrand -tA -c "$q" | cut -d'|' -f2) | awk '{printf "%-9s %6s %5s\n", $1, $2, $3}'
dc dropdb -U luckybrand luckybrand_restore_test
echo "restore test OK (counts can differ by what changed since the backup was taken)"
