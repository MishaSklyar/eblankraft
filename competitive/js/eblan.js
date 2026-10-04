/**
 * .EBLAN — супер-простой пак формат для Eblankraft.
 *
 * .eblan = обычный ZIP (Store или Deflate). Внутри:
 *   manifest.json          (необязательно) {"name","version","author","description"}
 *   textures/<ключ>.png    переопределяет текстуру (ключ = canvasCache: dirt, grass_side,
 *                          stone, ak47 ...). Новый ключ = новая иконка для Items.register.
 *   models/<id>.glb|.gltf  грузится в Models под id = имя файла без расширения.
 *                          (.gltf только embedded, без внешних .bin — ограничение GLTFLoader)
 *   lua/*.lua              (необязательно) каждый файл = Lua-мод, ставится включённым.
 *
 * Собрать:  python3 eblan_pack.py ./my_pack ./my_pack.eblan
 * Распаковать: любой unzip (переименуй .eblan в .zip).
 */
(function () {
    'use strict';

    // --- минимальный ZIP-ридер (central directory + DecompressionStream, без зависимостей) ---
    async function unzipEblan(buf) {
        const dv = new DataView(buf);
        const len = dv.byteLength;
        if (len < 22 || dv.getUint32(0, true) !== 0x04034b50) throw new Error('Не ZIP (.eblan = zip)');
        // EOCD: PK\x05\x06, ищем с конца (комментарий до 64KB)
        let eocd = -1;
        for (let i = len - 22; i >= Math.max(0, len - 65558); i--) {
            if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('EOCD не найден — битый zip');
        const count = dv.getUint16(eocd + 10, true);
        let cdOff = dv.getUint32(eocd + 16, true);
        const out = new Map();
        let p = cdOff;
        for (let i = 0; i < count; i++) {
            if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Битый central directory');
            const method = dv.getUint16(p + 10, true);
            const compSize = dv.getUint32(p + 20, true);
            const nameLen = dv.getUint16(p + 28, true);
            const extraLen = dv.getUint16(p + 30, true);
            const commentLen = dv.getUint16(p + 32, true);
            const localOff = dv.getUint32(p + 42, true);
            const nameBytes = new Uint8Array(buf, p + 46, nameLen);
            const name = new TextDecoder().decode(nameBytes);
            p += 46 + nameLen + extraLen + commentLen;
            if (name.endsWith('/')) continue; // директория
            // local header: PK\x03\x04, пропуск name+extra
            const lhNameLen = dv.getUint16(localOff + 26, true);
            const lhExtraLen = dv.getUint16(localOff + 28, true);
            const dataOff = localOff + 30 + lhNameLen + lhExtraLen;
            const comp = new Uint8Array(buf, dataOff, compSize);
            let raw;
            if (method === 0) raw = comp.slice();
            else if (method === 8) {
                const ds = new DecompressionStream('deflate-raw');
                const s = new Blob([comp]).stream().pipeThrough(ds);
                raw = new Uint8Array(await new Response(s).arrayBuffer());
            } else throw new Error('Метод ' + method + ' не поддерживается (нужен Store/Deflate)');
            out.set(name, raw);
        }
        return out;
    }

    function fname(path) { return path.split('/').pop(); }
    function fbase(path) { const n = fname(path); return n.replace(/\.[^/.]+$/, ''); }

    function isModelPath(path) {
        const low = path.toLowerCase();
        return low.startsWith('models/') && (low.endsWith('.glb') || low.endsWith('.gltf'));
    }

    function modelIdOf(path) { return fbase(path).toLowerCase().replace(/[^a-z0-9_]/g, '_'); }

    function modelDataOf(path, raw) {
        return path.toLowerCase().endsWith('.gltf')
            ? new TextDecoder().decode(raw)
            : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    }

    // --- IndexedDB: паки переживают перезагрузку (в localStorage жирные GLB не влезут) ---
    let dbPromise = null;
    function idb() {
        if (!dbPromise) {
            dbPromise = new Promise((res, rej) => {
                try {
                    const q = indexedDB.open('eblan', 1);
                    q.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs');
                    };
                    q.onsuccess = () => res(q.result);
                    q.onerror = () => { dbPromise = null; rej(q.error); };
                    q.onblocked = () => { dbPromise = null; rej(new Error('IDB blocked')); };
                } catch (e) { dbPromise = null; rej(e); }
            });
        }
        return dbPromise;
    }

    async function idbPut(pack) {
        const db = await idb();
        return new Promise((res, rej) => {
            const tx = db.transaction('packs', 'readwrite');
            tx.objectStore('packs').put(pack, pack.name);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    }

    async function idbAll() {
        const db = await idb();
        return new Promise((res, rej) => {
            const q = db.transaction('packs', 'readonly').objectStore('packs').getAll();
            q.onsuccess = () => res(q.result || []);
            q.onerror = () => rej(q.error);
        });
    }

    async function idbDel(name) {
        const db = await idb();
        return new Promise((res, rej) => {
            const tx = db.transaction('packs', 'readwrite');
            tx.objectStore('packs').delete(name);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
        });
    }

    async function applyTextures(files, game) {
        const tm = game.textureManager;
        let n = 0;
        for (const [path, raw] of files) {
            const low = path.toLowerCase();
            if (!low.startsWith('textures/') || !(low.endsWith('.png') || low.endsWith('.jpg') || low.endsWith('.jpeg'))) continue;
            const key = fbase(path).toLowerCase();
            const blob = new Blob([raw], { type: 'image/png' });
            const bmp = await createImageBitmap(blob);
            const cv = document.createElement('canvas');
            cv.width = bmp.width; cv.height = bmp.height;
            cv.getContext('2d').drawImage(bmp, 0, 0);
            bmp.close();
            tm.canvasCache[key] = cv;
            if (tm.threeTextures[key]) {
                tm.threeTextures[key].image = cv;
                tm.threeTextures[key].needsUpdate = true;
            } else {
                const tex = new THREE.CanvasTexture(cv);
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                tm.threeTextures[key] = tex;
            }
            if (tm.iconDataUrlCache) { tm.iconDataUrlCache.delete(key); }
            if (tm.itemDropTextures) delete tm.itemDropTextures[key];
            if (tm.itemDropMaterials) { // сброс закешированных 3D-материалов дропа с этой иконкой
                for (const itemId in tm.itemDropMaterials) {
                    try {
                        const info = window.ITEM_REGISTRY && window.ITEM_REGISTRY[itemId];
                        if (!info || (info.icon || itemId) === key) delete tm.itemDropMaterials[itemId];
                    } catch (e) {}
                }
            }
            n++;
        }
        if (n > 0 && game.world && game.world.chunks) {
            for (const k in game.world.chunks) game.world.chunks[k].isDirty = true; // перестроить чанки с новыми текстурами
        }
        return n;
    }

    async function applyModels(files, game) {
        const mm = game.modManager && game.modManager.modelManager;
        if (!mm) return 0;
        let n = 0;
        for (const [path, raw] of files) {
            if (!isModelPath(path)) continue;
            const id = modelIdOf(path);
            if (mm.cachedModels.has(id)) continue; // уже загружена (напр. после реинита модов)
            await new Promise((res) => mm.load(id, modelDataOf(path, raw), res, res)); // ждём и ok, и fail
            n++;
        }
        return n;
    }

    // Докачать модели из сохранённых паков (звать после реинита модов — он чистит кеш моделей)
    async function reapplyModels() {
        const g = window.game;
        if (!g || !g.modManager || !g.modManager.modelManager) return 0;
        let n = 0;
        try {
            for (const p of await idbAll()) {
                n += await applyModels(new Map(p.files), g);
            }
        } catch (e) {}
        return n;
    }

    function applyLua(files, game) {
        const mgr = game.modManager;
        if (!mgr || typeof mgr.addOrUpdateMod !== 'function') return 0;
        let n = 0;
        const manifest = files._manifest || {};
        const packTag = (manifest.name || 'eblan').slice(0, 24);
        for (const [path, raw] of files) {
            const low = path.toLowerCase();
            if (!(low.startsWith('lua/') || low.endsWith('.lua')) || low.startsWith('textures/') || low.startsWith('models/')) continue;
            if (low === 'manifest.json') continue;
            const code = new TextDecoder().decode(raw);
            const base = fbase(path).toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'mod';
            mgr.addOrUpdateMod({
                id: 'eblan_' + base,
                name: '📦 ' + packTag + ': ' + base,
                version: manifest.version || '1.0',
                author: manifest.author || 'eblan pack',
                description: 'Из .eblan пака ' + packTag,
                code: code,
                enabled: true
            });
            n++;
        }
        return n;
    }

    async function loadEblanFile(file, game) {
        game = game || window.game;
        if (!game) throw new Error('Игра ещё не запущена');
        const buf = await file.arrayBuffer();
        const files = await unzipEblan(buf);
        let manifest = {};
        for (const [path, raw] of files) {
            if (fname(path).toLowerCase() === 'manifest.json') {
                try { manifest = JSON.parse(new TextDecoder().decode(raw)); } catch (e) {}
                break;
            }
        }
        files._manifest = manifest;
        const nTex = await applyTextures(files, game);
        const nMod = await applyModels(files, game);
        const nLua = applyLua(files, game);
        const title = manifest.name || file.name.replace(/\.eblan$/i, '');
        try { await idbPut({ name: title, manifest: manifest, files: [...files] }); }
        catch (e) { console.warn('eblan: не сохранилось в IndexedDB', e); }
        const msg = '📦 ' + title + ': текстур ' + nTex + ', моделей ' + nMod + (nLua ? ', lua ' + nLua : '');
        if (game.ui) game.ui.showToast(msg);
        return { name: title, manifest: manifest, textures: nTex, models: nMod, lua: nLua };
    }

    function importDialog(game) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.eblan,.zip';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = async () => {
            const f = input.files && input.files[0];
            document.body.removeChild(input);
            if (!f) return;
            try { await loadEblanFile(f, game); }
            catch (e) {
                console.error(e);
                const g = game || window.game;
                if (g && g.ui) g.ui.showToast('❌ .eblan: ' + e.message);
                else alert('.eblan: ' + e.message);
            }
        };
        input.click();
    }

    // Кнопка в менеджере модов (самопривязка — mods.js трогать не надо)
    function bindButton() {
        if (document.getElementById('btn-import-eblan')) return;
        const bar = document.querySelector('#mods-tab-list .mods-top-bar');
        if (!bar) return;
        const btn = document.createElement('button');
        btn.id = 'btn-import-eblan';
        btn.className = 'menu-btn btn-primary';
        btn.textContent = '📦 Імпорт .eblan';
        btn.title = 'Пак текстур/моделей (.eblan = zip)';
        btn.onclick = () => importDialog();
        bar.appendChild(btn);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindButton);
    else bindButton();
    setTimeout(bindButton, 1500); // моды могут перерисовать панель позже

    // Автовосстановление паков после перезагрузки (lua-моды и так в localStorage — только текстуры+модели)
    let bootDone = false;
    async function bootRestore() {
        if (bootDone) return;
        const g = window.game;
        if (!g || !g.textureManager || !g.modManager || !g.modManager.modelManager) return;
        bootDone = true;
        try {
            const packs = await idbAll();
            if (!packs.length) return;
            let t = 0, m = 0;
            for (const p of packs) {
                const fm = new Map(p.files);
                t += await applyTextures(fm, g);
                m += await applyModels(fm, g);
            }
            if (g.ui) g.ui.showToast('📦 Паки восстановлены (' + packs.length + '): текстур ' + t + ', моделей ' + m);
        } catch (e) {}
    }
    setInterval(bootRestore, 1000);

    function setPolyLimit(n) {
        n = Math.max(1000, Number(n) || 100000);
        try { localStorage.setItem('eblan_poly_limit', String(n)); } catch (e) {}
        return n;
    }

    window.Eblan = {
        load: loadEblanFile, import: importDialog, unzip: unzipEblan,
        reapplyModels: reapplyModels, restore: bootRestore, setPolyLimit: setPolyLimit,
        packs: idbAll, forget: idbDel,
    };
})();
