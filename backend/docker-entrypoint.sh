#!/bin/sh
# Apply pending migrations and make sure the admin account exists, then start the API.
set -e

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "▶ Applying database migrations"
  i=1
  until npx --no-install prisma migrate deploy; do
    if [ "$i" -ge 10 ]; then echo "✖ Database not reachable, giving up"; exit 1; fi
    echo "  database not ready, retrying in 3s ($i/10)"
    i=$((i + 1))
    sleep 3
  done
fi

# Creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD if it doesn't exist (skips when unset).
node dist/scripts/create-admin.js

exec "$@"
