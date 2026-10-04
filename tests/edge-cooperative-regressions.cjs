const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../cloudflare/src/worker.js'), 'utf8');
const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(source.slice(0, source.indexOf('export default')), context);
class Socket {
    constructor() { this.readyState = 1; this.messages = []; this.handlers = {}; }
    accept() {}
    addEventListener(event, handler) { this.handlers[event] = handler; }
    send(raw) { this.messages.push(JSON.parse(raw)); }
    receive(packet) { this.handlers.message({ data: JSON.stringify(packet) }); }
}
const connect = vm.runInContext('handleWebSocketSession', context);
const first = new Socket(); connect(first);
first.receive({ type: 'join', room: 'coop_friends', mode: 'creative', name: 'Builder' });
const welcome = first.messages.at(-1);
assert.equal(welcome.world.mode, 'creative');
assert.equal(welcome.pvp, false);
first.receive({ type: 'move', x: 1, y: 24, z: 3 });
first.receive({ type: 'block_action', action: 'break', x: 1, y: 24, z: 3, block_type: 1 });
const second = new Socket(); connect(second);
second.receive({ type: 'join', room: 'coop_friends', mode: 'survival', name: 'Friend' });
assert.equal(second.messages.at(-1).world.seed, welcome.world.seed);
assert.equal(second.messages.at(-1).world.mode, 'creative');
assert.equal(second.messages.at(-1).blocks[0].block_type, 0);
first.receive({ type: 'attack', target_id: second.messages.at(-1).id });
assert.equal(first.messages.some(msg => msg.type === 'damage_event'), false);
first.receive({ type: 'inventory_sync', inventory: [{ itemId: 2, count: 5, name: 'stone' }], selected_slot: 0 });
assert.equal(first.messages.at(-1).inventory.length, 27);
assert.equal(second.messages.at(-1).held_item, 'stone');
first.receive({ type: 'chat', text: 'hello' });
assert.equal(second.messages.at(-1).text, 'hello');
assert.equal(second.messages.at(-1).room, 'coop_friends');
first.receive({ type: 'leave' }); second.receive({ type: 'leave' });
const third = new Socket(); connect(third);
third.receive({ type: 'join', room: 'coop_friends' });
assert.equal(third.messages.at(-1).blocks[0].block_type, 0, 'empty cooperative rooms must keep edits');
third.receive({ type: 'join', room: 'coop_other' });
assert.equal(vm.runInContext('rooms.get("coop_friends").clients.size', context), 0);
console.log('PASS: edge cooperative mode/seed, AIR persistence, full inventory, chat, no PvP and room lifecycle');
