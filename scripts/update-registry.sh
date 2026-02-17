#!/usr/bin/env bash
# Fetch the latest mozilla-ai mcpd registry snapshot.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY_PATH="${SCRIPT_DIR}/../src/renderer/data/registry.json"

curl -fsSL -o "${REGISTRY_PATH}" \
  https://raw.githubusercontent.com/mozilla-ai/mcpd/main/internal/provider/mozilla_ai/data/registry.json

echo "Registry updated at ${REGISTRY_PATH}"
echo "Servers: $(python3 -c "import json; print(len(json.load(open('${REGISTRY_PATH}'))))")"
