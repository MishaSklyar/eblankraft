const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AuthorityWorld } = require('../server/engine');
const THREE = require('../js/three.min.js');

async function main() {
    const replies = [];
    const worker = vm.createContext({ console, WebAssembly, URL, Uint8Array, Float32Array, Uint32Array,
        fetch: async () => ({ ok: true, arrayBuffer: async () => fs.readFileSync('js/eblan_core.wasm') }),
        self: { postMessage: message => replies.push(message) } });
    vm.runInContext(fs.readFileSync('js/eblan_worker.js', 'utf8'), worker);
    await worker.self.onmessage({ data: { type: 'INIT', seed: 42, baseUrl: 'http://localhost:8081/' } });
    assert.equal(replies.pop().type, 'READY');
    const voxels = new Uint8Array(8192);
    for (let z = 0; z < 16; z++) for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
        voxels[x + 16 * (y + 32 * z)] = (x + y + z) % 2 ? 1 : 0;
    }
    await worker.self.onmessage({ data: { type: 'GEN_AND_MESH', id: 1, cx: 0, cz: 0, voxels } });
    const dense = replies.pop();
    assert.equal(dense.type, 'CHUNK_READY', 'memory growth must not detach the buffer used for results');
    assert.equal(dense.positions.length / 3, 147456);
    await worker.self.onmessage({ data: { type: 'GEN_AND_MESH', id: 2, cx: 0, cz: 0, voxels: new Uint8Array(9000) } });
    assert.equal(replies.pop().type, 'CHUNK_FAILED', 'task failures must resolve the caller through an error response');

    const engine = new AuthorityWorld(42, { worldType: 'flat' });
    const world = engine.world, core = engine.context.EblanEng;
    world.clearWorld();
    const material = new THREE.MeshBasicMaterial();
    world.textureManager = { getBlockMaterial: () => material };
    core.syncMaterials(world.textureManager);
    await worker.self.onmessage({ data: { type: 'SYNC_MATERIALS', blockMaterials: core.syncedBlockMaterials } });
    core.workerReady = true;
    let requests = [];
    core.requestChunkAsync = async options => {
        requests.push(options);
        await worker.self.onmessage({ data: { ...options, type: 'GEN_AND_MESH', id: 3 } });
        const reply = replies.pop();
        if (reply.type !== 'CHUNK_READY') throw new Error(reply.error);
        return reply;
    };
    const chunk = await world.generateChunkAsync(0, 0);
    assert.ok(requests[0].generateOnly, 'world generation must use the worker');
    const reference = new AuthorityWorld(42, { worldType: 'flat' });
    reference.world.clearWorld();
    const comparison = reference.chunk(0, 0);
    assert.deepEqual(Array.from(chunk.voxels), Array.from(comparison), 'worker generation preserves authoritative terrain');
    await world.rebuildChunkAsync(chunk);
    assert.ok(chunk.mesh, 'worker geometry is installed in the real THREE scene');
    assert.equal(chunk.isDirty, false);
    await world.generateChunkAsync(1, 0);
    assert.equal(chunk.isDirty, true, 'new neighbors invalidate old boundary meshes');
    const mesh = await world.prepareChunkMesh(chunk);
    assert.ok(mesh.isCurrent());
    world.setBlock(1, 1, 1, 0);
    assert.equal(mesh.isCurrent(), false, 'edits after worker completion invalidate the result');
    const request = core.requestChunkAsync;
    let release;
    core.requestChunkAsync = options => new Promise(resolve => { release = async () => resolve(await request(options)); });
    const pending = world.prepareChunkMesh(chunk);
    world.setBlock(2, 1, 1, 0);
    await release();
    assert.equal(await pending, null, 'edits in flight must not be overwritten');
    const pendingGeneration = world.generateChunkAsync(5, 5);
    world.clearWorld();
    await release();
    assert.equal(await pendingGeneration, null, 'old-world generation must not resurrect cleared chunks');
    core.requestChunkAsync = request;
    core.workerReady = false;
    for (let i = 0; i < 20; i++) world.generateSingleChunk(100 + i, 0).isDirty = false;
    const center = world.generateSingleChunk(0, 0);
    world.chunkRadius = 0;
    world.updateWaterPhysics = () => {};
    for (let frame = 0; frame < 20; frame++) world.update(0, 0);
    assert.equal(Object.values(world.chunks).filter(c => c.cx >= 100).length, 0, 'stationary frames continue disposal');
    let rebuilds = 0;
    center.rebuildMesh = () => { rebuilds++; center.isDirty = false; };
    center.isDirty = true;
    world.updateMeshes();
    assert.equal(rebuilds, 0, 'bulk updates enqueue dirty work instead of blocking the frame');
    world.update(0, 0);
    assert.equal(rebuilds, 1);
    core.workerReady = true;
    center.isDirty = true;
    world.update(0, 0);
    assert.ok(world.meshTask, 'runtime streaming dispatches worker meshing');
    assert.equal(rebuilds, 1, 'no synchronous rebuild while worker runs');
    await world.meshTask;
    world.update(0, 0);
    assert.equal(rebuilds, 2, 'one prepared result is applied on the next frame');

    let writes = 0;
    const board = { style: {}, set innerHTML(value) { writes++; } };
    const arenaContext = vm.createContext({ window: {}, document: { getElementById: () => board } });
    vm.runInContext(fs.readFileSync('js/arena_client.js', 'utf8'), arenaContext);
    const Arena = vm.runInContext('ArenaClient', arenaContext);
    const arena = Object.assign(Object.create(Arena.prototype), { scoreboardOpen: false, clientId: 'me',
        playerStates: [{ id: 'me', name: 'Player', team: 'T', alive: true, health: 100, kills: 0 }] });
    arena.renderScoreboard();
    assert.equal(writes, 0, 'hidden scoreboard does no DOM construction');
    arena.scoreboardOpen = true;
    arena.renderScoreboard(); arena.renderScoreboard();
    assert.equal(writes, 1, 'unchanged scoreboard reuses DOM');
    arena.playerStates[0].health = 50;
    arena.renderScoreboard();
    assert.equal(writes, 2, 'health changes remain visible');
    for (const file of ['world.js', 'eblan_eng.js', 'eblan_worker.js', 'arena_client.js']) {
        assert.equal(fs.readFileSync('js/' + file, 'utf8'), fs.readFileSync('web/js/' + file, 'utf8'));
    }
    const embedded = fs.readFileSync('js/eblan_eng.js', 'utf8').match(/const WORKER_BASE64 = '([^']*)'/)[1];
    assert.equal(Buffer.from(embedded, 'base64').toString(), fs.readFileSync('js/eblan_worker.js', 'utf8'));

    // Exercise the engine's transport and startup lifecycle, not only the worker handler.
    const transport = new AuthorityWorld(42).context;
    Object.assign(transport, { URL, Blob, setTimeout, clearTimeout, location: { href: 'http://localhost:8081/' } });
    transport.Worker = class {
        constructor() {
            this.queue = Promise.resolve();
            this.context = vm.createContext({ console, WebAssembly, URL, Uint8Array, Float32Array, Uint32Array,
                fetch: async () => ({ ok: true, arrayBuffer: async () => fs.readFileSync('js/eblan_core.wasm') }),
                self: { postMessage: data => this.onmessage?.({ data }) } });
            vm.runInContext(fs.readFileSync('js/eblan_worker.js', 'utf8'), this.context);
        }
        postMessage(data) { this.queue = this.queue.then(() => this.context.self.onmessage({ data })); }
        terminate() {}
    };
    const transportCore = transport.EblanEng;
    transportCore.initWorker(42);
    await transportCore.workerStartup;
    assert.equal(transportCore.workerReady, true);
    const transported = await transportCore.requestChunkAsync({ cx: 0, cz: 0, voxels });
    assert.equal(transported.positions.length / 3, 147456);
    assert.equal(transportCore.pendingTasks.size, 0, 'completed tasks release timers and callbacks');
    const failed = transportCore.requestChunkAsync({ cx: 0, cz: 0, voxels });
    const failureCheck = assert.rejects(failed, /unavailable/);
    transportCore.worker.onerror();
    await failureCheck;
    assert.equal(transportCore.workerReady, false);
    assert.equal(transportCore.pendingTasks.size, 0, 'worker crashes release every pending request');
    console.log('PASS: worker memory growth/errors, generation parity, asynchronous meshing, stale replies, boundaries, stationary disposal, bounded frame work, scoreboard and build parity');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
