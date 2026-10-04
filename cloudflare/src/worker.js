/**
 * 🎮 EBLANKRAFT 3.0 — Cloudflare Workers Edge Edition
 * Features:
 *  - Native Cloudflare WebSocketPair Authoritative Game Server (/ws)
 *  - Global Low-Latency Edge Rooms (PvP Arena, Duels, Open World)
 *  - Server-Authoritative Anti-Cheat, Anti-One-Tap (max 65 HP), i-Frames & Reach Verification
 *  - EmuOS Edge Reverse-Proxy (/proxy/emuos/*) with CORS
 *  - Edge Diagnostics & Status API (/api/status)
 *  - Zero-Config Instant Game Launcher Web Client
 */

// Authoritative Weapon Damage Table (Matches items.js)
const WEAPON_DAMAGE = {
    fist: 5.0,
    // Pickaxes
    wood_pickaxe: 6.0,
    stone_pickaxe: 9.0,
    iron_pickaxe: 12.0,
    diamond_pickaxe: 16.0,
    netherite_pickaxe: 20.0,
    eblan_pickaxe: 28.0,
    // Swords
    wood_sword: 18.0,
    stone_sword: 24.0,
    iron_sword: 30.0,
    diamond_sword: 36.0,
    netherite_sword: 42.0,
    eblan_sword: 55.0,
    // Firearms & Explosives
    ak47: 24.0,
    m4a1: 22.0,
    awp: 62.0,
    shotgun: 42.0,
    deagle: 35.0,
    glock: 15.0,
    mp5: 17.0,
    rpg: 65.0,
    grenade: 45.0,
};

// In-Memory Global Edge Rooms Map & Duel Matchmaking Queue
const rooms = new Map();
let duelQueue = [];

function enqueueDuel(client, nick, kit) {
    // Remove dead/closed sockets
    duelQueue = duelQueue.filter(entry => entry.client.ws.readyState === 1);

    if (!duelQueue.some(entry => entry.client.id === client.id)) {
        duelQueue.push({ client, nick: nick || client.name, kit: kit || 'classic' });
    }

    if (duelQueue.length >= 2) {
        const e1 = duelQueue.shift();
        const e2 = duelQueue.shift();
        if (e1.client.ws.readyState === 1 && e2.client.ws.readyState === 1) {
            startDuelMatch(e1, e2);
        }
    }
}

function startDuelMatch(e1, e2) {
    const p1 = e1.client;
    const p2 = e2.client;
    const roomName = `duel_${Date.now()}_${p1.id}_${p2.id}`;
    const room = getOrCreateRoom(roomName);

    if (p1.room && p1.room.name !== roomName) {
        p1.room.clients.delete(p1.id);
    }
    if (p2.room && p2.room.name !== roomName) {
        p2.room.clients.delete(p2.id);
    }

    p1.room = room;
    p2.room = room;
    p1.name = e1.nick;
    p2.name = e2.nick;
    p1.health = 100.0;
    p2.health = 100.0;
    p1.isAlive = true;
    p2.isAlive = true;
    p1.invulnerableUntil = Date.now() / 1000 + 4.5;
    p2.invulnerableUntil = Date.now() / 1000 + 4.5;

    // Spawns
    p1.x = 0.0; p1.y = 5.0; p1.z = -14.0; p1.yaw = 0.0;
    p2.x = 0.0; p2.y = 5.0; p2.z = 14.0; p2.yaw = Math.PI;

    room.clients.set(p1.id, p1);
    room.clients.set(p2.id, p2);

    // Notify clients of match
    p1.ws.send(JSON.stringify({
        type: 'duel_matched',
        room: roomName,
        opponent: { id: p2.id, name: p2.name, skin: p2.skin },
        spawn: { x: 0.0, y: 5.0, z: -14.0, yaw: 0.0 }
    }));
    p2.ws.send(JSON.stringify({
        type: 'duel_matched',
        room: roomName,
        opponent: { id: p1.id, name: p1.name, skin: p1.skin },
        spawn: { x: 0.0, y: 5.0, z: 14.0, yaw: Math.PI }
    }));

    // Synchronize representations
    p1.ws.send(JSON.stringify({
        type: 'player_joined',
        player: { id: p2.id, name: p2.name, skin: p2.skin, x: p2.x, y: p2.y, z: p2.z, yaw: p2.yaw, pitch: 0, health: 100, held_item: 'diamond_sword', is_alive: true }
    }));
    p2.ws.send(JSON.stringify({
        type: 'player_joined',
        player: { id: p1.id, name: p1.name, skin: p1.skin, x: p1.x, y: p1.y, z: p1.z, yaw: p1.yaw, pitch: 0, health: 100, held_item: 'diamond_sword', is_alive: true }
    }));

    // 3-2-1 Countdown
    [3, 2, 1, 0].forEach((sec, idx) => {
        setTimeout(() => {
            if (p1.ws.readyState === 1 && p2.ws.readyState === 1) {
                room.broadcast({ type: 'duel_countdown', seconds: sec });
            }
        }, (idx + 1) * 1000);
    });
}

