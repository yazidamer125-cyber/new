#!/usr/bin/env bash
# CI privacy gate (product rule #1): worker data must NEVER be reachable from
# the public route group. Fails the build if:
#   1. any file under app/(public) mentions worker code/strings at all, or
#   2. any file under app/(public) imports from components/workers, lib/db
#      schema/guards/access, or calls /api/workers.
set -euo pipefail

PUBLIC_DIR="app/(public)"
FAIL=0

if [ ! -d "$PUBLIC_DIR" ]; then
  echo "ERROR: $PUBLIC_DIR not found — route layout changed without updating the privacy gate."
  exit 1
fi

echo "→ Checking $PUBLIC_DIR for worker-data leakage…"

# Rule 1: the token 'worker' (any case) may not appear in public sources.
if grep -RinE "worker" "$PUBLIC_DIR" --include='*.ts' --include='*.tsx'; then
  echo "✗ FAIL: 'worker' reference found under $PUBLIC_DIR (see matches above)."
  FAIL=1
fi

# Rule 2: forbidden imports/endpoints in public sources.
if grep -RinE "components/workers|lib/db/(schema|guards|access)|/api/workers|from ['\"]@/lib/db" "$PUBLIC_DIR" --include='*.ts' --include='*.tsx'; then
  echo "✗ FAIL: forbidden import or endpoint reference under $PUBLIC_DIR (see matches above)."
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "Public pages must contain ZERO worker data or data-layer imports."
  exit 1
fi

echo "✓ Public routes are clean: no worker data, no data-layer imports."
