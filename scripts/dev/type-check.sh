#!/usr/bin/env bash
# type-check.sh - Run TypeScript type checking
# Usage: ./scripts/dev/type-check.sh
set -euo pipefail

echo "🔍 Running TypeScript type check..."

# Run tsc in noEmit mode
bun run type-check

echo "✅ Type check passed!"
