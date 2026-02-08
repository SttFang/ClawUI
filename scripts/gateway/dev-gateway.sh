#!/usr/bin/env bash
# dev-gateway.sh - Start OpenClaw Gateway for development
# Usage: ./scripts/gateway/dev-gateway.sh
set -euo pipefail

NAME="clawui-gateway"
PORT="${GATEWAY_PORT:-18789}"
RUNNER="${GATEWAY_RUNNER:-auto}"

echo "🚀 Starting OpenClaw Gateway on port ${PORT}..."

# Check if openclaw is installed
if ! command -v openclaw >/dev/null 2>&1; then
  echo "❌ OpenClaw not found. Please install it first:"
  echo "   npm install -g openclaw"
  echo "   or visit: https://docs.openclaw.ai/installation"
  exit 1
fi

# Check if gateway is already running
if lsof -i ":${PORT}" >/dev/null 2>&1; then
  echo "⚠️  Port ${PORT} is already in use"
  echo "   Another gateway instance may be running"
  exit 1
fi

# Start gateway
exec openclaw gateway --port "${PORT}"
