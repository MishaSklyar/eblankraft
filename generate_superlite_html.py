#!/usr/bin/env python3
import re
from pathlib import Path

DIR = Path(__file__).resolve().parent
index_path = DIR / "index.html"
output_path = DIR / "index_superlite.html"

with open(index_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Title
content = content.replace("🎮 ЕБЛАНКРАФТ 2.0 (Eblankraft 2.0 Survival Edition)", "🎮 ЕБЛАНКРАФТ SuperLITE (Samsung A02 Edition)")

# 2. Add SuperLITE flags at top of head
flags_script = """    <script>
        window.isSuperLite = true;
        window.isAndroidApp = true;
        try {
            if (!localStorage.getItem('eblankraft_a02_mode')) localStorage.setItem('eblankraft_a02_mode', 'true');
            if (!localStorage.getItem('eblankraft_render_scale')) localStorage.setItem('eblankraft_render_scale', '0.6');
            if (!localStorage.getItem('eblankraft_fancy_water')) localStorage.setItem('eblankraft_fancy_water', '0');
        } catch(e) {}
    </script>
"""
content = content.replace('<link rel="manifest" href="manifest.json">', flags_script + '    <link rel="manifest" href="manifest.json">')

# 3. Strip webgpu_adapter, fengari, and mods scripts
content = re.sub(r'\s*<script src="js/webgpu_adapter\.js[^"]*"></script>', '', content)
content = re.sub(r'\s*<script src="js/fengari-web\.js[^"]*"></script>', '', content)
content = re.sub(r'\s*<script src="js/mods\.js[^"]*"></script>', '', content)

# 4. Hide Mods button in main menu
content = content.replace('id="btn-mods"', 'id="btn-mods" style="display:none;"')

# 5. Hide Mods and Sync modals in DOM to save elements
content = content.replace('id="mods-modal"', 'id="mods-modal" style="display:none !important;"')
content = content.replace('id="mp-mod-sync-modal"', 'id="mp-mod-sync-modal" style="display:none !important;"')

with open(output_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Generated {output_path} successfully ({len(content)} bytes)")
