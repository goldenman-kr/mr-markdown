#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP_PATH="${MD_APP_OUTPUT:-$PWD/dist/Mr. Markdown.app}"
if [[ ! -f build/web/index.html ]]; then
  echo 'Missing build/web/index.html. Run npm run build:web first.' >&2
  exit 1
fi
mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources"
mkdir -p .build/module-cache
xcrun swiftc -O -parse-as-library -module-name MrMarkdown -target "$(uname -m)-apple-macos14.0" \
  -module-cache-path "$PWD/.build/module-cache" \
  Sources/MD-Editor/*.swift -o "$APP_PATH/Contents/MacOS/Mr. Markdown"
cp Sources/MD-Editor/Info.plist "$APP_PATH/Contents/Info.plist"
rm -rf "$APP_PATH/Contents/Resources/web"
cp -R build/web "$APP_PATH/Contents/Resources/web"
if [[ -f assets/AppIcon.icns ]]; then
  cp assets/AppIcon.icns "$APP_PATH/Contents/Resources/AppIcon.icns"
fi
if [[ -f assets/THIRD-PARTY-NOTICES.txt ]]; then
  cp assets/THIRD-PARTY-NOTICES.txt "$APP_PATH/Contents/Resources/THIRD-PARTY-NOTICES.txt"
fi
printf 'APPL????' > "$APP_PATH/Contents/PkgInfo"
bash scripts/build-quicklook.sh "$APP_PATH/Contents/PlugIns/MDPreview.appex"
plutil -lint "$APP_PATH/Contents/Info.plist"
bash scripts/sign-app.sh "$APP_PATH"
printf 'Built %s\n' "$APP_PATH"
