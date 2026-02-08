#!/usr/bin/env bash
# build-mac.sh - Build for macOS
# Usage: ./scripts/build/build-mac.sh
set -euo pipefail

echo "🍎 Building ClawUI for macOS..."

# Clean previous builds
rm -rf dist/mac* dist/*.dmg

# Build renderer and main process
pnpm build

# Build for macOS
pnpm build:mac

echo ""
echo "✅ macOS build complete!"
echo "   Output:"
ls -la dist/*.dmg dist/mac* 2>/dev/null || echo "   Check dist/ directory"
