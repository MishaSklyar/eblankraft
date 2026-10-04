# ☁️ ЕБЛАНКРАФТ 3.0 — Cloudflare Workers

Повноцінний авторитетний ігровий сервер, EmuOS проксі та шлюз мультиплеєра на **Cloudflare Workers**.

---

## ⚡ Що робить цей Cloudflare Worker
1. **🛡️ WebSocket Game Server (`/ws`)**:
   - Авторитетний сервер PvP дуелей та кімнат.
   - Серверний прорахунок урону (`WEAPON_DAMAGE`), захист від чітів, радіус удару (5.5 блоків), кулдауни та i-frames.
   - Захист від вантапів (кап урону 65 HP).
   - Синхронізація блоків, чат, пінг/понг.
2. **🌐 EmuOS Edge Proxy (`/proxy/emuos/*`)**:
   - Робота емуляторів без CORS помилок на глобальній мережі Cloudflare.
3. **📊 Статус API (`/api/status`)**:
   - Діагностика кількості онлайн гравців, кімнат та локації дата-центру Cloudflare.

---

## 🚀 Як розгорнути (2 Простих Способи)

### Спосіб 1: Через Wrangler CLI (1 команда)
1. Встанови Wrangler (якщо ще не встановлено):
   ```bash
   npm install -g wrangler
   ```
2. Авторизуйся у своєму безкоштовному акаунті Cloudflare:
   ```bash
   wrangler login
   ```
3. Запусти розгортання:
   ```bash
   cd cloudflare
   wrangler deploy
   ```
Після цього Cloudflare надасть тобі безкоштовне посилання виду:
👉 `https://eblankraft.<твій-акаунт>.workers.dev`

---

### Спосіб 2: Через браузер у Cloudflare Dashboard (БЕЗ встановлення Node.js)
1. Зайди на [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Перейди в меню **Workers & Pages** -> **Create application** -> **Create Worker**.
3. Натисни **Deploy**.
4. На сторінці воркера натисни **Edit code**.
5. Відкрий файл `cloudflare/src/worker.js` з цього проєкту, скопіюй увесь вміст і встав у редактор Cloudflare.
6. Натисни **Save and Deploy**. Все готово!

---

## 🎮 Підключення клієнта гри
Клієнт гри автоматично розпізнає запуск на домені `*.workers.dev` та підключається до `wss://<твій-воркер>.workers.dev/ws` для наднизького пінгу у будь-якій точці світу!
