#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_DIR="${1:?usage: rollback-production.sh /var/backups/huicien-v2/YYYYmmdd-HHMMSS}"
BACKEND_DIR="/opt/huicien-v2/backend"
ORG_DIR="/var/www/huicien-v2/org"
ADMIN_DIR="/var/www/huicien-v2/admin"

BACKUP_REAL="$(readlink -f "${BACKUP_DIR}")"
case "${BACKUP_REAL}" in
  /var/backups/huicien-v2/*) ;;
  *) echo "Invalid backup directory: ${BACKUP_REAL}" >&2; exit 1 ;;
esac

pm2 stop huicien-api || true
tar -xzf "${BACKUP_REAL}/backend-files.tgz" -C "${BACKEND_DIR}"
tar -xzf "${BACKUP_REAL}/org-files.tgz" -C "${ORG_DIR}"
tar -xzf "${BACKUP_REAL}/admin-files.tgz" -C "${ADMIN_DIR}"

if [[ -f "${BACKUP_REAL}/huicien.sqlite" ]]; then
  cp "${BACKUP_REAL}/huicien.sqlite" "${BACKEND_DIR}/data/huicien.sqlite"
fi

pm2 startOrReload "${BACKEND_DIR}/deploy/pm2/ecosystem.production.config.cjs" \
  --only huicien-api
pm2 save
nginx -t
systemctl reload nginx
curl --fail --silent --show-error http://127.0.0.1:8797/api/health
echo
