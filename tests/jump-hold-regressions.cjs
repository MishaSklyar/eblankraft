const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
for (const source of ['js/controls.js', 'web/js/controls.js', 'competitive/js/controls.js']) {
    let now = 1000;
    const handlers = {};
    const window = { addEventListener: (event, handler) => handlers[event] = handler };
    const document = { activeElement: null, addEventListener() {}, body: { addEventListener() {} } };
    const context = vm.createContext({ window, document, performance: { now: () => now }, console });
    vm.runInContext(fs.readFileSync(path.join(root, source), 'utf8'), context);
    const Controls = vm.runInContext('Controls', context);
    const player = { isCreative: true, isFlying: false };
    const controls = Object.create(Controls.prototype);
    Object.assign(controls, { player, keys: {}, domElement: { addEventListener() {} } });
    controls.setupDesktopControls();
    const key = (repeat = false) => ({ code: 'Space', key: ' ', keyCode: 32, repeat, preventDefault() {} });
    handlers.keydown(key());
    for (let i = 0; i < 15; i++) {
        now += 50; handlers.keydown(key(true));
        assert.equal(player.isFlying, false, source + ": repeated keydown must not toggle flight");
    }
    assert.equal(player.isFlying, false, source + ': held Space must not toggle flight');
    assert.equal(controls.keys.Space, true, 'holding must preserve continuous jump input');
    handlers.keyup(key());
    now += 1000;
    handlers.keydown(key());
    handlers.keyup(key());
    now += 100;
    handlers.keydown(key());
    assert.equal(player.isFlying, true, 'two real presses must toggle flight');
    handlers.keyup(key());
    now += 1000;
    handlers.keydown(key());
    handlers.blur();
    now += 100;
    handlers.keydown(key());
    assert.equal(player.isFlying, true, 'blur must discard pending double tap');
}
console.log('PASS: holding jump, real double taps, continuous input and focus loss in all web versions');
