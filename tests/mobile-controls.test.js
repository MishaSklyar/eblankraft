const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

for (const dir of ['js', 'web/js']) {
    const controlsCode = fs.readFileSync(path.join(root, dir, 'controls.js'), 'utf8');

    function createEnv({ userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints = 0, coarse = false, fine = true } = {}) {
        const classSet = new Set();
        const listeners = {};
        const windowListeners = {};

        const document = {
            activeElement: null,
            getElementById: () => null,
            body: {
                classList: {
                    add: (c) => classSet.add(c),
                    remove: (c) => classSet.delete(c),
                    contains: (c) => classSet.has(c),
                    toggle: (c, val) => {
                        const setVal = val !== undefined ? !!val : !classSet.has(c);
                        if (setVal) classSet.add(c); else classSet.delete(c);
                        return setVal;
                    }
                }
            },
            addEventListener: (event, handler) => { listeners[event] = handler; },
            pointerLockElement: null
        };

        const window = {
            addEventListener: (event, handler) => { windowListeners[event] = handler; },
            matchMedia: (query) => {
                if (query.includes('coarse')) return { matches: coarse };
                if (query.includes('fine')) return { matches: fine };
                return { matches: false };
            }
        };

        const navigator = {
            userAgent,
            maxTouchPoints
        };

        const context = vm.createContext({
            window,
            document,
            navigator,
            THREE: { Vector2: class { set() { return this; } normalize() { return this; } } },
            console,
            setTimeout,
            clearTimeout
        });

        vm.runInContext(controlsCode + '\nthis.Controls = Controls;', context);

        const dummyPlayer = {
            isCreative: false,
            detonateTNT() {},
            position: { x: 0, y: 0, z: 0 },
            updatePhysics() {},
            getSelectedItem() { return null; }
        };

        const domElement = {
            addEventListener: (event, handler) => { listeners[event] = handler; },
            requestPointerLock: () => Promise.resolve()
        };

        return {
            context,
            windowListeners,
            listeners,
            classSet,
            instantiate: () => new context.Controls(dummyPlayer, domElement)
        };
    }

    test(`${dir}: mobile Android detects as touch device and never switches to PC on synthetic mouse events`, () => {
        const env = createEnv({
            userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
            maxTouchPoints: 5,
            coarse: true,
            fine: false
        });
        const ctrl = env.instantiate();
        assert.equal(ctrl.isTouchDevice, true, 'Pixel 8 must be detected as touch device');
        assert.equal(env.classSet.has('is-pc'), false, 'Mobile must not have is-pc class');
        assert.equal(env.classSet.has('force-touch'), true, 'Mobile must have force-touch class');

        // Synthetic mousemove and mousedown from mobile tap
        env.windowListeners.mousemove?.({ movementX: 5, movementY: 5, sourceCapabilities: { firesTouchEvents: true } });
        assert.equal(ctrl.isTouchDevice, true, 'Synthetic mousemove must not disable touch device');
        assert.equal(env.classSet.has('is-pc'), false, 'Synthetic mousemove must not add is-pc');

        env.windowListeners.mousedown?.({ button: 0, sourceCapabilities: { firesTouchEvents: true } });
        assert.equal(ctrl.isTouchDevice, true, 'Synthetic mousedown must not disable touch device');
        assert.equal(env.classSet.has('is-pc'), false, 'Synthetic mousedown must not add is-pc');

        // Pointer event from touch
        env.windowListeners.mousedown?.({ button: 0, pointerType: 'touch' });
        assert.equal(ctrl.isTouchDevice, true, 'Touch pointer must not disable touch device');
        assert.equal(env.classSet.has('is-pc'), false, 'Touch pointer must not add is-pc');
    });

    test(`${dir}: iPad with desktop-style Safari UA detects as touch device and keeps controls`, () => {
        const env = createEnv({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
            maxTouchPoints: 5,
            coarse: true,
            fine: false
        });
        const ctrl = env.instantiate();
        assert.equal(ctrl.isTouchDevice, true, 'iPadOS must be detected as touch device');
        assert.equal(env.classSet.has('is-pc'), false, 'iPadOS must not have is-pc class');
        assert.equal(env.classSet.has('force-touch'), true, 'iPadOS must have force-touch class');
    });

    test(`${dir}: desktop PC detects as PC mode and dynamically switches to touch mode on touchstart`, () => {
        const env = createEnv({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            maxTouchPoints: 0,
            coarse: false,
            fine: true
        });
        const ctrl = env.instantiate();
        assert.equal(ctrl.isTouchDevice, false, 'Desktop must be detected as PC mode');
        assert.equal(env.classSet.has('is-pc'), true, 'Desktop must have is-pc class');
        assert.equal(env.classSet.has('force-touch'), false, 'Desktop must not have force-touch class');

        // Touch interaction on touchscreen laptop
        env.windowListeners.touchstart?.({});
        assert.equal(ctrl.isTouchDevice, true, 'touchstart must activate touch mode');
        assert.equal(env.classSet.has('is-pc'), false, 'touchstart must remove is-pc');
        assert.equal(env.classSet.has('force-touch'), true, 'touchstart must add force-touch');

        // Real mouse movement switches back to PC mode
        env.windowListeners.mousemove?.({ movementX: 10, movementY: 5 });
        assert.equal(ctrl.isTouchDevice, false, 'real mousemove must restore PC mode');
        assert.equal(env.classSet.has('is-pc'), true, 'real mousemove must restore is-pc');
        assert.equal(env.classSet.has('force-touch'), false, 'real mousemove must remove force-touch');
    });

    test(`${dir}: pointer lock is skipped when in touch mode`, () => {
        const env = createEnv({
            userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/128.0.0.0 Mobile',
            maxTouchPoints: 10,
            coarse: true,
            fine: false
        });
        const ctrl = env.instantiate();
        let lockRequested = false;
        ctrl.domElement = { requestPointerLock: () => { lockRequested = true; } };
        ctrl.requestPointerLock();
        assert.equal(lockRequested, false, 'requestPointerLock must be skipped in touch mode');
    });
}

test('CSS rules ensure touch controls are visible when force-touch is present', () => {
    const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
    assert.match(css, /body\.is-pc:not\(\.force-touch\)\s+#touch-action-buttons/, 'is-pc rule must exclude force-touch');
    assert.match(css, /@media\s*\(pointer:\s*fine\)\s*\{[^}]*body:not\(\.force-touch\)\s+#touch-action-buttons/, 'pointer: fine rule must exclude force-touch');
});
