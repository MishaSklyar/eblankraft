# Addons and Eblancoins

Open **Mods → Marketplace** from the main menu or the in-game addon manager.
The original Lua editor, console, Blockly, `.lua` imports and `.eblan` asset packs
remain available. The installed library supports search and package export.

## Portable addon packages

An `.ebaddon` is a UTF-8 JSON file, not an executable archive:

```json
{
  "format": "eblankraft-addon",
  "apiVersion": 1,
  "manifest": {
    "id": "my-building-tools",
    "name": "My Building Tools",
    "version": "1.0.0",
    "author": "Your name",
    "description": "Tools for building worlds.",
    "category": "building",
    "dependencies": [{ "id": "base-tools", "minVersion": "1.0.0" }]
  },
  "code": "print('Addon loaded')"
}
```

Categories: `gameplay`, `building`, `tools`, `cosmetic`. IDs contain letters,
digits, dots, dashes and underscores (maximum 64 characters). Versions use
`major.minor.patch`. Export converts legacy `1.0` versions to `1.0.0`.
Lua source is limited to 128 KiB, dependencies to 16, and uploaded JSON to 150 KiB.
The editor's **Addon package settings** accepts dependencies as
`base-tools@1.0.0, another-addon@2.0.0`.

Imports and marketplace updates require review of the package summary and start
disabled. An update must have a higher version and match the installed source;
export local edits before replacing them. Enable dependencies in the library.
They execute before dependents. Missing, disabled, outdated, cyclic or failed
dependencies prevent affected addons from loading; independent addons still run.
Errors appear in the library and Lua console.

Lua addons retain the existing powerful game/JavaScript API. They are **not
sandboxed from the browser or other addons**. Only enable code you trust. Review
and marketplace moderation reduce exposure but do not prove that code is safe.

## Wallet and rewards

Create a wallet in **Eblancoins**, then use **Back up wallet key**. The private
key is stored in this browser and can restore access from another browser. Keep
it private: it controls the wallet and creator listings. There is no password
reset or account recovery without that key. The server stores its SHA-256 hash.
Keys are sent only to this site's authority, never custom multiplayer endpoints.

Balances, ownership and transaction history live on the server. Neither local
storage nor a client request can choose a reward amount. Eblancoins have no cash
withdrawal. Initial balances are zero.

Each 300 seconds of active movement on this server earns **10 EC**, capped at
**120 EC per wallet per UTC day**. Valid authority positions and elapsed server
time determine progress. Idle time, disconnected gaps, solo and P2P games do not
earn coins. Multiple sessions cannot multiply rewards for one wallet. Rewarded
balances are persisted; incomplete progress may reset on a server restart.
Refresh the wallet to see progress. These controls limit ordinary replay and
idle farming; they are not a complete bot or multi-account prevention system.

**Adsterra rewards are disabled.** Adsterra's publisher guidance prohibits
incentivized traffic. No fake video timer, click reward, or fabricated completion
callback is included. A future rewarded-ad integration needs a provider that
allows the use case and authenticated server-side completion verification.
See https://adsterra.com/blog/set-up-publishers-dashboard/.

## Marketplace operation

Creators select an installed addon, a category and a whole-number EC price
(`0` means free). New listings and higher-version updates enter `pending` review.
Only approved listings are public. An update is unavailable to buyers until
approved. Buyers keep update entitlement and are never charged again for that
listing. A buyer's coins transfer to the creator, with **no platform fee**.
Purchase retries are idempotent through recorded ownership; price/version changes
require refreshing before purchase. Saves and both sides of a sale are atomic.
Same addon IDs from different sellers remain separate listings; local installation
rejects conflicting sources. Paid Lua is downloadable by its buyers and can be
copied; this format does not provide DRM.

Set `EBLAN_MARKET_ADMIN_TOKEN` as a private server environment variable or Worker
secret. Do not put it in browser code. Without it listings can be submitted but
cannot be approved. Moderator API:

- `GET /api/economy/review` with `Authorization: Bearer <admin token>` returns
  pending listings including their Lua source.
- `POST /api/economy/moderate` with that header and JSON
  `{ "id": "<listing id>", "status": "approved" }` (or `rejected`) records a decision.

Review each version's source and metadata before approval. There is no automated
code-safety scanner. Creator limits are 30 listings and 10 hosted worlds per wallet.
Signup and API requests have server-side rate limits. This is an initial marketplace
implementation; public launch still needs operational moderation and abuse handling.

## Cloudflare Workers hosting

The existing beta Durable Object serves the economy and hosted co-op worlds.
Plans currently cost **40 EC / 24 hours** or **200 EC / 7 days**, with **8 players**
per world. These are game prices defined in `server/economy.mjs`, not Cloudflare's
monetary rates. Hosting uses the existing shared Worker; it does not purchase a
separate Worker, dedicated CPU, or an infrastructure subscription for each player.

Purchases create an expiring `coop_hosted_…` room code. Anyone with its code can
join. Renewals extend an active expiry or start from now after expiry. The server
enforces capacity and expiry; there is no automatic EC renewal. The world's seed
is derived from its code. Blocks and custom block designs are saved in SQLite
every 15 seconds while online and on disconnect, and restored after restart.
An abrupt instance failure can lose the most recent 15 seconds. Inventory follows
the existing client/world inventory behavior; entities, dropped items, and running
addon state are not stored as part of the hosted-world block snapshot.

The existing overall limits remain 128 connections and 64 normal/co-op rooms per
Durable Object, with all game simulation in one instance. Hosting plans share that
capacity. Expired world snapshots are retained for renewal. Plan sales are capped
against the current total hosted-world allocation; this is not an unlimited fleet.
The Node development server supports marketplace and play rewards but disables
hosting sales because it does not provide the Worker persistence service.

## Run and deploy

`npm start` runs the local game/API. Economy data defaults to
`server/.economy.json` (private and excluded by the static server's directory
rules). Use `EBLAN_ECONOMY_FILE` for a private persistent path outside the checkout.
Back it up; an ephemeral filesystem loses wallets and ownership on restart.
Do not run multiple Node authorities against one file.

The beta Worker uses its existing SQLite-enabled Durable Object binding; no new
Cloudflare resource or migration is necessary. From the project root:

```sh
python3 cloudflare/build-beta.py
wrangler secret put EBLAN_MARKET_ADMIN_TOKEN --config cloudflare/beta/wrangler.toml
wrangler deploy --config cloudflare/beta/wrangler.toml
python3 cloudflare/stage-beta.py
wrangler pages deploy cloudflare/beta/public --project-name eblancraftbeta --branch main
```

The Pages proxy and generated routes include `/api/economy/*`. Deploy both the
Worker and Pages build. The older `cloudflare/src/worker.js` launcher is not this
beta authority and does not implement this economy. These changes do not deploy
automatically or change live Cloudflare secrets.

Run `npm test` for package, economy, storage and game regressions. Run
`wrangler deploy --dry-run --config cloudflare/beta/wrangler.toml` to check the
Worker bundle. Local Worker tests use `wrangler dev` and
`node cloudflare/beta/smoke.cjs ws://127.0.0.1:8787/ws`.
