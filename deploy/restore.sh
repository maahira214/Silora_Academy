#!/usr/bin/env bash
# Restore the database from an R2 backup. Stops the app while restoring.
#   bash deploy/restore.sh            restore the newest backup
#   bash deploy/restore.sh --list     show available backups
#   bash deploy/restore.sh <key>      restore a specific backup, e.g. backups/silora-2026-10-03T2130Z.dump
set -euo pipefail
cd "$(dirname "$0")/.."
compose() { docker compose -f deploy/compose.yaml "$@"; }

if [ "${1:-}" = "--list" ]; then
  compose run --rm backup node backup.mjs list
  exit 0
fi

read -r -p "This replaces ALL current data with ${1:-the newest backup}. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

compose up -d db
compose stop app worker
compose run --rm backup node backup.mjs restore ${1:+"$1"}
# An older backup may predate recent database changes; bring it up to date.
compose run --rm migrate
compose up -d app worker
echo "Restore finished and the app is running again."
