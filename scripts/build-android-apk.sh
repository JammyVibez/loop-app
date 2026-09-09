#!/bin/bash
# Build Android APK for Loop app
# This script should be run on a machine with JDK 17+ and Android SDK installed

set -e

echo "Building Loop Android APK..."

# 1. Build the web app
echo "Step 1: Building Next.js app..."
npm run build

# 2. Sync web assets to Android project
echo "Step 2: Syncing to Capacitor..."
npx cap sync android

# 3. Build release APK
echo "Step 3: Building release APK..."
cd android
./gradlew assembleRelease

# 4. Copy APK to public directory
echo "Step 4: Copying APK..."
APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
if [ -f "$APK_PATH" ]; then
    cp "$APK_PATH" "../../public/apk/loop.apk"
    echo "APK copied to public/apk/loop.apk"
    
    # Generate checksum
    SHA256=$(sha256sum "../../public/apk/loop.apk" | cut -d' ' -f1)
    echo "SHA-256: $SHA256"
    echo "Update APK_CHECKSUM in lib/store-links.ts with this value"
else
    echo "APK not found at expected path. Check build output."
    exit 1
fi

echo "Build complete!"
echo ""
echo "To deploy:"
echo "  1. Update APK_CHECKSUM in lib/store-links.ts"
echo "  2. git add public/apk/loop.apk lib/store-links.ts"
echo "  3. git commit -m 'Update Android APK'"
echo "  4. Deploy to VPS"
