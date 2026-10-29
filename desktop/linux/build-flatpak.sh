#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
version="$(node -p 'JSON.parse(require("fs").readFileSync("package.json")).version')"
bundle="$root/release-desktop/Foliquo-Desktop-$version-Linux-x64.flatpak"
source_dir="$root/release-desktop/flatpak-source"
deb="$(find "$root/desktop/src-tauri/target/release/bundle/deb" -maxdepth 1 -name '*.deb' -print -quit)"
test -f "$deb"
rm -rf "$source_dir" "$root/release-desktop/flatpak-build" "$root/release-desktop/deb-extract"
mkdir -p "$source_dir" "$root/release-desktop/deb-extract"
cd "$root/release-desktop/deb-extract"
ar x "$deb"
tar -xf data.tar.* -C "$source_dir"
cp "$root/desktop/linux/flatpak-manifest.json" "$root/release-desktop/flatpak-manifest.json"
flatpak-builder --force-clean --repo="$root/release-desktop/flatpak-repo" "$root/release-desktop/flatpak-build" "$root/release-desktop/flatpak-manifest.json"
flatpak build-bundle --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo "$root/release-desktop/flatpak-repo" "$bundle" at.maximilianauer.foliquo
echo "Built $bundle"
