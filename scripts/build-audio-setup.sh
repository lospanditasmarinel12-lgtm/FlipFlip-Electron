#!/bin/bash
# Assemble the standalone "FlipFlip Audio Setup" distribution (a .command +
# both helper binaries), used by end users to install BlackHole and create the
# Multi-Output Device on their own Mac.
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE=build/audio-setup
rm -rf "$STAGE"
mkdir -p "$STAGE"

cp scripts/FlipFlip-Audio-Setup.command "$STAGE/"
cp audio_helper/build/flipflip_audio_helper_x64 "$STAGE/"
cp audio_helper/build/flipflip_audio_helper_arm64 "$STAGE/"
chmod +x "$STAGE/FlipFlip-Audio-Setup.command" "$STAGE/flipflip_audio_helper_x64" "$STAGE/flipflip_audio_helper_arm64"

cd build
rm -f FlipFlip-Audio-Setup-macOS.zip
ditto -c -k --keepParent audio-setup FlipFlip-Audio-Setup-macOS.zip
ls -lah FlipFlip-Audio-Setup-macOS.zip
