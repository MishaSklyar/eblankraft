#!/usr/bin/env python3
"""
EBLANKRAFT 3.0 — Dedicated Hybrid HTTP & Authoritative WebSocket Game Server
Port 8081: HTTP Static Server + EmuOS Proxy
Port 8082: Authoritative WebSocket Game Server (Anti-Cheat, Anti-One-Tap, Anti-Crash Sandbox)
"""

import http.server
import socketserver
import socket
import os
import sys
import threading
import time
import math
import struct
import hashlib
import base64
import json
import queue
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pvp_arena import ArenaService
import urllib.request
from collections import deque

HTTP_PORT = 8081
WS_PORT = 8082
# Project directory resolution
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

# Authoritative Weapon Damage Table (Matches js/items.js)
WEAPON_DAMAGE = {
    'fist': 5.0,
    # Pickaxes
    'wood_pickaxe': 6.0,
    'stone_pickaxe': 9.0,
    'iron_pickaxe': 12.0,
    'diamond_pickaxe': 16.0,
    'netherite_pickaxe': 20.0,
    'eblan_pickaxe': 28.0,
    # Swords (Diamond was 140 -> now 36! Eblan was 400 -> now 55!)
    'wood_sword': 18.0,
    'stone_sword': 24.0,
    'iron_sword': 30.0,
    'diamond_sword': 36.0,
    'netherite_sword': 42.0,
    'eblan_sword': 55.0,
    # Firearms & Explosives
    'ak47': 24.0,
    'm4a1': 22.0,
    'awp': 62.0,
    'shotgun': 42.0,
    'deagle': 35.0,
    'glock': 15.0,
    'mp5': 17.0,
    'rpg': 65.0,
    'grenade': 45.0,
}

DUEL_KITS = {
    'classic': {'item': 'diamond_sword', 'damage': 30.0, 'cooldown': 0.55, 'armor': 0.2},
    'shawarma': {'item': None, 'damage': 12.0, 'cooldown': 0.3, 'armor': 0.0},
}
DUEL_MAP = {'floorY': 5, 'min': -18, 'max': 18, 'wallHeight': 5, 'obstacles': []}

# --- HTTP SERVER WITH PROXY ---
class HTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path.startswith('/proxy/emuos'):
            target_path = self.path[len('/proxy/emuos'):]
            if not target_path or target_path == '/':
                target_url = 'https://emupedia.net/beta/emuos/'
            else:
                target_url = 'https://emupedia.net/beta/emuos' + target_path
            try:
                req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = resp.read()
                    content_type = resp.headers.get('Content-Type', 'text/html')
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(data)
                    return
            except Exception as e:
                self.send_response(502)
                self.end_headers()
                self.wfile.write(f"Proxy error: {e}".encode())
                return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Silent or lightweight HTTP logging
        pass

# --- AUTHORITATIVE WEBSOCKET GAME SERVER ---
class GameRoom:
    def __init__(self, name, mode='survival'):
        self.name = name
        self.cooperative = name.startswith('coop_')
        self.mode = 'creative' if mode == 'creative' else 'survival'
        self.seed = int.from_bytes(hashlib.sha256(name.encode()).digest()[:4], 'big') % 899999 + 100000
        self.clients = {}  # id -> WSClient
        self.blocks = {}   # (x, y, z) -> block_type
        self.lock = threading.RLock()

    def add_client(self, client):
        with self.lock:
            self.clients[client.id] = client

    def remove_client(self, client_id):
        with self.lock:
            return self.clients.pop(client_id, None)

    def broadcast(self, message_obj, exclude_id=None):
        payload = json.dumps({**message_obj, 'room': self.name})
        encoded = WSClient.encode_frame(payload)
        with self.lock:
            recipients = list(self.clients.values())
        for c in recipients:
            if exclude_id and c.id == exclude_id:
                continue
            c.send_raw(encoded)


