#!/bin/bash
# FlipFlip Audio Setup — one-time macOS system-audio loopback setup.
# Checks BlackHole, then creates the "FlipFlip Multi-Output" device.
DIR="$(cd "$(dirname "$0")" && pwd)"

case "$(uname -m)" in
  arm64)  HELPER="$DIR/flipflip_audio_helper_arm64" ;;
  x86_64) HELPER="$DIR/flipflip_audio_helper_x64" ;;
  *)      HELPER="$DIR/flipflip_audio_helper" ;;
esac

if [ ! -x "$HELPER" ]; then
  echo "Could not find the audio helper next to this script."
  echo "Expected: $HELPER"
  echo ""
  read -n 1 -s -r -p "Press any key to close..."
  echo ""
  exit 1
fi

"$HELPER"

echo ""
read -n 1 -s -r -p "Press any key to close..."
echo ""
