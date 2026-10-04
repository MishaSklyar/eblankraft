import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("competitive_server", Path(__file__).resolve().parents[1] / "competitive/server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class ServerTests(unittest.TestCase):
    module = server
    def setUp(self):
        self.server = self.module.AuthoritativeGameServer()
        self.client = self.module.WSClient(None, None, self.server)
        self.messages = []
        self.client.send_json = self.messages.append
        self.client.send_raw = lambda data: None
        self.server.process_message(self.client, {'type': 'join', 'room': 'test'})
        self.client.x, self.client.y, self.client.z = 1, 2, 3

    def send(self, **message):
        self.server.process_message(self.client, message)

    def test_late_join_keeps_air_and_placed_blocks(self):
        self.send(type='block_action', action='break', x=1, y=2, z=3, block_type=1)
        self.send(type='block_action', action='place', x=2, y=2, z=3, block_type=4)
        self.send(type='join', room='test')
        edits = self.messages[-1]['blocks']
        self.assertIn({'x': 1, 'y': 2, 'z': 3, 'block_type': 0}, edits)
        self.assertIn({'x': 2, 'y': 2, 'z': 3, 'block_type': 4}, edits)

    def test_invalid_actions_do_not_edit_room(self):
        for action, x, y, block in [('invalid', 1, 2, 1), ('break', 999, 2, 1),
                                     ('place', 1, -1, 1), ('place', 1, 2, 0)]:
            self.send(type='block_action', action=action, x=x, y=y, z=3, block_type=block)
        self.assertEqual(self.client.room.blocks, {})
        self.client.is_alive = False
        self.send(type='block_action', action='break', x=1, y=2, z=3, block_type=1)
        self.assertEqual(self.client.room.blocks, {})

    def test_full_inventory_and_invalid_snapshots(self):
        slots = [None] * 27
        slots[0] = {'itemId': 5, 'count': 3, 'name': 'stone'}
        slots[26] = {'itemId': 7, 'count': 64, 'name': 'apple'}
        self.send(type='inventory_sync', inventory=slots, selected_slot=0)
        self.assertEqual(self.client.inventory[26]['count'], 64)
        self.assertEqual(self.client.held_item, 'stone')
        self.assertEqual(self.messages[-1]['type'], 'inventory_state')
        previous = self.client.inventory
        for bad in ['bad', [False], [{'itemId': 5, 'count': -1}], [None] * 28]:
            self.send(type='inventory_sync', inventory=bad)
            self.assertIs(self.client.inventory, previous)
        self.send(type='inventory_sync', inventory=slots, selected_slot=9)
        self.assertEqual(self.client.selected_slot, 0)
        self.server.process_message(self.client, [])

    def test_room_switch_removes_old_membership(self):
        old_room = self.client.room
        self.send(type='join', room='second')
        self.assertNotIn(self.client.id, old_room.clients)
        self.assertEqual(self.messages[-1]['blocks'], [])

    def test_cooperative_world_is_shared_and_mode_is_locked(self):
        self.send(type='join', room='coop_friends', mode='creative')
        first = self.messages[-1]
        self.client.x, self.client.y, self.client.z = 1, 2, 3
        self.assertFalse(first['pvp'])
        self.assertEqual(first['world']['mode'], 'creative')
        self.send(type='block_action', action='break', x=1, y=2, z=3, block_type=1)
        friend = self.module.WSClient(None, None, self.server)
        messages = []
        friend.send_json = messages.append
        friend.send_raw = lambda data: None
        self.server.process_message(friend, {'type': 'join', 'room': 'coop_friends', 'mode': 'survival'})
        self.assertEqual(messages[-1]['world'], first['world'])
        self.assertEqual(messages[-1]['blocks'][0]['block_type'], 0)
        friend.x, friend.y, friend.z = 1, 2, 3
        self.send(type='attack', target_id=friend.id)
        self.assertEqual(friend.health, 100)
        self.send(type='tnt_explode', x=1, y=2, z=3, radius=4)
        self.assertEqual(friend.health, 100, 'friendly explosives must not damage other players')
        self.server.process_message(friend, {'type': 'join', 'room': 'pvp_arena'})
        self.send(type='join', room='pvp_arena')
        self.send(type='attack', target_id=friend.id)
        self.assertLess(friend.health, 100, 'PvP rooms must still allow combat')

    def test_leave_stops_room_actions(self):
        old_room = self.client.room
        self.send(type='leave')
        self.assertIsNone(self.client.room)
        self.assertNotIn(self.client.id, old_room.clients)
        self.send(type='block_action', action='place', x=1, y=2, z=3, block_type=4)
        self.assertEqual(old_room.blocks, {})


mainline_spec = importlib.util.spec_from_file_location("mainline_server", Path(__file__).resolve().parents[1] / "server.py")
mainline_server = importlib.util.module_from_spec(mainline_spec)
mainline_spec.loader.exec_module(mainline_server)


class MainlineServerTests(ServerTests):
    module = mainline_server


if __name__ == '__main__':
    unittest.main()
