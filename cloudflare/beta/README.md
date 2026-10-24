# Eblancraft beta

Site: https://eblancraftbeta.pages.dev/
WebSocket (same origin): wss://eblancraftbeta.pages.dev/ws
WebSocket (direct): wss://eblancraftbeta-ws.plese0580.workers.dev/ws
Status: https://eblancraftbeta.pages.dev/api/status

The Worker wraps the existing Node authority and browser Wasm engine in a single
Durable Object. Rooms and matchmaking share one instance. Live matches/worlds
are in memory and reset when the instance restarts or the Worker is redeployed.
Capacity inherits the Node server's 128 connections / 16 players per world.

From the repository root, regenerate the authority whenever game/server sources change:

```bash
rtk proxy python3 cloudflare/build-beta.py
rtk proxy npx --yes wrangler@latest deploy --config cloudflare/beta/wrangler.toml
rtk proxy python3 cloudflare/stage-beta.py
rtk proxy npx --yes wrangler@latest pages deploy cloudflare/beta/public --project-name eblancraftbeta --branch main --commit-dirty=true
rtk proxy node cloudflare/beta/smoke.cjs wss://eblancraftbeta.pages.dev/ws
```

The staging script copies only public assets and the current root index.html.
Pages forwards /ws and /api/status to the Worker; other paths use static assets.
No server URL changes are required in the browser client.

Local runtime proof:

```bash
rtk proxy npx --yes wrangler@latest dev --config cloudflare/beta/wrangler.toml --port 18787 --inspector-port 19239
rtk proxy node cloudflare/beta/smoke.cjs
```

Smoke checks exercise two connections in one room, the original Wasm world
engine, and Dust2 welcome/snapshot messages.

## Telegram Bug Report setup

1. Open **@BotFather** in Telegram, run `/newbot`, choose a name and a username
   ending in `bot`. Copy the bot token. Do not put it in HTML, JS, Git, or chat.
2. Open your new bot and press **Start** (`/start`). The bot cannot send messages
   to your private chat until you start it.
3. Open **@userinfobot** and press **Start** to obtain your numeric Telegram user
   ID. For a private chat, that ID is your `TELEGRAM_CHAT_ID`.
4. From the repository root, run these commands. Wrangler prompts for each
   value; paste the token in the first prompt and the numeric ID in the second:

```bash
rtk proxy npx --yes wrangler@latest secret put TELEGRAM_BOT_TOKEN --config cloudflare/beta/wrangler.toml
rtk proxy npx --yes wrangler@latest secret put TELEGRAM_CHAT_ID --config cloudflare/beta/wrangler.toml
```

These are **Worker** secrets for `eblancraftbeta-ws`, not Pages environment vars.
Wrangler publishes secret updates; no site rebuild is needed. Alternatively,
use Cloudflare → Workers & Pages → eblancraftbeta-ws → Settings → Variables
and Secrets → Add → Secret, add both names above, then deploy the changes.

5. Open https://eblancraftbeta.pages.dev/, select **Bug Report**, describe a test
   bug (at least 10 characters), and submit. Check that your bot delivered it.
   If you see an unconfigured message, check both secret names. If delivery
   fails, check the token, chat ID, and that you pressed Start on your own bot.

Reports include description, optional nickname, page URL without query params,
and browser user agent. Rate limits: 3 attempts per IP per 10 minutes, 20
attempts per minute globally. Rate counters reset if the Durable Object restarts.
Without both secrets the endpoint returns 503 and never claims delivery.
