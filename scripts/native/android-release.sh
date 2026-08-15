#!/usr/bin/env bash
# ============================================================================
# Loop — Android Play Store release build helper
#
# Generates a release keystore (if missing), writes android/app/key.properties,
# and produces a signed .aab in android/app/build/outputs/bundle/release/.
#
# Requirements (on YOUR machine — this sandbox has no Android SDK):
#   - JDK 17+        (java -version)
#   - Android SDK    (ANDROID_HOME set, platform-tools + build-tools installed)
#   - Capacitor sync already done:  npm run cap:sync
#
# Usage:
#   sh scripts/native/android-release.sh
#
# You only need to run this once to generate the keystore. After that, run
# `npm run native:release:android` to rebuild the .aab.
#
# ⚠️  KEEP android/loop-release.keystore AND android/app/key.properties SAFE.
# They sign every future update. Back them up; never commit them (both are
# gitignored).
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/../.."

KEYSTORE="android/loop-release.keystore"
KEYPROPS="android/app/key.properties"
ALIAS="loop"
VALIDITY_DAYS=10000

if [ ! -f "$KEYSTORE" ]; then
  echo "==> Generating release keystore ($KEYSTORE)…"
  if ! command -v keytool >/dev/null 2>&1; then
    echo "keytool not found — install a JDK (e.g. temurin 17+) and re-run." >&2
    exit 1
  fi
  # NOTE: prompts for a password (store + key). Keep it strong; it is used below.
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity "$VALIDITY_DAYS"
fi

if [ ! -f "$KEYPROPS" ]; then
  echo "==> Writing $KEYPROPS (edit the passwords to match your keystore)…"
  cat > "$KEYPROPS" <<EOF
storeFile=../loop-release.keystore
keyAlias=$ALIAS
storePassword=CHANGE_ME
keyPassword=CHANGE_ME
EOF
  echo "Edit $KEYPROPS and set storePassword/keyPassword, then re-run." >&2
  exit 1
fi

echo "==> Syncing web shell…"
npx cap sync android

echo "==> Building signed release bundle…"
cd android
./gradlew bundleRelease

echo ""
echo "✅ Done. Upload this to Play Console:"
echo "   android/app/build/outputs/bundle/release/app-release.aab"
