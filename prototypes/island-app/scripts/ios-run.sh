#!/usr/bin/env bash
# Build Hearth Island and run it on the paired iPhone.
#
#   npm run ios:run                 # auto-picks the first paired device
#   IOS_UDID=00008110-... npm run ios:run
set -euo pipefail

cd "$(dirname "$0")/.."
TEAM="${IOS_TEAM:-4YLRJ6SMN5}"

if [[ -z "${IOS_UDID:-}" ]]; then
  TMP=$(mktemp -t hearth-devices)
  xcrun devicectl list devices --json-output "$TMP" >/dev/null
  IOS_UDID=$(python3 -c "
import json
devs=json.load(open('$TMP'))['result']['devices']
ok=[d for d in devs if d.get('connectionProperties',{}).get('pairingState')=='paired'
    and 'iPhone' in (d.get('hardwareProperties',{}).get('deviceType') or 'iPhone')]
print(ok[0]['hardwareProperties']['udid'] if ok else '')
")
  rm -f "$TMP"
fi
[[ -n "$IOS_UDID" ]] || { echo '✗ no paired iPhone found — pair it in Xcode ▸ Window ▸ Devices first'; exit 1; }
echo "▸ device: $IOS_UDID"

npm run build
npx cap sync ios

xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -destination "id=$IOS_UDID" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" build

APP=$(xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug \
  -destination "id=$IOS_UDID" -showBuildSettings 2>/dev/null \
  | awk -F' = ' '/ BUILT_PRODUCTS_DIR = /{print $2; exit}')/App.app
[[ -d "$APP" ]] || { echo "✗ build produced no app bundle at $APP"; exit 1; }

xcrun devicectl device install app --device "$IOS_UDID" "$APP"
xcrun devicectl device process launch --device "$IOS_UDID" io.starnova.hearth
echo "✓ Hearth Island is running on the device"
