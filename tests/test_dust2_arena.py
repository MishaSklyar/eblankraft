import math
import unittest
from unittest.mock import patch

from pvp_arena import ArenaService, DUST2_MAP, EBLAN2_COLUMNS, WEAPONS


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


class Client:
    def __init__(self, ident, name='Player'):
        self.id = ident
        self.name = name
        self.room = None
        self.is_closed = False
        self.arena_mode = False
        self.messages = []

    def send_json(self, message):
        self.messages.append(message)


class Dust2ArenaTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.arena = ArenaService(clock=self.clock)
        self.player = Client('human')
        self.arena.process(self.player, {'type': 'arena_join', 'room': 'dust', 'mode': 'dust2', 'name': 'Human'})
        self.room = self.player.room

    def test_round_starts_with_teams_bots_and_buy_economy(self):
        self.assertEqual(self.room.phase, 'buy')
        self.assertEqual(len(self.room.players), 6)
        self.assertEqual(sum(p.team == 'T' for p in self.room.players.values()), 3)
        self.assertEqual(sum(p.team == 'CT' for p in self.room.players.values()), 3)
        self.assertEqual(self.player.money, 800)
        self.arena.process(self.player, {'type': 'arena_buy', 'item': 'armor'})
        self.assertTrue(self.player.armor)
        self.assertEqual(self.player.money, 150)

    def lineup(self, distance=8, body=False):
        """Isolate the combat ray above the map, with one opponent ahead."""
        target = next(p for p in self.room.players.values() if p.team == 'CT')
        for player in self.room.players.values():
            player.is_alive = player in (self.player, target)
        self.room.phase, self.room.deadline = 'live', 1000
        self.player.x, self.player.y, self.player.z = .5, 100, .5
        target.x, target.y, target.z = .5, 100, .5 - distance
        self.player.yaw = 0
        self.player.pitch = math.atan2(-.67, distance) if body else 0
        self.player.vx = self.player.vz = 0
        self.player.on_ground = True
        self.player.attack_pending = True
        return target

    def fire(self, now):
        self.clock.now = now
        self.player.last_input_time = now
        return self.arena._fire_dust(self.room, self.player, now)

    def test_welcome_exposes_weapon_specs_and_state_progress(self):
        welcome = self.player.messages[0]
        self.assertFalse(welcome['weaponSpecs']['glock']['automatic'])
        self.assertTrue(welcome['weaponSpecs']['ak47']['automatic'])
        self.assertEqual(welcome['weaponSpecs']['awp']['magazine'], 10)
        self.player.ammo = 1
        self.arena._reload(self.player, self.room, self.clock.now)
        self.assertEqual(self.arena.dust_state(self.player)['reloadRemaining'], 2.2)
        self.room.objective_actor, self.room.objective_started_at = self.player.id, 0
        bomb = self.room.state(1.5)['bomb']
        self.assertEqual((bomb['action'], bomb['progress'], bomb['actionRemaining']), ('plant', .5, 1.5))

    def test_headshot_kill_stats_and_body_damage(self):
        self.player.money = 3000
        self.arena._buy(self.player, 'ak47')
        target = self.lineup(body=True)
        body = self.fire(0)
        self.assertFalse(body['headshot'])
        self.assertGreater(body['damage'], 30)
        self.assertLess(body['damage'], 35)
        target.health = 100
        self.player.pitch, self.player.attack_pending = 0, True
        head = self.fire(1)
        self.assertTrue(head['headshot'])
        self.assertTrue(head['killed'])
        self.assertEqual(head['weaponName'], 'AK-47')
        self.assertEqual((self.player.kills, target.deaths), (1, 1))
        self.assertEqual((head['attackerName'], head['targetName']), (self.player.name, target.name))

    def test_armor_and_range_reduce_damage(self):
        target = self.lineup(distance=5, body=True)
        close = self.fire(0)['damage']
        target.health, target.armor = 100, True
        self.player.attack_pending = True
        armored = self.fire(1)['damage']
        target = self.lineup(distance=20, body=True)
        target.health, target.armor = 100, False
        far = self.fire(2)['damage']
        self.assertLess(armored, close)
        self.assertLess(far, close)

    def test_miss_and_hit_emit_authoritative_shots_once(self):
        target = self.lineup()
        target.is_alive = False
        self.player.messages.clear()
        self.assertIsNone(self.fire(0))
        shot = self.player.messages[-1]
        self.assertEqual((shot['type'], shot['ammo'], shot['weapon']), ('arena_shot', 19, 'glock'))
        self.assertEqual(shot['origin'], {'x': .5, 'y': 101.62, 'z': .5})
        self.assertAlmostEqual(math.dist(tuple(shot['origin'].values()), tuple(shot['end'].values())), WEAPONS['glock']['range'])
        self.player.attack_pending = True
        self.fire(.01)
        self.assertEqual(len(self.player.messages), 1, 'cooldown rejection must not create a shot')
        target.is_alive, self.player.attack_pending = True, True
        self.assertIsNotNone(self.fire(1))
        self.assertEqual(len(self.player.messages), 2)
        self.assertAlmostEqual(self.player.messages[-1]['end']['z'], target.z + .27)

    def test_queued_attack_waits_for_tick_cooldown_and_expires(self):
        self.player.money = 3000
        self.arena._buy(self.player, 'ak47')
        target = self.lineup()
        target.is_alive = False
        self.fire(0)
        self.clock.now, self.player.last_input_time = .1, .1
        self.arena.process(self.player, {'type': 'arena_attack'})
        self.assertIsNone(self.arena._fire_dust(self.room, self.player, .1))
        self.assertTrue(self.player.attack_pending)
        self.arena._fire_dust(self.room, self.player, .15)
        self.assertFalse(self.player.attack_pending)
        self.assertEqual(self.player.ammo, 28)
        self.player.attack_pending = True
        self.arena._fire_dust(self.room, self.player, 1)
        self.assertFalse(self.player.attack_pending, 'stale input must discard a queued shot')
        self.assertEqual(self.player.ammo, 28)
        self.room.phase, self.player.attack_pending = 'buy', True
        self.arena._fire_dust(self.room, self.player, 1)
        self.assertFalse(self.player.attack_pending)
        self.arena.process(self.player, {'type': 'arena_attack'})
        self.assertFalse(self.player.attack_pending, 'buy-phase clicks must not fire when the round begins')

    def test_voxel_wall_blocks_damage_and_stops_tracer(self):
        target = self.lineup()
        with patch.dict(EBLAN2_COLUMNS, {(0, -3): [[0, 100, -3, 1, 103, -2]]}):
            self.assertIsNone(self.fire(0))
        self.assertEqual(target.health, 100)
        self.assertAlmostEqual(self.player.messages[-1]['end']['z'], -2)

    def test_movement_air_and_bursts_widen_spread(self):
        target = self.lineup()
        target.is_alive = False
        self.fire(0)
        standing = self.player.messages[-1]['spread']
        self.player.vx, self.player.attack_pending = 7.2, True
        self.fire(1)
        moving = self.player.messages[-1]['spread']
        self.player.vx, self.player.on_ground, self.player.attack_pending = 0, False, True
        self.fire(2)
        airborne = self.player.messages[-1]['spread']
        self.assertGreater(moving, standing)
        self.assertGreater(airborne, moving)
        self.player.on_ground, self.player.attack_pending = True, True
        self.fire(3)
        self.player.attack_pending = True
        self.fire(3.3)
        self.assertGreater(self.player.messages[-1]['spread'], standing)

    def test_weapon_slots_preserve_magazines_and_cancel_reload(self):
        self.player.money = 8000
        self.arena.process(self.player, {'type': 'arena_buy', 'item': 'ak47'})
        self.player.ammo, self.player.reserve_ammo = 9, 53
        self.arena.process(self.player, {'type': 'arena_reload'})
        self.arena.process(self.player, {'type': 'arena_equip', 'slot': 2})
        self.assertEqual((self.player.weapon, self.player.ammo), ('glock', 20))
        self.assertIsNone(self.player.reload_until)
        self.player.ammo = 3
        self.arena.process(self.player, {'type': 'arena_buy', 'item': 'deagle'})
        self.arena.process(self.player, {'type': 'arena_equip', 'slot': 1})
        self.assertEqual((self.player.weapon, self.player.ammo, self.player.reserve_ammo), ('ak47', 9, 53))
        self.arena.process(self.player, {'type': 'arena_equip', 'slot': 2})
        self.assertEqual((self.player.weapon, self.player.ammo), ('deagle', 7))
        self.arena.process(self.player, {'type': 'arena_equip', 'slot': True})
        self.assertEqual(self.player.weapon, 'deagle')

    def test_survivor_equipment_and_half_time_reset(self):
        self.player.money = 8000
        self.arena._buy(self.player, 'ak47')
        self.arena._buy(self.player, 'armor')
        self.player.ammo = 3
        money = self.player.money
        self.arena._begin_round(self.room, 1)
        self.assertEqual((self.player.primary, self.player.armor, self.player.ammo, self.player.money), ('ak47', True, 30, money))
        self.player.is_alive = False
        self.arena._begin_round(self.room, 2)
        self.assertEqual((self.player.primary, self.player.armor, self.player.weapon), (None, False, 'glock'))
        self.player.money = 8000
        self.arena._buy(self.player, 'ak47')
        self.room.round_number = 6
        self.arena._begin_round(self.room, 3)
        self.assertEqual((self.player.team, self.player.money, self.player.primary, self.player.weapon), ('CT', 800, None, 'glock'))

    def test_buy_phase_join_replaces_bot_live_join_spectates(self):
        joining = Client('human2')
        self.arena.process(joining, {'type': 'arena_join', 'room': 'dust', 'mode': 'dust2'})
        self.assertTrue(joining.is_alive)
        self.assertEqual(len(self.room.players), 6)
        self.assertEqual(sum(p.is_bot and p.team == joining.team for p in self.room.players.values()), 2)
        self.assertFalse(any(p is not joining and p.is_alive and (p.x, p.y, p.z) == (joining.x, joining.y, joining.z) for p in self.room.players.values()))
        self.room.phase = 'live'
        spectator = Client('human3')
        self.arena.process(spectator, {'type': 'arena_join', 'room': 'dust', 'mode': 'dust2'})
        self.assertFalse(spectator.is_alive)
        self.assertEqual(spectator.objective, 'spectating')

    def test_bot_reacts_before_firing(self):
        bot = self.lineup(body=True)
        bot.x, bot.y, bot.z = .5, 100, -7.5
        bot.yaw = math.pi
        self.arena._think_bot(self.room, bot)
        self.assertFalse(bot.attack_pending)
        self.clock.now = 1
        self.arena._think_bot(self.room, bot)
        self.assertTrue(bot.attack_pending)

    def test_c4_plant_defuse_and_bot_rotation(self):
        self.room.phase = 'live'
        site = DUST2_MAP['sites']['A']
        self.player.x, self.player.z = site
        self.player.arena_input['use'] = True
        self.arena._objective(self.room, self.clock.now)
        self.clock.now += 3.01
        self.player.last_input_time = self.clock.now
        self.arena._objective(self.room, self.clock.now)
        self.assertIsNotNone(self.room.bomb_planted_at)
        self.assertEqual(self.room.bomb_site, 'A')
        ct_bot = next(p for p in self.room.players.values() if p.team == 'CT' and p.is_bot)
        ct_bot.x, ct_bot.z = -18, 21
        for p in self.room.players.values():
            if p.team == 'T' and p is not self.player:
                p.is_alive = False
        self.arena._think_bot(self.room, ct_bot)
        self.assertIn('defuse', ct_bot.objective)
        ct_bot.x, ct_bot.z = self.room.bomb_position
        ct_bot.y = DUST2_MAP['siteHeights']['A']
        ct_bot.arena_input['use'] = True
        self.arena._objective(self.room, self.clock.now)
        self.clock.now += 5.01
        self.arena._objective(self.room, self.clock.now)
        self.assertEqual(self.room.phase, 'post')
        self.assertEqual(self.room.last_result['reason'], 'defuse')

    def test_manual_bhop_and_side_swap(self):
        self.player.arena_input.update({'strafe': 0, 'forward': 1, 'jump': True, 'sprint': True, 'use': False})
        self.arena._move_dust(self.player, self.clock.now)
        self.assertFalse(self.player.on_ground)
        for _ in range(100):
            self.arena._move_dust(self.player, self.clock.now)
        self.assertTrue(self.player.on_ground)
        self.assertEqual(self.player.vy, 0.0, 'holding jump must not auto-hop after landing')
        original_team = self.player.team
        self.room.round_number = 6
        self.arena._begin_round(self.room, self.clock.now)
        self.assertNotEqual(self.player.team, original_team)

    def test_bot_carries_routes_and_plants_c4(self):
        self.room.phase = 'live'
        self.player.is_alive = False
        for player in self.room.players.values():
            if player.team == 'CT':
                player.is_alive = False
        bot = next(player for player in self.room.players.values() if player.team == 'T' and player.is_bot)
        self.room.bomb_carrier = bot.id
        for _ in range(900):
            self.arena._think_bot(self.room, bot)
            self.arena._move_dust(bot, self.clock.now)
            self.arena._objective(self.room, self.clock.now)
            self.clock.now += .05
        self.assertIsNotNone(self.room.bomb_planted_at)
        self.assertEqual(self.room.bomb_site, 'A')

    def test_ct_physically_rotates_across_map_and_defuses(self):
        self.room.phase = 'live'
        self.room.bomb_position = list(DUST2_MAP['sites']['A'])
        self.room.bomb_site = 'A'
        self.room.bomb_planted_at = 0.0
        self.room.bomb_carrier = None
        bot = next(p for p in self.room.players.values() if p.team == 'CT' and p.is_bot)
        for player in self.room.players.values():
            if player is not bot: player.is_alive = False
        for _ in range(790):
            self.arena._think_bot(self.room, bot)
            self.arena._move_dust(bot, self.clock.now)
            self.arena._objective(self.room, self.clock.now)
            if self.room.phase == 'post': break
            self.clock.now += .05
        self.assertEqual(self.room.phase, 'post')
        self.assertEqual(self.room.last_result['reason'], 'defuse')
        self.assertLess(self.clock.now, 40)

    def test_timed_hop_preserves_momentum(self):
        self.player.vx, self.player.vz = 10, 0
        self.player.arena_input.update({'strafe': 0, 'forward': 0, 'jump': True})
        self.arena._move_dust(self.player, self.clock.now)
        self.assertAlmostEqual(self.player.vx, 10)

    def test_ammo_misses_empty_magazine_and_timed_reload(self):
        self.room.phase, self.room.deadline = 'live', 1000
        for player in self.room.players.values():
            if getattr(player, 'is_bot', False): player.is_alive = False
        self.player.ammo, self.player.reserve_ammo = 1, 3
        self.player.attack_pending = True
        self.fire(self.clock.now)
        self.assertEqual(self.player.ammo, 0)
        self.clock.now = 1
        self.player.attack_pending = True
        self.fire(self.clock.now)
        self.assertEqual(self.player.ammo, 0)
        self.arena.process(self.player, {'type': 'arena_reload'})
        deadline = self.player.reload_until
        self.clock.now = 2
        self.player.attack_pending = True
        self.fire(self.clock.now)
        self.assertEqual(self.player.ammo, 0)
        self.arena.process(self.player, {'type': 'arena_reload'})
        self.assertEqual(self.player.reload_until, deadline)
        self.clock.now = deadline
        self.arena._tick_dust(self.room, self.clock.now)
        self.assertEqual((self.player.ammo, self.player.reserve_ammo), (3, 0))
        self.assertIsNone(self.player.reload_until)

    def test_eblan2_asset_spawns_and_both_objectives(self):
        self.assertEqual(DUST2_MAP['id'], 'de_eblan2')
        for player in self.room.players.values():
            self.assertFalse(self.arena.collides(player.x, player.y, player.z, DUST2_MAP))
        for site in ('A', 'B'):
            with self.subTest(site=site):
                self.setUp()
                self.room.phase = 'live'
                self.room.target_site = site
                carrier = next(p for p in self.room.players.values() if p.team == 'T' and getattr(p, 'is_bot', False))
                defender = next(p for p in self.room.players.values() if p.team == 'CT' and getattr(p, 'is_bot', False))
                for player in self.room.players.values():
                    player.is_alive = player is carrier
                self.room.bomb_carrier = carrier.id
                for _ in range(1600):
                    self.arena._think_bot(self.room, carrier)
                    self.arena._move_dust(carrier, self.clock.now)
                    self.arena._objective(self.room, self.clock.now)
                    self.clock.now += .05
                    if self.room.bomb_planted_at is not None: break
                self.assertEqual(self.room.bomb_site, site)
                self.assertIsNotNone(self.room.bomb_planted_at)
                self.assertAlmostEqual(carrier.y, DUST2_MAP['siteHeights'][site])
                carrier.is_alive, defender.is_alive = False, True
                planted = self.room.bomb_planted_at
                for _ in range(790):
                    self.arena._think_bot(self.room, defender)
                    self.arena._move_dust(defender, self.clock.now)
                    self.arena._objective(self.room, self.clock.now)
                    self.clock.now += .05
                    if self.room.phase == 'post': break
                self.assertEqual(self.room.phase, 'post')
                self.assertEqual(self.room.last_result['reason'], 'defuse')
                self.assertLess(self.clock.now - planted, 40)


if __name__ == '__main__':
    unittest.main()
