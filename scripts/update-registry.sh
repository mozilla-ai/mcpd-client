#!/usr/bin/env bash
# Fetch the latest mozilla-ai mcpd registry snapshot.
# Falls back to the existing bundled copy if the network is unavailable.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY_PATH="${SCRIPT_DIR}/../src/renderer/data/registry.json"
URL="https://raw.githubusercontent.com/mozilla-ai/mcpd/main/internal/provider/mozilla_ai/data/registry.json"

TMP="${REGISTRY_PATH}.tmp"

if curl -fsSL --connect-timeout 5 -o "${TMP}" "${URL}" 2>/dev/null; then
  mv "${TMP}" "${REGISTRY_PATH}"
  echo "Registry updated at ${REGISTRY_PATH}"
else
  rm -f "${TMP}"
  echo "Registry fetch failed (offline?). Using existing snapshot."
fi
