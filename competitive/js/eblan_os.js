// ============================================================================
// EBLAN OS v2.5 - Retro Operating System for In-Game Computer
// ============================================================================

class EblanOS {
    constructor(container, game) {
        this.container = container;
        this.game = game;
        this.windows = new Map();
        this.activeWindowId = null;
        this.nextZIndex = 100;
        this.startMenuOpen = false;
        
        // System Settings
        this.settings = {
            wallpaper: localStorage.getItem('eblan_os_wallpaper') || 'teal',
            crtFilter: localStorage.getItem('eblan_os_crt') === 'true',
            soundEnabled: localStorage.getItem('eblan_os_sound') !== 'false'
        };

        this.init();
    }

    init() {
        this.renderDesktop();
        this.bindEvents();
        this.startClock();
        this.applySettings();

        // Welcome notification
        setTimeout(() => {
            this.showNotification('Eblan OS v2.5', 'Ласкаво просимо! Система готова до роботи.');
        }, 600);
    }

    renderDesktop() {
        this.container.innerHTML = `
            <div class="eblan-os-desktop ${this.settings.wallpaper}" id="eblan-desktop">
                <div class="eblan-crt-overlay ${this.settings.crtFilter ? 'active' : ''}" id="eblan-crt"></div>
                
                <!-- Desktop Icons -->
                <div class="eblan-desktop-icons" id="eblan-icons">
                    <div class="eblan-icon" data-app="browser" title="Інтернет Браузер">
                        <div class="eblan-icon-img">🌐</div>
                        <div class="eblan-icon-label">Ебланет</div>
                    </div>
                    <div class="eblan-icon" data-app="settings" title="Налаштування системи">
                        <div class="eblan-icon-img">⚙️</div>
                        <div class="eblan-icon-label">Налаштування</div>
                    </div>
                    <div class="eblan-icon" data-app="minesweeper" title="Класичний Сапер">
                        <div class="eblan-icon-img">💣</div>
                        <div class="eblan-icon-label">Сапер</div>
                    </div>
                    <div class="eblan-icon" data-app="snake" title="Ретро Змійка">
                        <div class="eblan-icon-img">🐍</div>
                        <div class="eblan-icon-label">Змійка</div>
                    </div>
                    <div class="eblan-icon" data-app="notepad" title="Текстовий редактор">
                        <div class="eblan-icon-img">📝</div>
                        <div class="eblan-icon-label">Блокнот</div>
                    </div>
                    <div class="eblan-icon" data-app="cmd" title="Командний рядок EblanPrompt">
                        <div class="eblan-icon-img">💻</div>
                        <div class="eblan-icon-label">Термінал</div>
                    </div>
                    <div class="eblan-icon" data-app="emuos" title="EmuOS Емулятор">
                        <div class="eblan-icon-img">🕹️</div>
                        <div class="eblan-icon-label">EmuOS 95</div>
                    </div>
                    <div class="eblan-icon" data-app="trash" title="Кошик">
                        <div class="eblan-icon-img">🗑️</div>
                        <div class="eblan-icon-label">Кошик</div>
                    </div>
                </div>

                <!-- Windows Container -->
                <div class="eblan-windows-layer" id="eblan-windows-layer"></div>

                <!-- Start Menu -->
                <div class="eblan-start-menu" id="eblan-start-menu" style="display: none;">
                    <div class="eblan-start-sidebar">
                        <span>EBLAN<b>OS</b> 2.5</span>
                    </div>
                    <div class="eblan-start-content">
                        <div class="eblan-start-item" data-app="browser">🌐 <span>Ебланет (Браузер)</span></div>
                        <div class="eblan-start-item" data-app="settings">⚙️ <span>Панель керування</span></div>
                        <div class="eblan-start-item" data-app="minesweeper">💣 <span>Гра Сапер</span></div>
                        <div class="eblan-start-item" data-app="snake">🐍 <span>Гра Змійка</span></div>
                        <div class="eblan-start-item" data-app="notepad">📝 <span>Блокнот</span></div>
                        <div class="eblan-start-item" data-app="cmd">💻 <span>Командний рядок</span></div>
                        <div class="eblan-start-item" data-app="emuos">🕹️ <span>EmuOS Емуляція</span></div>
                        <div class="eblan-start-separator"></div>
                        <div class="eblan-start-item" id="eblan-shutdown-btn">🔌 <span>Вимкнути ПК</span></div>
                    </div>
                </div>

                <!-- Taskbar -->
                <div class="eblan-taskbar" id="eblan-taskbar">
                    <button class="eblan-start-btn" id="eblan-start-btn">
                        <span class="eblan-logo-flag">🪟</span>
                        <b>Пуск</b>
                    </button>
                    <div class="eblan-taskbar-tasks" id="eblan-taskbar-tasks"></div>
                    <div class="eblan-taskbar-tray">
                        <span class="eblan-tray-icon" id="eblan-tray-sound" title="Звук">🔊</span>
                        <span class="eblan-tray-clock" id="eblan-clock">12:00</span>
                    </div>
                </div>

                <!-- Notification Popup -->
                <div class="eblan-toast-container" id="eblan-toasts"></div>
            </div>
        `;
    }