class WSClient:
    _id_counter = 1000

    def __init__(self, sock, addr, server):
        WSClient._id_counter += 1
        self.id = f"p_{WSClient._id_counter}"
        self.sock = sock
        self.addr = addr
        self.server = server
        self.room = None
        self.name = f"Боєць_{self.id[-4:]}"
        self.skin = "classic"
        self.x = 0.0
        self.y = 32.0
        self.z = 0.0
        self.yaw = 0.0
        self.pitch = 0.0
        self.health = 100.0
        self.max_health = 100.0
        self.is_alive = True
        self.invulnerable_until = 0.0
        self.last_attack_time = 0.0
        self.held_item = None
        self.inventory = [None] * 27
        self.selected_slot = 0
        self.armor_reduction = 0.68  # 68% Diamond Armor damage mitigation
        self.armor_defense = 20
        self.packet_times = deque(maxlen=120)
        self.is_closed = False
        self.send_lock = threading.Lock()
        self.close_lock = threading.Lock()
        self.owns_connection_slot = False
        self.arena_mode = False
        self.outbox = queue.Queue(maxsize=64)

    @staticmethod
    def encode_frame(payload, opcode=0x01):
        data = payload.encode('utf-8') if isinstance(payload, str) else payload
        length = len(data)
        header = bytearray([0x80 | (opcode & 0x0F)])
        if length < 126:
            header.append(length)
        elif length < 65536:
            header.append(126)
            header.extend(struct.pack('!H', length))
        else:
            header.append(127)
            header.extend(struct.pack('!Q', length))
        return bytes(header) + data

    def send_raw(self, frame_bytes):
        if self.is_closed:
            return
        with self.send_lock:
            try:
                self.sock.sendall(frame_bytes)
            except Exception:
                self.close()

    def send_json(self, obj):
        try:
            frame = self.encode_frame(json.dumps(obj, allow_nan=False))
            if self.arena_mode:
                self.outbox.put_nowait(frame)
            else:
                self.send_raw(frame)
        except Exception:
            self.close()

    def flush_outbox(self):
        while not self.is_closed:
            try:
                frame = self.outbox.get(timeout=0.5)
            except queue.Empty:
                continue
            self.send_raw(frame)

    def close(self):
        with self.close_lock:
            if self.is_closed:
                return
            self.is_closed = True
        if self.owns_connection_slot:
            self.owns_connection_slot = False
            self.server.connection_slots.release()
        try:
            self.sock.close()
        except Exception:
            pass

        # Remove from duel queue if queued
        if hasattr(self.server, 'remove_from_duel_queue'):
            self.server.remove_from_duel_queue(self)

        if self.room:
            if self.room.name.startswith("duel_"):
                self.server.forfeit_duel(self)

            self.room.remove_client(self.id)
            self.room.broadcast({
                'type': 'player_left',
                'id': self.id,
                'name': self.name
            })
            self.server.remove_empty_duel_room(self.room)
            self.room = None

    def read_exact(self, n):
        buf = bytearray()
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                return None
            buf.extend(chunk)
        return bytes(buf)

    def read_frame(self):
        header = self.read_exact(2)
        if not header:
            return None, None
        b1, b2 = header[0], header[1]
        opcode = b1 & 0x0F
        is_masked = bool(b2 & 0x80)
        if not is_masked or not (b1 & 0x80) or (b1 & 0x70) or opcode not in (1, 8, 9, 10):
            self.close()
            return None, None
        length = b2 & 0x7F
        if length == 126:
            ext = self.read_exact(2)
            if not ext: return None, None
            length = struct.unpack('!H', ext)[0]
        elif length == 127:
            ext = self.read_exact(8)
            if not ext: return None, None
            length = struct.unpack('!Q', ext)[0]

        # Max frame safety check (64KB) - Anti-DoS
        if length > (2048 if self.arena_mode else 65536) or (opcode >= 8 and length > 125):
            sys.stderr.write(f"[WS Security] Client {self.id} exceeded max frame size ({length} bytes). Dropping connection.\n")
            self.close()
            return None, None

        mask = self.read_exact(4) if is_masked else None
        if is_masked and not mask:
            return None, None

        payload = self.read_exact(length) if length > 0 else b''
        if payload is None:
            return None, None

        if is_masked and mask:
            payload = bytearray(b ^ mask[i % 4] for i, b in enumerate(payload))
        return opcode, bytes(payload)

    def do_handshake(self):
        req = b''
        while b'\r\n\r\n' not in req:
            chunk = self.sock.recv(1024)
            if not chunk or len(req) > 8192:
                return False
            req += chunk
        lines = req.decode('latin1', errors='ignore').split('\r\n')
        headers = {}
        for line in lines[1:]:
            if ':' in line:
                k, v = line.split(':', 1)
                headers[k.strip().lower()] = v.strip()
        key = headers.get('sec-websocket-key')
        if not key:
            return False
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        resp = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
        )
        self.sock.sendall(resp.encode('latin1'))
        return True

    def handle(self):
        try:
            if not self.do_handshake():
                self.close()
                return

            threading.Thread(target=self.flush_outbox, daemon=True).start()

            while not self.is_closed:
                opcode, payload = self.read_frame()
                if opcode is None or opcode == 0x08:  # Close frame
                    break
                now = time.monotonic()
                self.packet_times.append(now)
                if len(self.packet_times) == 120 and now - self.packet_times[0] < 1.0:
                    break
                if opcode == 0x09:  # Ping
                    self.send_raw(self.encode_frame(payload, opcode=0x0A))
                    continue
                if opcode == 0x0A:  # Pong
                    continue
                if opcode != 0x01:  # Only text supported
                    continue

                try:
                    msg = json.loads(payload.decode('utf-8'), parse_constant=lambda value: None)
                except Exception:
                    # Ignore malformed JSON - Anti-Crash
                    continue

                self.server.process_message(self, msg)
        except Exception as e:
            pass
        finally:
            self.close()


