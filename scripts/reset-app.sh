#!/usr/bin/env bash
# Reset myHealth to a clean first-run state.
# Removes the encrypted database, password salt, KDF config, and WebKit storage.
# Safe to run repeatedly; silently skips files that don't exist.

set -euo pipefail

APP_DATA="$HOME/Library/Application Support/com.myhealth.app"

# Kill any running instance first
if pgrep -x "myHealth" >/dev/null 2>&1; then
  echo "Stopping myHealth..."
  pkill -x "myHealth" || true
  sleep 1
fi

echo "Clearing app data at: $APP_DATA"

rm -f "$APP_DATA/myhealth.db"
rm -f "$APP_DATA/myhealth.salt"
rm -f "$APP_DATA/myhealth.kdf"
rm -rf "$APP_DATA/WebKit"

echo "Done. myHealth will start fresh on next launch."
