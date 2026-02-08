#!/usr/bin/env bash
# build-all.sh - Build for all platforms
# Usage: ./scripts/build/build-all.sh
set -euo pipefail

echo "🔨 Building ClawUI for all platforms..."

# Clean previous builds
rm -rf dist/

# Build renderer and main process
pnpm build

# Build for each platform
echo ""
echo "📦 Building macOS..."
pnpm build:mac

echo ""
echo "📦 Building Windows..."
pnpm build:win

echo ""
echo "📦 Building Linux..."
pnpm build:linux

echo ""
echo "✅ All builds complete!"
echo "   Output directory: dist/"
ls -la dist/
