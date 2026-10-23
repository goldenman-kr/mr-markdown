#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP_PATH="${MD_APP_INPUT:-$PWD/dist/Mr. Markdown.app}"
[[ -d "$APP_PATH" ]] || { echo 'Run npm run build first.' >&2; exit 1; }
# A separate staging folder prevents legacy app names from entering the image.
STAGING="$PWD/build/dmg-mr-markdown"
mkdir -p "$STAGING"
rm -rf "$STAGING/Mr. Markdown.app"
cp -R "$APP_PATH" "$STAGING/Mr. Markdown.app"
VERSION=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP_PATH/Contents/Info.plist")
ln -sfn /Applications "$STAGING/Applications"
hdiutil create -volname "Mr. Markdown" -srcfolder "$STAGING" -format UDZO -ov "dist/Mr. Markdown-${VERSION}-$(uname -m).dmg"
