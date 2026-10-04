#!/bin/bash
set -e

# ==============================================================================
# Eblankraft LITE — Automated Android APK Builder (100% Offline & Standalone)
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="${ANDROID_HOME:-$HOME/Android/Sdk}"
BUILD_TOOLS="$SDK_DIR/build-tools/35.0.0"
PLATFORM="$SDK_DIR/platforms/android-35/android.jar"
AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"
KEYSTORE="$HOME/.android/debug.keystore"
PROJECT_DIR="$DIR/android_project"
OUTPUT_APK="$DIR/eblankraft-lite.apk"

echo "🎮 [Eblankraft LITE APK] Starting build process..."

# 1. Check tools
if [ ! -f "$AAPT2" ] || [ ! -f "$PLATFORM" ]; then
    echo "❌ Error: Android SDK build tools not found at $BUILD_TOOLS"
    exit 1
fi

# Create debug keystore if not found
if [ ! -f "$KEYSTORE" ]; then
    echo "🔑 Generating Android debug keystore..."
    mkdir -p "$HOME/.android"
    keytool -genkey -v -keystore "$KEYSTORE" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=AndroidDebug,O=Android,C=US"
fi

# 2. Sync web assets into android assets
echo "📦 Syncing game assets..."
mkdir -p "$PROJECT_DIR/assets"
rsync -a --delete \
    --exclude "android_*" \
    --exclude "__pycache__" \
    --exclude "*.apk" \
    --exclude "tools" \
    --exclude "server.py" \
    --exclude "eblan_core/target" \
    "$DIR/index.html" \
    "$DIR/manifest.json" \
    "$DIR/sw.js" \
    "$DIR/css" \
    "$DIR/js" \
    "$DIR/assets" \
    "$DIR/textures" \
    "$DIR/packs" \
    "$DIR/mods" \
    "$DIR/eblankraft_standalone.html" \
    "$PROJECT_DIR/assets/"

# 3. Compile Android resources
echo "🎨 Compiling Android resources with aapt2..."
"$AAPT2" compile --dir "$PROJECT_DIR/res" -o "$PROJECT_DIR/compiled_res.zip"

# 4. Link initial APK
echo "🔗 Linking APK..."
"$AAPT2" link \
    -I "$PLATFORM" \
    --manifest "$PROJECT_DIR/AndroidManifest.xml" \
    -o "$PROJECT_DIR/unaligned.apk" \
    -A "$PROJECT_DIR/assets" \
    "$PROJECT_DIR/compiled_res.zip" \
    --auto-add-overlay

# 5. Compile Java source
echo "☕ Compiling Java code..."
mkdir -p "$PROJECT_DIR/obj" "$PROJECT_DIR/dex"
javac -source 8 -target 8 -d "$PROJECT_DIR/obj" -cp "$PLATFORM" "$PROJECT_DIR/src/org/eblankraft/lite/MainActivity.java"

# 6. Convert to Dalvik Executable (classes.dex)
echo "⚡ Converting to DEX bytecode (d8)..."
"$D8" --lib "$PLATFORM" --output "$PROJECT_DIR/dex/" "$PROJECT_DIR/obj/org/eblankraft/lite/"*.class

# 7. Add classes.dex into APK
echo "📦 Injecting classes.dex..."
(cd "$PROJECT_DIR/dex" && zip -u -0 "$PROJECT_DIR/unaligned.apk" classes.dex)

# 8. Align APK to 4-byte boundaries
echo "📐 Zipaligning APK..."
"$ZIPALIGN" -p -f 4 "$PROJECT_DIR/unaligned.apk" "$PROJECT_DIR/aligned.apk"

# 9. Sign APK
echo "🔏 Signing APK with debug keystore..."
"$APKSIGNER" sign \
    --ks "$KEYSTORE" \
    --ks-pass pass:android \
    --ks-key-alias androiddebugkey \
    --key-pass pass:android \
    --out "$OUTPUT_APK" \
    "$PROJECT_DIR/aligned.apk"

# 10. Verify signature
"$APKSIGNER" verify "$OUTPUT_APK"

APK_SIZE=$(du -h "$OUTPUT_APK" | cut -f1)
echo "=========================================================="
echo "✅ УСПІХ! Готовий APK: $OUTPUT_APK"
echo "📱 Розмір файлу: $APK_SIZE"
echo "🚀 100% Офлайн клієнт для Samsung A02 з апаратним WebGL!"
echo "=========================================================="
