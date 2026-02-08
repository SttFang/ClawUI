#!/usr/bin/env bash
# clean.sh - Clean build artifacts and caches
# Usage: ./scripts/dev/clean.sh
set -euo pipefail

echo "🧹 Cleaning ClawUI build artifacts..."

# Remove build outputs
rm -rf dist/
rm -rf out/

# Remove node_modules cache
rm -rf node_modules/.cache
rm -rf node_modules/.vite

# Remove Electron cache (optional)
if [ "${CLEAN_ELECTRON_CACHE:-false}" = "true" ]; then
  echo "   Removing Electron cache..."
  rm -rf ~/Library/Caches/clawui
  rm -rf ~/.cache/electron
fi

echo "✅ Clean complete!"
