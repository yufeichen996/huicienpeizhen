#!/usr/bin/env bash
set -euo pipefail
umask 077

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="/var/backups/huicien-v2/${STAMP}"
mkdir -p "${TARGET}"

sqlite3 /opt/huicien-v2/backend/server/.data/huicien-v2-test.sqlite \
  ".backup '${TARGET}/huicien-v2-test.sqlite'"
tar \
  --exclude='./.env*' \
  --exclude='./server/.data' \
  --exclude='./server/.logs' \
  --exclude='./server/.uploads' \
  -czf "${TARGET}/backend-files.tgz" \
  -C /opt/huicien-v2/backend .
tar -czf "${TARGET}/uploads.tgz" -C /opt/huicien-v2/backend/server/.uploads .
tar -czf "${TARGET}/org-files.tgz" -C /var/www/huicien-v2/org .
tar -czf "${TARGET}/admin-files.tgz" -C /var/www/huicien-v2/admin .
cp /etc/nginx/sites-available/huicien-v2-test.conf "${TARGET}/"
pm2 jlist > "${TARGET}/pm2-jlist.json"

find /var/backups/huicien-v2 -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf -- {} +
echo "${TARGET}"
