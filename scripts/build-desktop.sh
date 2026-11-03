#!/usr/bin/env bash
# Portable desktop build entrypoint for Flip-Electron

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Get version from package.json
VERSION=$(node -e "console.log(require('./package.json').version)")

echo "Building Flip-Electron v$VERSION"

# Ensure dependencies installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci
fi

PLATFORM="$1"

case "$PLATFORM" in
    --all)
        echo "Building all platforms..."
        npm run production
        rm -rf app release
        mkdir -p app release
        cp -r dist app/dist
        cp package.json app/package.json
        
        # Try to use electron-packager
        npx electron-packager app FlipFlip --platform=darwin --arch=x64 --icon="src/renderer/icons/flipflip_logo.icns" --overwrite || true
        npx electron-packager app FlipFlip --platform=darwin --arch=arm64 --icon="src/renderer/icons/flipflip_logo.icns" --overwrite || true
        npx electron-packager app FlipFlip --platform=win32 --arch=x64 --icon="src/renderer/icons/flipflip_logo.ico" --overwrite || true
        npx electron-packager app FlipFlip --platform=win32 --arch=ia32 --icon="src/renderer/icons/flipflip_logo.ico" --overwrite || true
        npx electron-packager app FlipFlip --platform=linux --arch=x64 --icon="src/renderer/icons/flipflip_logo.iconset/icon_512x512@2x.png" --overwrite || true
        npx electron-packager app FlipFlip --platform=linux --arch=ia32 --icon="src/renderer/icons/flipflip_logo.iconset/icon_512x512@2x.png" --overwrite || true
        
        # Zip outputs
        [ -d "FlipFlip-darwin-x64" ] && zip -r release/FlipFlip-macOS-x64.zip FlipFlip-darwin-x64
        [ -d "FlipFlip-darwin-arm64" ] && zip -r release/FlipFlip-macOS-arm64.zip FlipFlip-darwin-arm64
        [ -d "FlipFlip-win32-x64" ] && zip -r release/FlipFlip-Windows-x64.zip FlipFlip-win32-x64
        [ -d "FlipFlip-win32-ia32" ] && zip -r release/FlipFlip-Windows-32bit.zip FlipFlip-win32-ia32
        [ -d "FlipFlip-linux-x64" ] && zip -r release/FlipFlip-Linux.zip FlipFlip-linux-x64
        [ -d "FlipFlip-linux-ia32" ] && zip -r release/FlipFlip-Linux-32bit.zip FlipFlip-linux-ia32
        
        echo "Build complete. Outputs in release/"
        ;;
    --macos)
        ARCH="$2"
        npm run production
        if [ -f "scripts/build-mac.sh" ]; then
            bash scripts/build-mac.sh
        else
            make app
        fi
        ;;
    *)
        make app
        ;;
esac
