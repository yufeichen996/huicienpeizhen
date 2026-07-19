#!/usr/bin/env bash
set -euo pipefail
umask 077

RELEASE_DIR="${1:?usage: deploy-test.sh /path/to/release}"
BACKEND_DIR="/opt/huicien-v2/backend"
ORG_DIR="/var/www/huicien-v2/org"
ADMIN_DIR="/var/www/huicien-v2/admin"
BACKUP_DIR="/var/backups/huicien-v2/$(date +%Y%m%d-%H%M%S)"

if [[ ! -f "${RELEASE_DIR}/package.json" || ! -d "${RELEASE_DIR}/server" ]]; then
  echo "Invalid release directory: ${RELEASE_DIR}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}" "${BACKEND_DIR}" "${ORG_DIR}" "${ADMIN_DIR}" /var/log/huicien-v2

if [[ -f "${BACKEND_DIR}/server/.data/huicien-v2-test.sqlite" ]]; then
  sqlite3 "${BACKEND_DIR}/server/.data/huicien-v2-test.sqlite" ".backup '${BACKUP_DIR}/huicien-v2-test.sqlite'"
fi
tar \
  --exclude='./.env*' \
  --exclude='./server/.data' \
  --exclude='./server/.logs' \
  --exclude='./server/.uploads' \
  -czf "${BACKUP_DIR}/backend-files.tgz" \
  -C "${BACKEND_DIR}" . 2>/dev/null || true
tar -czf "${BACKUP_DIR}/org-files.tgz" -C "${ORG_DIR}" . 2>/dev/null || true
tar -czf "${BACKUP_DIR}/admin-files.tgz" -C "${ADMIN_DIR}" . 2>/dev/null || true

rsync -a --delete \
  --exclude '.git' \
  --exclude '.env*' \
  --exclude 'server/.data' \
  --exclude 'server/.logs' \
  --exclude 'server/.uploads' \
  "${RELEASE_DIR}/" "${BACKEND_DIR}/"

cd "${BACKEND_DIR}"
if [[ ! -f .env.test ]]; then
  echo "Missing server-managed ${BACKEND_DIR}/.env.test" >&2
  exit 1
fi
npm ci
node --env-file=.env.test server/migrate.mjs
node --env-file=.env.test server/prelaunch-test.mjs
node --env-file=.env.test scripts/build-portals.mjs

rsync -a --delete dist/institution/ "${ORG_DIR}/"
rsync -a --delete dist/admin/ "${ADMIN_DIR}/"

pm2 startOrReload deploy/pm2/ecosystem.config.cjs --only huicien-api-v2-test
pm2 save

nginx -t
systemctl reload nginx

curl --fail --silent --show-error https://api-test.huicien.com/api/health
echo "Deployment completed. Backup: ${BACKUP_DIR}"
