const SERVER = 'https://eblancraftbeta-ws.plese0580.workers.dev';
export default {
    fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/ws' || url.pathname === '/api/status' || url.pathname === '/api/bug-report' || url.pathname.startsWith('/api/economy/')) {
            const upstream = new URL(url.pathname + url.search, SERVER);
            return fetch(new Request(upstream, request));
        }
        return env.ASSETS.fetch(request);
    }
};
