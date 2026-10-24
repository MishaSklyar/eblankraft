"""Stage only public game files for Pages, never workspace/config/secrets."""
from pathlib import Path
import shutil
import re
root = Path(__file__).resolve().parent.parent
out = root / 'cloudflare/beta/public'
# Clear previous staging output so retired builds and deleted files cannot survive.
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True, exist_ok=True)
for name in ('js', 'css', 'assets', 'textures', 'packs', 'mods', 'blockly', 'babylonport', 'ALL_ASSETS'):
    shutil.copytree(root / name, out / name, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('node_modules', '__pycache__', '*.py', '*.md', '.*'))
shutil.copytree(root / 'ALL_ASSETS', out / 'GAME_ASSETS', dirs_exist_ok=True)
for name in ('index.html', 'manifest.json', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'de_eblan2.zip'):
    shutil.copyfile(root / name, out / name)
# Publish the edited main menu, not the legacy web/index.html or generated binaries.
p = out / 'index.html'
s = p.read_text().replace('https://eblancraft.tech/', 'https://eblancraftbeta.pages.dev/')
p.write_text(s)
# Prevent a cached old build from surviving a deployment.
(out / 'sw.js').write_text("self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.registration.unregister())));\n")
(out / '_headers').write_text('/\n  Cache-Control: no-cache\n/*.js\n  Cache-Control: no-cache\n')
shutil.copyfile(root / 'cloudflare/beta/pages-worker.js', out / '_worker.js')
(out / '_routes.json').write_text('{"version":1,"include":["/ws","/api/status","/api/bug-report","/api/economy/*"],"exclude":[]}')
print('Staged public beta assets')
