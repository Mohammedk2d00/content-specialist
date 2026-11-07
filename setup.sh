#!/usr/bin/env bash
set -e
cd "$(dirname "$(readlink -f "$0")")"
ROOT="$PWD"
echo
echo " === UOWA Content Specialist: one-time setup (Linux) ==="
echo

echo "[1/5] System packages (Node.js, npm and the libraries the app window needs)..."
if command -v pacman >/dev/null 2>&1; then
  pacman -Q nodejs npm gtk3 nss alsa-lib >/dev/null 2>&1 || sudo pacman -S --needed --noconfirm nodejs npm gtk3 nss alsa-lib
else
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Install Node.js and npm with your package manager, then run ./setup.sh again."
    exit 1
  fi
fi
node --version

echo
echo "[2/5] Downloading the app window engine (about 100 MB, one time)..."
(cd app && npm install --no-audit --no-fund --ignore-scripts=false)
if [ ! -x app/node_modules/electron/dist/electron ]; then
  echo "Fetching the engine file directly..."
  (cd app && node node_modules/electron/install.js) || true
fi
if [ ! -x app/node_modules/electron/dist/electron ]; then
  echo "The engine download failed. Check the internet connection and run ./setup.sh again."
  exit 1
fi

echo
echo "[3/5] Drafts folder in Documents..."
DOCS=$(xdg-user-dir DOCUMENTS 2>/dev/null || true)
[ -n "$DOCS" ] || DOCS="$HOME/Documents"
mkdir -p "$DOCS/drafts"
if [ -d drafts ] && [ ! -L drafts ]; then
  ( shopt -s dotglob nullglob; for f in drafts/*; do mv -n "$f" "$DOCS/drafts/" || true; done )
  rmdir drafts 2>/dev/null || echo "Some files stayed in the old drafts folder (same names already in Documents). Move them by hand."
fi
if [ ! -e drafts ] && [ ! -L drafts ]; then ln -s "$DOCS/drafts" drafts; fi
echo "Drafts are stored in: $DOCS/drafts"

echo
echo "[4/5] Menu entry and desktop shortcut..."
chmod +x start.sh
APPDIR="$HOME/.local/share/applications"
mkdir -p "$APPDIR"
ENTRY="$APPDIR/uowa-content-specialist.desktop"
cat > "$ENTRY" <<EOF
[Desktop Entry]
Type=Application
Name=UOWA Content Specialist
Comment=Write university website posts
Exec="$ROOT/start.sh"
Path=$ROOT
Icon=$ROOT/app/renderer/logo.png
Terminal=false
Categories=Office;
EOF
DESK=$(xdg-user-dir DESKTOP 2>/dev/null || true)
[ -n "$DESK" ] || DESK="$HOME/Desktop"
if [ -d "$DESK" ]; then
  cp "$ENTRY" "$DESK/UOWA Content Specialist.desktop"
  chmod +x "$DESK/UOWA Content Specialist.desktop"
fi
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPDIR" || true

echo
echo "[5/5] Checking the project files..."
if ! node selftest.js 2>&1 | grep -E "FAIL|passed"; then
  echo "The self-test reported a problem."
fi

if ! command -v gemini >/dev/null 2>&1; then
  echo
  printf "Optional: install Gemini CLI for the Classic engine (the Fast engine does not need it)? [y/N] "
  read -r ANS || ANS=n
  if [ "$ANS" = y ] || [ "$ANS" = Y ]; then
    sudo npm install -g @google/gemini-cli || echo "Gemini CLI install failed. You can skip it."
  fi
fi

echo
echo " Setup finished."
echo " Open it from the application menu (UOWA Content Specialist), the desktop icon, or run ./start.sh"
echo " Also install the browser extension once (see README.txt, step 3)."
