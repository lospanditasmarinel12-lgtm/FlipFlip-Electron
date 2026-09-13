#!/bin/bash
# Build signed macOS release kits (x64 + arm64) for FlipFlip
# Everything is staged inside this repo (build/payload) - no /tmp.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

# Signing certificate hash (Apple Development is fine for manual
# "Open Anyway" distribution; swap for a Developer ID Application hash if the
# account is ever upgraded to support notarization).
DEV_ID_HASH="${DEV_ID_HASH:-4D2DDCB4E8330C572E4CF6CEB332C8C533A97243}"

VERSION="6.1.0"
BUILD_NUMBER="7"

pkill -9 -f "FlipFlip" >/dev/null 2>&1 || true
pkill -9 -f "Electron.app/Contents/MacOS" >/dev/null 2>&1 || true

echo "== production webpack build =="
npm run production

echo "== staging payload (repo-local build/payload) =="
rm -rf build/payload
mkdir -p build/payload
cp package.json package-lock.json LICENSE build/payload/ 2>/dev/null || cp package.json build/payload/
cp -R dist build/payload/dist
( cd build/payload && npm install --omit=dev --legacy-peer-deps )

# Gate - this is what /tmp lost before:
[ -f build/payload/package.json ] || { echo "GATE FAIL: no package.json in payload"; exit 1; }
[ -d build/payload/node_modules ] || { echo "GATE FAIL: no node_modules in payload"; exit 1; }
[ -f build/payload/dist/main.bundle.js ] || { echo "GATE FAIL: no main.bundle.js in payload"; exit 1; }
echo "payload gate OK (package.json + node_modules + main.bundle.js)"

echo "== helper gate =="
HELPER_SRC="audio_helper/flipflip_audio_helper.swift"
for arch in arm64 x64; do
  HELPER="audio_helper/build/flipflip_audio_helper_$arch"
  if [ ! -f "$HELPER" ]; then
    echo "GATE FAIL: missing helper binary $HELPER"; exit 1
  fi
  if [ "$HELPER_SRC" -nt "$HELPER" ]; then
    echo "GATE FAIL: $HELPER is older than $HELPER_SRC — rebuild it first:"
    echo "  swiftc -O $HELPER_SRC -o $HELPER"
    exit 1
  fi
done
echo "helper gate OK (arm64 + x64 fresh)"

echo "== electron templates (repo-local build/templates) =="
mkdir -p build/templates/arm64 build/templates/x64
if [ ! -d build/templates/arm64/Electron.app ]; then cp -R /tmp/eeltpl/Electron.app build/templates/arm64/; fi
if [ ! -d build/templates/x64/Electron.app ]; then cp -R /tmp/eeltpl_x64/Electron.app build/templates/x64/; fi

echo "== package + sign both arches =="
for arch in arm64 x64; do
  R="release/FlipFlip-darwin-$arch/FlipFlip.app"
  rm -rf "$R"
  TEMPL="build/templates/$arch/Electron.app"
  HELPER="audio_helper/build/flipflip_audio_helper_$arch"
  cp -R "$TEMPL" "$R"
  cp -R build/payload "$R/Contents/Resources/app"
  rm -f "$R/Contents/Resources/default_app.asar"
  cp build_icons/FlipFlip.icns "$R/Contents/Resources/FlipFlip.icns"
  if [ -f "$HELPER" ]; then
    cp "$HELPER" "$R/Contents/Resources/flipflip_audio_helper"
    chmod +x "$R/Contents/Resources/flipflip_audio_helper"
  fi
  mv "$R/Contents/MacOS/Electron" "$R/Contents/MacOS/FlipFlip"
  /usr/libexec/PlistBuddy \
    -c "Set :CFBundleExecutable FlipFlip" \
    -c "Set :CFBundleName FlipFlip" \
    -c "Set :CFBundleIdentifier com.flipflip.app" \
    -c "Set :CFBundleShortVersionString $VERSION" \
    -c "Set :CFBundleVersion $BUILD_NUMBER" \
    -c "Set :CFBundleIconFile FlipFlip.icns" \
    "$R/Contents/Info.plist"
  if ! /usr/libexec/PlistBuddy -c "Print :NSMicrophoneUsageDescription" "$R/Contents/Info.plist" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string FlipFlip captures system audio for haptic feedback." "$R/Contents/Info.plist"
  fi
  codesign --force --deep --sign "$DEV_ID_HASH" --entitlements entitlements.plist "$R"
done

echo "== code-sign verify =="
codesign --verify --deep --strict release/FlipFlip-darwin-x64/FlipFlip.app
codesign --verify --deep --strict release/FlipFlip-darwin-arm64/FlipFlip.app
echo "x64 OK / arm64 OK"

echo "== zips =="
cd release
rm -f FlipFlip-macOS-arm64.zip FlipFlip-macOS-x64.zip
ditto -c -k --keepParent FlipFlip-darwin-arm64/FlipFlip.app FlipFlip-macOS-arm64.zip
ditto -c -k --keepParent FlipFlip-darwin-x64/FlipFlip.app FlipFlip-macOS-x64.zip
ls -lah *.zip
echo "DONE"