class AuthoritativeGameServer:
    def __init__(self, host='0.0.0.0', port=WS_PORT):
        self.host = host
        self.port = port
        self.rooms = {}
        self.rooms_lock = threading.RLock()
        self.duel_queue = []
        self.duel_queue_lock = threading.RLock()
        self.running = False
        self.arena = ArenaService()
        self.connection_slots = threading.BoundedSemaphore(256)

    def get_or_create_room(self, name, mode='survival'):
        with self.rooms_lock:
            if name not in self.rooms:
                self.rooms[name] = GameRoom(name, mode)
            return self.rooms[name]

    def remove_from_duel_queue(self, client):
        with self.duel_queue_lock:
            self.duel_queue = [q for q in self.duel_queue if q['client'].id != client.id]

    def enqueue_duel(self, client, nick, kit):
        if kit not in DUEL_KITS:
            client.send_json({'type': 'duel_error', 'message': 'Цей формат дуелі недоступний.'})
            return
        with self.duel_queue_lock:
            # Clean closed clients
            self.duel_queue = [q for q in self.duel_queue if not q['client'].is_closed]
            # Avoid duplicate enqueue
            if not any(q['client'].id == client.id for q in self.duel_queue):
                self.duel_queue.append({'client': client, 'nick': nick or client.name, 'kit': kit or 'classic'})
                sys.stderr.write(f"[Duels Queue] Client {client.id} ({nick}) joined queue. Total in queue: {len(self.duel_queue)}\n")

            client.send_json({'type': 'duel_queue_status', 'kit': kit,
                              'waiting': sum(q['kit'] == kit for q in self.duel_queue)})
            compatible = [q for q in self.duel_queue if q['kit'] == kit]
            if len(compatible) >= 2:
                entry1, entry2 = compatible[:2]
                self.duel_queue.remove(entry1)
                self.duel_queue.remove(entry2)
                if not entry1['client'].is_closed and not entry2['client'].is_closed:
                    t = threading.Thread(target=self.start_duel_match, args=(entry1, entry2), daemon=True)
                    t.start()

    def start_duel_match(self, entry1, entry2):
        p1 = entry1['client']
        p2 = entry2['client']
        kit = entry1['kit']
        if (kit != entry2['kit'] or kit not in DUEL_KITS or p1.is_closed or p2.is_closed
                or not p1.room or p1.room.name != 'pvp_arena'
                or not p2.room or p2.room.name != 'pvp_arena'):
            return
        room_name = f"duel_{time.time_ns()}_{p1.id}_{p2.id}"
        room = self.get_or_create_room(room_name)
        room.duel_kit, room.duel_phase, room.duel_ready = kit, 'loading', set()
        room.duel_result = None

        # Remove from previous rooms
        if p1.room and p1.room.name != room_name:
            p1.room.remove_client(p1.id)
        if p2.room and p2.room.name != room_name:
            p2.room.remove_client(p2.id)

        p1.room = room
        p2.room = room
        p1.name = entry1['nick']
        p2.name = entry2['nick']
        p1.health = 100.0
        p2.health = 100.0
        p1.is_alive = True
        p2.is_alive = True
        for player in (p1, p2):
            player.armor_reduction = DUEL_KITS[kit]['armor']
            player.held_item = DUEL_KITS[kit]['item']
            player.last_attack_time = 0.0
            player.invulnerable_until = 0.0
            player.duel_blocking = False

        # Arena spawns: Player 1 at -14 facing +Z (math.pi), Player 2 at +14 facing -Z (0.0)
        p1.x, p1.y, p1.z, p1.yaw = 0.0, 5.0, -14.0, math.pi
        p2.x, p2.y, p2.z, p2.yaw = 0.0, 5.0, 14.0, 0.0

        room.add_client(p1)
        room.add_client(p2)

        sys.stderr.write(f"[Duels Match] Started match {room_name}: {p1.name} vs {p2.name}\n")

        # Send match notifications
        p1.send_json({
            'type': 'duel_matched',
            'room': room_name,
            'kit': kit, 'map': DUEL_MAP,
            'opponent': {'id': p2.id, 'name': p2.name, 'skin': p2.skin},
            'spawn': {'x': 0.0, 'y': 5.0, 'z': -14.0, 'yaw': math.pi}
        })
        p2.send_json({
            'type': 'duel_matched',
            'room': room_name,
            'kit': kit, 'map': DUEL_MAP,
            'opponent': {'id': p1.id, 'name': p1.name, 'skin': p1.skin},
            'spawn': {'x': 0.0, 'y': 5.0, 'z': 14.0, 'yaw': 0.0}
        })

        # Synchronize remote player representations
        p1.send_json({
            'type': 'player_joined',
            'player': {
                'id': p2.id, 'name': p2.name, 'skin': p2.skin,
                'x': p2.x, 'y': p2.y, 'z': p2.z, 'yaw': p2.yaw, 'pitch': 0.0,
                'health': 100.0, 'held_item': DUEL_KITS[kit]['item'], 'is_alive': True
            }
        })
        p2.send_json({
            'type': 'player_joined',
            'player': {
                'id': p1.id, 'name': p1.name, 'skin': p1.skin,
                'x': p1.x, 'y': p1.y, 'z': p1.z, 'yaw': p1.yaw, 'pitch': 0.0,
                'health': 100.0, 'held_item': DUEL_KITS[kit]['item'], 'is_alive': True
            }
        })

    def countdown_duel(self, room):
        for sec in (3, 2, 1, 0):
            with room.lock:
                if room.duel_phase != 'countdown': return
                if sec == 0: room.duel_phase = 'live'
                room.broadcast({'type': 'duel_countdown', 'seconds': sec})
            if sec: time.sleep(1.0)

    def finish_duel(self, room, winner, loser, reason):
        with room.lock:
            if getattr(room, 'duel_phase', None) == 'finished': return False
            room.duel_phase = 'finished'
            room.duel_result = {'type': 'duel_round_end', 'winner_id': winner.id,
                'winner_name': winner.name, 'loser_id': loser.id, 'loser_name': loser.name,
                'reason': reason}
            room.broadcast(room.duel_result)
            return True

    def forfeit_duel(self, client):
        room = client.room
        if room and room.name.startswith('duel_'):
            opponents = [c for c in room.clients.values() if c is not client and not c.is_closed]
            if opponents: self.finish_duel(room, opponents[0], client, f'{client.name} покинув арену.')

    def remove_empty_duel_room(self, room):
        if room.name.startswith('duel_') and not room.clients:
            with self.rooms_lock:
                self.rooms.pop(room.name, None)

    def process_message(self, client, msg):
        if not isinstance(msg, dict):
            return
        if client.arena_mode or msg.get('type') == 'arena_join':
            self.arena.process(client, msg)
            return
        mtype = msg.get('type')
        now = time.time()

        if mtype == 'ping':
            client_time = msg.get('client_time', 0)
            client.send_json({
                'type': 'pong',
                'client_time': client_time,
                'server_time': int(now * 1000)
            })
            return

        if mtype == 'join':
            room_name = str(msg.get('room', 'pvp_arena'))[:32]
            name = str(msg.get('name', 'Боєць'))[:24].strip() or 'Боєць'
            skin = str(msg.get('skin', 'classic'))[:32]
            
            room = self.get_or_create_room(room_name, msg.get('mode'))
            if client.room is not room:
                client.x, client.y, client.z = 0.0, (5.05 if room_name == 'pvp_arena' else 32.0), 0.0
            if client.room and client.room is not room:
                self.forfeit_duel(client)
                client.room.remove_client(client.id)
                client.room.broadcast({'type': 'player_left', 'id': client.id, 'name': client.name})
                self.remove_empty_duel_room(client.room)
            client.room = room
            client.name = name
            client.skin = skin
            client.health = 100.0
            client.is_alive = True
            room.add_client(client)

            # Build list of existing players in room
            existing = []
            with room.lock:
                for c in room.clients.values():
                    if c.id != client.id:
                        existing.append({
                            'id': c.id,
                            'name': c.name,
                            'skin': c.skin,
                            'x': c.x,
                            'y': c.y,
                            'z': c.z,
                            'yaw': c.yaw,
                            'pitch': c.pitch,
                            'health': c.health,
                            'held_item': c.held_item,
                            'is_alive': c.is_alive
                        })

                blocks = [{'x': x, 'y': y, 'z': z, 'block_type': block}
                          for (x, y, z), block in room.blocks.items()]

            # Welcome client
            client.send_json({
                'type': 'welcome',
                'id': client.id,
                'room': room_name,
                'players': existing,
                'blocks': blocks,
                'world': {'seed': room.seed, 'mode': room.mode, 'type': 'normal'} if room.cooperative else None,
                'pvp': not room.cooperative,
                'health': client.health
            })

            # Broadcast to others
            room.broadcast({
                'type': 'player_joined',
                'player': {
                    'id': client.id,
                    'name': client.name,
                    'skin': client.skin,
                    'x': client.x,
                    'y': client.y,
                    'z': client.z,
                    'yaw': client.yaw,
                    'pitch': client.pitch,
                    'health': client.health,
                    'held_item': client.held_item,
                    'is_alive': client.is_alive
                }
            }, exclude_id=client.id)
            return

        if mtype == 'leave':
            if client.room:
                old_room = client.room
                self.forfeit_duel(client)
                old_room.remove_client(client.id)
                client.room = None
                old_room.broadcast({'type': 'player_left', 'id': client.id, 'name': client.name})
                self.remove_empty_duel_room(old_room)
            self.remove_from_duel_queue(client)
            return

        if not client.room:
            return

        room = client.room

        if mtype == 'duel_ready' and room.name.startswith('duel_'):
            with room.lock:
                if getattr(room, 'duel_phase', None) != 'loading': return
                room.duel_ready.add(client.id)
                if len(room.duel_ready) == 2:
                    room.duel_phase = 'countdown'
                    threading.Thread(target=self.countdown_duel, args=(room,), daemon=True).start()
            return

        if mtype == 'move':
            if room.name.startswith('duel_') and room.duel_phase != 'live': return
            try:
                nx = float(msg.get('x', client.x))
                ny = float(msg.get('y', client.y))
                nz = float(msg.get('z', client.z))
                yaw = float(msg.get('yaw', client.yaw))
                pitch = float(msg.get('pitch', client.pitch))
                if not all(math.isfinite(value) for value in (nx, ny, nz, yaw, pitch)): return
                held_item = str(msg.get('held_item', ''))[:32] or None
                is_walking = bool(msg.get('is_walking', False))
                is_sprinting = bool(msg.get('is_sprinting', False))

                # Sanity speed check: prevent teleport hack (>25 blocks per packet)
                dx = nx - client.x
                dy = ny - client.y
                dz = nz - client.z
                dist_sq = dx*dx + dy*dy + dz*dz
                if dist_sq > 900.0:  # > 30 blocks
                    # Clamp position or keep previous
                    nx = client.x + (dx / math.sqrt(dist_sq)) * 30.0
                    nz = client.z + (dz / math.sqrt(dist_sq)) * 30.0

                client.x = nx
                client.y = ny
                client.z = nz
                client.yaw = yaw
                client.pitch = pitch
                client.held_item = held_item
                client.duel_blocking = bool(msg.get('is_blocking')) and held_item in ('shield', 'diamond_sword')

                room.broadcast({
                    'type': 'player_moved',
                    'id': client.id,
                    'x': client.x,
                    'y': client.y,
                    'z': client.z,
                    'yaw': client.yaw,
                    'pitch': client.pitch,
                    'held_item': client.held_item,
                    'is_walking': is_walking,
                    'is_sprinting': is_sprinting
                }, exclude_id=client.id)
            except Exception:
                pass
            return

        if mtype == 'attack':
            if room.cooperative:
                return
            # --- AUTHORITATIVE COMBAT VERIFICATION ---
            target_id = str(msg.get('target_id', ''))
            is_crit = bool(msg.get('is_crit', False))

            if not client.is_alive:
                return

            duel = room.name.startswith('duel_')
            if duel and room.duel_phase != 'live': return
            spec = DUEL_KITS[room.duel_kit] if duel else None

            with room.lock:
                target = room.clients.get(target_id)
            if not target or not target.is_alive or target.id == client.id:
                return

            # 1. Cooldown verification: minimum 200ms between attacks (smooth combos)
            if (now - client.last_attack_time) < (spec['cooldown'] if duel else 0.20):
                return

            # 2. Reach check: distance <= 6.5 blocks (generous for network latency and heights)
            dist = math.sqrt((client.x - target.x)**2 + (client.y - target.y)**2 + (client.z - target.z)**2)
            if dist > (4.8 if duel else 6.5):
                return

            # 3. Target Hurt Invulnerability (i-Frames: 300ms)
            if now < target.invulnerable_until:
                return

            # 4. Authoritative Damage Lookup (Client CANNOT dictate damage!)
            item_key = client.held_item or 'fist'
            base_damage = spec['damage'] if duel else WEAPON_DAMAGE.get(item_key, 5.0)
            if duel and client.duel_blocking: return

            # Apply crit multiplier (1.35x)
            final_damage = base_damage * (1.35 if is_crit else 1.0)

            # Apply target's armor reduction (e.g. 68% for full Diamond armor)
            armor_red = getattr(target, 'armor_reduction', 0.68)
            final_damage = final_damage * (1.0 - armor_red)
            if duel and room.duel_kit == 'classic' and getattr(target, 'duel_blocking', False):
                facing = (-math.sin(target.yaw), -math.cos(target.yaw))
                toward = (client.x - target.x, client.z - target.z)
                if facing[0] * toward[0] + facing[1] * toward[1] > 0:
                    final_damage *= 0.35 if target.held_item == 'shield' else 0.65

            # Anti-One-Tap Cap: non-void single hit damage is capped at 65.0 HP max!
            final_damage = min(65.0, final_damage)
            final_damage = max(1.0, round(final_damage, 1))

            # 5. Apply Damage & set i-frames
            client.last_attack_time = now
            target.invulnerable_until = now + (0.18 if duel else 0.40)
            target.health = max(0.0, round(target.health - final_damage, 1))

            # Compute knockback vector
            kb_x = 0.0
            kb_z = 0.0
            if dist > 0.001:
                kb_x = round(((target.x - client.x) / dist) * 0.45, 3)
                kb_z = round(((target.z - client.z) / dist) * 0.45, 3)

            # 6. Broadcast Authoritative Damage Event
            room.broadcast({
                'type': 'damage_event',
                'target_id': target.id,
                'attacker_id': client.id,
                'attacker_name': client.name,
                'damage': final_damage,
                'health_remaining': target.health,
                'is_crit': is_crit,
                'knockback': {'x': kb_x, 'y': 0.28, 'z': kb_z}
            })

            # 7. Check Death
            if target.health <= 0:
                target.is_alive = False
                room.broadcast({
                    'type': 'death_event',
                    'victim_id': target.id,
                    'victim_name': target.name,
                    'killer_id': client.id,
                    'killer_name': client.name,
                    'message': f"⚔️ {client.name} ліквідував {target.name}!"
                })

                if room.name.startswith("duel_"):
                    self.finish_duel(room, client, target, f'{client.name} переміг у двобої.')
            return

        if mtype == 'inventory_sync':
            # Client-owned inventory snapshot; validate before storing or relaying.
            slots = msg.get('inventory', msg.get('hotbar', []))
            selected = msg.get('selected_slot', 0)
            if not isinstance(slots, list) or len(slots) > 27:
                return
            if type(selected) is not int or not 0 <= selected < 9:
                return
            inventory = []
            for slot in slots:
                if slot is None:
                    inventory.append(None)
                    continue
                if not isinstance(slot, dict):
                    return
                item_id = slot.get('itemId')
                count = slot.get('count')
                if (not isinstance(item_id, (str, int)) or isinstance(item_id, bool)
                        or len(str(item_id)) > 64 or not str(item_id)
                        or type(count) is not int or not 1 <= count <= 9999):
                    return
                inventory.append({'itemId': item_id, 'count': count,
                                  'name': str(slot.get('name', ''))[:64]})
            inventory.extend([None] * (27 - len(inventory)))
            client.inventory = inventory
            client.selected_slot = selected
            held = inventory[selected]
            client.held_item = (held['name'] or None) if held else None
            room.broadcast({
                'type': 'inventory_sync', 'id': client.id,
                'held_item': client.held_item, 'hotbar': inventory[:9]
            }, exclude_id=client.id)
            client.send_json({'type': 'inventory_state', 'inventory': inventory,
                              'selected_slot': selected})
            return

        if mtype == 'item_drop':
            item_id = str(msg.get('itemId') or msg.get('item_id') or '')[:32]
            count = int(msg.get('count', 1))
            x = float(msg.get('x', client.x))
            y = float(msg.get('y', client.y))
            z = float(msg.get('z', client.z))
            vx = float(msg.get('vx', 0.0))
            vy = float(msg.get('vy', 2.0))
            vz = float(msg.get('vz', 0.0))
            if item_id:
                room.broadcast({
                    'type': 'item_drop',
                    'player_id': client.id,
                    'itemId': item_id,
                    'count': count,
                    'x': x, 'y': y, 'z': z,
                    'vx': vx, 'vy': vy, 'vz': vz
                }, exclude_id=client.id)
            return

        if mtype == 'join_duel_queue':
            raw_nick = msg.get('player_name') or msg.get('name') or client.name
            nick = str(raw_nick)[:24].strip() or client.name
            kit = str(msg.get('kit', 'classic'))[:24]
            self.enqueue_duel(client, nick, kit)
            return

        if mtype == 'leave_duel_queue':
            with self.duel_queue_lock:
                self.duel_queue = [q for q in self.duel_queue if q['client'].id != client.id]
            sys.stderr.write(f"[Duels Queue] Client {client.id} left queue. Total in queue: {len(self.duel_queue)}\n")
            return

        if mtype == 'respawn':
            if room.name.startswith('duel_'): return
            client.health = 100.0
            client.is_alive = True
            client.invulnerable_until = now + 1.5  # 1.5s spawn shield
            client.x = 0.0
            client.y = 32.0
            client.z = 0.0
            room.broadcast({
                'type': 'player_respawned',
                'id': client.id,
                'health': 100.0,
                'x': client.x,
                'y': client.y,
                'z': client.z
            })
            return

        if mtype == 'block_action':
            if room.name.startswith('duel_'): return
            action = msg.get('action')  # 'place' or 'break'
            try:
                bx = int(msg.get('x', 0))
                by = int(msg.get('y', 0))
                bz = int(msg.get('z', 0))
                block_type = int(msg.get('block_type', 0))

                if action not in ('place', 'break') or not client.is_alive:
                    return
                if not 0 <= by < 32 or not 1 <= block_type <= 255:
                    return

                # Distance check (<= 9.0 blocks reach)
                bdist = math.sqrt((client.x - bx)**2 + (client.y - by)**2 + (client.z - bz)**2)
                if bdist > 9.0:
                    return

                with room.lock:
                    if action == 'place':
                        room.blocks[(bx, by, bz)] = block_type
                    elif action == 'break':
                        # AIR is an edit too: retain it for late joiners.
                        room.blocks[(bx, by, bz)] = 0

                room.broadcast({
                    'type': 'block_update',
                    'action': action,
                    'x': bx,
                    'y': by,
                    'z': bz,
                    'block_type': block_type,
                    'player_id': client.id
                }, exclude_id=client.id)
            except Exception:
                pass
            return

        if mtype == 'tnt_spawn':
            if room.name.startswith('duel_'): return
            try:
                tnt_id = f"tnt_{int(time.time() * 1000)}_{client.id}"
                tx = float(msg.get('x', client.x))
                ty = float(msg.get('y', client.y))
                tz = float(msg.get('z', client.z))
                tvx = float(msg.get('vx', 0.0))
                tvy = float(msg.get('vy', 3.0))
                tvz = float(msg.get('vz', 0.0))
                fuse = float(msg.get('fuse', 2.2))
                room.broadcast({
                    'type': 'tnt_spawned',
                    'tnt_id': tnt_id,
                    'spawner_id': client.id,
                    'x': tx, 'y': ty, 'z': tz,
                    'vx': tvx, 'vy': tvy, 'vz': tvz,
                    'fuse': fuse
                }, exclude_id=client.id)
            except Exception:
                pass
            return

        if mtype == 'tnt_explode':
            if room.name.startswith('duel_'): return
            try:
                ex = float(msg.get('x', 0.0))
                ey = float(msg.get('y', 0.0))
                ez = float(msg.get('z', 0.0))
                radius = float(msg.get('radius', 4.0))

                room.broadcast({
                    'type': 'tnt_exploded',
                    'x': ex, 'y': ey, 'z': ez,
                    'radius': radius,
                    'source_id': client.id
                })

                # Authoritative explosion damage & knockback for players in room
                with room.lock:
                    recipients = list(room.clients.values())

                for p in recipients:
                    if room.cooperative and p.id != client.id:
                        continue
                    if not p.is_alive:
                        continue
                    p_dist = math.sqrt((p.x - ex)**2 + (p.y - ey)**2 + (p.z - ez)**2)
                    if p_dist < 8.0:
                        force = (1.0 - p_dist / 8.0) * 1.4
                        kb_x = round(((p.x - ex) / (p_dist or 1)) * force, 3)
                        kb_y = round(max(0.35, ((p.y - ey) / (p_dist or 1)) * force + 0.35), 3)
                        kb_z = round(((p.z - ez) / (p_dist or 1)) * force, 3)
                        raw_dmg = max(8.0, (1.0 - p_dist / 8.0) * 55.0)
                        armor_red = getattr(p, 'armor_reduction', 0.68)
                        dmg = round(max(3.0, raw_dmg * (1.0 - armor_red)), 1)

                        p.health = max(0.0, round(p.health - dmg, 1))
                        room.broadcast({
                            'type': 'damage_event',
                            'target_id': p.id,
                            'attacker_id': client.id,
                            'attacker_name': f"💣 Динаміт ({client.name})",
                            'damage': dmg,
                            'health_remaining': p.health,
                            'is_crit': False,
                            'knockback': {'x': kb_x, 'y': kb_y, 'z': kb_z}
                        })

                        if p.health <= 0:
                            p.is_alive = False
                            room.broadcast({
                                'type': 'death_event',
                                'victim_id': p.id,
                                'victim_name': p.name,
                                'killer_id': client.id,
                                'killer_name': client.name,
                                'message': f"💣 {p.name} підірвався на ТНТ гравця {client.name}!"
                            })
                            if room.name.startswith("duel_"):
                                room.broadcast({
                                    'type': 'duel_round_end',
                                    'winner_id': client.id,
                                    'winner_name': client.name,
                                    'loser_id': p.id,
                                    'loser_name': p.name,
                                    'reason': f"💣 {client.name} підірвав {p.name} динамітом!"
                                })
            except Exception:
                pass
            return

        if mtype == 'chat':
            text = str(msg.get('text', ''))[:256].strip()
            if text:
                # Sanitize HTML tags
                clean_text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                room.broadcast({
                    'type': 'chat',
                    'sender': client.name,
                    'sender_id': client.id,
                    'text': clean_text
                })
            return

    def start(self):
        self.running = True
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_sock.bind((self.host, self.port))
        server_sock.listen(128)
        sys.stderr.write(f"[Authoritative Server] WebSocket listener active on {self.host}:{self.port}\n")
        threading.Thread(target=self.arena.run, args=(self,), daemon=True).start()

        while self.running:
            try:
                sock, addr = server_sock.accept()
                if not self.connection_slots.acquire(blocking=False):
                    sock.close()
                    continue
                sock.settimeout(20)
                client = WSClient(sock, addr, self)
                client.owns_connection_slot = True
                t = threading.Thread(target=client.handle, daemon=True)
                t.start()
            except Exception as e:
                if not self.running:
                    break


