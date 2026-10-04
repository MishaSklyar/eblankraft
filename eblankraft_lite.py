#!/usr/bin/env python3
"""
Eblankraft LITE — High-Performance Native QtWebEngine Client
Bypasses standard browser overhead and uncaps frame rate (VSync off) for maximum FPS.
"""

import os
import sys
import time
import socket
import subprocess
import atexit
from pathlib import Path

# Set extreme performance Chromium flags BEFORE Qt initializes
CHROMIUM_FLAGS = [
    "--disable-frame-rate-limit",
    "--disable-gpu-vsync",
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
    "--enable-zero-copy",
    "--enable-webgl",
    "--enable-accelerated-2d-canvas",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--autoplay-policy=no-user-gesture-required",
    "--enable-high-resolution-time",
    "--canvas-oop-rasterization",
    "--enable-low-res-tiling",
    "--num-raster-threads=2",
]

# Force bypass VSync at the driver level (NVIDIA & Mesa Intel/AMD)
os.environ["__GL_SYNC_TO_VBLANK"] = "0"
os.environ["vblank_mode"] = "0"
os.environ["QT_XCB_GL_INTEGRATION"] = "xcb_glx"

# 🚀 ASUS UL20FT / Intel GMA HD / Ironlake (2010) Netbook Optimizations:
# 1. Use modern Gallium3D crocus driver if available
os.environ["MESA_LOADER_DRIVER_OVERRIDE"] = "crocus"
# 2. Multithreaded OpenGL dispatch (offloads draw calls to 2nd CPU core)
os.environ["mesa_glthread"] = "true"
# 3. Disable redundant OpenGL error checking overhead
os.environ["MESA_NO_ERROR"] = "1"
os.environ["INTEL_DEBUG"] = "noccs"

existing_flags = os.environ.get("QTWEBENGINE_CHROMIUM_FLAGS", "")
os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = f"{existing_flags} {' '.join(CHROMIUM_FLAGS)}".strip()

# Now import PyQt6 components
from PyQt6.QtCore import QUrl, Qt
from PyQt6.QtGui import QIcon, QKeySequence, QShortcut, QColor, QPalette
from PyQt6.QtWidgets import QApplication, QMainWindow
from PyQt6.QtWebEngineCore import (
    QWebEngineSettings,
    QWebEngineProfile,
    QWebEnginePage,
)
from PyQt6.QtWebEngineWidgets import QWebEngineView

SCRIPT_DIR = Path(__file__).resolve().parent
STANDALONE_HTML = SCRIPT_DIR / "eblankraft_standalone.html"
INDEX_HTML = SCRIPT_DIR / "index.html"
ICON_PNG = SCRIPT_DIR / "assets" / "icon-512.png"
DEFAULT_PORT = 8080

server_proc = None

