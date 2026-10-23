#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
EXTENSION_PATH="${1:-$PWD/dist/Mr. Markdown.app/Contents/PlugIns/MDPreview.appex}"
if [[ ! -f build/preview/index.html ]]; then
  echo 'Missing build/preview/index.html. Run npm run build:web first.' >&2
  exit 1
fi
mkdir -p "$EXTENSION_PATH/Contents/MacOS" "$EXTENSION_PATH/Contents/Resources" .build/module-cache
# App extension processes enter Foundation's NSExtensionMain rather than NSApplication.main.
xcrun swiftc -O -parse-as-library -application-extension -module-name MDPreview \
  -target "$(uname -m)-apple-macos14.0" -module-cache-path "$PWD/.build/module-cache" \
  -Xlinker -e -Xlinker _NSExtensionMain \
  Sources/MDPreview/*.swift -o "$EXTENSION_PATH/Contents/MacOS/MDPreview"
cp Sources/MDPreview/Info.plist "$EXTENSION_PATH/Contents/Info.plist"
rm -rf "$EXTENSION_PATH/Contents/Resources/preview"
cp -R build/preview "$EXTENSION_PATH/Contents/Resources/preview"
printf 'XPC!????' > "$EXTENSION_PATH/Contents/PkgInfo"
plutil -lint "$EXTENSION_PATH/Contents/Info.plist"
printf 'Built Quick Look extension: %s\n' "$EXTENSION_PATH"
