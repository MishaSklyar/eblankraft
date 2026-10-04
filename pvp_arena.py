"""Authoritative sword arena and the round-based Dust2 objective mode."""
import math
import re
import threading
import time
from collections import deque
from arena_map import EBLAN2_MAP, EBLAN2_COLUMNS, EBLAN2_NAV

STEP = 1 / 20
MAP = {"floorY": 8, "min": -16, "max": 16, "wallHeight": 6,
       "obstacles": [[-2, 8, -1, 2, 11, 1]]}
KIT = "diamond_sword"
MAX_PLAYERS = 16
MAX_ROOMS = 64

# Browser geometry, authoritative collision and navigation share one voxel asset.
DUST2_MAP = EBLAN2_MAP

def nearby_boxes(x, z):
    return [box for ix in range(math.floor(x - .3), math.floor(x + .3) + 1)
            for iz in range(math.floor(z - .3), math.floor(z + .3) + 1)
            for box in EBLAN2_COLUMNS.get((ix, iz), [])]

def obstacle_distance(origin, direction, distance):
    visited, nearest = set(), None
    for index in range(math.ceil(distance * 2) + 1):
        t = min(distance, index * .5)
        if nearest is not None and t > nearest + 1: break
        key = (math.floor(origin[0] + direction[0] * t), math.floor(origin[2] + direction[2] * t))
        if key in visited: continue
        visited.add(key)
        for box in EBLAN2_COLUMNS.get(key, []):
            hit = ray_box(origin, direction, box, distance)
            if hit is not None and (nearest is None or hit < nearest): nearest = hit
    return nearest


def blocked_ray(origin, direction, distance):
    return obstacle_distance(origin, direction, distance) is not None

BUY_SECONDS, ROUND_SECONDS, POST_SECONDS = 10, 85, 6
BOMB_SECONDS, PLANT_SECONDS, DEFUSE_SECONDS = 40, 3, 5
HALF_ROUNDS, WINS, TEAM_SIZE = 6, 7, 3
WEAPONS = {
    "glock": {"cost": 0, "damage": 25, "cooldown": .28, "range": 30},
    "deagle": {"cost": 700, "damage": 42, "cooldown": .42, "range": 34},
    "mp5": {"cost": 1500, "damage": 23, "cooldown": .11, "range": 28},
    "ak47": {"cost": 2700, "damage": 35, "cooldown": .12, "range": 40},
    "m4a1": {"cost": 2900, "damage": 33, "cooldown": .12, "range": 40},
    "awp": {"cost": 4750, "damage": 105, "cooldown": 1.15, "range": 52},
}
for name, (magazine, reserve, seconds) in {
    "glock": (20, 120, 2.2), "deagle": (7, 35, 2.2), "mp5": (30, 120, 2.5),
    "ak47": (30, 90, 2.5), "m4a1": (30, 90, 2.5), "awp": (10, 30, 3.5),
}.items():
    WEAPONS[name].update(magazine=magazine, reserve=reserve, reload=seconds)

for name, (label, automatic, spread, recoil, headshot, armor, falloff) in {
    "glock": ("Glock-18", False, .0035, .005, 3.6, .55, .94),
    "deagle": ("Desert Eagle", False, .002, .018, 2.5, .80, .97),
    "mp5": ("MP5", True, .004, .006, 3.0, .60, .92),
    "ak47": ("AK-47", True, .0018, .011, 4.0, .78, .98),
    "m4a1": ("M4A1", True, .0015, .008, 3.5, .72, .98),
    "awp": ("AWP", False, .0005, .025, 2.0, .95, .99),
}.items():
    WEAPONS[name].update(name=label, automatic=automatic, spread=spread, recoil=recoil,
                         headshotMultiplier=headshot, armorMultiplier=armor, rangeModifier=falloff)


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def flat_distance(player, point):
    return math.hypot(player.x - point[0], player.z - point[1])


def ray_box(origin, direction, bounds, reach):
    near, far = 0.0, reach
    for i in range(3):
        if abs(direction[i]) < 1e-9:
            if not bounds[i] <= origin[i] <= bounds[i + 3]:
                return None
        else:
            a = (bounds[i] - origin[i]) / direction[i]
            b = (bounds[i + 3] - origin[i]) / direction[i]
            near, far = max(near, min(a, b)), min(far, max(a, b))
            if near > far:
                return None
    return near


class ArenaRoom:
    """Compatibility free-for-all used by pre-Dust2 clients and old links."""
    def __init__(self, name):
        self.name, self.clients, self.lock = name, {}, threading.RLock()

    def remove_client(self, client_id):
        with self.lock:
            return self.clients.pop(client_id, None)

    def broadcast(self, message, exclude_id=None):
        for client in list(self.clients.values()):
            if client.id != exclude_id:
                client.send_json(message)


class Dust2Bot:
    """A bot is a regular server-side player, so it follows the same rules."""
    def __init__(self, bot_id, team, slot):
        self.id, self.name, self.team, self.slot = bot_id, f"{team}-BOT {slot + 1}", team, slot
        self.is_bot, self.is_closed, self.room = True, False, None
        self.money, self.losses, self.route_key, self.route, self.route_index = 800, 0, None, [], 0

    def send_json(self, _message):
        pass


