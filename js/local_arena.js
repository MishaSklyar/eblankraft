/**
 * Offline Dust2 arena + on-demand script loading.
 *
 * eblanLoadScript(src): loads a classic <script> once and resolves when it has run. Works from file:// too
 * (unlike fetch), so the game still opens straight from disk. Heavy, rarely needed files (the 1.2 MB Dust2
 * map, the Lua VM, PeerJS, the WebGPU path tracer) go through it instead of being parsed at page load.
 *
 * LocalArenaSocket: a WebSocket stand-in that runs the real authority code (js/arena_core.js, the very file the
 * Node server uses) inside the page. ArenaClient talks to it exactly as it would to a server, so Dust2 1v1
 * against a bot needs no server, no network and no install.
 */
(function () {
    const pending = new Map();
    window.eblanLoadScript = function (src) {
        if (pending.has(src)) return pending.get(src);
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = () => { pending.delete(src); reject(new Error('Failed to load ' + src)); };
            (document.head || document.documentElement).appendChild(script);
        });
        pending.set(src, promise);
        return promise;
    };
    // Load a set of scripts in order (each may depend on the previous one).
    window.eblanLoadScripts = function (list) {
        return list.reduce((chain, src) => chain.then(() => window.eblanLoadScript(src)), Promise.resolve());
    };
    window.eblanLoadDust2 = function () {
        if (window.EBLAN_MAPS && window.EBLAN_MAPS.de_eblan2) return Promise.resolve();
        return window.eblanLoadScript('js/de_eblan2.js?v=1');
    };

    // Small compatibility shims for older browsers (old Safari / Android WebView / smart-TV browsers).
    if (!Array.prototype.at) {
        Object.defineProperty(Array.prototype, 'at', { configurable: true, writable: true, value(index) {
            index = Math.trunc(index) || 0;
            if (index < 0) index += this.length;
            return index < 0 || index >= this.length ? undefined : this[index];
        } });
    }
    if (!Object.hasOwn) Object.hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    if (!window.queueMicrotask) window.queueMicrotask = callback => Promise.resolve().then(callback);

    class LocalArenaSocket {
        constructor() {
            this.readyState = 0;            // CONNECTING, same numbers as WebSocket
            this.bufferedAmount = 0;
            this.local = true;
            this.onopen = this.onmessage = this.onclose = this.onerror = null;
            this.queue = [];
            window.eblanLoadDust2()
                .then(() => window.eblanLoadScript('js/arena_core.js?v=1'))
                .then(() => this.start(), error => this.fail(error));
        }

        start() {
            if (this.readyState !== 0) return;
            try {
                this.service = new window.EblanArena.ArenaService(() => performance.now() / 1000);
            } catch (error) { this.fail(error); return; }
            this.client = { id: 'local_' + Math.random().toString(36).slice(2, 8), room: null, is_closed: false,
                arena_mode: false, name: 'Player', close: () => this.close(), send_json: message => this.deliver(message) };
            this.readyState = 1;
            // The server runs its world at 20 Hz (STEP = 1/20); match it.
            this.timer = setInterval(() => {
                if (this.readyState !== 1) return;
                try { this.service.tick(); } catch (error) { console.error('Local arena tick failed:', error); }
            }, 50);
            if (this.onopen) this.onopen({ type: 'open' });
        }

        fail(error) {
            console.error('Local arena failed to start:', error);
            if (this.readyState === 3) return;
            this.readyState = 3;
            if (this.onerror) this.onerror({ type: 'error', error });
            if (this.onclose) this.onclose({ type: 'close' });
        }

        // Messages are handed over as objects (no JSON round-trip: the welcome packet carries the whole map's
        // collision boxes). Delivery is deferred so the client never re-enters itself from inside send().
        deliver(message) {
            if (this.readyState !== 1) return;
            this.queue.push(message);
            if (this.queue.length === 1) queueMicrotask(() => this.flush());
        }

        flush() {
            const messages = this.queue;
            this.queue = [];
            for (const message of messages) {
                if (this.readyState !== 1) return;
                if (this.onmessage) this.onmessage({ data: message });
            }
        }

        send(text) {
            if (this.readyState !== 1) return;
            let message;
            try { message = typeof text === 'string' ? JSON.parse(text) : text; } catch (error) { return; }
            if (!message || typeof message !== 'object') return;
            if (!this.client.arena_mode && message.type !== 'arena_join') return;   // economy_auth etc.
            this.service.process(this.client, message);
        }

        close() {
            if (this.readyState === 3) return;
            const wasOpen = this.readyState === 1;
            this.readyState = 3;
            clearInterval(this.timer);
            this.queue = [];
            if (this.client) {
                this.client.is_closed = true;
                this.client.room?.remove_client(this.client.id);
                this.client.room = null;
            }
            if (wasOpen && this.onclose) this.onclose({ type: 'close' });
        }
    }
    LocalArenaSocket.CONNECTING = 0;
    LocalArenaSocket.OPEN = 1;
    LocalArenaSocket.CLOSED = 3;
    window.LocalArenaSocket = LocalArenaSocket;
})();
