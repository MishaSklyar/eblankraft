'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const directory of ['js', 'web/js']) {
    test(`${directory}: debug toggle samples frames and attaches only selected diagnostics`, async () => {
        const handlers = {};
        const toggle = { checked: false, addEventListener: (type, callback) => { handlers.toggle = callback; } };
        const panel = { hidden: true }, output = { textContent: '' }, checkbox = { checked: false };
        const button = { addEventListener: (type, callback) => { handlers.open = callback; } };
        const form = { elements: { name: { value: '' }, message: { value: 'The leaves shake when turning.' } },
            reportValidity: () => true, reset() {}, addEventListener: (type, callback) => { handlers.submit = callback; } };
        const elements = { 'chk-debug': toggle, 'debug-panel': panel, 'debug-info': output,
            'mm-btn-bug-report': button, 'bug-report-form': form,
            'bug-report-dialog': { showModal() {}, close() {} }, 'bug-report-debug': checkbox,
            'bug-report-status': {}, 'bug-report-submit': {}, 'bug-report-cancel': { addEventListener() {} } };
        let callback, requests = [], canceled = 0;
        const context = vm.createContext({ window: { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
            game: { getFrameStats: () => ({ fps: 5, average: 200, max: 200, spikes: 3, count: 3 }), lastFrameCpuTime: 5, windLeavesEnabled: true, world: { chunks: { a: { isDirty: true } }, chunkGenQueue: [1] } } },
            document: { getElementById: id => elements[id], addEventListener() {} },
            requestAnimationFrame: fn => { callback = fn; return 1; }, cancelAnimationFrame: () => { canceled++; },
            navigator: { userAgent: 'Test' }, location: { origin: 'https://eblancraftbeta.pages.dev', pathname: '/' }, AbortSignal,
            fetch: async (url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ ok: true }) }; } });
        vm.runInContext(fs.readFileSync(`${directory}/debug.js`, 'utf8'), context);
        vm.runInContext(fs.readFileSync(`${directory}/bug_report.js`, 'utf8'), context);
        assert.equal(panel.hidden, true);
        toggle.checked = true;
        handlers.toggle();
        callback(0); callback(16); callback(76); callback(576);
        assert.equal(panel.hidden, false);
        assert.match(output.textContent, /≥50 ms: 3\/3/);
        assert.match(output.textContent, /Чанки: 1 \| брудні: 1 \| черга: 1/);
        handlers.open();
        assert.equal(checkbox.checked, true);
        await handlers.submit({ preventDefault() {} });
        assert.match(requests[0].diagnostics, /листя\/вітер: true/);
        assert.ok(requests[0].diagnostics.length <= 1200);
        checkbox.checked = false;
        await handlers.submit({ preventDefault() {} });
        assert.equal(requests[1].diagnostics, undefined);
        toggle.checked = false;
        handlers.toggle();
        assert.equal(panel.hidden, true);
        assert.ok(canceled > 0);
        handlers.open();
        assert.equal(checkbox.checked, false);
    });
}

test('backend delivers diagnostics and rejects oversized or invalid attachments', async () => {
    const { BugReports } = await import('../cloudflare/beta/bug-reports.mjs');
    let sent;
    const reports = new BugReports({ TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_CHAT_ID: '123' }, async (url, options) => {
        sent = JSON.parse(options.body); return Response.json({ ok: true });
    });
    const request = diagnostics => new Request('https://eblancraftbeta.pages.dev/api/bug-report', {
        method: 'POST', headers: { Origin: 'https://eblancraftbeta.pages.dev', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'The leaves shake when turning.', diagnostics })
    });
    assert.equal((await reports.fetch(request('FPS: 60\nкадр макс: 52 ms'))).status, 200);
    assert.match(sent.text, /інформація для супер ебланов\nFPS: 60/);
    for (const bad of [{}, 'x'.repeat(1201)]) assert.equal((await reports.fetch(request(bad))).status, 400);
});
