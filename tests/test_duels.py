import json
import unittest
from unittest.mock import patch

import server


class InlineThread:
    def __init__(self, target, args=(), **_kwargs):
        self.target, self.args = target, args

    def start(self):
        self.target(*self.args)


class DuelTests(unittest.TestCase):
    def setUp(self):
        self.game = server.AuthoritativeGameServer()
        self.players = []

    def player(self, name):
        client = server.WSClient(None, None, self.game)
        client.messages = []
        client.send_json = client.messages.append
        client.send_raw = lambda frame: client.messages.append(json.loads(frame[2:] if frame[1] < 126 else frame[4:]))
        self.game.process_message(client, {'type': 'join', 'room': 'pvp_arena', 'name': name})
        self.players.append(client)
        return client

    def match(self, kit='classic'):
        first, second = self.player('First'), self.player('Second')
        with patch.object(server.threading, 'Thread', InlineThread):
            self.game.enqueue_duel(first, first.name, kit)
            self.game.enqueue_duel(second, second.name, kit)
        return first, second, first.room

    def ready(self, first, second):
        with patch.object(server.threading, 'Thread', InlineThread), patch.object(server.time, 'sleep'):
            self.game.process_message(first, {'type': 'duel_ready'})
            self.assertEqual(first.room.duel_phase, 'loading')
            self.game.process_message(second, {'type': 'duel_ready'})
        self.assertEqual(first.room.duel_phase, 'live')

    def test_matchmaking_matches_same_kit_and_cancellation(self):
        sword, fists, opponent = self.player('Sword'), self.player('Fists'), self.player('Opponent')
        with patch.object(server.threading, 'Thread', InlineThread):
            self.game.enqueue_duel(sword, sword.name, 'classic')
            self.game.enqueue_duel(fists, fists.name, 'shawarma')
            self.assertEqual(sword.room.name, 'pvp_arena')
            self.game.enqueue_duel(opponent, opponent.name, 'classic')
        self.assertIs(sword.room, opponent.room)
        self.assertEqual(sword.room.duel_kit, 'classic')
        self.assertEqual(fists.room.name, 'pvp_arena')
        self.game.process_message(fists, {'type': 'leave_duel_queue'})
        self.assertFalse(self.game.duel_queue)
        self.game.enqueue_duel(fists, fists.name, 'bow')
        self.assertEqual(fists.messages[-1]['type'], 'duel_error')

    def test_real_ready_countdown_and_kit_owned_damage(self):
        first, second, room = self.match()
        second.x, second.y, second.z = first.x, first.y, first.z + 2
        self.game.process_message(first, {'type': 'attack', 'target_id': second.id})
        self.assertEqual(second.health, 100)
        self.ready(first, second)
        self.assertEqual([m['seconds'] for m in first.messages if m['type'] == 'duel_countdown'], [3, 2, 1, 0])
        first.held_item = 'eblan_sword'
        self.game.process_message(first, {'type': 'attack', 'target_id': second.id})
        self.assertEqual(second.health, 76, 'duel equipment must not override kit damage')
        self.game.process_message(first, {'type': 'attack', 'target_id': second.id})
        self.assertEqual(second.health, 76, 'kit cooldown rejects immediate repeat')
        self.game.process_message(first, {'type': 'block_action', 'action': 'place', 'x': 0, 'y': 5, 'z': -14, 'block_type': 1})
        self.assertFalse(room.blocks)

    def test_shield_and_fists_are_distinct(self):
        first, second, room = self.match()
        self.ready(first, second)
        second.x, second.y, second.z, second.yaw = first.x, first.y, first.z + 2, 0
        second.duel_blocking = True
        second.held_item = 'shield'
        self.game.process_message(first, {'type': 'attack', 'target_id': second.id})
        self.assertEqual(second.health, 91.6)
        first, second, room = self.match('shawarma')
        self.ready(first, second)
        second.x, second.y, second.z = first.x, first.y, first.z + 2
        self.game.process_message(first, {'type': 'attack', 'target_id': second.id})
        self.assertEqual(second.health, 88)

    def test_result_once_no_respawn_no_second_forfeit_result(self):
        first, second, room = self.match()
        self.ready(first, second)
        second.x, second.y, second.z, second.health = first.x, first.y, first.z + 2, 1
        self.game.process_message(first, {'type': 'attack', 'target_id': second.id})
        self.assertEqual(room.duel_phase, 'finished')
        self.game.process_message(second, {'type': 'respawn'})
        self.assertFalse(second.is_alive)
        self.game.process_message(second, {'type': 'leave'})
        results = [m for m in first.messages if m['type'] == 'duel_round_end']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['winner_id'], first.id)

    def test_leaving_live_duel_awards_opponent(self):
        first, second, room = self.match()
        self.ready(first, second)
        self.game.process_message(first, {'type': 'leave'})
        results = [m for m in second.messages if m['type'] == 'duel_round_end']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['winner_id'], second.id)
        self.assertIsNone(first.room)


if __name__ == '__main__':
    unittest.main()
