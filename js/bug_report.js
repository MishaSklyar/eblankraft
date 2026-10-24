(() => {
    const button = document.getElementById('mm-btn-bug-report');
    const dialog = document.getElementById('bug-report-dialog');
    const form = document.getElementById('bug-report-form');
    if (!button || !dialog || !form) return;
    const status = document.getElementById('bug-report-status');
    const submit = document.getElementById('bug-report-submit');
    const debugCheckbox = document.getElementById('bug-report-debug');
    const debug = () => typeof window !== 'undefined' ? window.EblanDebug : null;
    let sending = false;
    button.addEventListener('click', () => {
        if (document.pointerLockElement) document.exitPointerLock();
        status.textContent = '';
        if (debugCheckbox) debugCheckbox.checked = !!debug()?.enabled;
        dialog.showModal();
    });
    document.getElementById('bug-report-cancel').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending || !form.reportValidity()) return;
        sending = true;
        submit.disabled = true;
        status.textContent = 'Надсилання…';
        try {
            const response = await fetch('/api/bug-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(15000),
                body: JSON.stringify({
                    name: form.elements.name.value.trim(),
                    message: form.elements.message.value.trim(),
                    page: location.origin + location.pathname,
                    browser: navigator.userAgent.slice(0, 200),
                    ...(debugCheckbox?.checked && debug() ? { diagnostics: debug().snapshot() } : {})
                })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || 'Не вдалося надіслати.');
            form.reset();
            status.textContent = 'Дякуємо! Повідомлення надіслано розробнику.';
        } catch (error) {
            status.textContent = error.name === 'TimeoutError'
                ? 'Сервер не відповів вчасно. Повідомлення могло надійти; зачекайте перед повторною спробою.'
                : error instanceof TypeError ? 'Немає зв’язку з сервером. Спробуйте пізніше.' : error.message;
        } finally {
            sending = false;
            submit.disabled = false;
        }
    });
})();
