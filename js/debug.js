(() => {
    const toggle = document.getElementById('chk-debug');
    const panel = document.getElementById('debug-panel');
    const output = document.getElementById('debug-info');
    if (!toggle || !panel || !output) return;
    let enabled = false, frame = null, updated = 0;
    const number = value => Number.isFinite(value) ? Math.round(value * 10) / 10 : '—';
    function snapshot() {
        const game = window.game;
        const world = game?.world;
        const chunks = Object.values(world?.chunks || {});
        const core = window.EblanEng;
        const render = game?.renderer;
        const info = render?.info;
        const stats = game?.getFrameStats?.();
        const position = game?.player?.position;
        return [
            `FPS: ${stats?.count ? number(stats.fps) : '—'} | кадр середній/макс: ${stats?.count ? number(stats.average) : '—'}/${stats?.count ? number(stats.max) : '—'} ms | ≥50 ms: ${stats?.spikes || 0}/${stats?.count || 0}`,
            `CPU кадру: ${number(game?.lastFrameCpuTime)} ms | стримінг: ${number(game?.lastStreamingTime)} | culling: ${number(game?.lastCullingTime)} | render CPU: ${number(game?.lastRenderSubmitTime)}`,
            `Чанки: ${chunks.length} | брудні: ${chunks.filter(chunk => chunk.isDirty).length} | черга: ${world?.chunkGenQueue?.length || 0}`,
            `Генерація: ${!!world?.generationTask} | мешинг: ${!!world?.meshTask} | готовий меш: ${!!world?.readyChunkMesh}`,
            `WASM: ${!!core?.ready} | worker: ${!!core?.workerReady} | задачі: ${core?.pendingTasks?.size || 0}`,
            `Draw calls: ${info?.render?.calls ?? '—'} | трикутники: ${info?.render?.triangles ?? '—'} | геометрії: ${info?.memory?.geometries ?? '—'} | текстури: ${info?.memory?.textures ?? '—'}`,
            `Екран: ${window.innerWidth}×${window.innerHeight} | DPR: ${number(window.devicePixelRatio)} | render ratio: ${number(render?.getPixelRatio?.())}`,
            `Тіні: ${!!game?.shadowsEnabled} | листя/вітер: ${!!game?.windLeavesEnabled} | Graphics: ${game?.graphicsPreset || '—'}`,
            `Світ: ${world?.worldType || '—'} | вимір: ${world?.dimension || '—'} | радіус: ${world?.chunkRadius ?? '—'}`,
            `Позиція: ${number(position?.x)}, ${number(position?.y)}, ${number(position?.z)}`
        ].join('\n').slice(0, 1200);
    }
    function tick(now) {
        if (!enabled) return;
        if (now - updated >= 500) {
            output.textContent = snapshot();
            updated = now;
        }
        frame = requestAnimationFrame(tick);
    }
    toggle.addEventListener('change', () => {
        enabled = toggle.checked;
        panel.hidden = !enabled;
        if (frame !== null) cancelAnimationFrame(frame);
        if (enabled) {
            output.textContent = snapshot();
            frame = requestAnimationFrame(tick);
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (window.game) window.game.lastRenderedAt = undefined;
    });
    window.EblanDebug = { snapshot, get enabled() { return enabled; } };
})();
