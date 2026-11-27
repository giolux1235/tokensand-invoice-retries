#!/usr/bin/env bash
set -euo pipefail

roots="$RUNNER_TEMP/evaluated"
reviewer="$RUNNER_TEMP/reviewer/plugins/tokensand-agent-pack/skills/tokensand-agent-pack/scripts/review_vitest.py"
candidates=()
case "$REVIEW_SET" in
  mixed) candidates+=(--after-root "$roots/weakened");;
  repaired) ;;
  *) exit 1;;
esac
exec python3 "$reviewer" "$@" --before-root "$roots/baseline" "${candidates[@]}" --after-root "$roots/repair" \
  packages/ai/src/ui/last-assistant-message-is-complete-with-tool-calls.test.ts
