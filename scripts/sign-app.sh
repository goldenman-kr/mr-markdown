#!/bin/bash
set -euo pipefail
APP_PATH="${1:-dist/Mr. Markdown.app}"
LOCAL_CONFIG="$(dirname "$0")/signing.local.env"
if [[ -f "$LOCAL_CONFIG" ]]; then
  source "$LOCAL_CONFIG"
fi
ACCOUNT="${MD_SIGN_ACCOUNT:-}"
if [[ -z "$ACCOUNT" && -n "${MD_SIGN_IDENTITY:-}" ]]; then
  echo 'Set MD_SIGN_ACCOUNT alongside MD_SIGN_IDENTITY to validate the requested account.' >&2
  exit 1
fi
IDENTITIES="$(security find-identity -v -p codesigning)"
# Never select a different person's or team's certificate automatically.
IDENTITY=""
if [[ -n "$ACCOUNT" ]]; then
  IDENTITY="$(printf '%s\n' "$IDENTITIES" | awk -v account="$ACCOUNT" 'index($0, account) && /Apple Development:/ {print $2; exit}')"
fi
if [[ -n "${MD_SIGN_IDENTITY:-}" ]]; then
  if ! printf '%s\n' "$IDENTITIES" | awk -v selected="$MD_SIGN_IDENTITY" -v account="$ACCOUNT" 'index($0, selected) && index($0, account) && /Apple Development:/ {found=1} END {exit !found}'; then
    echo 'MD_SIGN_IDENTITY is not a valid Apple Development identity for the requested account.' >&2
    exit 1
  fi
  IDENTITY="$MD_SIGN_IDENTITY"
fi
EXTENSION_PATH="$APP_PATH/Contents/PlugIns/MDPreview.appex"
ENTITLEMENTS="$(dirname "$0")/../Sources/MDPreview/MDPreview.entitlements"
SIGNING_IDENTITY="${IDENTITY:--}"
if [[ -d "$EXTENSION_PATH" ]]; then
  codesign --force --options runtime --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$EXTENSION_PATH"
fi
if [[ -n "$IDENTITY" ]]; then
  codesign --force --options runtime --sign "$IDENTITY" "$APP_PATH"
  echo "Signed using Apple Development identity for $ACCOUNT."
else
  codesign --force --sign - "$APP_PATH"
  echo "Developer signing unavailable: no valid Apple Development certificate for $ACCOUNT. Applied ad-hoc local signing only." >&2
fi
codesign --verify --deep --strict "$APP_PATH"