    bindEvents() {
        const desktop = this.container.querySelector('#eblan-desktop');
        const startBtn = this.container.querySelector('#eblan-start-btn');
        const startMenu = this.container.querySelector('#eblan-start-menu');

        // Start Menu Toggle
        startBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStartMenu();
        });

        // Close start menu on outside click
        desktop.addEventListener('click', (e) => {
            if (!startMenu.contains(e.target) && e.target !== startBtn) {
                this.closeStartMenu();
            }
        });

        // Desktop Icons Click
        this.container.querySelectorAll('.eblan-icon').forEach(icon => {
            icon.addEventListener('dblclick', () => {
                const app = icon.dataset.app;
                this.openApp(app);
            });
            // Single tap support for touch / quick launch
            icon.addEventListener('click', (e) => {
                this.selectIcon(icon);
            });
        });

        // Start Menu items
        startMenu.querySelectorAll('.eblan-start-item[data-app]').forEach(item => {
            item.addEventListener('click', () => {
                this.openApp(item.dataset.app);
                this.closeStartMenu();
            });
        });

        // Shutdown Button
        const shutdownBtn = this.container.querySelector('#eblan-shutdown-btn');
        if (shutdownBtn) {
            shutdownBtn.addEventListener('click', () => {
                this.closeStartMenu();
                this.showNotification('Вимкнення...', 'Завершення роботи Eblan OS.');
                setTimeout(() => {
                    if (this.game && this.game.ui) {
                        this.game.ui.closeEmuOSModal();
                    }
                }, 700);
            });
        }

        // Sound toggle in tray
        const soundTray = this.container.querySelector('#eblan-tray-sound');
        if (soundTray) {
            soundTray.addEventListener('click', () => {
                this.settings.soundEnabled = !this.settings.soundEnabled;
                localStorage.setItem('eblan_os_sound', this.settings.soundEnabled);
                soundTray.textContent = this.settings.soundEnabled ? '🔊' : '🔇';
                this.showNotification('Аудіо', this.settings.soundEnabled ? 'Звук увімкнено' : 'Звук вимкнено');
            });
        }
    }

    selectIcon(selectedIcon) {
        this.container.querySelectorAll('.eblan-icon').forEach(i => i.classList.remove('selected'));
        selectedIcon.classList.add('selected');
    }

    toggleStartMenu() {
        const startMenu = this.container.querySelector('#eblan-start-menu');
        const startBtn = this.container.querySelector('#eblan-start-btn');
        this.startMenuOpen = !this.startMenuOpen;
        if (this.startMenuOpen) {
            startMenu.style.display = 'flex';
            startBtn.classList.add('active');
        } else {
            startMenu.style.display = 'none';
            startBtn.classList.remove('active');
        }
    }

    closeStartMenu() {
        this.startMenuOpen = false;
        const startMenu = this.container.querySelector('#eblan-start-menu');
        const startBtn = this.container.querySelector('#eblan-start-btn');
        if (startMenu) startMenu.style.display = 'none';
        if (startBtn) startBtn.classList.remove('active');
    }

    startClock() {
        const clockEl = this.container.querySelector('#eblan-clock');
        const update = () => {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            if (clockEl) clockEl.textContent = `${h}:${m}`;
        };
        update();
        setInterval(update, 1000);
    }

    showNotification(title, message) {
        const toasts = this.container.querySelector('#eblan-toasts');
        if (!toasts) return;
        const toast = document.createElement('div');
        toast.className = 'eblan-toast';
        toast.innerHTML = `
            <div class="eblan-toast-title">🔔 ${title}</div>
            <div class="eblan-toast-msg">${message}</div>
        `;
        toasts.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // =========================================================================
    // WINDOW MANAGEMENT
    // =========================================================================

    createWindow(options) {
        const { id, title, icon = '📁', width = 640, height = 440, contentHtml = '' } = options;

        if (this.windows.has(id)) {
            this.focusWindow(id);
            const winObj = this.windows.get(id);
            if (winObj.minimized) this.restoreWindow(id);
            return winObj;
        }

        const layer = this.container.querySelector('#eblan-windows-layer');
        const winEl = document.createElement('div');
        winEl.className = 'eblan-window';
        winEl.id = `win-${id}`;
        winEl.style.width = `${width}px`;
        winEl.style.height = `${height}px`;

        const count = this.windows.size;
        const offsetLeft = 40 + (count * 28) % 180;
        const offsetTop = 30 + (count * 28) % 120;
        winEl.style.left = `${offsetLeft}px`;
        winEl.style.top = `${offsetTop}px`;
        winEl.style.zIndex = ++this.nextZIndex;

        winEl.innerHTML = `
            <div class="eblan-win-titlebar">
                <div class="eblan-win-title">
                    <span>${icon}</span>
                    <span>${title}</span>
                </div>
                <div class="eblan-win-controls">
                    <button class="eblan-win-btn minimize" title="Згорнути">_</button>
                    <button class="eblan-win-btn maximize" title="Розгорнути">□</button>
                    <button class="eblan-win-btn close" title="Закрити">✕</button>
                </div>
            </div>
            <div class="eblan-win-body">
                ${contentHtml}
            </div>
        `;

        layer.appendChild(winEl);

        const winObj = {
            id,
            title,
            icon,
            el: winEl,
            minimized: false,
            maximized: false,
            prevRect: null
        };

        this.windows.set(id, winObj);
        this.addtaskbarTab(id, title, icon);
        this.setupWindowInteractions(winObj);
        this.focusWindow(id);

        return winObj;
    }

    setupWindowInteractions(winObj) {
        const winEl = winObj.el;
        const titlebar = winEl.querySelector('.eblan-win-titlebar');
        const minBtn = winEl.querySelector('.eblan-win-btn.minimize');
        const maxBtn = winEl.querySelector('.eblan-win-btn.maximize');
        const closeBtn = winEl.querySelector('.eblan-win-btn.close');

        // Focus
        winEl.addEventListener('mousedown', () => this.focusWindow(winObj.id));

        // Close
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeWindow(winObj.id);
        });

        // Minimize
        minBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.minimizeWindow(winObj.id);
        });

        // Maximize
        maxBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMaximizeWindow(winObj.id);
        });

        titlebar.addEventListener('dblclick', () => {
            this.toggleMaximizeWindow(winObj.id);
        });

        // Dragging
        let isDragging = false;
        let startX = 0, startY = 0;
        let origX = 0, origY = 0;

        titlebar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.eblan-win-controls')) return;
            if (winObj.maximized) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = winEl.offsetLeft;
            origY = winEl.offsetTop;
            this.focusWindow(winObj.id);

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                winEl.style.left = `${origX + dx}px`;
                winEl.style.top = `${origY + dy}px`;
            };

            const onMouseUp = () => {
                isDragging = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    focusWindow(id) {
        if (!this.windows.has(id)) return;
        this.windows.forEach(w => {
            w.el.classList.remove('active');
        });
        const win = this.windows.get(id);
        win.el.classList.add('active');
        win.el.style.zIndex = ++this.nextZIndex;
        this.activeWindowId = id;

        this.container.querySelectorAll('.eblan-task-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.id === id);
        });
    }

    minimizeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.minimized = true;
        win.el.style.display = 'none';
        const tab = this.container.querySelector(`.eblan-task-tab[data-id="${id}"]`);
        if (tab) tab.classList.remove('active');
        if (this.activeWindowId === id) this.activeWindowId = null;
    }

    restoreWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.minimized = false;
        win.el.style.display = 'flex';
        this.focusWindow(id);
    }

    toggleMaximizeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        if (!win.maximized) {
            win.prevRect = {
                left: win.el.style.left,
                top: win.el.style.top,
                width: win.el.style.width,
                height: win.el.style.height
            };
            win.el.style.left = '0px';
            win.el.style.top = '0px';
            win.el.style.width = '100%';
            win.el.style.height = 'calc(100% - 32px)';
            win.maximized = true;
        } else {
            win.el.style.left = win.prevRect.left;
            win.el.style.top = win.prevRect.top;
            win.el.style.width = win.prevRect.width;
            win.el.style.height = win.prevRect.height;
            win.maximized = false;
        }
    }

    closeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.el.remove();
        this.windows.delete(id);
        const tab = this.container.querySelector(`.eblan-task-tab[data-id="${id}"]`);
        if (tab) tab.remove();
        if (this.activeWindowId === id) {
            this.activeWindowId = null;
            const keys = Array.from(this.windows.keys());
            if (keys.length > 0) this.focusWindow(keys[keys.length - 1]);
        }
    }

    addtaskbarTab(id, title, icon) {
        const tasks = this.container.querySelector('#eblan-taskbar-tasks');
        const tab = document.createElement('button');
        tab.className = 'eblan-task-tab active';
        tab.dataset.id = id;
        tab.innerHTML = `<span>${icon}</span> <span>${title}</span>`;
        tab.addEventListener('click', () => {
            const win = this.windows.get(id);
            if (!win) return;
            if (win.minimized) {
                this.restoreWindow(id);
            } else if (this.activeWindowId === id) {
                this.minimizeWindow(id);
            } else {
                this.focusWindow(id);
            }
        });
        tasks.appendChild(tab);
    }

    // =========================================================================
    // APPS LAUNCHER
    // =========================================================================

    openApp(appId) {
        switch (appId) {
            case 'browser':
                this.openBrowserApp();
                break;
            case 'settings':
                this.openSettingsApp();
                break;
            case 'minesweeper':
                this.openMinesweeperApp();
                break;
            case 'snake':
                this.openSnakeApp();
                break;
            case 'notepad':
                this.openNotepadApp();
                break;
            case 'cmd':
                this.openCmdApp();
                break;
            case 'emuos':
                this.openEmuOSApp();
                break;
            case 'trash':
                this.openTrashApp();
                break;
            default:
                this.showNotification('Помилка', `Додаток ${appId} не знайдено.`);
        }
    }

    // =========================================================================
    // 1. ЕБЛАНЕТ (INTERNET BROWSER)
    // =========================================================================

    openBrowserApp() {
        const win = this.createWindow({
            id: 'browser',
            title: 'Ебланет - Всесвітня Павутина',
            icon: '🌐',
            width: 720,
            height: 480,
            contentHtml: `
                <div class="eblan-browser-app">
                    <div class="eblan-browser-toolbar">
                        <button class="eblan-btn-icon" id="br-back" title="Назад">◀</button>
                        <button class="eblan-btn-icon" id="br-forward" title="Вперед">▶</button>
                        <button class="eblan-btn-icon" id="br-reload" title="Оновити">🔄</button>
                        <button class="eblan-btn-icon" id="br-home" title="Головна">🏠</button>
                        <input type="text" class="eblan-browser-url" id="br-url-input" value="eblandex://search" />
                        <button class="eblan-btn" id="br-go-btn">Перейти</button>
                    </div>
                    <div class="eblan-browser-bookmarks">
                        <span class="br-bm-item" data-url="eblandex://search">🔍 Ебландекс</span>
                        <span class="br-bm-item" data-url="eblanwiki://index">📖 Вікіпедія ЕбланКрафту</span>
                        <span class="br-bm-item" data-url="eblannews://fresh">📰 Новини Кубів</span>
                        <span class="br-bm-item" data-url="https://emupedia.net/beta/emuos/">🕹️ EmuOS Онлайн</span>
                    </div>
                    <div class="eblan-browser-viewport" id="br-viewport"></div>
                </div>
            `
        });

        const winEl = win.el;
        const urlInput = winEl.querySelector('#br-url-input');
        const viewport = winEl.querySelector('#br-viewport');
        const goBtn = winEl.querySelector('#br-go-btn');
        const homeBtn = winEl.querySelector('#br-home');
        const reloadBtn = winEl.querySelector('#br-reload');

        const navigateTo = (url) => {
            urlInput.value = url;
            if (url.startsWith('eblandex://')) {
                renderEblandex(url);
            } else if (url.startsWith('eblanwiki://')) {
                renderWiki(url);
            } else if (url.startsWith('eblannews://')) {
                renderNews();
            } else {
                viewport.innerHTML = `
                    <div class="br-web-frame-wrap">
                        <div class="br-web-notice">Завантаження веб-сторінки: <b>${url}</b></div>
                        <iframe src="${url}" class="br-web-iframe" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
                    </div>
                `;
            }
        };

        const renderEblandex = (url) => {
            viewport.innerHTML = `
                <div class="eblandex-page">
                    <div class="eblandex-logo">ЕБЛАН<span>ДЕКС</span></div>
                    <div class="eblandex-slogan">Пошукова система світу кубів</div>
                    <div class="eblandex-search-box">
                        <input type="text" id="eblandex-input" placeholder="Введіть запит (напр. як зробити ак-47, тачка, редстоун, село...)" />
                        <button id="eblandex-search-btn" class="eblan-btn">Знайти</button>
                    </div>
                    <div class="eblandex-suggestions">
                        <span>Популярні запити:</span>
                        <a href="#" class="edx-q">автомобільні перегони</a>
                        <a href="#" class="edx-q">кулемет ак-47 рецепт</a>
                        <a href="#" class="edx-q">дроти та редстоун схеми</a>
                        <a href="#" class="edx-q">де знайти село з жителями</a>
                    </div>
                    <div class="eblandex-results" id="edx-results"></div>
                </div>
            `;

            const input = viewport.querySelector('#eblandex-input');
            const searchBtn = viewport.querySelector('#eblandex-search-btn');
            const results = viewport.querySelector('#edx-results');

            const doSearch = (query) => {
                query = query.toLowerCase();
                let output = '';
                if (query.includes('ак') || query.includes('збро') || query.includes('оруж')) {
                    output = `
                        <div class="edx-res-item">
                            <div class="edx-res-title"><a href="#" data-to="eblanwiki://weapons">АК-47 та Вогнепальна Зброя - Вікі ЕбланКрафту</a></div>
                            <div class="edx-res-desc">Створюйте АК-47 на верстаку: 4 залізні злитки + 2 порохи + 1 дошка. Стрільба лівою кнопкою миші з миттєвим ураженням ворогів!</div>
                        </div>
                    `;
                } else if (query.includes('машин') || query.includes('авто') || query.includes('тачк')) {
                    output = `
                        <div class="edx-res-item">
                            <div class="edx-res-title"><a href="#" data-to="eblanwiki://cars">Автомобілі та Транспорт у Світі</a></div>
                            <div class="edx-res-desc">4 класи транспорту: Спорткар, Поліцейське авто, Кібертрак і Вантажівка. Спавніть ключем, сідайте на ПКМ, газуйте на W/S/A/D! Села та стоянки генеруються автоматично.</div>
                        </div>
                    `;
                } else if (query.includes('редстоун') || query.includes('дріт') || query.includes('пров')) {
                    output = `
                        <div class="edx-res-item">
                            <div class="edx-res-title"><a href="#" data-to="eblanwiki://redstone">Електричні Дроти та Логічні Схеми</a></div>
                            <div class="edx-res-desc">Прокладайте дроти на будь-яку поверхню. Сигнал передається до 15 блоків, живить лампи, механізми та двері.</div>
                        </div>
                    `;
                } else if (query.includes('сел') || query.includes('жител')) {
                    output = `
                        <div class="edx-res-item">
                            <div class="edx-res-title"><a href="#" data-to="eblanwiki://villages">Поселення та Жителі ЕбланКрафту</a></div>
                            <div class="edx-res-desc">Села генеруються природним чином кожні кілька чанків, а також гарантовано біля спавну. У будинках є комп'ютери та лабораторії!</div>
                        </div>
                    `;
                } else {
                    output = `
                        <div class="edx-res-item">
                            <div class="edx-res-title"><a href="#" data-to="eblanwiki://index">База Знань ЕбланКрафт 2.5</a></div>
                            <div class="edx-res-desc">Знайдено інформацію про світ: воксельний рушій, транспортні засоби, вогнепал, ОС Eblan OS v2.5 та комп'ютерні термінали.</div>
                        </div>
                    `;
                }
                results.innerHTML = output;

                results.querySelectorAll('a[data-to]').forEach(a => {
                    a.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        navigateTo(a.dataset.to);
                    });
                });
            };

            searchBtn.addEventListener('click', () => doSearch(input.value));
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(input.value); });
            viewport.querySelectorAll('.edx-q').forEach(q => {
                q.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    input.value = q.textContent;
                    doSearch(q.textContent);
                });
            });
        };

        const renderWiki = (url) => {
            viewport.innerHTML = `
                <div class="eblan-wiki-page">
                    <div class="wiki-header">
                        <h2>📖 ЕбланКрафт Енциклопедія</h2>
                        <span class="wiki-tag">Версія 2.5 Release</span>
                    </div>
                    <div class="wiki-nav">
                        <button class="eblan-btn sm" data-tab="craft">🛠️ Крафт</button>
                        <button class="eblan-btn sm" data-tab="cars">🚗 Транспорт</button>
                        <button class="eblan-btn sm" data-tab="weapons">🔫 Зброя</button>
                        <button class="eblan-btn sm" data-tab="pc">💻 Комп'ютери</button>
                    </div>
                    <div class="wiki-content" id="wiki-body">
                        <h3>Головна сторінка</h3>
                        <p>Ласкаво просимо до офіційного довідника гри <b>EblanCraft</b>. Тут ви знайдете повну інформацію про всі модулі гри, від добування ресурсів до налаштування власної операційної системи Eblan OS!</p>
                        <ul>
                            <li><b>Машини:</b> знайдіть у селах або скрафтіть ключ у верстаку.</li>
                            <li><b>Зброя:</b> стрільба з віддачею, звуком пострілу та спалахом ствола.</li>
                            <li><b>Комп'ютер:</b> встановіть блок ПК у світі, клацніть ПКМ та використовуйте браузер і термінал!</li>
                        </ul>
                    </div>
                </div>
            `;

            const body = viewport.querySelector('#wiki-body');
            viewport.querySelectorAll('.wiki-nav button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.tab;
                    if (tab === 'craft') {
                        body.innerHTML = `
                            <h3>🛠️ Рецепти Крафту</h3>
                            <p>У верстаку 3х3 ви можете створювати унікальні предмети:</p>
                            <table class="wiki-table">
                                <tr><th>Предмет</th><th>Інгредієнти</th><th>Результат</th></tr>
                                <tr><td>АК-47</td><td>4 Залізо + 2 Порох + 1 Дошка</td><td>1x Вогнепальний АК-47</td></tr>
                                <tr><td>Спорткар</td><td>4 Залізо + 2 Редстоун + 1 Скло</td><td>1x Ключ від Спорткару</td></tr>
                                <tr><td>Кібертрак</td><td>6 Залізо + 2 Редстоун + 1 Алмаз</td><td>1x Ключ Кібертраку</td></tr>
                                <tr><td>Комп'ютер</td><td>4 Залізо + 2 Скло + 1 Редстоун</td><td>1x Блок ПК</td></tr>
                            </table>
                        `;
                    } else if (tab === 'cars') {
                        body.innerHTML = `
                            <h3>🚗 Посібник з Автомобілів</h3>
                            <p>У світі є 4 доступні моделі транспорту:</p>
                            <ul>
                                <li><b>Спорткар:</b> Максимальна швидкість, швидкий розгін, спортивний дизайн.</li>
                                <li><b>Поліцейське авто:</b> Мигалки, сирена, хороша стійкість на дорозі.</li>
                                <li><b>Кібертрак:</b> Броньований футуристичний кузов, висока прохідність.</li>
                                <li><b>Вантажівка:</b> Потужний тягач для перевезення вантажів.</li>
                            </ul>
                            <p><b>Керування:</b> Спавніть ключ на ПКМ. Сісти/вилізти — ПКМ по авто. Газ — W, Гальмо/Задній хід — S, Кермо — A/D, Ручник — Пробіл.</p>
                        `;
                    } else if (tab === 'weapons') {
                        body.innerHTML = `
                            <h3>🔫 Вогнепальна Зброя</h3>
                            <p>У грі доступний повноцінний балістичний модуль:</p>
                            <ul>
                                <li>Стрільба здійснюється <b>Лівою Кнопкою Миші</b> коли зброя в руці.</li>
                                <li>Траєкторія пострілу використовує рейкаст з перевіркою зіткнень з мобами та гравцями.</li>
                                <li>Реалістична віддача та звук пострілу.</li>
                            </ul>
                        `;
                    } else if (tab === 'pc') {
                        body.innerHTML = `
                            <h3>💻 Операційна Система Eblan OS</h3>
                            <p>Eblan OS встановлена на всіх комп'ютерних терміналах у світі.</p>
                            <ul>
                                <li><b>Браузер Єбланет:</b> пошук рецептів, довідка та емуляція сторонніх ОС.</li>
                                <li><b>Налаштування:</b> вибір ретро шпалер робочого столу, CRT сканлайни.</li>
                                <li><b>Термінал:</b> виконання прямих команд гри (спавн, телепортація, видача предметів).</li>
                            </ul>
                        `;
                    }
                });
            });
        };

        const renderNews = () => {
            viewport.innerHTML = `
                <div class="eblan-news-page">
                    <h2>📰 Останні новини світу EblanCraft</h2>
                    <div class="news-card">
                        <div class="news-date">14 Вересня 2026</div>
                        <div class="news-title">Встановлено нову ОС Eblan OS v2.5!</div>
                        <div class="news-text">Всі комп'ютерні лабораторії оновлено. Тепер жителі сіл грають у Сапера та переглядають інтернет замість торгівлі пшеницею.</div>
                    </div>
                    <div class="news-card">
                        <div class="news-date">14 Вересня 2026</div>
                        <div class="news-title">Зафіксовано появу нових спорткарів на дорогах</div>
                        <div class="news-text">Поліцейські патрулі готові зупиняти порушників швидкості. Бережіть свої блоки!</div>
                    </div>
                </div>
            `;
        };

        goBtn.addEventListener('click', () => navigateTo(urlInput.value));
        urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigateTo(urlInput.value); });
        homeBtn.addEventListener('click', () => navigateTo('eblandex://search'));
        reloadBtn.addEventListener('click', () => navigateTo(urlInput.value));
        winEl.querySelectorAll('.br-bm-item').forEach(bm => {
            bm.addEventListener('click', () => navigateTo(bm.dataset.url));
        });

        navigateTo('eblandex://search');
    }

    // =========================================================================
    // 2. НАЛАШТУВАННЯ (SETTINGS)
    // =========================================================================

    openSettingsApp() {
        const win = this.createWindow({
            id: 'settings',
            title: 'Панель керування та Налаштування Eblan OS',
            icon: '⚙️',
            width: 580,
            height: 420,
            contentHtml: `
                <div class="eblan-settings-app">
                    <div class="settings-tabs">
                        <button class="settings-tab-btn active" data-target="st-display">🖥️ Екран</button>
                        <button class="settings-tab-btn" data-target="st-wallpapers">🎨 Шпалери</button>
                        <button class="settings-tab-btn" data-target="st-system">ℹ️ Про систему</button>
                    </div>
                    <div class="settings-body">
                        <!-- Display Section -->
                        <div class="settings-section active" id="st-display">
                            <h3>Налаштування монітора</h3>
                            <label class="setting-row">
                                <span>Ефект ретро CRT-сканлайнів (ЕПТ монітор)</span>
                                <input type="checkbox" id="st-crt-toggle" ${this.settings.crtFilter ? 'checked' : ''} />
                            </label>
                            <label class="setting-row">
                                <span>Звукові ефекти інтерфейсу</span>
                                <input type="checkbox" id="st-sound-toggle" ${this.settings.soundEnabled ? 'checked' : ''} />
                            </label>
                        </div>

                        <!-- Wallpapers Section -->
                        <div class="settings-section" id="st-wallpapers">
                            <h3>Фон робочого столу</h3>
                            <div class="wallpaper-grid">
                                <div class="wp-card teal ${this.settings.wallpaper === 'teal' ? 'selected' : ''}" data-wp="teal">
                                    <div class="wp-preview teal-bg"></div>
                                    <span>Класичний Бірюзовий 95</span>
                                </div>
                                <div class="wp-card cyber ${this.settings.wallpaper === 'cyber' ? 'selected' : ''}" data-wp="cyber">
                                    <div class="wp-preview cyber-bg"></div>
                                    <span>Кіберпанк Неон</span>
                                </div>
                                <div class="wp-card sunset ${this.settings.wallpaper === 'sunset' ? 'selected' : ''}" data-wp="sunset">
                                    <div class="wp-preview sunset-bg"></div>
                                    <span>Ретровейв Захід</span>
                                </div>
                                <div class="wp-card matrix ${this.settings.wallpaper === 'matrix' ? 'selected' : ''}" data-wp="matrix">
                                    <div class="wp-preview matrix-bg"></div>
                                    <span>Матриця Код</span>
                                </div>
                                <div class="wp-card dark ${this.settings.wallpaper === 'dark' ? 'selected' : ''}" data-wp="dark">
                                    <div class="wp-preview dark-bg"></div>
                                    <span>Темний Граніт</span>
                                </div>
                            </div>
                        </div>

                        <!-- System Specs Section -->
                        <div class="settings-section" id="st-system">
                            <h3>Конфігурація комп'ютера</h3>
                            <table class="wiki-table">
                                <tr><td>ОС:</td><td>Eblan OS v2.5 SP3 Black Edition (x86)</td></tr>
                                <tr><td>Процесор:</td><td>EblanCore™ X99 @ 4.20 GHz Octa-Redstone</td></tr>
                                <tr><td>Оперативна пам'ять:</td><td>64 MB EblanRAM FastSync</td></tr>
                                <tr><td>Відеокарта:</td><td>Voxel3D Accelerate PRO 16MB VRAM</td></tr>
                                <tr><td>Сховище:</td><td>512 MB Quantum Redstone Drive</td></tr>
                                <tr><td>Живлення:</td><td>100% Чиста енергія редстоуну</td></tr>
                            </table>
                            <div style="margin-top: 15px;">
                                <button class="eblan-btn danger" id="st-reset-btn">Скинути налаштування</button>
                            </div>
                        </div>
                    </div>
                </div>
            `
        });

        const winEl = win.el;

        winEl.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                winEl.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
                winEl.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
                btn.classList.add('active');
                const target = winEl.querySelector(`#${btn.dataset.target}`);
                if (target) target.classList.add('active');
            });
        });

        const crtToggle = winEl.querySelector('#st-crt-toggle');
        crtToggle.addEventListener('change', () => {
            this.settings.crtFilter = crtToggle.checked;
            localStorage.setItem('eblan_os_crt', this.settings.crtFilter);
            this.applySettings();
        });

        const soundToggle = winEl.querySelector('#st-sound-toggle');
        soundToggle.addEventListener('change', () => {
            this.settings.soundEnabled = soundToggle.checked;
            localStorage.setItem('eblan_os_sound', this.settings.soundEnabled);
            const soundTray = this.container.querySelector('#eblan-tray-sound');
            if (soundTray) soundTray.textContent = this.settings.soundEnabled ? '🔊' : '🔇';
        });

        winEl.querySelectorAll('.wp-card').forEach(card => {
            card.addEventListener('click', () => {
                winEl.querySelectorAll('.wp-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const wp = card.dataset.wp;
                this.settings.wallpaper = wp;
                localStorage.setItem('eblan_os_wallpaper', wp);
                this.applySettings();
                this.showNotification('Шпалери змінено', `Встановлено тему: ${card.querySelector('span').textContent}`);
            });
        });

        const resetBtn = winEl.querySelector('#st-reset-btn');
        resetBtn.addEventListener('click', () => {
            this.settings.wallpaper = 'teal';
            this.settings.crtFilter = false;
            this.settings.soundEnabled = true;
            localStorage.removeItem('eblan_os_wallpaper');
            localStorage.removeItem('eblan_os_crt');
            localStorage.removeItem('eblan_os_sound');
            this.applySettings();
            this.closeWindow('settings');
            this.openSettingsApp();
            this.showNotification('Налаштування скинуто', 'Встановлено заводські параметри Eblan OS.');
        });
    }

    applySettings() {
        const desktop = this.container.querySelector('#eblan-desktop');
        const crt = this.container.querySelector('#eblan-crt');
        if (desktop) {
            desktop.className = `eblan-os-desktop ${this.settings.wallpaper}`;
        }
        if (crt) {
            crt.classList.toggle('active', !!this.settings.crtFilter);
        }
    }

    // =========================================================================
    // 3. САПЕР (MINESWEEPER)
    // =========================================================================

    openMinesweeperApp() {
        const rows = 9;
        const cols = 9;
        const totalMines = 10;

        const win = this.createWindow({
            id: 'minesweeper',
            title: 'Сапер (Minesweeper)',
            icon: '💣',
            width: 320,
            height: 380,
            contentHtml: `
                <div class="eblan-ms-app">
                    <div class="ms-header">
                        <div class="ms-digit-box" id="ms-mines-count">010</div>
                        <button class="ms-face-btn" id="ms-face">🙂</button>
                        <div class="ms-digit-box" id="ms-timer">000</div>
                    </div>
                    <div class="ms-grid" id="ms-board"></div>
                </div>
            `
        });

        const winEl = win.el;
        const boardEl = winEl.querySelector('#ms-board');
        const faceBtn = winEl.querySelector('#ms-face');
        const minesCountEl = winEl.querySelector('#ms-mines-count');
        const timerEl = winEl.querySelector('#ms-timer');

        let grid = [];
        let timer = null;
        let elapsed = 0;
        let gameOver = false;
        let started = false;
        let flagsLeft = totalMines;

        const initGame = () => {
            clearInterval(timer);
            elapsed = 0;
            flagsLeft = totalMines;
            gameOver = false;
            started = false;
            faceBtn.textContent = '🙂';
            minesCountEl.textContent = '010';
            timerEl.textContent = '000';

            grid = [];
            boardEl.innerHTML = '';
            boardEl.style.gridTemplateColumns = `repeat(${cols}, 24px)`;

            for (let r = 0; r < rows; r++) {
                grid[r] = [];
                for (let c = 0; c < cols; c++) {
                    const cellEl = document.createElement('div');
                    cellEl.className = 'ms-cell';
                    cellEl.dataset.r = r;
                    cellEl.dataset.c = c;
                    boardEl.appendChild(cellEl);

                    grid[r][c] = {
                        el: cellEl,
                        isMine: false,
                        revealed: false,
                        flagged: false,
                        adjacent: 0
                    };

                    cellEl.addEventListener('mousedown', (e) => {
                        if (gameOver) return;
                        if (e.button === 0 && !grid[r][c].flagged) {
                            faceBtn.textContent = '😮';
                        }
                    });

                    cellEl.addEventListener('mouseup', () => {
                        if (!gameOver) faceBtn.textContent = '🙂';
                    });

                    cellEl.addEventListener('click', () => {
                        if (gameOver) return;
                        if (!started) {
                            placeMines(r, c);
                            startTimer();
                            started = true;
                        }
                        revealCell(r, c);
                    });

                    cellEl.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        if (gameOver || grid[r][c].revealed) return;
                        toggleFlag(r, c);
                    });
                }
            }
        };

        const placeMines = (safeR, safeC) => {
            let placed = 0;
            while (placed < totalMines) {
                const rr = Math.floor(Math.random() * rows);
                const cc = Math.floor(Math.random() * cols);
                if ((rr !== safeR || cc !== safeC) && !grid[rr][cc].isMine) {
                    grid[rr][cc].isMine = true;
                    placed++;
                }
            }

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (grid[r][c].isMine) continue;
                    let count = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isMine) {
                                count++;
                            }
                        }
                    }
                    grid[r][c].adjacent = count;
                }
            }
        };

        const startTimer = () => {
            timer = setInterval(() => {
                elapsed++;
                if (elapsed > 999) elapsed = 999;
                timerEl.textContent = String(elapsed).padStart(3, '0');
            }, 1000);
        };

        const revealCell = (r, c) => {
            const cell = grid[r][c];
            if (cell.revealed || cell.flagged) return;

            cell.revealed = true;
            cell.el.classList.add('revealed');

            if (cell.isMine) {
                cell.el.classList.add('exploded');
                cell.el.textContent = '💣';
                endGame(false);
                return;
            }

            if (cell.adjacent > 0) {
                cell.el.textContent = cell.adjacent;
                cell.el.dataset.num = cell.adjacent;
            } else {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                            revealCell(nr, nc);
                        }
                    }
                }
            }

            checkWin();
        };

        const toggleFlag = (r, c) => {
            const cell = grid[r][c];
            if (cell.revealed) return;
            cell.flagged = !cell.flagged;
            cell.el.textContent = cell.flagged ? '🚩' : '';
            flagsLeft += cell.flagged ? -1 : 1;
            minesCountEl.textContent = String(Math.max(0, flagsLeft)).padStart(3, '0');
        };

        const checkWin = () => {
            let revealedCount = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (grid[r][c].revealed) revealedCount++;
                }
            }
            if (revealedCount === (rows * cols - totalMines)) {
                endGame(true);
            }
        };

        const endGame = (won) => {
            gameOver = true;
            clearInterval(timer);
            faceBtn.textContent = won ? '😎' : '😵';

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (grid[r][c].isMine && !grid[r][c].revealed) {
                        grid[r][c].el.classList.add('revealed');
                        grid[r][c].el.textContent = '💣';
                    }
                }
            }

            if (won) {
                this.showNotification('Перемога!', `Ви виграли в Сапер за ${elapsed} секунд!`);
            }
        };

        faceBtn.addEventListener('click', initGame);
        initGame();
    }

    // =========================================================================
    // 4. ЗМІЙКА (RETRO SNAKE)
    // =========================================================================

    openSnakeApp() {
        const win = this.createWindow({
            id: 'snake',
            title: 'Змійка (Retro Snake)',
            icon: '🐍',
            width: 380,
            height: 440,
            contentHtml: `
                <div class="eblan-snake-app">
                    <div class="snake-header">
                        <span>Рахунок: <b id="sn-score">0</b></span>
                        <span>Рекорд: <b id="sn-best">0</b></span>
                    </div>
                    <canvas id="sn-canvas" width="320" height="320"></canvas>
                    <div class="snake-controls">
                        <button class="eblan-btn sm" id="sn-start-btn">Почати гру</button>
                        <span class="snake-hint">Керування: Стрілочки або W/A/S/D</span>
                    </div>
                </div>
            `
        });

        const winEl = win.el;
        const canvas = winEl.querySelector('#sn-canvas');
        const ctx = canvas.getContext('2d');
        const scoreEl = winEl.querySelector('#sn-score');
        const bestEl = winEl.querySelector('#sn-best');
        const startBtn = winEl.querySelector('#sn-start-btn');

        const gridSize = 16;
        const tileCount = canvas.width / gridSize;
        let snake = [];
        let food = { x: 10, y: 10 };
        let dx = 1, dy = 0;
        let score = 0;
        let best = parseInt(localStorage.getItem('eblan_snake_best') || '0', 10);
        let gameLoop = null;
        let isRunning = false;

        bestEl.textContent = best;

        const spawnFood = () => {
            food = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount)
            };
        };

        const resetGame = () => {
            snake = [
                { x: 5, y: 10 },
                { x: 4, y: 10 },
                { x: 3, y: 10 }
            ];
            dx = 1;
            dy = 0;
            score = 0;
            scoreEl.textContent = '0';
            spawnFood();
        };

        const update = () => {
            const head = { x: snake[0].x + dx, y: snake[0].y + dy };

            if (head.x < 0) head.x = tileCount - 1;
            if (head.x >= tileCount) head.x = 0;
            if (head.y < 0) head.y = tileCount - 1;
            if (head.y >= tileCount) head.y = 0;

            for (let i = 0; i < snake.length; i++) {
                if (snake[i].x === head.x && snake[i].y === head.y) {
                    gameOver();
                    return;
                }
            }

            snake.unshift(head);

            if (head.x === food.x && head.y === food.y) {
                score += 10;
                scoreEl.textContent = score;
                if (score > best) {
                    best = score;
                    bestEl.textContent = best;
                    localStorage.setItem('eblan_snake_best', best);
                }
                spawnFood();
            } else {
                snake.pop();
            }

            draw();
        };

        const draw = () => {
            ctx.fillStyle = '#0a1a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = '#112211';
            ctx.lineWidth = 0.5;
            for (let x = 0; x < canvas.width; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

            ctx.fillStyle = '#ff3333';
            ctx.fillRect(food.x * gridSize + 2, food.y * gridSize + 2, gridSize - 4, gridSize - 4);

            for (let i = 0; i < snake.length; i++) {
                ctx.fillStyle = i === 0 ? '#39ff14' : '#28a745';
                ctx.fillRect(snake[i].x * gridSize + 1, snake[i].y * gridSize + 1, gridSize - 2, gridSize - 2);
            }
        };

        const gameOver = () => {
            clearInterval(gameLoop);
            isRunning = false;
            startBtn.textContent = 'Зіграти знову';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ff4444';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ГРА ЗАКІНЧЕНА!', canvas.width / 2, canvas.height / 2);
        };

        const onKey = (e) => {
            if (!isRunning) return;
            const k = e.key.toLowerCase();
            if ((k === 'arrowup' || k === 'w') && dy === 0) { dx = 0; dy = -1; e.preventDefault(); }
            if ((k === 'arrowdown' || k === 's') && dy === 0) { dx = 0; dy = 1; e.preventDefault(); }
            if ((k === 'arrowleft' || k === 'a') && dx === 0) { dx = -1; dy = 0; e.preventDefault(); }
            if ((k === 'arrowright' || k === 'd') && dx === 0) { dx = 1; dy = 0; e.preventDefault(); }
        };

        window.addEventListener('keydown', onKey);

        startBtn.addEventListener('click', () => {
            if (isRunning) return;
            resetGame();
            isRunning = true;
            startBtn.textContent = 'Гра триває...';
            gameLoop = setInterval(update, 110);
        });

        draw();
    }

    // =========================================================================
    // 5. БЛОКНОТ (NOTEPAD)
    // =========================================================================

    openNotepadApp() {
        const savedNotes = localStorage.getItem('eblan_os_notepad') || 'Замітки дослідника:\n- У селі біля спавну знайдено лабораторію.\n- Під верстаком заховано креслення спорткару.\n- Не забути зарядити АК-47 перед походом у печеру!';

        const win = this.createWindow({
            id: 'notepad',
            title: 'Блокнот - нотатки.txt',
            icon: '📝',
            width: 500,
            height: 380,
            contentHtml: `
                <div class="eblan-notepad-app">
                    <div class="notepad-menu">
                        <button class="eblan-btn sm" id="np-save-btn">💾 Зберегти</button>
                        <button class="eblan-btn sm" id="np-clear-btn">🗑️ Очистити</button>
                        <span class="np-status" id="np-status">Збережено</span>
                    </div>
                    <textarea class="notepad-textarea" id="np-text">${savedNotes}</textarea>
                </div>
            `
        });

        const winEl = win.el;
        const textarea = winEl.querySelector('#np-text');
        const saveBtn = winEl.querySelector('#np-save-btn');
        const clearBtn = winEl.querySelector('#np-clear-btn');
        const status = winEl.querySelector('#np-status');

        const save = () => {
            localStorage.setItem('eblan_os_notepad', textarea.value);
            status.textContent = 'Збережено!';
            setTimeout(() => status.textContent = 'Збережено', 2000);
        };

        textarea.addEventListener('input', () => {
            status.textContent = 'Незбережені зміни...';
        });

        saveBtn.addEventListener('click', save);
        clearBtn.addEventListener('click', () => {
            textarea.value = '';
            save();
        });
    }

    // =========================================================================
    // 6. ТЕРМІНАЛ (CMD / EBLANPROMPT)
    // =========================================================================

    openCmdApp() {
        const win = this.createWindow({
            id: 'cmd',
            title: 'Термінал EblanPrompt (CMD.EXE)',
            icon: '💻',
            width: 620,
            height: 400,
            contentHtml: `
                <div class="eblan-cmd-app">
                    <div class="cmd-output" id="cmd-out">
Eblan OS [Версія 2.5.2026]
(c) Корпорація EblanSoft. Всі права захищені.

Введіть 'help' для перегляду доступних команд консолі.
                    </div>
                    <div class="cmd-input-row">
                        <span class="cmd-prompt">C:\\EBLAN_OS&gt;</span>
                        <input type="text" class="cmd-input" id="cmd-in" autofocus autocomplete="off" />
                    </div>
                </div>
            `
        });

        const winEl = win.el;
        const output = winEl.querySelector('#cmd-out');
        const input = winEl.querySelector('#cmd-in');

        const print = (text, isError = false) => {
            const line = document.createElement('div');
            line.className = isError ? 'cmd-line error' : 'cmd-line';
            line.textContent = text;
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = input.value.trim();
                input.value = '';
                if (!cmd) return;

                print(`C:\\EBLAN_OS> ${cmd}`);
                this.executeCmd(cmd, print, output);
            }
        });
    }

    executeCmd(cmdStr, print, outputEl) {
        const parts = cmdStr.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (cmd) {
            case 'help':
                print('Доступні команди EblanPrompt:');
                print('  help                 - показати цю довідку');
                print('  cls                  - очистити екран терміналу');
                print('  ver                  - версія операційної системи');
                print('  give <предмет> [кількість] - видати предмет у інвентар');
                print('  spawn <car_sport|car_police|car_cyber|car_truck> - створити автомобіль');
                print('  time <day|night>     - встановити час доби у світі');
                print('  tp <x> <y> <z>       - телепортувати гравця за координатами');
                print('  matrix               - запустити матричний код');
                print('  ping                 - перевірити зв\'язок з ядром');
                print('  exit                 - закрити термінал');
                break;

            case 'cls':
                outputEl.innerHTML = '';
                break;

            case 'ver':
                print('Eblan OS Kernel v2.5.0-Release-PRO (x86_64)');
                break;

            case 'ping':
                print('Відповідь від 127.0.0.1: час < 1мс, TTL=128. З\'єднання стабільне.');
                break;

            case 'time':
                if (this.game) {
                    if (args[0] === 'day') {
                        this.game.timeOfDay = 0.25;
                        print('Час встановлено: День.');
                    } else if (args[0] === 'night') {
                        this.game.timeOfDay = 0.75;
                        print('Час встановлено: Ніч.');
                    } else {
                        print('Використання: time <day|night>', true);
                    }
                }
                break;

            case 'give':
                if (!args[0]) {
                    print('Використання: give <назва_предмета> [кількість]', true);
                    return;
                }
                const itemName = args[0].toUpperCase();
                const count = parseInt(args[1] || '1', 10);
                if (this.game && this.game.inventory) {
                    if (window.ITEMS && window.ITEMS[itemName]) {
                        this.game.inventory.addItem(window.ITEMS[itemName].id, count);
                        print(`Успішно видано ${count}x ${itemName} до вашого інвентаря!`);
                    } else {
                        print(`Предмет '${itemName}' не знайдено в базі даних.`, true);
                    }
                }
                break;

            case 'spawn':
                if (!args[0]) {
                    print('Використання: spawn <car_sport|car_police|car_cyber|car_truck>', true);
                    return;
                }
                const entityType = args[0].toLowerCase();
                const vMgr = (this.game && this.game.vehicleManager) ||
                             (this.game && this.game.modManager && this.game.modManager.vehicleManager) ||
                             (window.modManager && window.modManager.vehicleManager);

                if (vMgr && this.game && this.game.player) {
                    const pos = this.game.player.position;
                    const spawnPos = { x: pos.x + 2, y: pos.y + 1, z: pos.z + 2 };
                    let vType = 'sport';
                    if (entityType.includes('police')) vType = 'police';
                    else if (entityType.includes('cyber')) vType = 'cyber';
                    else if (entityType.includes('truck')) vType = 'truck';

                    const v = vMgr.spawn(vType, spawnPos.x, spawnPos.y, spawnPos.z);
                    if (v) print(`Автомобіль [${vType}] успішно спавнено на позиції (${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}, ${spawnPos.z.toFixed(1)})!`);
                    else print('Помилка при створенні автомобіля.', true);
                } else {
                    print('Менеджер транспорту недоступний.', true);
                }
                break;

            case 'tp':
                if (args.length >= 3 && this.game && this.game.player) {
                    const tx = parseFloat(args[0]), ty = parseFloat(args[1]), tz = parseFloat(args[2]);
                    if (!isNaN(tx) && !isNaN(ty) && !isNaN(tz)) {
                        this.game.player.position.set(tx, ty, tz);
                        print(`Гравця телепортовано на: ${tx}, ${ty}, ${tz}`);
                    } else {
                        print('Невірні координати!', true);
                    }
                } else {
                    print('Використання: tp <x> <y> <z>', true);
                }
                break;

            case 'matrix':
                print('Запуск матричного потоку даних...');
                for (let i = 0; i < 15; i++) {
                    setTimeout(() => {
                        let str = '';
                        for (let j = 0; j < 40; j++) str += String.fromCharCode(33 + Math.floor(Math.random() * 90));
                        print(str);
                    }, i * 70);
                }
                break;

            case 'exit':
                this.closeWindow('cmd');
                break;

            default:
                print(`Команда '${cmd}' не розпізнана. Введіть 'help' для списку команд.`, true);
        }
    }

    // =========================================================================
    // 7. EMUOS APP
    // =========================================================================

    openEmuOSApp() {
        this.createWindow({
            id: 'emuos',
            title: 'EmuOS 95 Емулятор',
            icon: '🕹️',
            width: 760,
            height: 500,
            contentHtml: `
                <div class="eblan-emuos-app">
                    <iframe src="https://emupedia.net/beta/emuos/" class="emuos-embed-frame" allow="autoplay; fullscreen; gamepad"></iframe>
                </div>
            `
        });
    }

    // =========================================================================
    // 8. КОШИК (RECYCLE BIN)
    // =========================================================================

    openTrashApp() {
        const win = this.createWindow({
            id: 'trash',
            title: 'Кошик (Recycle Bin)',
            icon: '🗑️',
            width: 480,
            height: 320,
            contentHtml: `
                <div class="eblan-trash-app">
                    <div class="trash-toolbar">
                        <button class="eblan-btn sm" id="trash-empty-btn">Очистити кошик</button>
                        <span class="trash-count">Об'єктів: 4</span>
                    </div>
                    <div class="trash-grid" id="trash-items">
                        <div class="trash-item">
                            <div class="trash-icon">📁</div>
                            <span>домашнє_завдання_2007.zip</span>
                        </div>
                        <div class="trash-item">
                            <div class="trash-icon">☠️</div>
                            <span>trojan_cheat_diamonds.exe</span>
                        </div>
                        <div class="trash-item">
                            <div class="trash-icon">📜</div>
                            <span>секретний_план_захоплення_села.docx</span>
                        </div>
                        <div class="trash-item">
                            <div class="trash-icon">💾</div>
                            <span>старий_сейв_світу.bak</span>
                        </div>
                    </div>
                </div>
            `
        });

        const winEl = win.el;
        const emptyBtn = winEl.querySelector('#trash-empty-btn');
        const items = winEl.querySelector('#trash-items');
        const count = winEl.querySelector('.trash-count');

        emptyBtn.addEventListener('click', () => {
            items.innerHTML = '<div class="trash-empty-notice">Кошик порожній. Ваша совість чиста!</div>';
            count.textContent = "Об'єктів: 0";
            this.showNotification('Кошик', 'Всі видалені файли успішно знищено.');
        });
    }
}

// Global export
window.EblanOS = EblanOS;
