// SQLite rows avoid the 128 KiB Durable Object key/value limit for addon packages.
export class EconomyStore {
    constructor(storage) {
        this.storage = storage; this.sql = storage.sql; this.saved = new Map();
        this.sql.exec('CREATE TABLE IF NOT EXISTS economy (kind TEXT, id TEXT, value TEXT, PRIMARY KEY(kind,id))');
        this.sql.exec('CREATE TABLE IF NOT EXISTS hosted_blocks (room TEXT, part INTEGER, value TEXT, PRIMARY KEY(room,part))');
    }
    load() {
        const state = { accounts: {}, listings: {}, leases: {} };
        for (const row of this.sql.exec('SELECT kind,id,value FROM economy')) {
            state[row.kind][row.id] = JSON.parse(row.value); this.saved.set(row.kind + ':' + row.id, row.value);
        }
        return state;
    }
    save(state) {
        const changed = [];
        for (const kind of ['accounts', 'listings', 'leases']) for (const [id, data] of Object.entries(state[kind])) {
            const value = JSON.stringify(data), key = kind + ':' + id;
            if (this.saved.get(key) !== value) changed.push({ kind, id, value, key });
        }
        this.storage.transactionSync(() => {
            for (const r of changed) this.sql.exec('INSERT OR REPLACE INTO economy VALUES (?,?,?)', r.kind, r.id, r.value);
        });
        for (const r of changed) this.saved.set(r.key, r.value);
    }
    loadWorld(room) {
        const blocks = [];
        for (const row of this.sql.exec('SELECT value FROM hosted_blocks WHERE room=? ORDER BY part', room)) blocks.push(...JSON.parse(row.value));
        return blocks;
    }
    saveWorld(room) {
        const blocks = [...room.blocks.values()];
        this.storage.transactionSync(() => {
            this.sql.exec('DELETE FROM hosted_blocks WHERE room=?', room.name);
            for (let i = 0; i < blocks.length; i += 128) this.sql.exec('INSERT INTO hosted_blocks VALUES (?,?,?)', room.name, i / 128, JSON.stringify(blocks.slice(i, i + 128)));
        });
    }
}