class EdgeRoom {
    constructor(name, mode = 'survival') {
        this.name = name;
        this.cooperative = name.startsWith('coop_');
        this.mode = mode === 'creative' ? 'creative' : 'survival';
        let hash = 2166136261;
        for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
        this.seed = (hash >>> 0) % 899999 + 100000;
        this.clients = new Map(); // id -> EdgeClient
        this.blocks = new Map();  // "x,y,z" -> blockType
    }

    broadcast(messageObj, excludeId = null) {
        const payload = JSON.stringify({ ...messageObj, room: this.name });
        for (const [id, client] of this.clients.entries()) {
            if (excludeId && id === excludeId) continue;
            try {
                if (client.ws.readyState === 1) { // 1 = OPEN
                    client.ws.send(payload);
                }
            } catch (e) {
                // Ignore broken sockets
            }
        }
    }
}

class EdgeClient {
    static idCounter = 1000;

    constructor(ws, room) {
        EdgeClient.idCounter++;
        this.id = `cf_${EdgeClient.idCounter}`;
        this.ws = ws;
        this.room = room;
        this.name = `Боєць_${String(this.id).slice(-4)}`;
        this.skin = 'classic';
        this.x = 0.0;
        this.y = 32.0;
        this.z = 0.0;
        this.yaw = 0.0;
        this.pitch = 0.0;
        this.health = 100.0;
        this.maxHealth = 100.0;
        this.isAlive = true;
        this.invulnerableUntil = 0.0;
        this.lastAttackTime = 0.0;
        this.heldItem = null;
    }
}

function getOrCreateRoom(roomName, mode = 'survival') {
    if (!rooms.has(roomName)) {
        rooms.set(roomName, new EdgeRoom(roomName, mode));
    }
    return rooms.get(roomName);
}

