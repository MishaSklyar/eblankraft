const MAX_BYTES = 8192;
const WINDOW_MS = 10 * 60 * 1000;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export class BugReports {
    constructor(env, send = (...args) => fetch(...args), now = () => Date.now()) {
        this.env = env;
        this.send = send;
        this.now = now;
        this.limits = new Map();
        this.global = { until: 0, count: 0 };
    }

    async fetch(request) {
        if (request.method !== 'POST') return json({ error: 'Використовуйте POST.' }, 405);
        const origin = request.headers.get('Origin');
        if (origin !== 'https://eblancraftbeta.pages.dev') return json({ error: 'Недозволене джерело запиту.' }, 403);
        if (!this.env.TELEGRAM_BOT_TOKEN || !this.env.TELEGRAM_CHAT_ID) {
            return json({ error: 'Bug Report ще не налаштовано. Спробуйте пізніше.' }, 503);
        }
        if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
            return json({ error: 'Очікується JSON.' }, 415);
        }
        let data;
        try {
            const reader = request.body?.getReader();
            if (!reader) return json({ error: 'Порожнє повідомлення.' }, 400);
            const parts = [];
            let size = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.length;
                if (size > MAX_BYTES) {
                    await reader.cancel();
                    return json({ error: 'Повідомлення завелике.' }, 413);
                }
                parts.push(value);
            }
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const part of parts) { bytes.set(part, offset); offset += part.length; }
            data = JSON.parse(new TextDecoder().decode(bytes));
        } catch { return json({ error: 'Некоректне повідомлення.' }, 400); }
        if (!data || typeof data !== 'object' || Array.isArray(data) ||
            typeof data.message !== 'string' || data.message.trim().length < 10 || data.message.length > 2000 ||
            (data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 40)) ||
            (data.browser !== undefined && (typeof data.browser !== 'string' || data.browser.length > 200)) ||
            (data.diagnostics !== undefined && (typeof data.diagnostics !== 'string' || data.diagnostics.length > 1200)) ||
            (data.page !== undefined && (typeof data.page !== 'string' || data.page.length > 300))) {
            return json({ error: 'Опис має містити від 10 до 2000 символів.' }, 400);
        }
        const now = this.now();
        for (const [key, limit] of this.limits) if (limit.until <= now) this.limits.delete(key);
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const limit = this.limits.get(ip) || { until: now + WINDOW_MS, count: 0 };
        if (this.global.until <= now) this.global = { until: now + 60000, count: 0 };
        if (limit.count >= 3 || this.global.count >= 20 || this.limits.size >= 2048) {
            return json({ error: 'Забагато повідомлень. Зачекайте кілька хвилин.' }, 429);
        }
        // Reserve quota before awaiting Telegram so parallel requests cannot bypass it.
        limit.count++;
        this.limits.set(ip, limit);
        this.global.count++;
        let page = '—';
        try {
            const url = new URL(data.page);
            if (url.origin === origin) page = url.origin + url.pathname;
        } catch {}
        const text = [
            '🐛 Eblancraft Beta — Bug Report',
            'Нік: ' + (data.name?.trim() || 'Анонім'),
            'Сторінка: ' + page,
            'Браузер: ' + (data.browser || '—'),
            '', data.message.trim(),
            ...(data.diagnostics ? ['', 'інформація для супер ебланов', data.diagnostics] : [])
        ].join('\n');
        try {
            const response = await this.send(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(10000),
                body: JSON.stringify({ chat_id: this.env.TELEGRAM_CHAT_ID, text, link_preview_options: { is_disabled: true } })
            });
            const result = await response.json();
            if (!response.ok || result.ok !== true) {
                // Only return fixed messages; Telegram descriptions may contain sensitive input.
                const code = result.error_code || response.status;
                const description = typeof result.description === 'string' ? result.description.toLowerCase() : '';
                if (code === 401 || code === 404) {
                    return json({ error: 'Telegram: неправильний токен бота. Оновіть TELEGRAM_BOT_TOKEN через Wrangler.', code: 'telegram_token_invalid' }, 502);
                }
                if (code === 403) {
                    return json({ error: 'Telegram: бот не може писати в цей чат. Розблокуйте свого бота і натисніть Start; для групи додайте бота та дозвольте надсилання повідомлень.', code: 'telegram_chat_forbidden' }, 502);
                }
                if (code === 400 && description.includes('chat not found')) {
                    return json({ error: 'Telegram: чат не знайдено. Перевірте числовий TELEGRAM_CHAT_ID та натисніть Start саме у своєму боті.', code: 'telegram_chat_not_found' }, 502);
                }
                if (code === 400 && (description.includes('chat_id') || description.includes('chat identifier'))) {
                    return json({ error: 'Telegram: некоректний TELEGRAM_CHAT_ID. Вставте числовий ID чату через Wrangler.', code: 'telegram_chat_invalid' }, 502);
                }
                if (code === 429) {
                    return json({ error: 'Telegram тимчасово обмежив надсилання. Зачекайте кілька хвилин.', code: 'telegram_rate_limited' }, 502);
                }
                return json({ error: 'Telegram відхилив повідомлення. Перевірте налаштування бота і чату.', code: 'telegram_rejected' }, 502);
            }
            return json({ ok: true });
        } catch {
            // Never expose or log Telegram URLs (they contain the bot token).
            return json({ error: 'Не вдалося підтвердити доставку. Зачекайте перед повторною спробою.' }, 502);
        }
    }
}
