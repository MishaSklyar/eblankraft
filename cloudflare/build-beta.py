"""Bundle existing game authority for Workers without runtime eval or filesystem reads."""
from pathlib import Path
import shutil
import re

root = Path(__file__).resolve().parent.parent
out = root / 'cloudflare/beta/generated'
out.mkdir(parents=True, exist_ok=True)
shutil.copyfile(root / 'js/three.min.js', out / 'three.cjs')
sources = ['textures', 'noise', 'eblan_eng', 'de_eblan2', 'world', 'player', 'particles']
factory = 'import * as THREE from "./three.cjs";\nimport wasmModule from "./eblan_core.wasm";\nfunction createContext() {\nconst window = { THREE };\n'
factory += '\n'.join((root / f'js/{name}.js').read_text() for name in sources)
factory += '\nreturn { ...window, isPassThroughBlock };\n}\n'
engine = (root / 'server/engine.js').read_text()
engine = engine[engine.index('class AuthorityWorld'):]
a = engine.index('        const context = vm.createContext(')
b = engine.index('        const core = context.EblanEng;', a)
engine = engine[:a] + '        const context = createContext();\n' + engine[b:]
engine = engine.replace('module.exports = { AuthorityWorld };', 'export { AuthorityWorld };')
(out / 'engine.js').write_text(factory + engine)
shutil.copyfile(root / 'js/eblan_core.wasm', out / 'eblan_core.wasm')
arena = (root / 'server/arena.js').read_text()
arena = re.sub(r"const fs = require\('node:fs'\);\nconst path = require\('node:path'\);", '', arena)
a = arena.index('const source = fs.readFileSync(')
b = arena.index('const levels =', a)
map_source = (root / 'js/de_eblan2.js').read_text()
data = map_source[map_source.index('{"id"'):].strip().removesuffix(';')
arena = arena[:a] + 'const data = ' + data + ';\n' + arena[b:]
arena = re.sub(r'module.exports = (.*);', r'export \1;', arena)
(out / 'arena.js').write_text(arena)
server = (root / 'server.js').read_text()
a = server.index('const WEAPON_DAMAGE')
b = server.index('const MIME =')
server = server[a:b]
server = server.replace('timer.unref();', 'timer.unref?.();')
imports = "import crypto from 'node:crypto';\nimport { AuthorityWorld } from './engine.js';\nimport { ArenaService } from './arena.js';\nconst WebSocket = { OPEN: 1 };\n"
(out / 'server.js').write_text(imports + server + '\nexport { AuthoritativeGameServer, WSClient };\n')
print('Built Worker authority from current Node/game sources')
