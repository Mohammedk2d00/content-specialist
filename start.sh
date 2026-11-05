#!/usr/bin/env bash
cd "$(dirname "$(readlink -f "$0")")"
ROOT="$PWD"
EXE="$ROOT/app/node_modules/electron/dist/electron"
if [ ! -x "$EXE" ]; then
  echo "The app engine is not installed. Run ./setup.sh first."
  exit 1
fi
T0=$(date +%s)
"$EXE" "$ROOT/app" --workspace="$ROOT" "$@" && exit 0
if [ $(( $(date +%s) - T0 )) -lt 5 ]; then
  echo "The window did not start. Trying once more without the Chromium sandbox..." >&2
  exec "$EXE" "$ROOT/app" --workspace="$ROOT" --no-sandbox "$@"
fi