def get_ip_addresses():
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        s.connect(('8.8.8.8', 80))
        ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if ip not in ips and not ip.startswith('127.'):
                ips.append(ip)
    except Exception:
        pass
    return ips


def main():
    os.chdir(DIRECTORY)
    ips = get_ip_addresses()

    # Start Authoritative WebSocket Game Server in background thread
    ws_server = AuthoritativeGameServer(host='0.0.0.0', port=WS_PORT)
    ws_thread = threading.Thread(target=ws_server.start, daemon=True)
    ws_thread.start()

    print("=" * 65)
    print("🎮  ЕБЛАНКРАФТ 3.0 (EBLANKRAFT 3.0 — АВТОРИТЕТНИЙ СЕРВЕР)")
    print("=" * 65)
    print(f"🚀 Веб-сервер запущено на порті:      http://0.0.0.0:{HTTP_PORT}")
    print(f"🛡️  WebSocket Ігровий Сервер (Арена): ws://0.0.0.0:{WS_PORT}")
    print("✨ Захисти: Серверний прорахунок урону, i-Frames, Anti-One-Tap, Anti-Crash")
    print(f"\n📱 Грати у локальній мережі:")
    if ips:
        for ip in ips:
            print(f"   👉 http://{ip}:{HTTP_PORT}")
    print(f"   👉 http://localhost:{HTTP_PORT}")
    print("=" * 65)
    print("Натисни Ctrl+C для зупинки.\n")

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", HTTP_PORT), HTTPHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер зупинено.")

if __name__ == "__main__":
    main()
