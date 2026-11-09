#!/bin/sh
# Nightly off-server backup of the uploads volume.
#
# The VPS disk must never be the only copy of user media. This copies (never
# deletes) /var/loop-uploads to remote object storage with rclone — Backblaze B2
# (`b2:loop-media`) or Cloudflare R2 (`r2:loop-media`) both work — verifies the
# transfer, and alerts when anything fails.
#
# Setup (once, on the VPS):
#   rclone config                 # create a remote named `b2` or `r2`
#   export MEDIA_BACKUP_REMOTE=b2:loop-media
#   export MEDIA_ALERT_WEBHOOK=https://hooks.slack.com/services/...  # optional
#
# Run from cron/systemd (deploy/systemd/loop-media-backup.timer) or by hand:
#   sh scripts/media-backup.sh
#
# Exit codes: 0 success, 1 rclone failure, 2 missing configuration.

set -eu

SRC="${MEDIA_STORAGE_ROOT:-/var/loop-uploads}"
REMOTE="${MEDIA_BACKUP_REMOTE:-}"
LOG_TAG="loop-media-backup"
LOCK="/var/lock/loop-media-backup.lock"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

alert() {
  message="$1"
  log "ALERT: $message"
  if [ -n "${MEDIA_ALERT_WEBHOOK:-}" ]; then
    # Slack and Discord both accept a JSON `text` field.
    curl -fsS -m 15 -H 'Content-Type: application/json' \
      -d "{\"text\":\"${LOG_TAG}: ${message}\"}" \
      "${MEDIA_ALERT_WEBHOOK}" >/dev/null 2>&1 || log "alert webhook failed"
  fi
}

if ! command -v rclone >/dev/null 2>&1; then
  alert "rclone is not installed — uploads are NOT being backed up"
  exit 2
fi

if [ -z "$REMOTE" ]; then
  alert "MEDIA_BACKUP_REMOTE is not set — uploads are NOT being backed up"
  exit 2
fi

if [ ! -d "$SRC" ]; then
  alert "uploads directory $SRC does not exist"
  exit 2
fi

# Never let two runs overlap (a big first sync can outlast a nightly slot).
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "another backup is already running; skipping"
    exit 0
  fi
fi

log "backing up $SRC → $REMOTE"
START=$(date +%s)

if ! rclone copy "$SRC" "$REMOTE" \
  --exclude ".incoming/**" \
  --transfers "${MEDIA_BACKUP_TRANSFERS:-4}" \
  --checkers 8 \
  --stats-one-line \
  --stats 60s \
  --log-level INFO 2>&1; then
  alert "rclone copy failed for $SRC"
  exit 1
fi

# Confirm the remote is reachable and holds data; a silent empty bucket is the
# failure mode that matters (deleted credentials, changed bucket name).
SIZE=$(rclone size "$REMOTE" --json 2>/dev/null | tr -d '\n' || true)
BYTES=$(printf '%s' "$SIZE" | sed -n 's/.*"bytes":\([0-9][0-9]*\).*/\1/p')
if [ -z "$BYTES" ] || [ "$BYTES" -eq 0 ]; then
  alert "backup finished but the remote is empty or unreadable — uploads may not be protected"
  exit 1
fi

DURATION=$(( $(date +%s) - START ))
log "backup complete in ${DURATION}s — $SIZE"

# A backup older than 36h is a problem; the app's Health tab reads this stamp if
# it is inside the media root, so surface it there too.
STAMP_DIR="$SRC/.backup"
mkdir -p "$STAMP_DIR" 2>/dev/null || true
if [ -w "$STAMP_DIR" ]; then
  date -u +%Y-%m-%dT%H:%M:%SZ > "$STAMP_DIR/last-success.txt" 2>/dev/null || true
fi

exit 0
