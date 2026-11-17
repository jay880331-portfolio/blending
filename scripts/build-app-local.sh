#!/usr/bin/env bash
set -euo pipefail

platform="${1:-android}"
profile="${2:-production}"
output="${3:-}"

case "$platform" in
  android)
    extension="aab"
    ;;
  ios)
    extension="ipa"
    ;;
  *)
    echo "Usage: $0 <android|ios> [profile]" >&2
    exit 1
    ;;
esac

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
builds_dir="$repo_root/builds"
timestamp="$(date +%Y%m%d%H%M%S)"

if [[ -z "$output" ]]; then
  output="$builds_dir/blending-$platform-$profile-$timestamp.$extension"
fi

mkdir -p "$builds_dir"
mkdir -p "$(dirname "$output")"

cd "$repo_root/app"
eas build \
  --platform "$platform" \
  --profile "$profile" \
  --local \
  --output "$output" \
  --non-interactive

echo "$output"
