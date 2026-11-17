#!/usr/bin/env bash
set -euo pipefail

platform="${1:-all}"
profile="${2:-production}"

case "$platform" in
  android | ios | all)
    ;;
  *)
    echo "Usage: $0 <android|ios|all> [profile]" >&2
    exit 1
    ;;
esac

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
eas_cli=(eas)

if ! command -v eas >/dev/null 2>&1; then
  eas_cli=(pnpm dlx eas-cli@latest)
fi

deploy_platform() {
  local target_platform="$1"
  local build_log
  local artifact

  build_log="$(mktemp)"
  "$repo_root/scripts/build-app-local.sh" "$target_platform" "$profile" | tee "$build_log"
  artifact="$(tail -n 1 "$build_log")"
  rm -f "$build_log"

  if [[ ! -f "$artifact" ]]; then
    echo "Build artifact not found: $artifact" >&2
    exit 1
  fi

  (
    cd "$repo_root/app"
    "${eas_cli[@]}" submit \
      --platform "$target_platform" \
      --profile "$profile" \
      --path "$artifact" \
      --non-interactive \
      --wait
  )

  "$repo_root/scripts/sync-mobile-version-policy-from-eas.sh" \
    "$target_platform" \
    "$profile"
}

if [[ "$platform" == "all" ]]; then
  deploy_platform android
  deploy_platform ios
else
  deploy_platform "$platform"
fi
