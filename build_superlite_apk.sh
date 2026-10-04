#!/bin/bash
set -e

# ==============================================================================
# Eblankraft SuperLITE — Android APK Builder (NO MODS, NO LUA, NO WEBGPU)
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
PROJECT_DIR="$DIR/android_superlite"
OUTPUT_APK="$DIR/eblankraft-superlite.apk"

echo "⚡ [Eblankraft SuperLITE APK] Starting build process..."

# 1. Check tools
if [ ! -f "$AAPT2" ] || [ ! -f "$PLATFORM" ]; then
    echo "❌ Error: Android SDK build tools not found at $BUILD_TOOLS"
    exit 1
fi

# 2. Re-generate index_superlite.html
echo "📄 Generating clean index_superlite.html..."
python3 "$DIR/generate_superlite_html.py"

# 3. Clean & sync only core assets into android assets
echo "📦 Syncing core assets (STRIPPING mods, lua, webgpu, and heavy packs)..."
rm -rf "$PROJECT_DIR/assets"
mkdir -p "$PROJECT_DIR/assets"

# Copy superlite HTML as index.html
cp "$DIR/index_superlite.html" "$PROJECT_DIR/assets/index.html"
cp "$DIR/manifest.json" "$PROJECT_DIR/assets/"
cp "$DIR/sw.js" "$PROJECT_DIR/assets/"

# Copy css
rsync -a "$DIR/css" "$PROJECT_DIR/assets/"

# Copy js excluding fengari, mods, and webgpu
mkdir -p "$PROJECT_DIR/assets/js"
rsync -a \
    --exclude "fengari-web.js" \
    --exclude "mods.js" \
    --exclude "webgpu_adapter.js" \
    "$DIR/js/" "$PROJECT_DIR/assets/js/"

# Copy assets and textures
rsync -a "$DIR/assets" "$PROJECT_DIR/assets/"
rsync -a "$DIR/textures" "$PROJECT_DIR/assets/"

# 4. Compile Android resources
echo "🎨 Compiling Android resources with aapt2..."
"$AAPT2" compile --dir "$PROJECT_DIR/res" -o "$PROJECT_DIR/compiled_res.zip"

# 5. Link initial APK
echo "🔗 Linking SuperLITE APK..."
"$AAPT2" link \
    -I "$PLATFORM" \
    --manifest "$PROJECT_DIR/AndroidManifest.xml" \
    -o "$PROJECT_DIR/unaligned.apk" \
    -A "$PROJECT_DIR/assets" \
    "$PROJECT_DIR/compiled_res.zip" \
    --auto-add-overlay

# 6. Compile Java source
echo "☕ Compiling SuperLITE Java code..."
mkdir -p "$PROJECT_DIR/obj" "$PROJECT_DIR/dex"
javac -source 8 -target 8 -d "$PROJECT_DIR/obj" -cp "$PLATFORM" "$PROJECT_DIR/src/org/eblankraft/superlite/MainActivity.java"

# 7. Convert to Dalvik Executable (classes.dex)
echo "⚡ Converting to DEX bytecode (d8)..."
"$D8" --lib "$PLATFORM" --output "$PROJECT_DIR/dex/" "$PROJECT_DIR/obj/org/eblankraft/superlite/"*.class

# 8. Add classes.dex into APK
echo "📦 Injecting classes.dex..."
(cd "$PROJECT_DIR/dex" && zip -u -0 "$PROJECT_DIR/unaligned.apk" classes.dex)

# 9. Align APK to 4-byte boundaries
echo "📐 Zipaligning APK..."
"$ZIPALIGN" -p -f 4 "$PROJECT_DIR/unaligned.apk" "$PROJECT_DIR/aligned.apk"

# 10. Sign APK
echo "🔏 Signing APK with debug keystore..."
"$APKSIGNER" sign \
    --ks "$KEYSTORE" \
    --ks-pass pass:android \
    --ks-key-alias androiddebugkey \
    --key-pass pass:android \
    --out "$OUTPUT_APK" \
    "$PROJECT_DIR/aligned.apk"

# 11. Verify signature
"$APKSIGNER" verify "$OUTPUT_APK"

APK_SIZE=$(du -h "$OUTPUT_APK" | cut -f1)
echo "=========================================================="
echo "✅ УСПІХ! Готовий SuperLITE APK: $OUTPUT_APK"
echo "📱 Розмір файлу: $APK_SIZE"
echo "🚀 100% Офлайн, БЕЗ модів, БЕЗ WebGPU, ультра-швидкий старт на Samsung A02!"
echo "=========================================================="
