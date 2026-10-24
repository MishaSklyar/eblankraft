'use strict';
const fs = require('node:fs');
const path = require('node:path');
async function createEconomyHandler() {
    const { Economy } = await import('./economy.mjs');
    const file = process.env.EBLAN_ECONOMY_FILE || path.join(__dirname, '.economy.json');
    let state;
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const economy = new Economy({ state, adminToken: process.env.EBLAN_MARKET_ADMIN_TOKEN,
        save: async state => {
            fs.writeFileSync(file + '.tmp', JSON.stringify(state), { mode: 0o600 });
            fs.renameSync(file + '.tmp', file);
        } });
    return { economy, async handle(req, res) {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, String(value));
        headers.set('CF-Connecting-IP', req.socket.remoteAddress || 'local');
        const request = new Request('http://' + (req.headers.host || 'localhost') + req.url, {
            method: req.method, headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: req, duplex: 'half' })
        });
        const response = await economy.fetch(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
    } };
}
module.exports = { createEconomyHandler };