class Dust2Room:
    def __init__(self, name):
        self.name, self.clients, self.players, self.lock = name, {}, {}, threading.RLock()
        self.phase, self.deadline, self.round_number = "buy", 0.0, 0
        self.score, self.target_site = {"T": 0, "CT": 0}, "A"
        self.bomb_carrier = self.bomb_position = self.bomb_planted_at = self.bomb_site = None
        self.objective_actor = self.objective_started_at = self.last_result = None
        self.match_complete = False

    def remove_client(self, client_id):
        with self.lock:
            player = self.clients.pop(client_id, None)
            self.players.pop(client_id, None)
            if self.bomb_carrier == client_id:
                self.bomb_carrier = None
                if player:
                    self.bomb_position = [player.x, player.z]
            return player

    def broadcast(self, message, exclude_id=None):
        for client in list(self.clients.values()):
            if client.id != exclude_id and not client.is_closed:
                client.send_json(message)

    def state(self, now):
        planted = self.bomb_planted_at is not None
        status = "planted" if planted else ("carried" if self.bomb_carrier else ("dropped" if self.bomb_position else "idle"))
        position = self.bomb_position or (DUST2_MAP["sites"].get(self.bomb_site) if self.bomb_site else None)
        action = ("defuse" if planted else "plant") if self.objective_actor is not None else None
        duration = DEFUSE_SECONDS if planted else PLANT_SECONDS
        elapsed = max(0, now - self.objective_started_at) if self.objective_started_at is not None else 0
        return {"phase": self.phase, "remaining": max(0, round(self.deadline - now, 1)),
                "round": self.round_number, "score": self.score.copy(), "sideSwapRound": HALF_ROUNDS + 1,
                "result": self.last_result,
                "bomb": {"status": status, "carrierId": self.bomb_carrier, "position": position,
                         "site": self.bomb_site, "actor": self.objective_actor,
                         "action": action, "progress": min(1, elapsed / duration) if action else 0,
                         "actionRemaining": max(0, round(duration - elapsed, 1)) if action else None,
                         "remaining": max(0, round(BOMB_SECONDS - (now - self.bomb_planted_at), 1)) if planted else None}}


