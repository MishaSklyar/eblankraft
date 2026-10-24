const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthorityWorld } = require('../server/engine');
const { AuthoritativeGameServer, WSClient } = require('../server');

function emptyWorld(world) {
    world.chunk(0, 0).fill(0);
    world.world.modifiedBlocks.clear();
}
test('authority visibility passes through empty shape space and blocks the occupied volume', () => {
    const world = new AuthorityWorld(123); emptyWorld(world);
    const rays = [
        ['STONE_SLAB', { x: .5, y: 10.75, z: 2.5 }, { x: 4.5, y: 10.75, z: 2.5 },
            { x: .5, y: 10.25, z: 2.5 }, { x: 4.5, y: 10.25, z: 2.5 }],
        ['STONE_PANEL_X', { x: .5, y: 10.5, z: 2.1 }, { x: 4.5, y: 10.5, z: 2.1 },
            { x: .5, y: 10.5, z: 2.5 }, { x: 4.5, y: 10.5, z: 2.5 }],
        ['STONE_PANEL_Z', { x: 2.1, y: 10.5, z: .5 }, { x: 2.1, y: 10.5, z: 4.5 },
            { x: 2.5, y: 10.5, z: .5 }, { x: 2.5, y: 10.5, z: 4.5 }],
        ['STONE_PILLAR', { x: .5, y: 10.5, z: 2.1 }, { x: 4.5, y: 10.5, z: 2.1 },
            { x: .5, y: 10.5, z: 2.5 }, { x: 4.5, y: 10.5, z: 2.5 }],
        ['STONE_BEAM', { x: .5, y: 10.8, z: 2.5 }, { x: 4.5, y: 10.8, z: 2.5 },
            { x: .5, y: 10.5, z: 2.5 }, { x: 4.5, y: 10.5, z: 2.5 }]
    ];
    for (const [key, from, to, blockedFrom, blockedTo] of rays) {
        world.setBlock(2, 10, 2, world.blocks[key]);
        assert.equal(world.visible(from, to), true, key + ' empty space');
        assert.equal(world.visible(blockedFrom, blockedTo), false, key + ' occupied space');
        world.setBlock(2, 10, 2, world.blocks.STONE);
        assert.equal(world.visible(from, to), false, 'full wall remains opaque');
    }
});

test('server accepts block actions above slabs while rejecting actions through their occupied half', t => {
    const game = new AuthoritativeGameServer(); t.after(() => game.stop());
    const p = new WSClient(null, game); p.send_json = () => {};
    game.process_message(p, { type: 'join', room: 'coop_shapes', mode: 'creative' });
    const world = p.room.world(); emptyWorld(world);
    Object.assign(p, { x: .5, y: 9.13, z: 2.5 });
    world.setBlock(2, 10, 2, world.blocks.STONE_SLAB);
    game.process_message(p, { type: 'block_action', action: 'place', x: 4, y: 10, z: 2, block_type: world.blocks.STONE });
    assert.equal(world.getBlock(4, 10, 2), world.blocks.STONE);
    p.y = 8.63;
    game.process_message(p, { type: 'block_action', action: 'break', x: 4, y: 10, z: 2, block_type: world.blocks.STONE });
    assert.equal(world.getBlock(4, 10, 2), world.blocks.STONE);
});

const fs = require('node:fs');
const vm = require('node:vm');
for (const prefix of ['js', 'web/js']) {
    test(`${prefix}: landing uses the true shape surface and stays clear on authority`, () => {
        const world = new AuthorityWorld(123); emptyWorld(world);
        const source = fs.readFileSync(`${prefix}/player.js`, 'utf8');
        const start = source.indexOf('                const minX =', source.indexOf('// Falling: find'));
        const end = source.indexOf('                this.onGround = true;', start);
        for (const [key, top] of [['STONE_SLAB', 10.5], ['STONE_BEAM', 10.625], ['STONE_PILLAR', 11], ['STONE_PANEL_X', 11], ['STONE', 11]]) {
            world.setBlock(2, 10, 2, world.blocks[key]);
            const player = { world, position: { x: 2.5, y: 11.1, z: 2.5 }, width: .6, depth: .6 };
            world.context.player = player;
            vm.runInContext(`(function () { const nextPosY = { y: 10.4 }; ${source.slice(start, end)} }).call(player)`, world.context);
            assert.equal(player.position.y, top, key);
            assert.equal(world.collides(2.5, player.position.y, 2.5), false, 'landing must not penetrate shape');
        }
    });
}

test('authority movement permits empty panel space while preventing penetration', () => {
    const world = new AuthorityWorld(123); emptyWorld(world);
    world.setBlock(2, 10, 2, world.blocks.STONE_PANEL_X);
    assert.equal(world.pathClear({ x: 1.5, y: 10, z: 2.1 }, { x: 3.5, y: 10, z: 2.1 }), true);
    assert.equal(world.pathClear({ x: 1.5, y: 10, z: 2.5 }, { x: 3.5, y: 10, z: 2.5 }), false);
    world.setBlock(2, 10, 2, world.blocks.STONE_SLAB);
    assert.equal(world.pathClear({ x: 1.5, y: 10.5, z: 2.5 }, { x: 3.5, y: 10.5, z: 2.5 }), true);
    assert.equal(world.pathClear({ x: 1.5, y: 10.4, z: 2.5 }, { x: 3.5, y: 10.4, z: 2.5 }), false);
});
