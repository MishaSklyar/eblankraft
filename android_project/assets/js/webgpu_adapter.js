/**
 * WebGPUAdapter - Optional WebGPU Detection, Hardware Diagnostic & Safe WebGL Fallback
 * Designed for Eblankraft 2.0. Completely safe on low-end devices (Samsung A02, Intel Ironlake, etc.).
 */

class WebGPUAdapter {
    constructor() {
        this.isSupported = typeof navigator !== 'undefined' && !!navigator.gpu;
        this.activeBackend = 'webgl'; // 'webgl' or 'webgpu'
        this.adapter = null;
        this.device = null;
        this.adapterInfo = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return this.activeBackend;
        this.initialized = true;

        const isMobileOrAndroid = typeof navigator !== 'undefined' && (
            /Android|Mobile|SM-A02/i.test(navigator.userAgent) ||
            window.isAndroidApp ||
            (window.location && window.location.protocol === 'file:')
        );

        const isQtWebEngine = typeof navigator !== 'undefined' && /QtWebEngine/i.test(navigator.userAgent);
        if (isQtWebEngine) {
            console.log('⚡ [WebGPUAdapter] QtWebEngine client detected. Using dedicated high-performance WebGL engine.');
            this.isSupported = false;
            this.activeBackend = 'webgl';
            return 'webgl';
        }

        if (isMobileOrAndroid) {
            console.log('📱 [WebGPUAdapter] Android / Mobile detected. WebGPU bypassed for 100% stable hardware WebGL on Samsung A02.');
            this.isSupported = false;
            this.activeBackend = 'webgl';
            return 'webgl';
        }

        if (!this.isSupported) {
            console.log('🎮 [WebGPUAdapter] WebGPU not available in browser/hardware. Using optimized WebGL engine.');
            this.activeBackend = 'webgl';
            return 'webgl';
        }

        try {
            this.adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });

            if (!this.adapter) {
                console.log('🎮 [WebGPUAdapter] No suitable WebGPU adapter found. Using WebGL engine.');
                this.activeBackend = 'webgl';
                return 'webgl';
            }

            // Request adapter info if supported by browser
            if (this.adapter.requestAdapterInfo) {
                try {
                    this.adapterInfo = await this.adapter.requestAdapterInfo();
                } catch (e) {}
            }

            // Test device initialization
            this.device = await this.adapter.requestDevice();
            this.activeBackend = 'webgpu';
            console.log('⚡ [WebGPUAdapter] Hardware WebGPU backend active!', {
                vendor: this.adapterInfo ? this.adapterInfo.vendor : 'generic',
                architecture: this.adapterInfo ? this.adapterInfo.architecture : 'unknown',
                limits: this.device.limits
            });
            return 'webgpu';
        } catch (err) {
            console.warn('⚠️ [WebGPUAdapter] WebGPU init failed or blocked, falling back to WebGL:', err);
            this.activeBackend = 'webgl';
            return 'webgl';
        }
    }

    getBackendName() {
        if (this.activeBackend === 'webgpu') {
            return 'WebGPU ⚡';
        }
        return 'WebGL (Mesa/GL) 🎮';
    }

    getStatusString() {
        if (typeof navigator !== 'undefined' && /Android|Mobile|SM-A02/i.test(navigator.userAgent)) {
            return 'WebGL 🎮 (Мобільний буст Samsung A02)';
        }
        if (this.activeBackend === 'webgpu') {
            const vendor = (this.adapterInfo && this.adapterInfo.vendor) ? ` (${this.adapterInfo.vendor})` : '';
            return `WebGPU Активен${vendor}`;
        }
        return this.isSupported ? 'WebGL (WebGPU доступен, но не задействован)' : 'WebGL (WebGPU не поддерживается)';
    }
}

window.WebGPUAdapter = new WebGPUAdapter();
