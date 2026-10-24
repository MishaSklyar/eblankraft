const test = require('node:test');
const assert = require('node:assert/strict');
const origin = 'https://eblancraftbeta.pages.dev';
const env = { TELEGRAM_BOT_TOKEN: 'test-secret', TELEGRAM_CHAT_ID: '12345' };
const packet = { name: 'Tester', message: 'Opening inventory freezes the game.', page: origin + '/?token=private', browser: 'Test browser' };
const request = (data = packet, headers = {}, method = 'POST') => new Request(origin + '/api/bug-report', {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers },
    ...(method === 'POST' ? { body: typeof data === 'string' ? data : JSON.stringify(data) } : {})
});
async function make(config = env, send = async () => Response.json({ ok: true }), now) {
    const { BugReports } = await import('../cloudflare/beta/bug-reports.mjs');
    return new BugReports(config, send, now);
}

test('bug report sends plain text to configured Telegram chat without query secrets', async () => {
    let calls = 0;
    const reports = await make(env, async (url, options) => {
        calls++;
        assert.equal(url, 'https://api.telegram.org/bottest-secret/sendMessage');
        const body = JSON.parse(options.body);
        assert.equal(body.chat_id, '12345');
        assert(body.text.includes(packet.message));
        assert(body.text.includes('Tester'));
        assert(!body.text.includes('private'));
        assert.equal(body.parse_mode, undefined);
        return Response.json({ ok: true });
    });
    const response = await reports.fetch(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls, 1);
});

test('missing Telegram secrets honestly report unconfigured service', async () => {
    const reports = await make({}, () => { throw new Error('Must not contact Telegram'); });
    assert.equal((await reports.fetch(request())).status, 503);
});

test('invalid origin, method, JSON, size and field types never contact Telegram', async () => {
    const reports = await make(env, () => { throw new Error('Must not contact Telegram'); });
    for (const [req, status] of [
        [request(packet, { Origin: 'https://example.com' }), 403],
        [request(packet, {}, 'GET'), 405],
        [request('{'), 400],
        [request({ message: 'short' }), 400],
        [request({ message: 'x'.repeat(2001) }), 400],
        [request({ ...packet, name: {} }), 400],
        [request('x'.repeat(8193)), 413],
        [request(packet, { 'Content-Type': 'text/plain' }), 415]
    ]) assert.equal((await reports.fetch(req)).status, status);
});

test('Telegram rejection and network errors never expose bot token or claim success', async () => {
    for (const send of [async () => Response.json({ ok: false }, { status: 401 }), async () => { throw new Error('test-secret'); }]) {
        const response = await (await make(env, send)).fetch(request());
        assert.equal(response.status, 502);
        const body = await response.text();
        assert(!body.includes('test-secret'));
        assert(!body.includes('"ok":true'));
    }
});

test('parallel reports reserve quota and cooldown expires', async () => {
    let calls = 0, clock = 1000;
    const reports = await make(env, async () => { calls++; return Response.json({ ok: true }); }, () => clock);
    const responses = await Promise.all(Array.from({ length: 5 }, () => reports.fetch(request())));
    assert.equal(responses.filter(r => r.status === 200).length, 3);
    assert.equal(responses.filter(r => r.status === 429).length, 2);
    assert.equal(calls, 3);
    clock += 10 * 60 * 1000;
    assert.equal((await reports.fetch(request())).status, 200);
});

for (const directory of ['js', 'web/js']) {
    test(directory + ': report form keeps failed drafts and prevents duplicate sends', async () => {
        const fs = require('node:fs'), vm = require('node:vm');
        const handlers = {};
        const button = { addEventListener(type, handler) { handlers.open = handler; } };
        const dialog = { showModal() { this.open = true; }, close() { this.open = false; } };
        const status = { textContent: '' }, submit = { disabled: false };
        let resets = 0, calls = 0, finish;
        const form = {
            elements: { name: { value: 'Tester' }, message: { value: packet.message } },
            reportValidity: () => true,
            reset() { resets++; },
            addEventListener(type, handler) { handlers.submit = handler; }
        };
        const elements = { 'mm-btn-bug-report': button, 'bug-report-dialog': dialog, 'bug-report-form': form,
            'bug-report-status': status, 'bug-report-submit': submit,
            'bug-report-cancel': { addEventListener(type, handler) { handlers.close = handler; } } };
        const context = vm.createContext({
            document: { getElementById: id => elements[id] },
            navigator: { userAgent: 'Test browser' },
            location: { origin, pathname: '/' },
            AbortSignal,
            fetch: async (url, options) => {
                calls++;
                assert.equal(url, '/api/bug-report');
                assert.equal(JSON.parse(options.body).message, packet.message);
                return new Promise(resolve => { finish = resolve; });
            }
        });
        vm.runInContext(fs.readFileSync(directory + '/bug_report.js', 'utf8'), context);
        handlers.open();
        assert.equal(dialog.open, true);
        const pending = handlers.submit({ preventDefault() {} });
        assert.equal(submit.disabled, true);
        await handlers.submit({ preventDefault() {} });
        assert.equal(calls, 1);
        finish(Response.json({ error: 'Bug Report not configured' }, { status: 503 }));
        await pending;
        assert.equal(status.textContent, 'Bug Report not configured');
        assert.equal(resets, 0);
        assert.equal(submit.disabled, false);
        const success = handlers.submit({ preventDefault() {} });
        finish(Response.json({ ok: true }));
        await success;
        assert.equal(resets, 1);
        assert(status.textContent.includes('Дякуємо'));
        handlers.close();
        assert.equal(dialog.open, false);
    });
}


test('Telegram failures give actionable allowlisted diagnostics without upstream secrets', async () => {
    for (const [error_code, description, expected] of [
        [401, 'Unauthorized test-secret', 'telegram_token_invalid'],
        [404, 'Not Found test-secret', 'telegram_token_invalid'],
        [403, 'Forbidden: bot was blocked by the user test-secret', 'telegram_chat_forbidden'],
        [400, 'Bad Request: chat not found test-secret', 'telegram_chat_not_found'],
        [400, 'Bad Request: chat_id is empty test-secret', 'telegram_chat_invalid'],
        [429, 'Too Many Requests test-secret', 'telegram_rate_limited'],
        [400, 'Unknown failure test-secret', 'telegram_rejected']
    ]) {
        const reports = await make(env, async () => Response.json({ ok: false, error_code, description }, { status: error_code }));
        const response = await reports.fetch(request());
        assert.equal(response.status, 502);
        const result = await response.json();
        assert.equal(result.code, expected);
        assert(!JSON.stringify(result).includes('test-secret'));
    }
});


test('default Cloudflare fetch is invoked without an object receiver', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = function () {
        'use strict';
        assert.equal(this, undefined, 'Workers fetch throws Illegal invocation for an object receiver');
        calls++;
        return Promise.resolve(Response.json({ ok: true }));
    };
    try {
        const { BugReports } = await import('../cloudflare/beta/bug-reports.mjs');
        const reports = new BugReports(env);
        assert.equal((await reports.fetch(request())).status, 200);
        assert.equal(calls, 1);
    } finally { globalThis.fetch = original; }
});