def is_port_open(host="127.0.0.1", port=DEFAULT_PORT):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def ensure_server():
    global server_proc
    if is_port_open("127.0.0.1", DEFAULT_PORT):
        print(f"[Eblankraft LITE] Server already running on port {DEFAULT_PORT}")
        return f"http://127.0.0.1:{DEFAULT_PORT}/index.html"
    
    server_script = SCRIPT_DIR / "server.py"
    if server_script.exists():
        print(f"[Eblankraft LITE] Starting background server on port {DEFAULT_PORT}...")
        server_proc = subprocess.Popen(
            [sys.executable, str(server_script)],
            cwd=str(SCRIPT_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        time.sleep(0.6)
        if is_port_open("127.0.0.1", DEFAULT_PORT):
            return f"http://127.0.0.1:{DEFAULT_PORT}/index.html"

    # Fallback to file URL if server fails
    if STANDALONE_HTML.exists():
        print("[Eblankraft LITE] Using local standalone file fallback")
        return QUrl.fromLocalFile(str(STANDALONE_HTML)).toString()
    return QUrl.fromLocalFile(str(INDEX_HTML)).toString()

def cleanup():
    global server_proc
    if server_proc and server_proc.poll() is None:
        print("[Eblankraft LITE] Stopping background server...")
        server_proc.terminate()

atexit.register(cleanup)


class EblankraftWebPage(QWebEnginePage):
    """Custom WebEnginePage with auto-granted permissions for gaming (MouseLock, etc.)."""
    def __init__(self, profile, parent=None):
        super().__init__(profile, parent)
        self.featurePermissionRequested.connect(self._on_feature_permission_requested)
        self.fullScreenRequested.connect(self._on_fullscreen_requested)

    def _on_feature_permission_requested(self, security_origin, feature):
        # Auto-grant MouseLock, Clipboard, etc. for frictionless gaming
        self.setFeaturePermission(
            security_origin,
            feature,
            QWebEnginePage.PermissionPolicy.PermissionGrantedByUser
        )

    def _on_fullscreen_requested(self, request):
        request.accept()
        window = self.view().window()
        if request.toggleOn():
            window.showFullScreen()
        else:
            window.showNormal()


class EblankraftWindow(QMainWindow):
    """Main Game Window."""
    def __init__(self, target_url, start_fullscreen=False):
        super().__init__()
        self.setWindowTitle("Eblankraft LITE — QtWebEngine (Max FPS Edition)")
        self.resize(1280, 720)
        
        # Dark black background to prevent bright flashes before WebGL draws
        palette = self.palette()
        palette.setColor(QPalette.ColorRole.Window, QColor(10, 10, 10))
        self.setPalette(palette)

        if ICON_PNG.exists():
            self.setWindowIcon(QIcon(str(ICON_PNG)))

        # Profile and Settings
        profile = QWebEngineProfile.defaultProfile()
        profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.MemoryHttpCache)
        
        self.browser = QWebEngineView(self)
        self.page = EblankraftWebPage(profile, self.browser)
        self.browser.setPage(self.page)
        self.setCentralWidget(self.browser)

        # Performance settings
        settings = self.browser.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.Accelerated2dCanvasEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanPaste, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.ShowScrollBars, False)

        # Shortcuts
        self.sc_fullscreen = QShortcut(QKeySequence(Qt.Key.Key_F11), self)
        self.sc_fullscreen.activated.connect(self.toggle_fullscreen)

        self.sc_reload = QShortcut(QKeySequence(Qt.Key.Key_F5), self)
        self.sc_reload.activated.connect(self.browser.reload)

        self.sc_reload_ctrl = QShortcut(QKeySequence("Ctrl+R"), self)
        self.sc_reload_ctrl.activated.connect(self.browser.reload)

        # Load game URL
        print(f"[Eblankraft LITE] Loading: {target_url}")
        self.browser.load(QUrl(target_url))

        if start_fullscreen:
            self.showFullScreen()
        else:
            self.show()

        # Ensure browser has focus so pointer lock and inputs work immediately
        self.browser.setFocus()

    def toggle_fullscreen(self):
        if self.isFullScreen():
            self.showNormal()
        else:
            self.showFullScreen()

    def closeEvent(self, event):
        cleanup()
        event.accept()


def main():
    # Pass clean argv to Qt application to avoid breaking X11/XCB event grabbing
    app = QApplication([sys.argv[0]])
    app.setApplicationName("Eblankraft LITE")

    start_fullscreen = "--fullscreen" in sys.argv
    standalone_mode = "--standalone" in sys.argv
    
    custom_url = None
    for arg in sys.argv[1:]:
        if arg.startswith("--url="):
            custom_url = arg.split("=", 1)[1]

    if custom_url:
        target_url = custom_url
    elif standalone_mode and STANDALONE_HTML.exists():
        target_url = QUrl.fromLocalFile(str(STANDALONE_HTML)).toString()
    else:
        target_url = ensure_server()

    window = EblankraftWindow(target_url, start_fullscreen=start_fullscreen)
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
