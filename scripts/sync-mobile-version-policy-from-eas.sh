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

raw_versions="$(
  cd "$repo_root/app"
  "${eas_cli[@]}" build:version:get \
    --platform "$platform" \
    --profile "$profile" \
    --json \
    --non-interactive
)"

versions="$(
  printf '%s' "$raw_versions" | node -e '
const input = require("fs").readFileSync(0, "utf8");
const start = input.lastIndexOf("{");
const end = input.lastIndexOf("}");
if (start === -1 || end === -1 || end < start) {
  throw new Error("Could not find JSON in EAS version output.");
}
const json = input.slice(start, end + 1);
console.log(JSON.stringify(JSON.parse(json)));
'
)"

android_build_number="$(
  node -e 'console.log(JSON.parse(process.argv[1]).versionCode ?? "")' "$versions"
)"
ios_build_number="$(
  node -e 'console.log(JSON.parse(process.argv[1]).buildNumber ?? "")' "$versions"
)"

args=()
if [[ "$platform" == "android" || "$platform" == "all" ]]; then
  if [[ -z "$android_build_number" ]]; then
    echo "Could not read Android versionCode from EAS." >&2
    exit 1
  fi
  args+=(--android-build-number "$android_build_number")
fi

if [[ "$platform" == "ios" || "$platform" == "all" ]]; then
  if [[ -z "$ios_build_number" ]]; then
    echo "Could not read iOS buildNumber from EAS." >&2
    exit 1
  fi
  args+=(--ios-build-number "$ios_build_number")
fi

cd "$repo_root"
pnpm --filter @blending/web exec tsx \
  scripts/update-mobile-version-policy.ts \
  "${args[@]}"
