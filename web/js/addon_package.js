/* Portable, data-only addon format. Shared by the browser and economy server. */
(function (root) {
    'use strict';
    const VERSION = /^\d{1,5}\.\d{1,5}\.\d{1,5}$/;
    const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;
    const CATEGORIES = ['gameplay', 'building', 'tools', 'cosmetic'];
    function validate(input) {
        if (!input || input.format !== 'eblankraft-addon' || input.apiVersion !== 1) throw new Error('Expected an Eblankraft addon package (API 1).');
        const m = input.manifest;
        if (!m || typeof m.id !== 'string' || typeof m.version !== 'string' || !ID.test(m.id) || !VERSION.test(m.version)) throw new Error('Addon needs a valid ID and version such as 1.0.0.');
        for (const [key, max] of [['name', 80], ['author', 60], ['description', 1200]]) {
            if (typeof m[key] !== 'string' || !m[key].trim() || m[key].length > max) throw new Error(`Invalid ${key} (1–${max} characters).`);
        }
        if (!CATEGORIES.includes(m.category)) throw new Error('Choose a supported addon category.');
        if (typeof input.code !== 'string' || !input.code.trim() || new TextEncoder().encode(input.code).length > 128 * 1024) throw new Error('Lua code must be between 1 byte and 128 KiB.');
        const deps = m.dependencies || [];
        if (!Array.isArray(deps) || deps.length > 16) throw new Error('Maximum 16 dependencies.');
        const seen = new Set();
        for (const dep of deps) {
            if (!dep || !ID.test(dep.id || '') || !VERSION.test(dep.minVersion || '') || dep.id === m.id || seen.has(dep.id)) throw new Error('Invalid, duplicate, or self dependency.');
            seen.add(dep.id);
        }
        return { format: 'eblankraft-addon', apiVersion: 1, manifest: {
            id: m.id, name: m.name.trim(), version: m.version, author: m.author.trim(), description: m.description.trim(),
            category: m.category, dependencies: deps.map(d => ({ id: d.id, minVersion: d.minVersion }))
        }, code: input.code };
    }
    function compare(a, b) {
        const x = a.split('.').map(Number), y = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
        return 0;
    }
    function pack(mod) {
        let version = String(mod.version || '1.0.0');
        if (/^\d{1,5}$/.test(version)) version += '.0.0';
        else if (/^\d{1,5}\.\d{1,5}$/.test(version)) version += '.0';
        return validate({ format: 'eblankraft-addon', apiVersion: 1, manifest: {
            id: mod.id, name: mod.name, author: mod.author || 'Player', description: mod.description || 'A Lua addon.',
            version, category: mod.category || 'gameplay', dependencies: mod.dependencies || []
        }, code: mod.code });
    }
    function unpack(data) { const p = validate(data); return { ...p.manifest, code: p.code, enabled: false }; }
    function resolve(mods) {
        const ordered = [], errors = new Map(), visiting = new Set(), done = new Set();
        const byId = new Map(mods.map(m => [m.id, m]));
        function visit(mod) {
            if (done.has(mod.id)) return !errors.has(mod.id);
            if (visiting.has(mod.id)) { errors.set(mod.id, 'Dependency cycle.'); return false; }
            visiting.add(mod.id);
            if (!Array.isArray(mod.dependencies || [])) errors.set(mod.id, 'Invalid dependency list. Reimport the addon package.');
            for (const dep of Array.isArray(mod.dependencies) ? mod.dependencies : []) {
                if (!dep || !ID.test(dep.id || '') || !VERSION.test(dep.minVersion || '')) { errors.set(mod.id, 'Invalid dependency.'); continue; }
                const found = byId.get(dep.id);
                if (!found?.enabled || !VERSION.test(found.version || '') || compare(found.version, dep.minVersion) < 0) errors.set(mod.id, `Needs ${dep.id} ≥ ${dep.minVersion}, installed and enabled.`);
                else if (!visit(found)) errors.set(mod.id, `Dependency ${dep.id} could not load.`);
            }
            visiting.delete(mod.id); done.add(mod.id);
            if (!errors.has(mod.id)) ordered.push(mod);
            return !errors.has(mod.id);
        }
        for (const mod of mods) if (mod.enabled) visit(mod);
        return { ordered, errors };
    }
    root.AddonPackage = { validate, pack, unpack, compare, resolve, CATEGORIES };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.AddonPackage;
})(typeof window !== 'undefined' ? window : globalThis);
