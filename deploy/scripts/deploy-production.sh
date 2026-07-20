#!/usr/bin/env bash
set -euo pipefail
umask 077

RELEASE_DIR="${1:?usage: deploy-production.sh /path/to/release}"
BACKEND_DIR="/opt/huicien-v2/backend"
ORG_DIR="/var/www/huicien-v2/org"
ADMIN_DIR="/var/www/huicien-v2/admin"
BACKUP_DIR="/var/backups/huicien-v2/$(date +%Y%m%d-%H%M%S)"

if [[ ! -f "${RELEASE_DIR}/package.json" || ! -d "${RELEASE_DIR}/server" ]]; then
  echo "Invalid release directory: ${RELEASE_DIR}" >&2
  exit 1
fi

install -d -m 700 "${BACKUP_DIR}"
install -d -m 755 "${BACKEND_DIR}" "${ORG_DIR}" "${ADMIN_DIR}"
install -d -m 750 /var/log/huicien-v2

if [[ -f "${BACKEND_DIR}/data/huicien.sqlite" ]]; then
  sqlite3 "${BACKEND_DIR}/data/huicien.sqlite" \
    ".backup '${BACKUP_DIR}/huicien.sqlite'"
fi
if [[ -d "${BACKEND_DIR}" ]]; then
  tar \
    --exclude='./.env*' \
    --exclude='./data' \
    --exclude='./uploads' \
    -czf "${BACKUP_DIR}/backend-files.tgz" \
    -C "${BACKEND_DIR}" . 2>/dev/null || true
fi
tar -czf "${BACKUP_DIR}/org-files.tgz" -C "${ORG_DIR}" . 2>/dev/null || true
tar -czf "${BACKUP_DIR}/admin-files.tgz" -C "${ADMIN_DIR}" . 2>/dev/null || true

rsync -a --delete \
  --exclude '.git' \
  --exclude '.env*' \
  --exclude 'data' \
  --exclude 'uploads' \
  "${RELEASE_DIR}/" "${BACKEND_DIR}/"

cd "${BACKEND_DIR}"
if [[ ! -f .env.production ]]; then
  echo "Missing server-managed ${BACKEND_DIR}/.env.production" >&2
  exit 1
fi

install -d -m 750 data uploads
npm ci --no-audit --no-fund
node --env-file=.env.production server/migrate.mjs
node --env-file=.env.production scripts/build-portals.mjs

rsync -a --delete dist/institution/ "${ORG_DIR}/"
rsync -a --delete dist/admin/ "${ADMIN_DIR}/"
find "${ORG_DIR}" "${ADMIN_DIR}" -type d -exec chmod 755 {} +
find "${ORG_DIR}" "${ADMIN_DIR}" -type f -exec chmod 644 {} +

pm2 startOrReload deploy/pm2/ecosystem.production.config.cjs --only huicien-api
pm2 save

curl --fail --silent --show-error http://127.0.0.1:8797/api/health
echo
echo "Deployment completed. Backup: ${BACKUP_DIR}"
