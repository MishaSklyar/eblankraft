import os

base_dir = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(base_dir, 'css/style.css'), 'r', encoding='utf-8') as f:
    css_content = f.read()

js_files = [
    'js/three.min.js',
    'js/gltfloader.js',
    'js/Water.js',
    'js/eblan_eng.js',
    'js/noise.js',
    'js/peerjs.min.js',
    'js/fengari-web.js',
    'js/textures.js',
    'js/items.js',
    'js/upgrader_skins.js',
    'js/sound.js',
    'js/redstone.js',
    'js/particles.js',
    'js/mobs.js',
    'js/world.js',
    'js/player.js',
    'js/controls.js',
    'js/weather.js',
    'js/multiplayer.js',
    'js/eblan_os.js',
    'js/ui.js',
    'js/mods.js',
    'js/eblan.js',
    'js/game.js'
]

js_combined = ""
for js_file in js_files:
    path = os.path.join(base_dir, js_file)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            js_combined += f"\n/* --- {js_file} --- */\n" + f.read() + "\n"

with open(os.path.join(base_dir, 'index.html'), 'r', encoding='utf-8') as f:
    html_content = f.read()

import re

# Replace <link rel="stylesheet" href="css/style.css..."> with <style>...</style>
html_content = re.sub(r'<link rel="stylesheet" href="css/style\.css[^"]*">', f'<style>\n{css_content}\n</style>', html_content)

# Replace script tags from three.min.js to game.js
pattern = r'    <script src="js/three\.min\.js"></script>[\s\S]*?<script src="js/game\.js[^"]*"></script>'
html_content = re.sub(pattern, lambda m: f'<script>\n{js_combined}\n</script>', html_content)

standalone_path = os.path.join(base_dir, 'eblankraft_standalone.html')
with open(standalone_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

for android_dir in ['android_pro/assets', 'android_project/assets']:
    dst = os.path.join(base_dir, android_dir, 'eblankraft_standalone.html')
    if os.path.exists(os.path.dirname(dst)):
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(html_content)

print(f"Generated standalone single-file: {standalone_path} ({os.path.getsize(standalone_path) / 1024:.1f} KB)")
