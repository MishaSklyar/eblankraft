const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['js/controls.js', 'web/js/controls.js']) {
    const request = async (navigator, failure) => {
        const context = vm.createContext({ navigator, window: {} });
        vm.runInContext(fs.readFileSync(file, 'utf8') + '\nthis.Controls = Controls;', context);
        const calls = [];
        const controls = Object.create(context.Controls.prototype);
        controls.domElement = { requestPointerLock(...args) {
            calls.push(JSON.parse(JSON.stringify(args)));
            if (calls.length === 1 && failure) {
                const error = Object.assign(new Error(), { name: failure.name });
                if (failure.sync) throw error;
                return Promise.reject(error);
            }
            return Promise.resolve();
        } };
        controls.requestPointerLock();
        await new Promise(resolve => setImmediate(resolve));
        return calls;
    };

    test(file + ': raw input only for Chrome', async () => {
        assert.deepEqual(await request({ userAgent: 'Chrome/130.0' }), [[{ unadjustedMovement: true }]]);
        assert.deepEqual(await request({ userAgent: '', userAgentData: { brands: [{ brand: 'Google Chrome' }] } }), [[{ unadjustedMovement: true }]]);
        for (const userAgent of ['Firefox/130', 'Version/18 Safari/605', 'Chrome/130 Edg/130', 'Chrome/130 OPR/115', 'CriOS/130', 'Chrome/130 SamsungBrowser/26']) {
            assert.deepEqual(await request({ userAgent }), [[]]);
        }
        assert.deepEqual(await request({ userAgent: 'Chrome/130', userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Microsoft Edge' }] } }), [[]]);
    });

    test(file + ': unsupported raw input falls back, other errors do not retry', async () => {
        for (const sync of [false, true]) {
            assert.deepEqual(await request({ userAgent: 'Chrome/130' }, { name: 'NotSupportedError', sync }), [[{ unadjustedMovement: true }], []]);
            assert.deepEqual(await request({ userAgent: 'Chrome/130' }, { name: 'NotAllowedError', sync }), [[{ unadjustedMovement: true }]]);
        }
    });
}