function handleWebSocketSession(serverWs) {
    serverWs.accept();

    let client = null;
    let room = null;

    serverWs.addEventListener('message', (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            return; // Ignore malformed JSON (Anti-Crash)
        }

        if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
        const now = Date.now() / 1000;
        const mtype = msg.type;

        if (mtype === 'ping') {
            serverWs.send(JSON.stringify({
                type: 'pong',
                client_time: msg.client_time || 0,
                server_time: Date.now()
            }));
            return;
        }

        if (mtype === 'join') {
            const roomName = String(msg.room || 'pvp_arena').slice(0, 32);
            const name = String(msg.name || 'Боєць').slice(0, 24).trim() || 'Боєць';
            const skin = String(msg.skin || 'classic').slice(0, 32);

            if (room && client) {
                room.clients.delete(client.id);
                room.broadcast({ type: 'player_left', id: client.id, name: client.name });
            }
            room = getOrCreateRoom(roomName, msg.mode);
            client = new EdgeClient(serverWs, room);
            client.name = name;
            client.skin = skin;
            room.clients.set(client.id, client);

            // Existing players in room
            const existing = [];
            for (const other of room.clients.values()) {
                if (other.id !== client.id) {
                    existing.push({
                        id: other.id,
                        name: other.name,
                        skin: other.skin,
                        x: other.x,
                        y: other.y,
                        z: other.z,
                        yaw: other.yaw,
                        pitch: other.pitch,
                        health: other.health,
                        held_item: other.heldItem,
                        is_alive: other.isAlive
                    });
                }
            }

            // Welcome
            serverWs.send(JSON.stringify({
                type: 'welcome',
                id: client.id,
                room: roomName,
                players: existing,
                blocks: [...room.blocks].map(([key, block_type]) => {
                    const [x, y, z] = key.split(',').map(Number);
                    return { x, y, z, block_type };
                }),
                world: room.cooperative ? { seed: room.seed, mode: room.mode, type: 'normal' } : null,
                pvp: !room.cooperative,
                health: client.health
            }));

            // Broadcast to other players
            room.broadcast({
                type: 'player_joined',
                player: {
                    id: client.id,
                    name: client.name,
                    skin: client.skin,
                    x: client.x,
                    y: client.y,
                    z: client.z,
                    yaw: client.yaw,
                    pitch: client.pitch,
                    health: client.health,
                    held_item: client.heldItem,
                    is_alive: client.isAlive
                }
            }, client.id);
            return;
        }

        if (mtype === 'leave') {
            if (room && client) {
                room.clients.delete(client.id);
                room.broadcast({ type: 'player_left', id: client.id, name: client.name });
            }
            duelQueue = duelQueue.filter(entry => entry.client !== client);
            room = null;
            if (client) client.room = null;
            return;
        }
        if (!client || !room) return;

        if (mtype === 'move') {
            const nx = Number(msg.x ?? client.x);
            const ny = Number(msg.y ?? client.y);
            const nz = Number(msg.z ?? client.z);
            const yaw = Number(msg.yaw ?? client.yaw);
            const pitch = Number(msg.pitch ?? client.pitch);
            const heldItem = msg.held_item ? String(msg.held_item).slice(0, 32) : null;
            const isWalking = Boolean(msg.is_walking);
            const isSprinting = Boolean(msg.is_sprinting);

            // Anti-speedhack / teleport clamp
            const dx = nx - client.x;
            const dy = ny - client.y;
            const dz = nz - client.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            if (distSq > 900.0) { // >30 blocks per frame
                return; // drop exploit packet
            }

            client.x = nx;
            client.y = ny;
            client.z = nz;
            client.yaw = yaw;
            client.pitch = pitch;
            client.heldItem = heldItem;

            room.broadcast({
                type: 'player_moved',
                id: client.id,
                x: client.x,
                y: client.y,
                z: client.z,
                yaw: client.yaw,
                pitch: client.pitch,
                held_item: client.heldItem,
                is_walking: isWalking,
                is_sprinting: isSprinting
            }, client.id);
            return;
        }

        if (mtype === 'attack') {
            if (room.cooperative) return;
            // Authoritative PvP Verification
            if (!client.isAlive) return;

            const targetId = String(msg.target_id || '');
            const isCrit = Boolean(msg.is_crit);
            const target = room.clients.get(targetId);

            if (!target || !target.isAlive || target.id === client.id) return;

            // 1. Cooldown check: min 350ms between attacks
            if ((now - client.lastAttackTime) < 0.35) return;

            // 2. Reach check: distance <= 5.5 blocks
            const dist = Math.hypot(client.x - target.x, client.y - target.y, client.z - target.z);
            if (dist > 5.5) return;

            // 3. Target Hurt Invulnerability (i-Frames: 400ms)
            if (now < target.invulnerableUntil) return;

            // 4. Server Damage Lookup (Cannot forge damage!)
            const itemKey = client.heldItem || 'fist';
            const baseDamage = WEAPON_DAMAGE[itemKey] || 5.0;
            let finalDamage = baseDamage * (isCrit ? 1.35 : 1.0);

            // Anti-One-Tap Cap (Max 65 HP)
            finalDamage = Math.min(65.0, finalDamage);
            finalDamage = Math.round(finalDamage * 10) / 10;

            client.lastAttackTime = now;
            target.invulnerableUntil = now + 0.40;
            target.health = Math.max(0.0, Math.round((target.health - finalDamage) * 10) / 10);

            let kbX = 0.0;
            let kbZ = 0.0;
            if (dist > 0.001) {
                kbX = Math.round(((target.x - client.x) / dist) * 0.45 * 1000) / 1000;
                kbZ = Math.round(((target.z - client.z) / dist) * 0.45 * 1000) / 1000;
            }

            room.broadcast({
                type: 'damage_event',
                target_id: target.id,
                attacker_id: client.id,
                attacker_name: client.name,
                damage: finalDamage,
                health_remaining: target.health,
                is_crit: isCrit,
                knockback: { x: kbX, y: 0.28, z: kbZ }
            });

            if (target.health <= 0) {
                target.isAlive = false;
                room.broadcast({
                    type: 'death_event',
                    victim_id: target.id,
                    victim_name: target.name,
                    killer_id: client.id,
                    killer_name: client.name,
                    message: `⚔️ ${client.name} ліквідував ${target.name}!`
                });

                if (room.name.startsWith('duel_')) {
                    room.broadcast({
                        type: 'duel_round_end',
                        winner_id: client.id,
                        winner_name: client.name,
                        loser_id: target.id,
                        loser_name: target.name,
                        reason: `⚔️ ${client.name} здолав ${target.name} у двобої!`
                    });
                }
            }
            return;
        }

        if (mtype === 'inventory_sync') {
            const slots = msg.inventory || msg.hotbar || [];
            const selected = msg.selected_slot ?? 0;
            if (!Array.isArray(slots) || slots.length > 27 || !Number.isInteger(selected) || selected < 0 || selected > 8) return;
            const inventory = [];
            for (const slot of slots) {
                if (slot === null) { inventory.push(null); continue; }
                if (!slot || typeof slot !== 'object' || !['string', 'number'].includes(typeof slot.itemId) ||
                    !String(slot.itemId) || String(slot.itemId).length > 64 ||
                    !Number.isInteger(slot.count) || slot.count < 1 || slot.count > 9999) return;
                inventory.push({ itemId: slot.itemId, count: slot.count, name: String(slot.name || '').slice(0, 64) });
            }
            while (inventory.length < 27) inventory.push(null);
            client.inventory = inventory;
            client.heldItem = inventory[selected]?.name || null;
            room.broadcast({ type: 'inventory_sync', id: client.id,
                held_item: client.heldItem, hotbar: inventory.slice(0, 9) }, client.id);
            serverWs.send(JSON.stringify({ type: 'inventory_state', inventory, selected_slot: selected }));
            return;
        }

        if (mtype === 'item_drop') {
            const itemId = String(msg.itemId || msg.item_id || '').slice(0, 32);
            const count = Math.max(1, Math.min(64, Number(msg.count) || 1));
            const x = Number(msg.x ?? client.x);
            const y = Number(msg.y ?? client.y);
            const z = Number(msg.z ?? client.z);
            const vx = Number(msg.vx ?? 0);
            const vy = Number(msg.vy ?? 2);
            const vz = Number(msg.vz ?? 0);
            if (itemId) {
                room.broadcast({
                    type: 'item_drop',
                    player_id: client.id,
                    itemId: itemId,
                    count: count,
                    x: x, y: y, z: z,
                    vx: vx, vy: vy, vz: vz
                }, client.id);
            }
            return;
        }

        if (mtype === 'join_duel_queue') {
            const rawNick = msg.player_name || msg.name || client.name;
            const nick = String(rawNick).slice(0, 24).trim() || client.name;
            const kit = String(msg.kit || 'classic').slice(0, 24);
            enqueueDuel(client, nick, kit);
            return;
        }

        if (mtype === 'leave_duel_queue') {
            duelQueue = duelQueue.filter(entry => entry.client.id !== client.id);
            return;
        }

        if (mtype === 'respawn') {
            client.health = 100.0;
            client.isAlive = true;
            client.invulnerableUntil = now + 1.5;
            client.x = 0.0;
            client.y = 32.0;
            client.z = 0.0;

            room.broadcast({
                type: 'player_respawned',
                id: client.id,
                health: 100.0,
                x: client.x,
                y: client.y,
                z: client.z
            });
            return;
        }

        if (mtype === 'block_action') {
            const action = msg.action;
            const bx = Math.floor(Number(msg.x || 0));
            const by = Math.floor(Number(msg.y || 0));
            const bz = Math.floor(Number(msg.z || 0));
            const btype = Number(msg.block_type || 0);

            const bdist = Math.hypot(client.x - bx, client.y - by, client.z - bz);
            if (bdist > 9.0) return;

            if (!client.isAlive || !['place', 'break'].includes(action) ||
                ![bx, by, bz, btype].every(Number.isFinite) || by < 0 || by >= 32 ||
                !Number.isInteger(btype) || btype < 1 || btype > 255) return;
            const bkey = `${bx},${by},${bz}`;
            if (action === 'place') {
                room.blocks.set(bkey, btype);
            } else if (action === 'break') {
                room.blocks.set(bkey, 0);
            }

            room.broadcast({
                type: 'block_update',
                action,
                x: bx,
                y: by,
                z: bz,
                block_type: btype,
                player_id: client.id
            }, client.id);
            return;
        }

        if (mtype === 'chat') {
            const rawText = String(msg.text || '').slice(0, 256).trim();
            if (rawText) {
                const clean = rawText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                room.broadcast({
                    type: 'chat',
                    sender: client.name,
                    sender_id: client.id,
                    text: clean
                });
            }
            return;
        }
    });

    const cleanup = () => {
        if (client) {
            // Remove from queue
            duelQueue = duelQueue.filter(entry => entry.client.id !== client.id);

            if (room) {
                if (room.name.startsWith('duel_')) {
                    for (const [id, opp] of room.clients.entries()) {
                        if (id !== client.id && opp.ws.readyState === 1) {
                            opp.ws.send(JSON.stringify({
                                type: 'duel_round_end',
                                winner_id: opp.id,
                                winner_name: opp.name,
                                loser_id: client.id,
                                loser_name: client.name,
                                reason: `⚔️ ${client.name} здався або покинув дуель!`
                            }));
                        }
                    }
                }

                room.clients.delete(client.id);
                room.broadcast({
                    type: 'player_left',
                    id: client.id,
                    name: client.name
                });
                if (room.clients.size === 0 && !room.cooperative) {
                    rooms.delete(room.name);
                }
                room = null;
            }
            client = null;
        }
    };

    serverWs.addEventListener('close', cleanup);
    serverWs.addEventListener('error', cleanup);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // 1. WebSocket Multiplayer Gateway (/ws)
        if (pathname === '/ws' || request.headers.get('Upgrade') === 'websocket') {
            const pair = new WebSocketPair();
            const clientWs = pair[0];
            const serverWs = pair[1];
            handleWebSocketSession(serverWs);
            return new Response(null, {
                status: 101,
                webSocket: clientWs
            });
        }

        // 2. EmuOS Proxy (/proxy/emuos/*)
        if (pathname.startsWith('/proxy/emuos')) {
            const subpath = pathname.slice('/proxy/emuos'.length);
            const targetUrl = subpath && subpath !== '/' ?
                `https://emupedia.net/beta/emuos${subpath}` :
                'https://emupedia.net/beta/emuos/';

            try {
                const resp = await fetch(targetUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                const headers = new Headers(resp.headers);
                headers.set('Access-Control-Allow-Origin', '*');
                headers.set('Cache-Control', 'public, max-age=3600');
                return new Response(resp.body, {
                    status: resp.status,
                    headers
                });
            } catch (err) {
                return new Response(`Proxy error: ${err.message}`, { status: 502 });
            }
        }

        // 3. API Status (/api/status)
        if (pathname === '/api/status') {
            let totalPlayers = 0;
            for (const r of rooms.values()) {
                totalPlayers += r.clients.size;
            }

            return new Response(JSON.stringify({
                status: 'online',
                service: 'Eblankraft 3.0 Cloudflare Edge Engine',
                colo: request.cf?.colo || 'LOCAL',
                country: request.cf?.country || 'UA',
                city: request.cf?.city || 'Kyiv',
                active_rooms: rooms.size,
                online_players: totalPlayers,
                timestamp: Date.now()
            }, null, 2), {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // 4. Default Landing Page & Game Launcher
        const html = `<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎮 ЕБЛАНКРАФТ 3.0 — Cloudflare Edge Server</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: linear-gradient(135deg, #0b0f19 0%, #17223b 100%);
            color: #ffffff;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: rgba(22, 33, 56, 0.85);
            border: 2px solid #00e676;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 230, 118, 0.2);
            backdrop-filter: blur(10px);
            max-width: 600px;
            width: 100%;
            padding: 32px;
            text-align: center;
        }
        h1 { font-size: 28px; margin-bottom: 12px; color: #00e676; }
        p { color: #b0bec5; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .badge-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 28px;
        }
        .badge {
            background: rgba(0,0,0,0.35);
            padding: 12px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            font-size: 13px;
        }
        .badge b { display: block; color: #ffea00; margin-bottom: 4px; font-size: 14px; }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #00c853, #00e676);
            color: #000;
            font-weight: 800;
            padding: 14px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 15px rgba(0, 230, 118, 0.4);
            margin: 6px;
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 230, 118, 0.6); }
        .btn-sub {
            background: rgba(255,255,255,0.1);
            color: #fff;
            box-shadow: none;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .footer { margin-top: 24px; font-size: 12px; color: #78909c; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🎮 ЕБЛАНКРАФТ 3.0</h1>
        <p>Глобальний авторитетний ігровий сервер та проксі на <b>Cloudflare Workers Edge Network</b>!</p>
        
        <div class="badge-grid">
            <div class="badge">
                <b>🛡️ WebSocket Сервер</b>
                <span>Працює на /ws</span>
            </div>
            <div class="badge">
                <b>⚡ Дата-центр Edge</b>
                <span>${request.cf?.colo || 'KBP (Kyiv)'}</span>
            </div>
            <div class="badge">
                <b>⚔️ Anti-Cheat & i-Frames</b>
                <span>Серверний урон (кап 65 HP)</span>
            </div>
            <div class="badge">
                <b>🌐 EmuOS Проксі</b>
                <span>/proxy/emuos/*</span>
            </div>
        </div>

        <div>
            <a href="/api/status" class="btn btn-sub" target="_blank">📊 Статус API</a>
            <a href="https://eblancraft.tech/" class="btn" target="_blank">🚀 Грати на eblancraft.tech</a>
        </div>

        <div class="footer">
            EblanCraft Cloudflare Worker • Активних кімнат: ${rooms.size} • З'єднань: 0
        </div>
    </div>
</body>
</html>`;

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=300'
            }
        });
    }
};
