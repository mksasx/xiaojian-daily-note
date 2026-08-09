#!/bin/bash
set -euo pipefail

source_icon="${1:-src/icons/icon-512.png}"
output_icon="${2:-build/icon.icns}"

if [[ ! -f "$source_icon" ]]; then
  echo "Missing source icon: $source_icon" >&2
  exit 1
fi

temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/xiaojian-icon.XXXXXX")"
trap 'rm -rf "$temporary_root"' EXIT
iconset="$temporary_root/AppIcon.iconset"
mkdir -p "$iconset" "$(dirname "$output_icon")"

for size in 16 32 128 256 512; do
  double_size=$((size * 2))
  sips -z "$size" "$size" "$source_icon" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  sips -z "$double_size" "$double_size" "$source_icon" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$iconset" -o "$output_icon"
echo "macOS icon ready: $output_icon"
