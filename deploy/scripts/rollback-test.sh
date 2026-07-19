#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_DIR="${1:?usage: rollback-test.sh /var/backups/huicien-v2/YYYYmmdd-HHMMSS}"

pm2 stop huicien-api-v2-test
tar -xzf "${BACKUP_DIR}/backend-files.tgz" -C /opt/huicien-v2/backend
tar -xzf "${BACKUP_DIR}/org-files.tgz" -C /var/www/huicien-v2/org
tar -xzf "${BACKUP_DIR}/admin-files.tgz" -C /var/www/huicien-v2/admin

if [[ -f "${BACKUP_DIR}/huicien-v2-test.sqlite" ]]; then
  cp "${BACKUP_DIR}/huicien-v2-test.sqlite" \
    /opt/huicien-v2/backend/server/.data/huicien-v2-test.sqlite
fi
if [[ -f "${BACKUP_DIR}/uploads.tgz" ]]; then
  tar -xzf "${BACKUP_DIR}/uploads.tgz" -C /opt/huicien-v2/backend/server/.uploads
fi

pm2 startOrReload /opt/huicien-v2/backend/deploy/pm2/ecosystem.config.cjs \
  --only huicien-api-v2-test
nginx -t
systemctl reload nginx
curl --fail --silent --show-error https://api-test.huicien.com/api/health