class ArenaService:
    def __init__(self, clock=time.monotonic):
        self.clock, self.rooms, self.lock = clock, {}, threading.RLock()

    # -- Legacy mode ----------------------------------------------------------
    @staticmethod
    def state(client):
        return {"id": client.id, "name": client.name,
                "position": {"x": client.x, "y": client.y, "z": client.z},
                "velocity": {"x": client.vx, "y": client.vy, "z": client.vz},
                "yaw": client.yaw, "pitch": client.pitch, "health": client.health,
                "alive": client.is_alive, "heldItem": KIT,
                "isWalking": abs(client.vx) + abs(client.vz) > .1,
                "isSprinting": client.arena_input["sprint"], "onGround": client.on_ground,
                "seq": client.input_seq, "jumpHeld": client.jump_held, "spawn": client.spawn_id}

    def spawn(self, client, now):
        spots = [(-10, -10), (10, 10), (-10, 10), (10, -10), (0, -12), (0, 12)]
        others = [p for p in client.room.clients.values() if p is not client and p.is_alive]
        x, z = max(spots, key=lambda point: min(((point[0] - p.x) ** 2 + (point[1] - p.z) ** 2 for p in others), default=0))
        client.x, client.y, client.z = float(x), float(MAP["floorY"]), float(z)
        client.vx = client.vy = client.vz = 0.0
        client.health, client.is_alive, client.on_ground = 100.0, True, True
        client.yaw = client.pitch = 0.0
        client.invulnerable_until, client.last_attack_time = now + 1.5, now
        client.dead_since, client.last_input_time, client.attack_pending = None, now, False
        client.arena_input = {"strafe": 0, "forward": 0, "jump": False, "sprint": False, "use": False}
        client.jump_held, client.spawn_id, client.held_item = False, getattr(client, "spawn_id", 0) + 1, KIT

    @staticmethod
    def collides(x, y, z, map_data=MAP):
        if x - .3 < map_data["min"] + 1 or x + .3 > map_data["max"] - (1 if map_data is DUST2_MAP else 0):
            return True
        if z - .3 < map_data["min"] + 1 or z + .3 > map_data["max"] - (1 if map_data is DUST2_MAP else 0):
            return True
        for a, b, c, d, e, f in (nearby_boxes(x, z) if map_data is DUST2_MAP else map_data["obstacles"]):
            if x + .3 > a and x - .3 < d and y + 1.8 > b and y < e and z + .3 > c and z - .3 < f:
                return True
        return False

    def move(self, client, now):
        if not client.is_alive:
            client.vx = client.vy = client.vz = 0.0
            return
        control = client.arena_input
        fresh = now - client.last_input_time <= .25
        sx, fw = (control["strafe"], control["forward"]) if fresh else (0, 0)
        length, speed = max(1, math.hypot(sx, fw)), 7.5 if control["sprint"] else 4.5
        client.vx = (sx * math.cos(client.yaw) - fw * math.sin(client.yaw)) / length * speed
        client.vz = (-sx * math.sin(client.yaw) - fw * math.cos(client.yaw)) / length * speed
        jump = fresh and control["jump"]
        if jump and not client.jump_held and client.on_ground:
            client.vy, client.on_ground = 8.5, False
        client.jump_held = jump
        self._move_vertical_and_horizontal(client, MAP)

    def _move_vertical_and_horizontal(self, client, map_data):
        client.vy = max(-30, client.vy - 22 * STEP)
        nx, nz = client.x + client.vx * STEP, client.z + client.vz * STEP
        if not self.collides(nx, client.y, client.z, map_data): client.x = nx
        elif map_data is DUST2_MAP and client.on_ground and not self.collides(nx, client.y + 1, client.z, map_data): client.x, client.y = nx, client.y + 1
        else: client.vx = 0
        if not self.collides(client.x, client.y, nz, map_data): client.z = nz
        elif map_data is DUST2_MAP and client.on_ground and not self.collides(client.x, client.y + 1, nz, map_data): client.z, client.y = nz, client.y + 1
        else: client.vz = 0
        ny = client.y + client.vy * STEP
        if ny <= map_data["floorY"]:
            client.y, client.vy, client.on_ground = float(map_data["floorY"]), 0.0, True
        elif not self.collides(client.x, ny, client.z, map_data):
            client.y, client.on_ground = ny, False
        else:
            if client.vy < 0:
                tops = [box[4] for box in map_data["obstacles"] if box[0] - .3 < client.x < box[3] + .3
                        and box[2] - .3 < client.z < box[5] + .3 and box[4] <= client.y]
                client.y, client.on_ground = max(tops, default=client.y), True
            client.vy = 0.0

    def attack(self, client, room, now):
        if not client.attack_pending:
            return None
        client.attack_pending = False
        if not client.is_alive or now - client.last_attack_time < .55 or now - client.last_input_time > .25:
            return None
        client.last_attack_time = now
        origin = (client.x, client.y + 1.62, client.z)
        direction = (-math.sin(client.yaw) * math.cos(client.pitch), math.sin(client.pitch), -math.cos(client.yaw) * math.cos(client.pitch))
        hits = []
        for target in room.clients.values():
            if target is client or not target.is_alive: continue
            distance = ray_box(origin, direction, (target.x - .3, target.y, target.z - .3, target.x + .3, target.y + 1.8, target.z + .3), 3.5)
            if distance is not None: hits.append((distance, target))
        if not hits: return None
        distance, target = min(hits, key=lambda item: item[0])
        if any(ray_box(origin, direction, box, distance) is not None for box in MAP["obstacles"]) or now < target.invulnerable_until:
            return None
        target.health, target.invulnerable_until = max(0, target.health - 18), now + .4
        if not target.health: target.is_alive, target.dead_since = False, now
        return {"type": "arena_hit", "attackerId": client.id, "targetId": target.id,
                "damage": 18, "health": target.health, "alive": target.is_alive}

    # -- Dust2 setup and economy ---------------------------------------------
    def _new_dust_player(self, player, team, now):
        player.team, player.is_bot = team, getattr(player, "is_bot", False)
        player.money, player.losses, player.armor, player.primary, player.secondary, player.weapon = 800, 0, False, None, "glock", "glock"
        player.kills, player.deaths, player.shots_fired, player.burst_count = 0, 0, 0, 0
        player.weapon_ammo = {}
        player.target_id, player.target_seen_at = None, None
        player.x = player.z = 0.0; player.y = float(DUST2_MAP["floorY"])
        player.vx = player.vy = player.vz = 0.0
        player.health, player.is_alive, player.on_ground = 100.0, False, True
        player.yaw = player.pitch = 0.0
        player.input_seq, player.jump_held, player.spawn_id = -1, False, 0
        player.dead_since, player.last_attack_time, player.last_input_time = now, -math.inf, now
        player.attack_pending, player.objective = False, "spectating"
        self._refill_ammo(player)
        player.arena_input = {"strafe": 0, "forward": 0, "jump": False, "sprint": False, "use": False}

    def dust_state(self, player, now=None):
        now = self.clock() if now is None else now
        return {"id": player.id, "name": player.name, "team": player.team, "bot": bool(getattr(player, "is_bot", False)),
                "position": {"x": player.x, "y": player.y, "z": player.z},
                "velocity": {"x": player.vx, "y": player.vy, "z": player.vz},
                "yaw": player.yaw, "pitch": player.pitch, "health": player.health, "alive": player.is_alive,
                "money": player.money, "armor": player.armor, "heldItem": player.weapon,
                "primary": player.primary, "secondary": player.secondary,
                "slot": 1 if player.weapon == player.primary else 2, "kills": player.kills, "deaths": player.deaths,
                "ammo": player.ammo, "reserveAmmo": player.reserve_ammo, "reloading": player.reload_until is not None,
                "reloadRemaining": max(0, round(player.reload_until - now, 2)) if player.reload_until is not None else 0,
                "isWalking": abs(player.vx) + abs(player.vz) > .1, "isSprinting": player.arena_input["sprint"],
                "onGround": player.on_ground, "seq": player.input_seq, "jumpHeld": player.jump_held,
                "spawn": player.spawn_id, "hasBomb": player.id == player.room.bomb_carrier,
                "objective": player.objective}

    def _join_dust(self, client, msg, now):
        name = msg.get("room", "dust2")
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,32}", name):
            return [(client, {"type": "arena_error", "message": "Invalid room code"})]
        room = self.rooms.get(name)
        if room is None:
            if len(self.rooms) >= MAX_ROOMS: return [(client, {"type": "arena_error", "message": "Arena is full"})]
            room = self.rooms[name] = Dust2Room(name)
        if not isinstance(room, Dust2Room) or len(room.clients) >= MAX_PLAYERS:
            return [(client, {"type": "arena_error", "message": "Dust2 room is full"})]
        count = {team: sum(p.team == team for p in room.clients.values()) for team in ("T", "CT")}
        client.room, client.name = room, (msg.get("name", "Player")[:24].strip() if isinstance(msg.get("name", "Player"), str) else "Player") or "Player"
        self._new_dust_player(client, "T" if count["T"] <= count["CT"] else "CT", now)
        room.clients[client.id] = room.players[client.id] = client
        if room.round_number == 0: self._begin_round(room, now)
        elif room.phase == "buy":
            teammates = [p for p in room.players.values() if p.team == client.team and p is not client]
            replacement = next((p for p in reversed(teammates) if getattr(p, "is_bot", False)), None)
            slot = next((i for i, point in enumerate(DUST2_MAP["spawns"][client.team])
                         if replacement and abs(point[0] - replacement.x) < .1 and abs(point[2] - replacement.z) < .1), len(teammates))
            self._ensure_bots(room, now)
            self._spawn_dust(client, now, slot)
            if replacement and room.bomb_carrier == replacement.id: room.bomb_carrier = client.id
        return [(client, {"type": "arena_welcome", "id": client.id, "room": name, "map": DUST2_MAP,
                          "kit": "glock", "mode": "dust2", "players": [self.dust_state(p) for p in room.players.values()],
                          "weaponSpecs": {weapon: spec.copy() for weapon, spec in WEAPONS.items()},
                          "match": room.state(now)})]

    def _ensure_bots(self, room, now):
        for team in ("T", "CT"):
            humans = [p for p in room.clients.values() if p.team == team and not p.is_closed]
            wanted = max(0, TEAM_SIZE - len(humans))
            bots = [p for p in room.players.values() if getattr(p, "is_bot", False) and p.team == team]
            for bot in bots[wanted:]: room.players.pop(bot.id, None)
            for slot in range(len(bots), wanted):
                bot = Dust2Bot(f"bot_{team}_{slot}", team, slot); bot.room = room
                self._new_dust_player(bot, team, now); bot.is_bot, bot.slot = True, slot
                room.players[bot.id] = bot

    def _spawn_dust(self, player, now, slot):
        survived = player.is_alive
        if not survived:
            player.armor, player.primary, player.secondary, player.weapon = False, None, "glock", "glock"
        player.weapon_ammo = {}
        player.x, player.y, player.z = map(float, DUST2_MAP["spawns"][player.team][slot % 3])
        player.vx = player.vy = player.vz = 0.0; player.health, player.is_alive, player.on_ground = 100.0, True, True
        player.yaw, player.pitch, player.jump_held = (0.0 if player.team == "T" else math.pi), 0.0, False
        player.spawn_id, player.dead_since, player.last_attack_time, player.attack_pending = player.spawn_id + 1, None, now - 1, False
        player.last_input_time, player.objective, player.burst_count = now, "buy", 0
        player.target_id, player.target_seen_at = None, None
        for weapon in (player.primary, player.secondary):
            if weapon: player.weapon_ammo[weapon] = (WEAPONS[weapon]["magazine"], WEAPONS[weapon]["reserve"])
        self._refill_ammo(player)
        player.arena_input = {"strafe": 0, "forward": 0, "jump": False, "sprint": False, "use": False}
        if getattr(player, "is_bot", False): player.route_key = None

    def _bot_buy(self, bot):
        choice = "ak47" if bot.team == "T" else "m4a1"
        if bot.primary:
            self._equip(bot, 1)
        elif bot.money >= WEAPONS[choice]["cost"] + 650:
            bot.money -= WEAPONS[choice]["cost"]; bot.primary = bot.weapon = choice
        elif bot.money >= WEAPONS["mp5"]["cost"]:
            bot.money -= WEAPONS["mp5"]["cost"]; bot.primary = bot.weapon = "mp5"
        elif bot.secondary != "deagle" and bot.money >= WEAPONS["deagle"]["cost"]:
            bot.money -= WEAPONS["deagle"]["cost"]; bot.secondary = bot.weapon = "deagle"
        if not bot.armor and bot.money >= 650: bot.money, bot.armor = bot.money - 650, True

    def _begin_round(self, room, now):
        if room.match_complete:
            room.match_complete, room.round_number, room.score = False, 0, {"T": 0, "CT": 0}
            for player in room.players.values():
                player.money, player.losses, player.kills, player.deaths, player.is_alive = 800, 0, 0, 0, False
        if room.round_number == HALF_ROUNDS:
            room.score = {"T": room.score["CT"], "CT": room.score["T"]}
            for player in room.players.values():
                player.team = "CT" if player.team == "T" else "T"
                player.money, player.losses, player.is_alive = 800, 0, False
        room.round_number += 1; room.target_site = "A" if room.round_number % 2 else "B"
        self._ensure_bots(room, now)
        slots = {"T": 0, "CT": 0}
        for player in room.players.values():
            self._spawn_dust(player, now, slots[player.team]); slots[player.team] += 1
        terrorists = [p for p in room.players.values() if p.team == "T"]
        room.bomb_carrier = next((p.id for p in terrorists if not getattr(p, "is_bot", False)), terrorists[0].id)
        room.bomb_position = room.bomb_planted_at = room.bomb_site = room.objective_actor = room.objective_started_at = room.last_result = None
        room.phase, room.deadline = "buy", now + BUY_SECONDS
        for bot in (p for p in room.players.values() if getattr(p, "is_bot", False)):
            self._bot_buy(bot)
            self._refill_ammo(bot)

    def _end_round(self, room, winner, reason, now):
        if room.phase == "post": return
        room.score[winner] += 1
        for player in room.players.values():
            if player.team == winner:
                player.money, player.losses = min(16000, player.money + (3500 if reason == "bomb" else 3250)), 0
            else:
                player.losses = min(4, player.losses + 1)
                player.money = min(16000, player.money + min(3400, 1400 + (player.losses - 1) * 500))
        room.last_result, room.phase, room.deadline = {"winner": winner, "reason": reason}, "post", now + POST_SECONDS
        room.objective_actor = room.objective_started_at = None
        room.match_complete = room.score[winner] >= WINS

    def _buy(self, player, item):
        if item == "armor":
            if not player.armor and player.money >= 650: player.money, player.armor = player.money - 650, True
            return
        spec = WEAPONS.get(item)
        if not spec or item == "glock" or player.money < spec["cost"]: return
        if (item == "ak47" and player.team != "T") or (item == "m4a1" and player.team != "CT"): return
        if item in (player.primary, player.secondary): return
        self._store_ammo(player)
        player.money -= spec["cost"]; player.weapon = item
        if item in ("ak47", "m4a1", "mp5", "awp"): player.primary = item
        else: player.secondary = item
        self._refill_ammo(player)

    # -- Dust2 movement, combat and bots ------------------------------------
    @staticmethod
    def _accelerate(player, wish_x, wish_z, wish_speed, acceleration):
        add = min(wish_speed - (player.vx * wish_x + player.vz * wish_z), acceleration * STEP * wish_speed)
        if add > 0: player.vx += wish_x * add; player.vz += wish_z * add

    def _move_dust(self, player, now):
        if not player.is_alive: player.vx = player.vy = player.vz = 0.0; return
        control = player.arena_input; fresh = getattr(player, "is_bot", False) or now - player.last_input_time <= .25
        sx, fw = (control["strafe"], control["forward"]) if fresh else (0, 0)
        length = math.hypot(sx, fw)
        if length: sx, fw = sx / length, fw / length
        wish_x, wish_z = sx * math.cos(player.yaw) - fw * math.sin(player.yaw), -sx * math.sin(player.yaw) - fw * math.cos(player.yaw)
        jump = fresh and control["jump"]
        if jump and not player.jump_held and player.on_ground: player.vy, player.on_ground = 8.5, False
        if player.on_ground:
            speed = math.hypot(player.vx, player.vz)
            if speed:
                slowed = max(0, speed - max(speed, 5) * 7.5 * STEP); player.vx *= slowed / speed; player.vz *= slowed / speed
            self._accelerate(player, wish_x, wish_z, 7.2, 55)
        else:
            # Air strafing adds only in the chosen direction.  Holding Space does
            # not trigger another hop: jump must be released and pressed again.
            self._accelerate(player, wish_x, wish_z, 7.2, 13)
            speed = math.hypot(player.vx, player.vz)
            if speed > 13: player.vx *= 13 / speed; player.vz *= 13 / speed
        jump = fresh and control["jump"]
        if jump and not player.jump_held and player.on_ground: player.vy, player.on_ground = 8.5, False
        player.jump_held = jump
        self._move_vertical_and_horizontal(player, DUST2_MAP)

    def _die(self, room, victim, killer, now):
        if not victim.is_alive: return
        victim.health, victim.is_alive, victim.dead_since, victim.objective = 0.0, False, now, "spectating"
        victim.deaths += 1
        victim.attack_pending, victim.reload_until = False, None
        if killer and killer is not victim:
            killer.money = min(16000, killer.money + 300)
            killer.kills += 1
        if room.bomb_carrier == victim.id: room.bomb_carrier, room.bomb_position = None, [victim.x, victim.z]
        if room.objective_actor == victim.id: room.objective_actor = room.objective_started_at = None

    @staticmethod
    def _refill_ammo(player):
        spec = WEAPONS[player.weapon]
        player.ammo, player.reserve_ammo, player.reload_until = spec["magazine"], spec["reserve"], None
        player.weapon_ammo[player.weapon] = (player.ammo, player.reserve_ammo)

    @staticmethod
    def _store_ammo(player):
        player.weapon_ammo[player.weapon] = (player.ammo, player.reserve_ammo)

    def _equip(self, player, slot):
        if type(slot) is not int or slot not in (1, 2) or not player.is_alive: return
        weapon = player.primary if slot == 1 else player.secondary
        if not weapon or weapon == player.weapon: return
        self._store_ammo(player)
        player.weapon = weapon
        player.ammo, player.reserve_ammo = player.weapon_ammo.get(weapon, (WEAPONS[weapon]["magazine"], WEAPONS[weapon]["reserve"]))
        player.reload_until, player.attack_pending, player.burst_count = None, False, 0

    @staticmethod
    def _reload(player, room, now):
        spec = WEAPONS[player.weapon]
        if room.phase not in ("buy", "live") or not player.is_alive or player.reload_until is not None: return
        if player.ammo >= spec["magazine"] or player.reserve_ammo <= 0: return
        player.reload_until = now + spec["reload"]
        player.attack_pending = False

    def _fire_dust(self, room, attacker, now):
        if not attacker.attack_pending: return None
        spec = WEAPONS[attacker.weapon]
        stale = not getattr(attacker, "is_bot", False) and now - attacker.last_input_time > .25
        if room.phase != "live" or not attacker.is_alive or stale or attacker.reload_until is not None or attacker.ammo <= 0:
            attacker.attack_pending = False
            return None
        if now - attacker.last_attack_time < spec["cooldown"]: return None
        attacker.attack_pending = False
        elapsed = now - attacker.last_attack_time
        attacker.burst_count = min(12, attacker.burst_count + 1) if elapsed < spec["cooldown"] * 2.5 else 0
        attacker.last_attack_time = now
        attacker.ammo -= 1
        self._store_ammo(attacker)
        origin = (attacker.x, attacker.y + 1.62, attacker.z)
        speed = math.hypot(attacker.vx, attacker.vz)
        spread = spec["spread"] + min(1.5, speed / 7.2) * .018 + (0 if attacker.on_ground else .045)
        spread += min(8, attacker.burst_count) * spec["recoil"] * .45
        if getattr(attacker, "is_bot", False):
            spread += .024 + min(.016, attacker.burst_count * .004)
        attacker.shots_fired += 1
        # A stable disk pattern avoids global random state and is reproducible in
        # authoritative replays. Moving, jumping and long bursts widen the disk.
        angle = attacker.shots_fired * 2.399963 + sum(ord(char) for char in str(attacker.id)) * .17
        radius = spread * math.sqrt((attacker.shots_fired * .618034) % 1)
        yaw, pitch = attacker.yaw + math.cos(angle) * radius, attacker.pitch + math.sin(angle) * radius
        direction = (-math.sin(yaw) * math.cos(pitch), math.sin(pitch), -math.cos(yaw) * math.cos(pitch))
        hits = []
        for target in room.players.values():
            if target is attacker or not target.is_alive or target.team == attacker.team: continue
            for headshot, bounds in (
                (True, (target.x - .27, target.y + 1.35, target.z - .27, target.x + .27, target.y + 1.8, target.z + .27)),
                (False, (target.x - .3, target.y, target.z - .3, target.x + .3, target.y + 1.35, target.z + .3)),
            ):
                distance = ray_box(origin, direction, bounds, spec["range"])
                if distance is not None: hits.append((distance, target, headshot))
        hit = min(hits, key=lambda item: item[0]) if hits else None
        wall = obstacle_distance(origin, direction, spec["range"])
        if wall is not None and (hit is None or wall <= hit[0]): hit = None
        distance = hit[0] if hit else (wall if wall is not None else spec["range"])
        room.broadcast({"type": "arena_shot", "attackerId": attacker.id, "weapon": attacker.weapon,
                        "origin": dict(zip(("x", "y", "z"), origin)),
                        "end": dict(zip(("x", "y", "z"), (origin[i] + direction[i] * distance for i in range(3)))),
                        "ammo": attacker.ammo, "reserveAmmo": attacker.reserve_ammo,
                        "spread": round(spread, 5), "recoil": spec["recoil"]})
        if hit is None: return None
        distance, target, headshot = hit
        damage = spec["damage"] * spec["rangeModifier"] ** (distance / 10)
        if headshot: damage *= spec["headshotMultiplier"]
        if target.armor: damage *= spec["armorMultiplier"]
        damage = round(damage, 1)
        target.health = max(0, round(target.health - damage, 1))
        target.last_hit_at = now
        target.last_hit_by = attacker.id
        if not target.health: self._die(room, target, attacker, now)
        return {"type": "arena_hit", "attackerId": attacker.id, "targetId": target.id, "damage": damage,
                "health": target.health, "alive": target.is_alive, "killed": not target.is_alive,
                "headshot": headshot, "weapon": attacker.weapon, "weaponName": spec["name"],
                "attackerName": attacker.name, "targetName": target.name,
                "kills": attacker.kills, "deaths": target.deaths}

    @staticmethod
    def _bot_route(bot, room, bomb_target=False):
        site = room.target_site if bot.team == "T" else ("A" if bot.slot % 2 == 0 else "B")
        target = room.bomb_position if bomb_target and room.bomb_position else DUST2_MAP["sites"][site]
        start = min(EBLAN2_NAV, key=lambda n: (n[0]+.5-bot.x)**2 + (n[2]+.5-bot.z)**2 + (n[1]-bot.y)**2)
        goal = min(EBLAN2_NAV, key=lambda n: (n[0]+.5-target[0])**2 + (n[2]+.5-target[1])**2 + (n[1]-DUST2_MAP["siteHeights"].get(room.bomb_site or site, 8))**2)
        queue, parents = deque([start]), {start: None}
        while queue:
            point = queue.popleft()
            if point == goal:
                route = []
                while point is not None:
                    route.append((point[0]+.5, point[2]+.5, point[1]))
                    point = parents[point]
                return list(reversed(route))
            for dx, dz in ((1,0),(-1,0),(0,1),(0,-1)):
                for dy in (0,1,-1):
                    nxt = (point[0]+dx,point[1]+dy,point[2]+dz)
                    if nxt not in EBLAN2_NAV or nxt in parents: continue
                    if ArenaService.collides(nxt[0]+.5, max(point[1],nxt[1]), nxt[2]+.5, DUST2_MAP): continue
                    if ArenaService.collides(point[0]+.5+dx*.5, max(point[1],nxt[1]), point[2]+.5+dz*.5, DUST2_MAP): continue
                    parents[nxt] = point
                    queue.append(nxt)
        return [(bot.x, bot.z)]

    def _think_bot(self, room, bot):
        now = self.clock()
        bot.arena_input["use"] = False
        if bot.ammo == 0: self._reload(bot, room, now)
        enemies = [(math.hypot(p.x - bot.x, p.z - bot.z), p) for p in room.players.values() if p.is_alive and p.team != bot.team]
        visible = []
        for distance, enemy in enemies:
            if distance > WEAPONS[bot.weapon]["range"]:
                continue
            direction = ((enemy.x - bot.x) / distance, 0, (enemy.z - bot.z) / distance) if distance else (0, 0, 0)
            origin = (bot.x, bot.y + 1.4, bot.z)
            if abs(enemy.y - bot.y) < 1.5 and not blocked_ray(origin, direction, distance):
                aim = math.atan2(-(enemy.x - bot.x), -(enemy.z - bot.z))
                angle = abs((aim - bot.yaw + math.pi) % (2 * math.pi) - math.pi)
                alert = angle < 1.35 or distance < 2.8 or (enemy.id == getattr(bot, "last_hit_by", None) and now - getattr(bot, "last_hit_at", 0) < 3.0)
                if alert:
                    visible.append((distance, enemy))
        enemies = visible
        if enemies:
            distance, enemy = min(enemies, key=lambda pair: pair[0])
            if bot.target_id != enemy.id:
                bot.target_id, bot.target_seen_at = enemy.id, now
                bot.burst_pause_until = 0
            aim = math.atan2(-(enemy.x - bot.x), -(enemy.z - bot.z))
            turn = (aim - bot.yaw + math.pi) % (2 * math.pi) - math.pi
            turn_rate = .12
            step = max(-turn_rate, min(turn_rate, turn))
            bot.yaw = (bot.yaw + step + math.pi) % (2 * math.pi) - math.pi
            bot.pitch = math.atan2(enemy.y + .72 - (bot.y + 1.62), max(.1, distance))
            if getattr(bot, "burst_pause_until", 0) > now:
                bot.attack_pending = False
            elif getattr(bot, "burst_count", 0) >= (3 if distance > 10 else 5) and WEAPONS[bot.weapon]["automatic"]:
                bot.burst_pause_until = now + .35
                bot.attack_pending = False
            else:
                reaction_time = .44 + .06 * (bot.slot % 3)
                remaining = turn - step
                bot.attack_pending = now - bot.target_seen_at >= reaction_time and abs(remaining) < .10
            bot.objective = "engage"; bot.arena_input.update({"strafe": 0, "forward": 0, "jump": False, "sprint": False}); return
        bot.target_id, bot.target_seen_at, bot.attack_pending = None, None, False
        bot.burst_pause_until = 0
        planted = room.bomb_planted_at is not None
        if bot.team == "T":
            target, label = (room.bomb_position, "defend bomb") if planted else ((room.bomb_position, "recover C4") if room.bomb_carrier is None else (DUST2_MAP["sites"][room.target_site], f"plant {room.target_site}"))
        else:
            target, label = (room.bomb_position, "rotate / defuse") if planted else (DUST2_MAP["sites"]["A" if bot.slot % 2 == 0 else "B"], "hold site")
        if not target: return
        key = f"{label}:{target[0]}:{target[1]}"
        if bot.route_key != key: bot.route_key, bot.route, bot.route_index = key, self._bot_route(bot, room, planted or room.bomb_carrier is None), 0
        while bot.route_index < len(bot.route) - 1 and flat_distance(bot, bot.route[bot.route_index]) < .2: bot.route_index += 1
        point = bot.route[bot.route_index] if bot.route else target; dx, dz = point[0] - bot.x, point[1] - bot.z
        bot.yaw, bot.pitch, bot.objective = math.atan2(-dx, -dz), 0, label
        bot.arena_input.update({"strafe": 0, "forward": 1 if math.hypot(dx, dz) > (.1 if bot.route_index < len(bot.route) - 1 else 1.1) else 0, "jump": False, "sprint": True})
        if len(point) > 2 and point[2] > bot.y + .5 and bot.on_ground:
            bot.arena_input["jump"] = not bot.jump_held
        if bot.team == "T" and room.bomb_carrier == bot.id and flat_distance(bot, DUST2_MAP["sites"][room.target_site]) < 2.2: bot.arena_input["use"] = True
        if bot.team == "CT" and planted and flat_distance(bot, room.bomb_position) < 2.2: bot.arena_input["use"] = True

    def _objective(self, room, now):
        terrorists = [p for p in room.players.values() if p.team == "T" and p.is_alive]
        if room.bomb_carrier is None and room.bomb_position and room.bomb_planted_at is None:
            for player in terrorists:
                if flat_distance(player, room.bomb_position) < 1.5: room.bomb_carrier, room.bomb_position = player.id, None; break
        actor = action = None; needed = 0
        if room.bomb_planted_at is None and room.bomb_carrier:
            carrier = room.players.get(room.bomb_carrier)
            using = carrier and (getattr(carrier, "is_bot", False) or now - carrier.last_input_time <= .25) and carrier.arena_input["use"]
            if carrier and carrier.is_alive and using:
                for site, point in DUST2_MAP["sites"].items():
                    if flat_distance(carrier, point) < 2.2 and abs(carrier.y - DUST2_MAP["siteHeights"][site]) < 1:
                        actor, action, needed, room.bomb_site = carrier, "plant", PLANT_SECONDS, site; break
        elif room.bomb_planted_at is not None:
            for player in room.players.values():
                using = getattr(player, "is_bot", False) or now - player.last_input_time <= .25
                if player.team == "CT" and player.is_alive and using and player.arena_input["use"] and flat_distance(player, room.bomb_position) < 2.2 and abs(player.y - DUST2_MAP["siteHeights"][room.bomb_site]) < 1:
                    actor, action, needed = player, "defuse", DEFUSE_SECONDS; break
        if actor is None: room.objective_actor = room.objective_started_at = None; return
        if room.objective_actor != actor.id: room.objective_actor, room.objective_started_at = actor.id, now; return
        if now - room.objective_started_at < needed: return
        if action == "plant":
            room.bomb_carrier, room.bomb_position, room.bomb_planted_at = None, list(DUST2_MAP["sites"][room.bomb_site]), now
            actor.money, actor.objective = min(16000, actor.money + 300), f"planted {room.bomb_site}"
        else:
            actor.money = min(16000, actor.money + 300); self._end_round(room, "CT", "defuse", now)
        room.objective_actor = room.objective_started_at = None

    # -- Protocol and server tick --------------------------------------------
    def process(self, client, msg):
        now, deliveries = self.clock(), []
        with self.lock:
            if not isinstance(msg, dict): return
            kind = msg.get("type")
            if kind == "arena_join":
                if client.room is not None: return
                client.arena_mode = True
                if msg.get("mode") == "dust2": deliveries.extend(self._join_dust(client, msg, now))
                else: deliveries.extend(self._join_legacy(client, msg, now))
            elif isinstance(client.room, Dust2Room):
                if kind == "arena_input": self._dust_input(client, msg, now)
                elif kind == "arena_attack": client.attack_pending = client.is_alive and client.room.phase == "live"
                elif kind == "arena_reload": self._reload(client, client.room, now)
                elif kind == "arena_equip" and client.room.phase in ("buy", "live"): self._equip(client, msg.get("slot"))
                elif kind == "arena_buy" and client.room.phase == "buy" and client.is_alive and isinstance(msg.get("item"), str): self._buy(client, msg["item"])
                elif kind == "arena_chat": self._chat(client, msg, now, deliveries)
            elif client.room in self.rooms.values(): self._legacy_input(client, msg, now, deliveries)
        for recipient, message in deliveries: recipient.send_json(message)

    def _join_legacy(self, client, msg, now):
        name = msg.get("room", "arena")
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,32}", name): return [(client, {"type": "arena_error", "message": "Invalid room code"})]
        room = self.rooms.get(name)
        if room is None and len(self.rooms) < MAX_ROOMS: room = self.rooms[name] = ArenaRoom(name)
        if room is None or not isinstance(room, ArenaRoom) or len(room.clients) >= MAX_PLAYERS: return [(client, {"type": "arena_error", "message": "Arena is full"})]
        client.room, client.name, client.input_seq, client.last_chat_time = room, (msg.get("name", "Player")[:24].strip() if isinstance(msg.get("name", "Player"), str) else "Player") or "Player", -1, -math.inf
        self.spawn(client, now); room.clients[client.id] = client
        return [(client, {"type": "arena_welcome", "id": client.id, "room": name, "map": MAP, "kit": KIT, "players": [self.state(p) for p in room.clients.values()]})]

    @staticmethod
    def _valid_input(client, msg, allow_use):
        seq, values = msg.get("seq"), [msg.get(key) for key in ("strafe", "forward", "yaw", "pitch")]
        bools = ("jump", "sprint", "use") if allow_use else ("jump", "sprint")
        if type(seq) is not int or not client.input_seq < seq <= 2147483647 or not all(finite(v) for v in values) or any(abs(v) > 1 for v in values[:2]) or abs(values[2]) > math.pi or abs(values[3]) > math.pi / 2 or any(type(msg.get(key)) is not bool for key in bools): return None
        return values

    def _dust_input(self, client, msg, now):
        values = self._valid_input(client, msg, True)
        if values is None: return
        client.input_seq, client.yaw, client.pitch = msg["seq"], values[2], values[3]
        client.arena_input = {key: msg[key] for key in ("strafe", "forward", "jump", "sprint", "use")}; client.last_input_time = now

    def _legacy_input(self, client, msg, now, deliveries):
        kind = msg.get("type")
        if kind == "arena_input":
            values = self._valid_input(client, msg, False)
            if values is None: return
            client.input_seq, client.yaw, client.pitch = msg["seq"], values[2], values[3]
            client.arena_input = {key: msg[key] for key in ("strafe", "forward", "jump", "sprint")}; client.arena_input["use"] = False; client.last_input_time = now
        elif kind == "arena_attack" and client.is_alive: client.attack_pending = True
        elif kind == "arena_respawn" and not client.is_alive and client.dead_since is not None and now - client.dead_since >= 2: self.spawn(client, now)
        elif kind == "arena_chat": self._chat(client, msg, now, deliveries)

    @staticmethod
    def _chat(client, msg, now, deliveries):
        text = msg.get("text")
        if isinstance(text, str) and text.strip() and now - getattr(client, "last_chat_time", -math.inf) >= 1:
            client.last_chat_time = now
            deliveries.extend((p, {"type": "arena_chat", "sender": client.name, "text": text.strip()[:256]}) for p in client.room.clients.values())

    def _tick_dust(self, room, now):
        for client in list(room.clients.values()):
            if client.is_closed: room.remove_client(client.id)
        if not room.clients: return False, []
        if room.phase == "post" and now >= room.deadline: self._begin_round(room, now)
        if room.phase == "buy" and now >= room.deadline:
            room.phase, room.deadline = "live", now + ROUND_SECONDS
            for player in room.players.values(): player.objective = "live"
        if room.phase == "live":
            for bot in (p for p in room.players.values() if getattr(p, "is_bot", False) and p.is_alive): self._think_bot(room, bot)
            for player in room.players.values(): self._move_dust(player, now)
        for player in room.players.values():
            if player.is_alive and player.reload_until is not None and now >= player.reload_until:
                amount = min(WEAPONS[player.weapon]["magazine"] - player.ammo, player.reserve_ammo)
                player.ammo += amount
                player.reserve_ammo -= amount
                player.reload_until = None
                self._store_ammo(player)
        deliveries = []
        if room.phase == "live":
            if room.bomb_planted_at is not None and now - room.bomb_planted_at >= BOMB_SECONDS:
                self._end_round(room, "T", "bomb", now)
        if room.phase == "live":
            self._objective(room, now)
            for player in room.players.values():
                event = self._fire_dust(room, player, now)
                if event: deliveries.extend((client, event) for client in room.clients.values())
            if room.bomb_planted_at is not None and now - room.bomb_planted_at >= BOMB_SECONDS: self._end_round(room, "T", "bomb", now)
            elif room.phase == "live":
                alive_t = any(p.is_alive and p.team == "T" for p in room.players.values()); alive_ct = any(p.is_alive and p.team == "CT" for p in room.players.values())
                if not alive_t and room.bomb_planted_at is None: self._end_round(room, "CT", "elimination", now)
                elif not alive_ct: self._end_round(room, "T", "elimination", now)
                elif room.bomb_planted_at is None and now >= room.deadline: self._end_round(room, "CT", "time", now)
        snapshot = {"type": "arena_snapshot", "players": [self.dust_state(p) for p in room.players.values()], "match": room.state(now)}
        deliveries.extend((client, snapshot) for client in room.clients.values())
        return True, deliveries

    def tick(self):
        now, deliveries = self.clock(), []
        with self.lock:
            for name, room in list(self.rooms.items()):
                with room.lock:
                    if isinstance(room, Dust2Room):
                        alive, outgoing = self._tick_dust(room, now); deliveries.extend(outgoing)
                        if not alive: del self.rooms[name]
                        continue
                    clients = [client for client in room.clients.values() if not client.is_closed]
                    if not clients: del self.rooms[name]; continue
                    for client in clients: self.move(client, now)
                    for client in clients:
                        event = self.attack(client, room, now)
                        if event: deliveries.extend((other, event) for other in clients)
                    snapshot = {"type": "arena_snapshot", "players": [self.state(client) for client in clients]}
                    deliveries.extend((client, snapshot) for client in clients)
        for recipient, message in deliveries: recipient.send_json(message)

    def run(self, server):
        while server.running:
            started = self.clock(); self.tick(); time.sleep(max(0, STEP - (self.clock() - started)))
