/**
 * Eblankraft 2.0 - Complete UI Manager, HUD, Multi-Tab Backpack, Crafting, Upgrader, Cases Roulette & Skins
 */

class UIManager {
    constructor(game) {
        this.game = game;
        this.player = game.player;
        this.textureManager = game.textureManager;
        this.soundManager = game.soundManager;

        this.inventoryOpen = false;
        this.menuOpen = false;
        this.currentTab = 'backpack';
        this.selectedInventorySlot = null;

        this.fpsHistory = [];
        this.lastFpsUpdate = 0;
        this.isSpinningCase = false;

        this.layoutModalOpen = false;
        this.dragModeOpen = false;
        this.layout = null;

        this.initHUD();
        this.initHotbar();
        this.initInventoryModal();
        this.initCaseModal();
        this.initWarpModal();
        this.initPauseMenu();
        this.initDeathScreen();
        this.initLayoutCustomizer();
        this.initModalTouchScrolling();
        this.mainMenuOpen = true;
        this.initMainMenu();
    }

    initHUD() {
        this.hudHealth = document.getElementById('hud-health');
        this.hudHunger = document.getElementById('hud-hunger');
        this.hudIQ = document.getElementById('hud-iq');
        this.hudDimension = document.getElementById('hud-dimension');
        this.hudCoords = document.getElementById('hud-coords');
        this.hudFps = document.getElementById('hud-fps');
        this.hudBlockName = document.getElementById('hud-block-name');
        this.damageOverlay = document.getElementById('damage-overlay');

        // Mining Break Progress
        this.miningProgressContainer = document.getElementById('mining-progress-container');
        this.miningProgressBar = document.getElementById('mining-progress-bar');

        // Boss Bar
        this.bossBarContainer = document.getElementById('boss-bar-container');
        this.bossBarFill = document.getElementById('boss-bar-fill');
        this.bossBarTitle = document.getElementById('boss-bar-title');

        // Top Buttons
        const btnInventory = document.getElementById('btn-inventory');
        if (btnInventory) {
            btnInventory.addEventListener('click', () => this.toggleInventory());
        }

        const btnCamera = document.getElementById('btn-camera');
        if (btnCamera) {
            btnCamera.addEventListener('click', () => {
                if (this.player) this.player.toggleThirdPerson();
            });
        }

        const btnWarp = document.getElementById('btn-warp');
        if (btnWarp) {
            btnWarp.addEventListener('click', () => this.toggleWarpModal());
        }

        const btnHudLayout = document.getElementById('btn-hud-layout');
        if (btnHudLayout) {
            btnHudLayout.addEventListener('click', () => this.toggleLayoutModal());
        }

        const btnMenu = document.getElementById('btn-menu');
        if (btnMenu) {
            btnMenu.addEventListener('click', () => this.togglePauseMenu());
        }

        const btnFullscreen = document.getElementById('btn-fullscreen');
        if (btnFullscreen) {
            btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
        }

        const btnModsManager = document.getElementById('btn-mods-manager');
        if (btnModsManager) {
            const openMods = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                if (window.modManager) window.modManager.toggleModal(true);
            };
            btnModsManager.addEventListener('click', openMods);
            btnModsManager.addEventListener('touchend', openMods);
        }

        const btnDevConsole = document.getElementById('btn-dev-console-top');
        if (btnDevConsole) {
            const openConsole = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                if (window.modManager) window.modManager.toggleDevConsole(true);
            };
            btnDevConsole.addEventListener('click', openConsole);
            btnDevConsole.addEventListener('touchend', openConsole);
        }

        // Quick Mods Fast Toggle Button & Dropdown Popup
        const btnQuickMods = document.getElementById('quick-mods-btn');
        const quickModsPopup = document.getElementById('quick-mods-popup');
        const quickModsClose = document.getElementById('quick-mods-close');
        const quickModsOpenMgr = document.getElementById('quick-mods-open-manager');

        if (btnQuickMods) {
            btnQuickMods.style.display = (this.game.quickModsEnabled !== false) ? '' : 'none';
            const toggleQuickMods = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                if (!quickModsPopup) return;
                const isHidden = quickModsPopup.style.display === 'none' || !quickModsPopup.style.display;
                if (isHidden) {
                    this.renderQuickModsList();
                    quickModsPopup.style.display = 'block';
                    if (this.soundManager) this.soundManager.playClick();
                } else {
                    quickModsPopup.style.display = 'none';
                }
            };
            btnQuickMods.addEventListener('click', toggleQuickMods);
            btnQuickMods.addEventListener('touchend', toggleQuickMods);
        }

        if (quickModsClose) {
            quickModsClose.addEventListener('click', (e) => {
                if (e) e.stopPropagation();
                if (quickModsPopup) quickModsPopup.style.display = 'none';
            });
        }

        if (quickModsOpenMgr) {
            quickModsOpenMgr.addEventListener('click', (e) => {
                if (e) e.stopPropagation();
                if (quickModsPopup) quickModsPopup.style.display = 'none';
                if (window.modManager) window.modManager.toggleModal(true);
            });
        }

        // Close quick mods dropdown if user clicks outside
        window.addEventListener('click', (e) => {
            if (quickModsPopup && quickModsPopup.style.display === 'block') {
                if (!quickModsPopup.contains(e.target) && e.target !== btnQuickMods && (!btnQuickMods || !btnQuickMods.contains(e.target))) {
                    quickModsPopup.style.display = 'none';
                }
            }
        });
    }

    renderQuickModsList() {
        const list = document.getElementById('quick-mods-list');
        if (!list) return;
        const mm = window.modManager;
        if (!mm || !Array.isArray(mm.mods) || mm.mods.length === 0) {
            list.innerHTML = `<div style="color:#aaa;font-size:11px;padding:12px;text-align:center;">Немає встановлених модів</div>`;
            return;
        }

        list.innerHTML = "";
        mm.mods.forEach((mod) => {
            const row = document.createElement('div');
            row.className = 'quick-mod-row';

            const info = document.createElement('div');
            info.className = 'quick-mod-info';

            const nameEl = document.createElement('div');
            nameEl.className = 'quick-mod-name';
            nameEl.textContent = `${mod.icon || '📜'} ${mod.name}`;

            const descEl = document.createElement('div');
            descEl.className = 'quick-mod-desc';
            descEl.textContent = mod.description ? mod.description.slice(0, 36) : (mod.author || 'Lua Mod');

            info.appendChild(nameEl);
            info.appendChild(descEl);

            const switchLabel = document.createElement('label');
            switchLabel.className = 'quick-switch';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = !!mod.enabled;
            chk.onchange = (e) => {
                e.stopPropagation();
                if (window.modManager) {
                    window.modManager.toggleMod(mod.id, chk.checked);
                    if (this.soundManager) this.soundManager.playClick();
                }
            };

            const slider = document.createElement('span');
            slider.className = 'quick-slider';

            switchLabel.appendChild(chk);
            switchLabel.appendChild(slider);

            row.appendChild(info);
            row.appendChild(switchLabel);
            list.appendChild(row);
        });
    }

    initHotbar() {
        const container = document.getElementById('hotbar-slots');
        if (!container) return;

        // In-place update if 9 slots already exist (Zero DOM rebuild lag!)
        if (container.children.length === 9) {
            for (let i = 0; i < 9; i++) {
                const slot = container.children[i];
                slot.classList.toggle('active', i === this.player.selectedHotbarIndex);

                const item = this.player.inventory[i];
                let img = slot.querySelector('.slot-icon');
                let countBadge = slot.querySelector('.slot-count');

                if (!item) {
                    if (img) img.remove();
                    if (countBadge) countBadge.remove();
                } else {
                    const reg = ITEM_REGISTRY[item.itemId];
                    const iconUrl = this.textureManager.getIconDataURL(reg ? reg.icon : 'stone');
                    if (!img) {
                        img = document.createElement('img');
                        img.className = 'slot-icon';
                        slot.prepend(img);
                    }
                    if (img.src !== iconUrl) {
                        img.src = iconUrl;
                    }

                    if (item.count > 1) {
                        if (!countBadge) {
                            countBadge = document.createElement('span');
                            countBadge.className = 'slot-count';
                            slot.appendChild(countBadge);
                        }
                        if (countBadge.textContent !== String(item.count)) {
                            countBadge.textContent = item.count;
                        }
                    } else if (countBadge) {
                        countBadge.remove();
                    }
                }
            }
            this.updateBlockNameDisplay();
            return;
        }

        container.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const slot = document.createElement('div');
            slot.className = `hotbar-slot ${i === this.player.selectedHotbarIndex ? 'active' : ''}`;
            slot.dataset.index = i;

            const item = this.player.inventory[i];
            if (item) {
                const img = document.createElement('img');
                img.className = 'slot-icon';
                const reg = ITEM_REGISTRY[item.itemId];
                img.src = this.textureManager.getIconDataURL(reg ? reg.icon : 'stone');
                slot.appendChild(img);

                if (item.count > 1) {
                    const countBadge = document.createElement('span');
                    countBadge.className = 'slot-count';
                    countBadge.textContent = item.count;
                    slot.appendChild(countBadge);
                }
            }

            const selectSlot = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectHotbarSlot(i);
            };

            slot.addEventListener('click', selectSlot);
            slot.addEventListener('touchstart', selectSlot, { passive: false });

            container.appendChild(slot);
        }

        this.updateBlockNameDisplay();
    }

    selectHotbarSlot(index) {
        if (index < 0 || index >= 9) return;
        this.player.selectedHotbarIndex = index;
        this.player.updateHeldBlock();
        this.soundManager.playClick();

        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((s, idx) => {
            s.classList.toggle('active', idx === index);
        });

        this.updateBlockNameDisplay();
    }

    updateBlockNameDisplay() {
        if (!this.hudBlockName) return;
        const item = this.player.getSelectedItem();
        if (!item) {
            this.hudBlockName.textContent = "";
            return;
        }
        const reg = ITEM_REGISTRY[item.itemId];
        this.hudBlockName.textContent = reg ? `${reg.name} (x${item.count})` : item.itemId;
        this.hudBlockName.style.opacity = '1';

        clearTimeout(this.blockNameTimeout);
        this.blockNameTimeout = setTimeout(() => {
            if (this.hudBlockName) this.hudBlockName.style.opacity = '0';
        }, 2200);
    }

    // --- MULTI-TAB INVENTORY MODAL ---
    initInventoryModal() {
        const modal = document.getElementById('inventory-modal');
        const closeBtn = document.getElementById('inventory-close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleInventory(false));
        }

        const tabs = ['backpack', 'catalog', 'crafting', 'cases', 'upgrader', 'trash', 'skins'];

        // Tab Navigation Arrows (◀ / ▶)
        const btnNavPrev = document.getElementById('tab-nav-prev');
        if (btnNavPrev) {
            btnNavPrev.addEventListener('click', (e) => {
                e.preventDefault();
                const curIdx = tabs.indexOf(this.currentTab);
                const prevTab = tabs[(curIdx - 1 + tabs.length) % tabs.length];
                this.switchTab(prevTab);
            });
        }

        const btnNavNext = document.getElementById('tab-nav-next');
        if (btnNavNext) {
            btnNavNext.addEventListener('click', (e) => {
                e.preventDefault();
                const curIdx = tabs.indexOf(this.currentTab);
                const nextTab = tabs[(curIdx + 1) % tabs.length];
                this.switchTab(nextTab);
            });
        }

        // Swipe Left / Right to flip through tabs on touchscreen
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        if (modal) {
            modal.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    touchStartTime = performance.now();
                }
            }, { passive: true });

            modal.addEventListener('touchend', (e) => {
                if (e.changedTouches.length === 1) {
                    const deltaX = e.changedTouches[0].clientX - touchStartX;
                    const deltaY = e.changedTouches[0].clientY - touchStartY;
                    const deltaTime = performance.now() - touchStartTime;

                    // Detect intentional horizontal swipe (distance > 45px, largely horizontal, under 450ms)
                    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && deltaTime < 450) {
                        const curIdx = tabs.indexOf(this.currentTab);
                        if (curIdx !== -1) {
                            if (deltaX < 0) {
                                // Swipe Left -> Next Tab
                                const nextTab = tabs[(curIdx + 1) % tabs.length];
                                this.switchTab(nextTab);
                            } else {
                                // Swipe Right -> Prev Tab
                                const prevTab = tabs[(curIdx - 1 + tabs.length) % tabs.length];
                                this.switchTab(prevTab);
                            }
                        }
                    }
                }
            }, { passive: true });
        }

        // Tabs click handling
        const tabButtons = document.querySelectorAll('.inv-tab');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });

        this.renderCurrentTab();
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        this.soundManager.playClick();

        const tabButtons = document.querySelectorAll('.inv-tab');
        tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));

        // Auto-scroll active tab into view horizontally in tab-bar
        const activeBtn = document.querySelector(`.inv-tab[data-tab="${tabName}"]`);
        if (activeBtn && activeBtn.scrollIntoView) {
            activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        this.renderCurrentTab();
    }

    renderCurrentTab() {
        const contentContainer = document.getElementById('inventory-content');
        if (!contentContainer) return;
        contentContainer.innerHTML = '';
        contentContainer.scrollTop = 0;

        switch (this.currentTab) {
            case 'backpack':
                this.renderBackpackTab(contentContainer);
                break;
            case 'catalog':
                this.renderCatalogTab(contentContainer);
                break;
            case 'crafting':
                this.renderCraftingTab(contentContainer);
                break;
            case 'cases':
                this.renderCasesTab(contentContainer);
                break;
            case 'upgrader':
                this.renderUpgraderTab(contentContainer);
                break;
            case 'trash':
                this.renderTrashTab(contentContainer);
                break;
            case 'skins':
                this.renderSkinsTab(contentContainer);
                break;
        }
    }

    // 1. Backpack Tab (27 slots)
    renderBackpackTab(container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tab-backpack-wrapper';

        const title = document.createElement('div');
        title.className = 'backpack-section-title';
        title.innerHTML = '🎒 ХОТБАР (1-9) &amp; ОСНОВНИЙ РЮКЗАК:';
        wrapper.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'backpack-grid';

        for (let i = 0; i < 27; i++) {
            const slotEl = document.createElement('div');
            slotEl.className = `backpack-slot ${i < 9 ? 'is-hotbar' : ''} ${this.selectedInventorySlot === i ? 'selected' : ''}`;

            const item = this.player.inventory[i];
            if (item) {
                const img = document.createElement('img');
                const reg = ITEM_REGISTRY[item.itemId];
                img.src = this.textureManager.getIconDataURL(reg ? reg.icon : 'stone');
                slotEl.appendChild(img);

                if (item.count > 1) {
                    const countEl = document.createElement('span');
                    countEl.className = 'slot-count';
                    countEl.textContent = item.count;
                    slotEl.appendChild(countEl);
                }
            }

            slotEl.addEventListener('click', () => {
                if (this.selectedInventorySlot === null) {
                    if (this.player.inventory[i]) {
                        this.selectedInventorySlot = i;
                        this.renderCurrentTab();
                    }
                } else {
                    // Swap slots
                    const fromIdx = this.selectedInventorySlot;
                    const toIdx = i;
                    const temp = this.player.inventory[fromIdx];
                    this.player.inventory[fromIdx] = this.player.inventory[toIdx];
                    this.player.inventory[toIdx] = temp;

                    this.selectedInventorySlot = null;
                    this.player.saveInventory();
                    this.player.updateHeldBlock();
                    this.initHotbar();
                    this.renderCurrentTab();
                    this.soundManager.playClick();
                }
            });

            grid.appendChild(slotEl);
        }
        wrapper.appendChild(grid);

        // Actions toolbar
        const actions = document.createElement('div');
        actions.className = 'backpack-actions';

        if (this.selectedInventorySlot !== null) {
            const selItem = this.player.inventory[this.selectedInventorySlot];
            if (selItem) {
                const reg = ITEM_REGISTRY[selItem.itemId];
                const infoText = document.createElement('div');
                infoText.className = 'backpack-info-text';
                infoText.textContent = `Вибрано: ${reg ? reg.name : selItem.itemId} (${selItem.count} шт.)`;
                actions.appendChild(infoText);

                const btnDrop = document.createElement('button');
                btnDrop.className = 'menu-btn btn-danger';
                btnDrop.textContent = '🗑️ Викинути (1 шт)';
                btnDrop.onclick = () => {
                    this.player.dropItem(this.selectedInventorySlot, 1);
                    this.renderCurrentTab();
                };
                actions.appendChild(btnDrop);

                if (reg && reg.category === 'food') {
                    const btnEat = document.createElement('button');
                    btnEat.className = 'menu-btn btn-success';
                    btnEat.textContent = '🍗 З’їсти';
                    btnEat.onclick = () => {
                        this.player.selectedHotbarIndex = this.selectedInventorySlot < 9 ? this.selectedInventorySlot : 0;
                        this.player.eatFood();
                        this.renderCurrentTab();
                    };
                    actions.appendChild(btnEat);
                }
            }
        } else {
            const hint = document.createElement('div');
            hint.className = 'backpack-hint';
            hint.textContent = '💡 Клікніть на предмет, потім на інший слот, щоб поміняти місцями!';
            actions.appendChild(hint);
        }

        wrapper.appendChild(actions);

        // Inventory Management Toolbar (Reset / Clear)
        const manageToolbar = document.createElement('div');
        manageToolbar.className = 'backpack-manage-toolbar';

        const btnStarter = document.createElement('button');
        btnStarter.className = 'menu-btn btn-primary';
        btnStarter.innerHTML = '🔄 Стартовий набір';
        btnStarter.title = 'Повернути стандартний набір виживання';
        btnStarter.onclick = () => {
            if (confirm("Скинути інвентар до стандартного набору виживання?")) {
                this.selectedInventorySlot = null;
                this.player.resetToStarterInventory();
                this.initHotbar();
                this.renderCurrentTab();
                this.showToast("🎒 Стартовий набір отримано!");
            }
        };

        const btnClear = document.createElement('button');
        btnClear.className = 'menu-btn btn-danger';
        btnClear.innerHTML = '🧹 Очистити все';
        btnClear.title = 'Повністю очистити весь інвентар';
        btnClear.onclick = () => {
            if (confirm("Повністю очистити весь інвентар (усі 27 слотів)?")) {
                this.selectedInventorySlot = null;
                this.player.clearInventory();
                this.initHotbar();
                this.renderCurrentTab();
                this.showToast("🧹 Інвентар повністю очищено!");
            }
        };

        manageToolbar.appendChild(btnStarter);
        manageToolbar.appendChild(btnClear);
        wrapper.appendChild(manageToolbar);

        container.appendChild(wrapper);
    }

    // 2. Catalog Tab (All Items & Blocks - scrollable & clickable to take)
    renderCatalogTab(container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tab-catalog-wrapper';

        const filterRow = document.createElement('div');
        filterRow.className = 'catalog-filter-row';

        const categories = [
            { id: 'all', label: 'Усі' },
            { id: 'block', label: '🧱 Блоки' },
            { id: 'weapon', label: '⚔️ Зброя' },
            { id: 'tool', label: '⛏️ Кайла' },
            { id: 'food', label: '🍗 Їжа' },
            { id: 'material', label: '💎 Руда / Ресурси' }
        ];

        this.catalogFilter = this.catalogFilter || 'all';

        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `catalog-filter-btn ${this.catalogFilter === cat.id ? 'active' : ''}`;
            btn.textContent = cat.label;
            btn.onclick = () => {
                this.catalogFilter = cat.id;
                this.renderCurrentTab();
            };
            filterRow.appendChild(btn);
        });

        wrapper.appendChild(filterRow);

        const grid = document.createElement('div');
        grid.className = 'catalog-grid';

        const items = Object.values(ITEM_REGISTRY).filter(item => {
            if (this.catalogFilter === 'all') return true;
            if (this.catalogFilter === 'block') return item.isBlock;
            if (this.catalogFilter === 'weapon') return item.category === 'sword';
            if (this.catalogFilter === 'tool') return item.category === 'pickaxe';
            if (this.catalogFilter === 'food') return item.category === 'food';
            if (this.catalogFilter === 'material') return item.category === 'material' || item.category === 'junk';
            return true;
        });

        items.forEach(reg => {
            const card = document.createElement('div');
            card.className = 'catalog-card';

            const icon = document.createElement('img');
            icon.src = this.textureManager.getIconDataURL(reg.icon || 'stone');
            card.appendChild(icon);

            const name = document.createElement('div');
            name.className = 'catalog-item-name';
            name.textContent = reg.name;
            card.appendChild(name);

            card.onclick = () => {
                const addCount = (reg.category === 'pickaxe' || reg.category === 'sword') ? 1 : 64;
                const added = this.player.addItem(reg.id, addCount);
                if (added) {
                    this.soundManager.playClick();
                    this.showToast(`Отримано: ${reg.name} x${addCount}`);
                    this.initHotbar();
                } else {
                    this.showToast(`Інвентар переповнений!`);
                }
            };

            grid.appendChild(card);
        });

        wrapper.appendChild(grid);
        container.appendChild(wrapper);
    }

    // 3. Crafting Tab
    renderCraftingTab(container) {
        const list = document.createElement('div');
        list.className = 'crafting-list';

        CRAFTING_RECIPES.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'craft-card';

            const left = document.createElement('div');
            left.className = 'craft-left';

            const icon = document.createElement('img');
            const outReg = ITEM_REGISTRY[recipe.output.itemId];
            icon.src = this.textureManager.getIconDataURL(outReg ? outReg.icon : 'stone');
            left.appendChild(icon);

            const details = document.createElement('div');
            details.className = 'craft-details';
            details.innerHTML = `<div class="craft-name">${recipe.name}</div><div class="craft-desc">${recipe.desc}</div>`;

            // Requirements list
            const reqs = document.createElement('div');
            reqs.className = 'craft-reqs';
            let canCraft = true;

            recipe.inputs.forEach(inp => {
                const hasCount = this.player.getItemCount(inp.itemId);
                const inReg = ITEM_REGISTRY[inp.itemId];
                const reqItem = document.createElement('span');
                reqItem.className = `req-tag ${hasCount >= inp.count ? 'req-ok' : 'req-missing'}`;
                reqItem.textContent = `${inReg ? inReg.name : inp.itemId}: ${hasCount}/${inp.count}`;
                reqs.appendChild(reqItem);
                if (hasCount < inp.count) canCraft = false;
            });
            details.appendChild(reqs);
            left.appendChild(details);
            card.appendChild(left);

            // Craft button
            const btnCraft = document.createElement('button');
            btnCraft.className = `menu-btn ${canCraft ? 'btn-success' : 'btn-disabled'}`;
            btnCraft.textContent = '🔨 Скрафтити';
            btnCraft.disabled = !canCraft;
            btnCraft.onclick = () => {
                if (!canCraft) return;
                // Deduct inputs
                recipe.inputs.forEach(inp => this.player.removeItem(inp.itemId, inp.count));
                // Add output
                this.player.addItem(recipe.output.itemId, recipe.output.count);
                this.soundManager.playClick();
                this.soundManager.speakRandomMeme(["Скрафтив!", "Красава!", "Оце річ!"]);
                this.renderCurrentTab();
            };
            card.appendChild(btnCraft);

            list.appendChild(card);
        });

        container.appendChild(list);
    }

    // 3. Cases Tab
    renderCasesTab(container) {
        const grid = document.createElement('div');
        grid.className = 'cases-grid';

        Object.keys(CASES_CONFIG).forEach(caseKey => {
            const cfg = CASES_CONFIG[caseKey];
            const card = document.createElement('div');
            card.className = 'case-card';

            const img = document.createElement('img');
            img.src = this.textureManager.getIconDataURL(cfg.id);
            card.appendChild(img);

            const title = document.createElement('div');
            title.className = 'case-title';
            title.textContent = cfg.name;
            card.appendChild(title);

            const desc = document.createElement('div');
            desc.className = 'case-desc';
            desc.textContent = cfg.desc;
            card.appendChild(desc);

            const costText = document.createElement('div');
            costText.className = 'case-cost';
            if (cfg.cost) {
                const inReg = ITEM_REGISTRY[cfg.cost.itemId];
                const has = this.player.getItemCount(cfg.cost.itemId);
                costText.innerHTML = `Ціна: <b>${cfg.cost.count} ${inReg ? inReg.name : cfg.cost.itemId}</b> (У вас: ${has})`;
            } else {
                costText.innerHTML = `Ціна: <b>Безкоштовно!</b>`;
            }
            card.appendChild(costText);

            const btnOpen = document.createElement('button');
            btnOpen.className = 'menu-btn btn-primary';
            btnOpen.textContent = '📦 Відкрити Кейс';
            btnOpen.onclick = () => {
                this.startCaseOpening(cfg.id);
            };
            card.appendChild(btnOpen);

            grid.appendChild(card);
        });

        container.appendChild(grid);
    }

    // 4. Upgrader Tab
    renderUpgraderTab(container) {
        const list = document.createElement('div');
        list.className = 'upgrader-list';

        Object.keys(UPGRADES_CONFIG).forEach(upgKey => {
            const cfg = UPGRADES_CONFIG[upgKey];
            const curLvl = this.game.upgrader.upgrades[upgKey] || 0;
            const isMax = curLvl >= cfg.maxLevel;
            const cost = cfg.baseCost * (curLvl + 1);

            const card = document.createElement('div');
            card.className = 'upgrade-card';

            const left = document.createElement('div');
            left.className = 'upg-left';
            left.innerHTML = `
                <div class="upg-icon">${cfg.icon}</div>
                <div class="upg-details">
                    <div class="upg-name">${cfg.name} <span class="upg-level">Рівень: ${curLvl}/${cfg.maxLevel}</span></div>
                    <div class="upg-desc">${cfg.desc}</div>
                    <div class="upg-cost">${isMax ? 'МАКСИМАЛЬНИЙ РІВЕНЬ!' : `Ціна: <b>${cost} Жетонів / Злитків</b>`}</div>
                </div>
            `;
            card.appendChild(left);

            const btnUpg = document.createElement('button');
            const canAfford = this.game.upgrader.canAffordUpgrade(upgKey);
            btnUpg.className = `menu-btn ${!isMax && canAfford ? 'btn-success' : 'btn-disabled'}`;
            btnUpg.textContent = isMax ? '✔ МАКС' : '⚡ Прокачати';
            btnUpg.disabled = isMax || !canAfford;
            btnUpg.onclick = () => {
                if (this.game.upgrader.purchaseUpgrade(upgKey)) {
                    this.renderCurrentTab();
                }
            };
            card.appendChild(btnUpg);

            list.appendChild(card);
        });

        container.appendChild(list);
    }

    // 5. Trash & Recycler Tab
    renderTrashTab(container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'trash-wrapper';

        wrapper.innerHTML = `
            <div class="trash-header">
                <h2>🗑️ МУСОРОПРОВІД ТА УТИЛІЗАТОР ЄБЛАНА</h2>
                <p>Знайшов у шахті старий носок, бичок або банку пива? Здай у переробку та отримай Мусорні Жетони ♻️ для Апгрейдера!</p>
            </div>
        `;

        // Count junk in player's inventory
        let totalJunk = 0;
        JUNK_ITEMS_POOL.forEach(jId => {
            totalJunk += this.player.getItemCount(jId);
        });

        const status = document.createElement('div');
        status.className = 'trash-status';
        status.innerHTML = `У вашому інвентарі знайдено мусору: <b>${totalJunk} шт.</b>`;
        wrapper.appendChild(status);

        const btnRecycle = document.createElement('button');
        btnRecycle.className = `menu-btn ${totalJunk > 0 ? 'btn-success' : 'btn-disabled'}`;
        btnRecycle.style.padding = '14px 20px';
        btnRecycle.style.fontSize = '16px';
        btnRecycle.textContent = `♻️ Переробити весь мусор (Отримати ~${Math.ceil(totalJunk / 2)} Жетонів)`;
        btnRecycle.disabled = totalJunk === 0;

        btnRecycle.onclick = () => {
            let tokensToAdd = 0;
            JUNK_ITEMS_POOL.forEach(jId => {
                const count = this.player.getItemCount(jId);
                if (count > 0) {
                    this.player.removeItem(jId, count);
                    tokensToAdd += Math.max(1, Math.floor(count / 2));
                }
            });

            if (tokensToAdd > 0) {
                this.player.addItem(ITEM_TYPES.JUNK_TOKEN, tokensToAdd);
                this.soundManager.playClick();
                this.soundManager.speakRandomMeme(["Мусор перероблено!", "Оце ти еколог!"]);
                this.showToast(`♻️ Отримано +${tokensToAdd} Мусорних Жетонів!`);
                this.renderCurrentTab();
            }
        };
        wrapper.appendChild(btnRecycle);

        container.appendChild(wrapper);
    }

    // 6. Skins Tab
    renderSkinsTab(container) {
        // --- CUSTOM SKIN UPLOAD HEADER ---
        const uploadBox = document.createElement('div');
        uploadBox.className = 'custom-skin-banner';
        uploadBox.style.cssText = 'background: linear-gradient(135deg, rgba(21,101,192,0.25), rgba(123,31,162,0.25)); border: 2px dashed #00e5ff; border-radius: 8px; padding: 12px; margin-bottom: 14px; text-align: center;';

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: bold; font-size: 14px; color: #00e5ff; margin-bottom: 4px;';
        title.textContent = '🎭 Завантажити власний скін Майнкрафт (.PNG)';
        uploadBox.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.style.cssText = 'font-size: 11px; color: #bbb; margin-bottom: 10px;';
        subtitle.textContent = 'Підтримуються стандартні скіни 64x64 та 64x32 з ПК або галереї телефону';
        uploadBox.appendChild(subtitle);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/jpeg';
        fileInput.style.display = 'none';
        uploadBox.appendChild(fileInput);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;';

        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'menu-btn btn-primary';
        uploadBtn.textContent = '📁 Обрати PNG файл';
        uploadBtn.onclick = () => fileInput.click();
        btnRow.appendChild(uploadBtn);

        const hasCustom = window.skinManager && window.skinManager.customSkinDataUrl;
        const isCustomEquipped = this.game.upgrader.equippedSkin === 'custom';

        const equipCustomBtn = document.createElement('button');
        equipCustomBtn.className = `menu-btn ${isCustomEquipped ? 'btn-success' : 'btn-secondary'}`;
        equipCustomBtn.textContent = isCustomEquipped ? '✔ Власний одягнено' : 'Одягнути свій скін';
        equipCustomBtn.disabled = isCustomEquipped || !hasCustom;
        equipCustomBtn.onclick = () => {
            this.game.upgrader.unlockedSkins['custom'] = true;
            this.game.upgrader.equipSkin('custom');
            this.renderCurrentTab();
            this.showToast('✔ Власний скін активовано!');
        };
        btnRow.appendChild(equipCustomBtn);
        uploadBox.appendChild(btnRow);

        const statusMsg = document.createElement('div');
        statusMsg.style.cssText = 'font-size: 11px; color: #a5d6a7; margin-top: 6px;';
        statusMsg.textContent = hasCustom ? '✨ Власний скін завантажено в гру' : 'Файл ще не вибрано';
        uploadBox.appendChild(statusMsg);

        fileInput.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                if (window.skinManager) {
                    window.skinManager.setCustomSkin(dataUrl);
                }
                this.game.upgrader.unlockedSkins['custom'] = true;
                this.game.upgrader.equipSkin('custom');
                this.showToast('✅ Власний скін успішно встановлено та одягнено!');
                this.renderCurrentTab();
            };
            reader.readAsDataURL(file);
        };

        container.appendChild(uploadBox);

        // --- SKINS GRID ---
        const grid = document.createElement('div');
        grid.className = 'skins-grid';

        Object.keys(SKINS_REGISTRY).forEach(skinKey => {
            const skin = SKINS_REGISTRY[skinKey];
            const isEquipped = this.game.upgrader.equippedSkin === skinKey;
            const isUnlocked = this.game.upgrader.unlockedSkins[skinKey];

            const card = document.createElement('div');
            card.className = `skin-card ${isEquipped ? 'equipped' : ''}`;

            // Pixelated Face Avatar Preview
            if (window.skinManager) {
                const faceCanvas = window.skinManager.getFacePreviewCanvas(skinKey);
                faceCanvas.className = 'skin-avatar-preview';
                card.appendChild(faceCanvas);
            } else {
                const swatch = document.createElement('div');
                swatch.className = 'skin-swatch';
                swatch.style.background = `linear-gradient(135deg, ${skin.colors.shirt} 50%, ${skin.colors.pants} 50%)`;
                card.appendChild(swatch);
            }

            const name = document.createElement('div');
            name.className = 'skin-name';
            name.textContent = skin.name;
            card.appendChild(name);

            const buff = document.createElement('div');
            buff.className = 'skin-buff';
            buff.textContent = skin.buffDesc;
            card.appendChild(buff);

            const btn = document.createElement('button');
            if (isEquipped) {
                btn.className = 'menu-btn btn-success';
                btn.textContent = '✔ Надіто';
                btn.disabled = true;
            } else if (isUnlocked) {
                btn.className = 'menu-btn btn-primary';
                btn.textContent = 'Одягнути';
                btn.onclick = () => {
                    this.game.upgrader.equipSkin(skinKey);
                    this.renderCurrentTab();
                };
            } else {
                btn.className = 'menu-btn btn-disabled';
                btn.textContent = '🔒 З кейсу';
                btn.disabled = true;
            }
            card.appendChild(btn);

            grid.appendChild(card);
        });

        container.appendChild(grid);
    }

    // --- CASE ROULETTE OPENING ANIMATION ---
    initCaseModal() {
        this.caseModal = document.getElementById('case-modal');
    }

    startCaseOpening(caseId) {
        if (this.isSpinningCase) return;

        const reward = this.game.upgrader.openCase(caseId);
        if (!reward) {
            this.showToast("❌ Недостатньо ресурсів для відкриття кейсу!");
            return;
        }

        this.isSpinningCase = true;
        this.toggleInventory(false);

        if (!this.caseModal) return;
        this.caseModal.style.display = 'flex';

        const track = document.getElementById('case-roulette-track');
        track.innerHTML = '';
        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';

        const cfg = CASES_CONFIG[caseId];

        // Generate 40 items for reel, placing winning item at index 30
        const items = [];
        for (let i = 0; i < 35; i++) {
            if (i === 30) {
                items.push(reward);
            } else {
                const randItem = cfg.items[Math.floor(Math.random() * cfg.items.length)];
                items.push(randItem);
            }
        }

        items.forEach((it, idx) => {
            const card = document.createElement('div');
            card.className = `case-item-card ${it.isSkin ? 'is-skin-card' : ''}`;

            const img = document.createElement('img');
            if (it.isSkin) {
                const s = SKINS_REGISTRY[it.skinId];
                img.src = this.textureManager.getIconDataURL('diamond');
                card.innerHTML = `<div class="roulette-skin-tag">🎭 СКІН</div><div class="roulette-item-title">${s ? s.name : it.skinId}</div>`;
            } else {
                const reg = ITEM_REGISTRY[it.item];
                img.src = this.textureManager.getIconDataURL(reg ? reg.icon : 'stone');
                card.appendChild(img);
                const title = document.createElement('div');
                title.className = 'roulette-item-title';
                title.textContent = `${reg ? reg.name : it.item} (x${it.count || 1})`;
                card.appendChild(title);
            }
            track.appendChild(card);
        });

        // Trigger slide animation
        setTimeout(() => {
            const cardWidth = 120; // px
            const targetX = -(30 * cardWidth - 140);

            track.style.transition = 'transform 5.5s cubic-bezier(0.12, 0.8, 0.2, 1)';
            track.style.transform = `translateX(${targetX}px)`;

            // Ticking sound during spin
            let ticks = 0;
            const tickInterval = setInterval(() => {
                ticks++;
                if (this.soundManager) this.soundManager.playRouletteTick();
                if (ticks > 28) clearInterval(tickInterval);
            }, 180);

            // Finish after 5.5s
            setTimeout(() => {
                this.isSpinningCase = false;
                if (this.soundManager) {
                    this.soundManager.playWinFanfare();
                    this.soundManager.speakRandomMeme(["Оце так улов!", "Красава, вибив лут!"]);
                }

                const rewardTitle = reward.isSkin ?
                    `🎭 Новий скін: ${SKINS_REGISTRY[reward.skinId]?.name}!` :
                    `🎁 Отримано: ${ITEM_REGISTRY[reward.item]?.name} (x${reward.count || 1})!`;

                this.showToast(rewardTitle);

                setTimeout(() => {
                    if (this.caseModal) this.caseModal.style.display = 'none';
                    this.toggleInventory(true);
                    this.switchTab('backpack');
                }, 2000);
            }, 5600);
        }, 100);
    }

    // --- DIMENSION WARP MODAL ---
    initWarpModal() {
        const modal = document.getElementById('warp-modal');
        const closeBtn = document.getElementById('warp-close');
        if (closeBtn) closeBtn.onclick = () => this.toggleWarpModal(false);

        const btnOverworld = document.getElementById('warp-overworld');
        const btnNether = document.getElementById('warp-nether');
        const btnEnd = document.getElementById('warp-end');

        if (btnOverworld) btnOverworld.onclick = () => { this.game.world.switchDimension('overworld'); this.toggleWarpModal(false); };
        if (btnNether) btnNether.onclick = () => { this.game.world.switchDimension('nether'); this.toggleWarpModal(false); };
        if (btnEnd) btnEnd.onclick = () => { this.game.world.switchDimension('the_end'); this.toggleWarpModal(false); };
    }

    toggleWarpModal(forceState = null) {
        const modal = document.getElementById('warp-modal');
        if (!modal) return;
        const show = forceState !== null ? forceState : modal.style.display !== 'flex';
        modal.style.display = show ? 'flex' : 'none';
        this.soundManager.playClick();
    }

    // --- TOAST NOTIFICATIONS ---
    showToast(text) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'hud-toast';
        toast.textContent = text;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    toggleInventory(forceState = null) {
        const modal = document.getElementById('inventory-modal');
        if (!modal) return;
        this.inventoryOpen = forceState !== null ? forceState : !this.inventoryOpen;
        modal.style.display = this.inventoryOpen ? 'flex' : 'none';
        this.soundManager.playClick();
        if (this.inventoryOpen) {
            if (document.pointerLockElement) document.exitPointerLock();
            const box = modal.querySelector('.inventory-full-modal') || modal;
            this.enableModalTouchScroll(box);
            this.renderCurrentTab();
        }
    }

    initPauseMenu() {
        const menu = document.getElementById('pause-menu');
        const closeBtn = document.getElementById('menu-close');
        const btnResume = document.getElementById('btn-resume');
        const btnRespawn = document.getElementById('btn-respawn');
        const btnResetWorld = document.getElementById('btn-reset-world');
        const btnSaveWorld = document.getElementById('btn-save-world');
        const btnLoadWorld = document.getElementById('btn-load-world');

        const selectWorldType = document.getElementById('select-world-type');
        const sliderSens = document.getElementById('slider-sensitivity');
        const chkVoice = document.getElementById('chk-voice');
        const chkGodMode = document.getElementById('chk-godmode');

        const hideMenu = () => this.togglePauseMenu(false);
        if (closeBtn) closeBtn.onclick = hideMenu;
        if (btnResume) btnResume.onclick = hideMenu;

        const btnMenuToMain = document.getElementById('btn-menu-to-main');
        if (btnMenuToMain) {
            btnMenuToMain.onclick = () => {
                this.openMainMenu();
            };
        }

        if (btnRespawn) {
            btnRespawn.onclick = () => {
                this.player.spawnSafe();
                hideMenu();
            };
        }

        if (btnResetWorld) {
            btnResetWorld.onclick = () => {
                const worldType = selectWorldType ? selectWorldType.value : 'normal';
                this.game.resetWorld(worldType);
                hideMenu();
            };
        }

        if (btnSaveWorld) {
            btnSaveWorld.onclick = () => {
                const json = this.game.world.exportJSON();
                localStorage.setItem('eblankraft_saved_world', json);
                this.showToast("💾 Світ успішно збережено!");
            };
        }

        if (btnLoadWorld) {
            btnLoadWorld.onclick = () => {
                const json = localStorage.getItem('eblankraft_saved_world');
                if (json) {
                    this.game.world.importJSON(json);
                    this.player.spawnSafe();
                    this.showToast("📂 Світ успішно завантажено!");
                    hideMenu();
                } else {
                    alert("Збереженого світу не знайдено!");
                }
            };
        }

        if (sliderSens) {
            sliderSens.oninput = (e) => {
                const val = parseFloat(e.target.value);
                this.game.controls.touchLookSensitivity = 0.002 + val * 0.005;
                this.game.controls.mouseSensitivity = 0.001 + val * 0.003;
            };
        }

        if (chkVoice) chkVoice.onchange = (e) => { this.soundManager.voiceEnabled = e.target.checked; };
        if (chkGodMode) chkGodMode.onchange = (e) => { this.player.godMode = e.target.checked; };

        // Physics API sliders (shared with Lua Physics.set — same player fields)
        const physNum = (k, def) => {
            try {
                const v = parseFloat(localStorage.getItem('eblan_phys_' + k));
                return isNaN(v) ? def : v;
            } catch (e) { return def; }
        };
        const physSave = (k, v) => { try { localStorage.setItem('eblan_phys_' + k, String(v)); } catch (e) {} };
        const sliderGrav = document.getElementById('slider-gravity');
        const lblGrav = document.getElementById('lbl-gravity');
        const sliderJump = document.getElementById('slider-jump');
        const lblJump = document.getElementById('lbl-jump');
        const sliderPSpd = document.getElementById('slider-pspeed');
        const lblPSpd = document.getElementById('lbl-pspeed');
        const chkNoFall = document.getElementById('chk-nofall');
        const btnPhysReset = document.getElementById('btn-phys-reset');
        const applyPhysUI = () => {
            if (sliderGrav && lblGrav) {
                const g = physNum('gravity', 22);
                sliderGrav.value = g; lblGrav.textContent = `${g}`;
                this.player.physGravity = (g === 22) ? undefined : g;
                physSave('gravity', g);
            }
            if (sliderJump && lblJump) {
                const j = physNum('jump', 8.5);
                sliderJump.value = j; lblJump.textContent = `${j}`;
                this.player.physJumpPower = (j === 8.5) ? undefined : j;
                physSave('jump', j);
            }
            if (sliderPSpd && lblPSpd) {
                const s = physNum('speed', 1.0);
                sliderPSpd.value = s; lblPSpd.textContent = `${s.toFixed(1)}x`;
                this.player.speedMultiplier = s;
                physSave('speed', s);
            }
            if (chkNoFall) {
                let nf = false;
                try { nf = localStorage.getItem('eblan_phys_nofall') === '1'; } catch (e) {}
                chkNoFall.checked = nf;
                this.player.physNoFallDamage = nf || undefined;
            }
        };
        applyPhysUI();
        if (sliderGrav) sliderGrav.oninput = (e) => {
            const g = parseFloat(e.target.value);
            if (lblGrav) lblGrav.textContent = `${g}`;
            this.player.physGravity = (g === 22) ? undefined : g;
            physSave('gravity', g);
        };
        if (sliderJump) sliderJump.oninput = (e) => {
            const j = parseFloat(e.target.value);
            if (lblJump) lblJump.textContent = `${j}`;
            this.player.physJumpPower = (j === 8.5) ? undefined : j;
            physSave('jump', j);
        };
        if (sliderPSpd) sliderPSpd.oninput = (e) => {
            const s = parseFloat(e.target.value);
            if (lblPSpd) lblPSpd.textContent = `${s.toFixed(1)}x`;
            this.player.speedMultiplier = s;
            physSave('speed', s);
        };
        if (chkNoFall) chkNoFall.onchange = (e) => {
            this.player.physNoFallDamage = e.target.checked || undefined;
            try { localStorage.setItem('eblan_phys_nofall', e.target.checked ? '1' : '0'); } catch (err) {}
        };
        if (btnPhysReset) btnPhysReset.onclick = () => {
            try {
                localStorage.removeItem('eblan_phys_gravity');
                localStorage.removeItem('eblan_phys_jump');
                localStorage.removeItem('eblan_phys_speed');
                localStorage.removeItem('eblan_phys_nofall');
            } catch (e) {}
            applyPhysUI();
            this.showToast("🏃 Звичайна фізика відновлена!");
        };

        // Graphics toggles: Real-time shadows & Voxel clouds
        const chkShadows = document.getElementById('chk-shadows');
        if (chkShadows) {
            chkShadows.checked = (this.game.shadowsEnabled !== false);
            chkShadows.onchange = (e) => this.game.setShadowsEnabled(e.target.checked);
        }

        const chkClouds = document.getElementById('chk-clouds');
        if (chkClouds) {
            chkClouds.checked = (this.game.cloudsEnabled !== false);
            chkClouds.onchange = (e) => this.game.setCloudsEnabled(e.target.checked);
        }

        // Shaders selection
        const selectShaders = document.getElementById('select-shaders');
        if (selectShaders) {
            const savedShader = localStorage.getItem('eblankraft_shader') || 'bsl';
            selectShaders.value = savedShader;
            this.setShader(savedShader, false);
            selectShaders.onchange = (e) => this.setShader(e.target.value);
        }

        // Render scale selector (FPS Boost for potato PCs & Samsung A02)
        const selectRenderScale = document.getElementById('select-render-scale');
        if (selectRenderScale) {
            const savedScale = localStorage.getItem('eblankraft_render_scale') || (this.game.isA02Mode ? "0.75" : "1.0");
            selectRenderScale.value = savedScale;
            selectRenderScale.onchange = (e) => {
                const val = parseFloat(e.target.value);
                if (this.game && this.game.setRenderScale) this.game.setRenderScale(val);
                this.showToast(`🔍 Масштаб рендера: ${Math.round(val * 100)}%`);
            };
        }

        // WebGPU / WebGL Backend indicator
        const lblGpuBackend = document.getElementById('lbl-gpu-backend');
        if (lblGpuBackend && window.WebGPUAdapter) {
            lblGpuBackend.textContent = window.WebGPUAdapter.getStatusString();
        }

        // 🥔 Ultra Potato Preset (1-Click Mega FPS Boost for 2010 Netbooks & Samsung A02)
        const btnPotato = document.getElementById('btn-ultra-potato-preset');
        if (btnPotato) {
            btnPotato.onclick = () => {
                // 1. Set render scale to 38%
                const selectScale = document.getElementById('select-render-scale');
                if (selectScale) selectScale.value = "0.38";
                if (this.game && this.game.setRenderScale) this.game.setRenderScale(0.38);

                // 2. Enable Turbo FPS
                this.setTurboFPS(true, false);

                // 3. Enable A02 mode
                if (this.game && this.game.setA02Mode) this.game.setA02Mode(true);
                const chkA02 = document.getElementById('chk-a02-mode');
                if (chkA02) chkA02.checked = true;

                // 4. Set chunk distance to 1
                if (this.game && this.game.world) this.game.world.chunkRadius = 1;
                const slDist = document.getElementById('slider-view-distance');
                const lblDist = document.getElementById('lbl-view-distance');
                if (slDist) slDist.value = '1';
                if (lblDist) lblDist.textContent = '1';

                // 5. Disable all heavy FX
                this.game.setShadowsEnabled(false);
                this.game.setCloudsEnabled(false);
                this.game.windLeavesEnabled = false;
                this.game.underwaterEffectsEnabled = false;
                if (this.game.setFancyWaterEnabled) this.game.setFancyWaterEnabled(false);
                try {
                    localStorage.setItem('eblankraft_wind_leaves', '0');
                    localStorage.setItem('eblankraft_underwater_fx', '0');
                } catch(e) {}

                const chkLeaves = document.getElementById('chk-wind-leaves');
                if (chkLeaves) chkLeaves.checked = false;
                const chkUnder = document.getElementById('chk-underwater');
                if (chkUnder) chkUnder.checked = false;
                const chkWater = document.getElementById('chk-fancy-water');
                if (chkWater) chkWater.checked = false;

                this.showToast("🥔 РЕЖИМ ТОСТЕРА 2010 АКТИВОВАНО! ФПС ВЗЛЕТІВ У КОСМОС! 🚀");
            };
        }

        // View distance / infinite world radius
        const sliderViewDist = document.getElementById('slider-view-distance');
        const lblViewDist = document.getElementById('lbl-view-distance');
        if (sliderViewDist && lblViewDist) {
            const curR = this.game.world ? this.game.world.chunkRadius : 2;
            sliderViewDist.value = curR;
            lblViewDist.textContent = `${curR}`;
            sliderViewDist.oninput = (e) => {
                const val = parseInt(e.target.value, 10);
                lblViewDist.textContent = `${val}`;
                if (this.game.world) {
                    this.game.world.chunkRadius = val;
                }
            };
        }

        // Samsung A02 / Low-end Mobile Optimization toggle
        const chkA02 = document.getElementById('chk-a02-mode');
        if (chkA02) {
            chkA02.checked = !!this.game.isA02Mode;
            chkA02.onchange = (e) => {
                this.game.setA02Mode(e.target.checked);
                if (e.target.checked) {
                    if (this.game.setFancyWaterEnabled) this.game.setFancyWaterEnabled(false);
                    const chkWater = document.getElementById('chk-fancy-water');
                    if (chkWater) chkWater.checked = false;
                }
                this.showToast(e.target.checked ? "📱 Оптимізацію Samsung A02 увімкнено (60 FPS)!" : "💻 Режим ПК / Максимальна графіка");
            };
        }

        // 10000000 FPS Boost
        const chkTurbo = document.getElementById('chk-turbofps');
        if (chkTurbo) {
            const savedTurbo = (localStorage.getItem('eblankraft_turbofps') === 'true') || !!this.game.turboFPS;
            chkTurbo.checked = savedTurbo;
            if (savedTurbo) {
                this.setTurboFPS(true, false);
            }
            chkTurbo.onchange = (e) => this.setTurboFPS(e.target.checked);
        }

        // PC Controls Hint Bar Position (WASD Hint location)
        const pcHintBar = document.getElementById('pc-hint-bar');
        const selectPcHints = document.getElementById('select-pc-hints');
        const applyPcHintsPos = (pos) => {
            if (!pcHintBar) return;
            pcHintBar.classList.remove('pos-bottom-left', 'pos-bottom-right', 'pos-above-hotbar', 'pos-top-right', 'pos-hidden');
            pcHintBar.classList.add(`pos-${pos}`);
            if (pos !== 'custom') {
                pcHintBar.style.top = '';
                pcHintBar.style.bottom = '';
                pcHintBar.style.left = '';
                pcHintBar.style.right = '';
                pcHintBar.style.transform = '';
            }
            try { localStorage.setItem('eblankraft_pc_hints_pos', pos); } catch (e) {}
        };
        const savedPcHintsPos = localStorage.getItem('eblankraft_pc_hints_pos') || 'bottom-left';
        applyPcHintsPos(savedPcHintsPos);
        if (selectPcHints) {
            selectPcHints.value = (savedPcHintsPos === 'custom') ? 'bottom-left' : savedPcHintsPos;
            selectPcHints.onchange = (e) => {
                applyPcHintsPos(e.target.value);
                this.showToast("⌨️ Розташування підказок змінено!");
            };
        }

        // Allow dragging the hints bar with mouse on PC when cursor is free
        if (pcHintBar) {
            let isDraggingHints = false;
            let startX = 0, startY = 0;
            let origLeft = 0, origTop = 0;

            pcHintBar.addEventListener('mousedown', (e) => {
                if (document.pointerLockElement) return;
                isDraggingHints = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = pcHintBar.getBoundingClientRect();
                origLeft = rect.left;
                origTop = rect.top;
                pcHintBar.style.bottom = 'auto';
                pcHintBar.style.right = 'auto';
                pcHintBar.style.transform = 'none';
                pcHintBar.style.left = `${origLeft}px`;
                pcHintBar.style.top = `${origTop}px`;
                e.preventDefault();
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDraggingHints) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                pcHintBar.style.left = `${Math.max(0, Math.min(window.innerWidth - pcHintBar.offsetWidth, origLeft + dx))}px`;
                pcHintBar.style.top = `${Math.max(0, Math.min(window.innerHeight - pcHintBar.offsetHeight, origTop + dy))}px`;
            });

            window.addEventListener('mouseup', () => {
                if (isDraggingHints) {
                    isDraggingHints = false;
                    try {
                        localStorage.setItem('eblankraft_pc_hints_pos', 'custom');
                        localStorage.setItem('eblankraft_pc_hints_custom', JSON.stringify({
                            left: pcHintBar.style.left,
                            top: pcHintBar.style.top
                        }));
                    } catch (e) {}
                }
            });

            try {
                if (savedPcHintsPos === 'custom') {
                    const customPos = JSON.parse(localStorage.getItem('eblankraft_pc_hints_custom'));
                    if (customPos) {
                        pcHintBar.style.bottom = 'auto';
                        pcHintBar.style.right = 'auto';
                        pcHintBar.style.transform = 'none';
                        pcHintBar.style.left = customPos.left;
                        pcHintBar.style.top = customPos.top;
                    }
                }
            } catch(e) {}
        }

        // Underwater Effects & Breathing toggle
        const chkUnderwater = document.getElementById('chk-underwater');
        if (chkUnderwater) {
            chkUnderwater.checked = (this.game.underwaterEffectsEnabled !== false);
            chkUnderwater.onchange = (e) => {
                const val = !!e.target.checked;
                this.game.underwaterEffectsEnabled = val;
                try { localStorage.setItem('eblankraft_underwater_fx', val ? '1' : '0'); } catch(err) {}
                const underOverlay = document.getElementById('underwater-overlay');
                if (!val && underOverlay) underOverlay.style.display = 'none';
                const oxyEl = document.getElementById('hud-oxygen');
                if (!val && oxyEl) oxyEl.style.display = 'none';
            };
        }

        // Tree Leaves Wind Animation toggle
        const chkWindLeaves = document.getElementById('chk-wind-leaves');
        if (chkWindLeaves) {
            chkWindLeaves.checked = (this.game.windLeavesEnabled !== false);
            chkWindLeaves.onchange = (e) => {
                const val = !!e.target.checked;
                this.game.windLeavesEnabled = val;
                try { localStorage.setItem('eblankraft_wind_leaves', val ? '1' : '0'); } catch(err) {}
            };
        }

        // 🌊 4K Water with Waves & Normal Maps toggle
        const chkFancyWater = document.getElementById('chk-fancy-water');
        if (chkFancyWater) {
            chkFancyWater.checked = (this.game.fancyWaterEnabled !== false);
            chkFancyWater.onchange = (e) => {
                const val = !!e.target.checked;
                if (this.game.setFancyWaterEnabled) {
                    this.game.setFancyWaterEnabled(val);
                }
                this.showToast(val ? "🌊 4K Вода з хвилями увімкнена!" : "💧 Пласка оптимізована вода (Буст ФПС)!");
            };
        }

        // Quick Mods Icon toggle
        const chkQuickMods = document.getElementById('chk-quick-mods');
        if (chkQuickMods) {
            chkQuickMods.checked = (this.game.quickModsEnabled !== false);
            chkQuickMods.onchange = (e) => {
                const val = !!e.target.checked;
                this.game.quickModsEnabled = val;
                try { localStorage.setItem('eblankraft_quick_mods', val ? '1' : '0'); } catch(err) {}
                const qBtn = document.getElementById('quick-mods-btn');
                if (qBtn) qBtn.style.display = val ? '' : 'none';
                const qPopup = document.getElementById('quick-mods-popup');
                if (!val && qPopup) qPopup.style.display = 'none';
            };
        }

        const btnPauseMp = document.getElementById('btn-pause-multiplayer');
        if (btnPauseMp) {
            btnPauseMp.onclick = () => {
                hideMenu();
                if (this.game && this.game.multiplayer) {
                    this.game.multiplayer.toggleModal(true);
                }
            };
        }

        const btnOpenLayout = document.getElementById('btn-open-layout-modal');
        if (btnOpenLayout) {
            btnOpenLayout.onclick = () => {
                hideMenu();
                this.toggleLayoutModal(true);
            };
        }

        const btnMenuResetInv = document.getElementById('btn-menu-reset-inv');
        if (btnMenuResetInv) {
            btnMenuResetInv.onclick = () => {
                const choice = confirm("Скинути інвентар до стартового набору виживання?\n\n[OK] = Стартовий набір\n[Скасувати] = Не чіпати (для повного очищення відкрийте Рюкзак)");
                if (choice) {
                    this.player.resetToStarterInventory();
                    this.initHotbar();
                    if (this.inventoryOpen) this.renderCurrentTab();
                    this.showToast("🎒 Інвентар скинуто до стартового набору!");
                }
            };
        }
    }

    setShader(shaderName, notify = true) {
        document.body.classList.remove('shader-bsl', 'shader-vanilla', 'shader-turbo');
        document.body.classList.add(`shader-${shaderName}`);
        try { localStorage.setItem('eblankraft_shader', shaderName); } catch(e) {}
        this.currentShader = shaderName;
        if (this.game && this.game.updateShaderAtmosphere) {
            this.game.updateShaderAtmosphere(shaderName);
        }
        const chkShadows = document.getElementById('chk-shadows');
        if (chkShadows && this.game) chkShadows.checked = !!this.game.shadowsEnabled;
        const chkClouds = document.getElementById('chk-clouds');
        if (chkClouds && this.game) chkClouds.checked = !!this.game.cloudsEnabled;
        const chkWater = document.getElementById('chk-fancy-water');
        if (chkWater && this.game) chkWater.checked = (shaderName === 'bsl');
        if (notify) this.showToast(`✨ Шейдери: ${shaderName.toUpperCase()}`);
    }

    setTurboFPS(enabled, notify = true) {
        this.turboFPS = enabled;
        try { localStorage.setItem('eblankraft_turbofps', enabled ? 'true' : 'false'); } catch (e) {}
        if (this.game && this.game.setTurboFPS) {
            this.game.setTurboFPS(enabled);
        }
        const chkTurbo = document.getElementById('chk-turbofps');
        if (chkTurbo) chkTurbo.checked = enabled;

        let badge = document.getElementById('hud-turbofps-badge');
        if (enabled) {
            if (this.game && this.game.setFancyWaterEnabled) this.game.setFancyWaterEnabled(false);
            const chkWater = document.getElementById('chk-fancy-water');
            if (chkWater) chkWater.checked = false;
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'hud-turbofps-badge';
                badge.textContent = '⚡ 14159265... FPS';
                badge.title = '14159265358979323846264338327950288419716939937510... FPS BOOST (ASUS UL20FT & Samsung A02 Edition)';
                const coordsEl = document.getElementById('hud-coords');
                if (coordsEl && coordsEl.parentElement) coordsEl.parentElement.appendChild(badge);
            }
            this.setShader('turbo', false);
            const selectShaders = document.getElementById('select-shaders');
            if (selectShaders) selectShaders.value = 'turbo';
            if (this.game && this.game.world) {
                this.game.world.chunkRadius = 1;
                const lbl = document.getElementById('lbl-view-distance');
                const sl = document.getElementById('slider-view-distance');
                if (lbl) lbl.textContent = '1';
                if (sl) sl.value = '1';
            }
            if (notify) this.showToast("🚀 1415926535... FPS ТУРБО РЕЖИМ! (ASUS UL20FT & A02)");
        } else {
            if (badge) badge.remove();
            this.setShader('bsl', false);
            const selectShaders = document.getElementById('select-shaders');
            if (selectShaders) selectShaders.value = 'bsl';
            if (this.game && this.game.world) {
                this.game.world.chunkRadius = 2;
                const lbl = document.getElementById('lbl-view-distance');
                const sl = document.getElementById('slider-view-distance');
                if (lbl) lbl.textContent = '2';
                if (sl) sl.value = '2';
            }
        }
    }

    togglePauseMenu(forceState = null) {
        const menu = document.getElementById('pause-menu');
        if (!menu) return;
        this.menuOpen = forceState !== null ? forceState : !this.menuOpen;
        menu.style.display = this.menuOpen ? 'flex' : 'none';
        this.soundManager.playClick();
        if (this.menuOpen) {
            if (document.pointerLockElement) document.exitPointerLock();
            const box = menu.querySelector('.menu-modal') || menu;
            this.enableModalTouchScroll(box);

            const btnResume = document.getElementById('btn-resume');
            const btnMenuToMain = document.getElementById('btn-menu-to-main');
            const menuTitle = menu.querySelector('.modal-title');
            if (this.mainMenuOpen) {
                if (btnResume) btnResume.textContent = '⬅️ Назад в меню';
                if (btnMenuToMain) btnMenuToMain.style.display = 'none';
                if (menuTitle) menuTitle.textContent = '⚙️ Налаштування';
            } else {
                if (btnResume) btnResume.textContent = '▶ Продовжити гру';
                if (btnMenuToMain) btnMenuToMain.style.display = 'block';
                if (menuTitle) menuTitle.textContent = '⚙️ Меню Гри 2.0';
            }
        }
    }

    initMainMenu() {
        const mm = document.getElementById('main-menu');
        const btnSingleplayer = document.getElementById('mm-btn-singleplayer');
        const btnMultiplayer = document.getElementById('mm-btn-multiplayer');
        const btnMods = document.getElementById('mm-btn-mods');
        const btnSettings = document.getElementById('mm-btn-settings');
        const splashEl = document.getElementById('main-menu-splash');

        const splashes = [
            "🔥 З модами та мультиплеєром!",
            "🐲 Єблан Дракон чекає на тебе!",
            "⚡ 10000000 FPS Turbo!",
            "🌲 Справжній воксельний світ!",
            "🧱 Копай, будуй, виживай!",
            "💣 Не чіпай динаміт!",
            "💎 Алмазна броня вже в кейсах!",
            "🌐 Грай з друзями через P2P!",
            "📜 Пиши та редагуй моди на Lua!",
            "🧠 IQ: 0 (Єблан) і гордий!",
            "⭐ Найкращий воксельний пісочник!",
            "⚔️ Незер та Енд відкриті!"
        ];

        this.randomizeSplash = () => {
            if (splashEl) {
                splashEl.textContent = splashes[Math.floor(Math.random() * splashes.length)];
            }
        };

        this.randomizeSplash();

        if (btnSingleplayer) {
            btnSingleplayer.onclick = () => {
                this.closeMainMenu();
                this.soundManager.playClick();
                if (document.body.classList.contains('is-pc') && this.game && this.game.controls) {
                    try {
                        const target = this.game.controls.domElement || document.body;
                        const p = target.requestPointerLock();
                        if (p && p.catch) p.catch(() => {});
                    } catch (e) {}
                }
            };
        }

        if (btnMultiplayer) {
            btnMultiplayer.onclick = () => {
                this.soundManager.playClick();
                if (this.game.multiplayer) {
                    this.game.multiplayer.toggleModal(true);
                }
            };
        }

        if (btnMods) {
            btnMods.onclick = () => {
                this.soundManager.playClick();
                if (this.game.modManager) {
                    this.game.modManager.toggleModal(true);
                }
            };
        }

        if (btnSettings) {
            btnSettings.onclick = () => {
                this.soundManager.playClick();
                this.togglePauseMenu(true);
            };
        }

        // Set initial body class
        document.body.classList.add('in-main-menu');
        if (mm) mm.style.display = 'flex';
    }

    openMainMenu() {
        this.mainMenuOpen = true;
        document.body.classList.add('in-main-menu');
        const mm = document.getElementById('main-menu');
        if (mm) mm.style.display = 'flex';

        this.togglePauseMenu(false);
        if (this.inventoryOpen) this.toggleInventory(false);
        if (this.game.multiplayer) this.game.multiplayer.toggleModal(false);
        if (this.game.modManager) this.game.modManager.toggleModal(false);
        if (document.exitPointerLock) document.exitPointerLock();

        try {
            if (this.game.world) {
                const json = this.game.world.exportJSON();
                localStorage.setItem('eblankraft_saved_world', json);
            }
        } catch (e) {}

        if (this.randomizeSplash) this.randomizeSplash();
        if (this.soundManager) this.soundManager.playClick();
    }

    closeMainMenu() {
        this.mainMenuOpen = false;
        document.body.classList.remove('in-main-menu');
        const mm = document.getElementById('main-menu');
        if (mm) mm.style.display = 'none';

        if (this.soundManager) {
            this.soundManager.init();
        }
    }

    enableModalTouchScroll(el) {
        if (!el) return;
        el.style.touchAction = 'pan-y';
        el.style.webkitOverflowScrolling = 'touch';
        el.style.overscrollBehavior = 'contain';
    }

    initModalTouchScrolling() {
        const selector = '.modal-content, .menu-modal, .inventory-full-modal, #inventory-content, .layout-modal-box, .mp-modal-box, .warp-modal-box, .mods-modal-box, #mods-items-list, #dev-console-logs';
        const applyAll = () => {
            const modals = document.querySelectorAll(selector);
            modals.forEach(m => this.enableModalTouchScroll(m));
        };
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', applyAll);
            } else {
                applyAll();
            }
        }
    }

    initDeathScreen() {
        const deathScreen = document.getElementById('death-screen');
        const btnDeathRespawn = document.getElementById('btn-death-respawn');
        if (btnDeathRespawn) {
            btnDeathRespawn.onclick = () => {
                this.player.spawnSafe();
                if (deathScreen) deathScreen.style.display = 'none';
            };
        }
    }

    showDeathScreen() {
        const deathScreen = document.getElementById('death-screen');
        const deathReasonEl = document.getElementById('death-reason');
        if (deathScreen) {
            deathScreen.style.display = 'flex';
            if (deathReasonEl) {
                deathReasonEl.textContent = this.player.deathReason || "ТИ ЗДОХ!";
            }
        }
    }

    flashDamage() {
        if (!this.damageOverlay) return;
        this.damageOverlay.style.opacity = '0.65';
        setTimeout(() => {
            if (this.damageOverlay) this.damageOverlay.style.opacity = '0';
        }, 180);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    update(dt) {
        // Health Hearts & Hunger Display (Responsive & Compact)
        if (this.hudHealth) {
            const hp = Math.max(0, Math.round(this.player.health));
            const maxHp = this.player.maxHealth || 100;
            if (window.innerWidth < 640) {
                this.hudHealth.innerHTML = `❤️ <b>${hp}</b>/${maxHp}`;
            } else {
                const heartsCount = Math.ceil(hp / 10);
                let heartsStr = "";
                for (let i = 0; i < 10; i++) {
                    heartsStr += i < heartsCount ? "❤️" : "🖤";
                }
                this.hudHealth.innerHTML = `<span class="hearts-strip">${heartsStr}</span> <span style="font-size:12px;color:#fff;">${hp}/${maxHp}</span>`;
            }
        }

        // Hunger Drumsticks
        if (this.hudHunger) {
            const hunger = Math.max(0, Math.round(this.player.hunger));
            if (window.innerWidth < 640) {
                this.hudHunger.innerHTML = `🍗 <b>${hunger}%</b>`;
            } else {
                const drumCount = Math.ceil(hunger / 10);
                let drumStr = "";
                for (let i = 0; i < 10; i++) {
                    drumStr += i < drumCount ? "🍗" : "🦴";
                }
                this.hudHunger.innerHTML = `<span class="drum-strip">${drumStr}</span> <span style="font-size:12px;color:#fff;">${hunger}%</span>`;
            }
        }

        // Dimension Badge
        if (this.hudDimension && this.game.world) {
            const dim = this.game.world.dimension || 'overworld';
            if (dim === 'nether') {
                this.hudDimension.innerHTML = '🔥 НЕЗЕР (АД)';
                this.hudDimension.style.color = '#ff5533';
            } else if (dim === 'the_end') {
                this.hudDimension.innerHTML = '🌌 ЕНД (ДРАКОН)';
                this.hudDimension.style.color = '#da55ff';
            } else {
                this.hudDimension.innerHTML = '🌲 ВЕРХНІЙ СВІТ';
                this.hudDimension.style.color = '#55ff77';
            }
        }

        // IQ Status
        if (this.hudIQ) {
            let status = "Єблан-Початківець";
            if (this.player.iq > 500) status = "ГІГА-ЄБЛАН ВСЕСВІТУ";
            else if (this.player.iq > 200) status = "Майстер Єбланкрафту";
            else if (this.player.iq < -50) status = "Конкретний Довбойоб";
            this.hudIQ.innerHTML = `🧠 IQ: <b>${this.player.iq}</b> <span style="color:#ffd700">(${status})</span>`;
        }

        // Coordinates
        if (this.hudCoords) {
            const px = Math.floor(this.player.position.x);
            const py = Math.floor(this.player.position.y);
            const pz = Math.floor(this.player.position.z);
            this.hudCoords.textContent = `XYZ: ${px} / ${py} / ${pz}`;
        }

        // Mining Progress Bar
        if (this.miningProgressContainer && this.miningProgressBar) {
            if (this.player.isMining && this.player.miningProgress > 0) {
                this.miningProgressContainer.style.display = 'block';
                this.miningProgressBar.style.width = `${Math.min(100, this.player.miningProgress * 100)}%`;
            } else {
                this.miningProgressContainer.style.display = 'none';
            }
        }

        // Boss Bar for Eblan Dragon
        if (this.bossBarContainer && this.bossBarFill) {
            const dragon = this.game.mobManager ? this.game.mobManager.dragon : null;
            if (dragon && !dragon.isDead && dragon.mesh) {
                this.bossBarContainer.style.display = 'flex';
                const pct = Math.max(0, (dragon.health / dragon.maxHealth) * 100);
                this.bossBarFill.style.width = `${pct}%`;
                if (this.bossBarTitle) {
                    this.bossBarTitle.textContent = `🐲 ЄБЛАН ДРАКОН [${Math.round(dragon.health)}/${dragon.maxHealth} HP]`;
                }
            } else {
                this.bossBarContainer.style.display = 'none';
            }
        }

        // FPS
        const now = performance.now();
        this.fpsHistory.push(1.0 / (dt || 0.016));
        if (this.fpsHistory.length > 20) this.fpsHistory.shift();

        if (now - this.lastFpsUpdate > 300 && this.hudFps) {
            const avgFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
            const backendTag = (window.WebGPUAdapter && window.WebGPUAdapter.activeBackend === 'webgpu') ? ' [WebGPU]' : '';
            const frameMs = (this.game && this.game.lastFrameCpuTime !== undefined) ? this.game.lastFrameCpuTime.toFixed(1) : null;
            const uncappedFps = (this.game && this.game.lastFrameCpuTime > 0.05) ? Math.round(1000 / this.game.lastFrameCpuTime) : null;

            let infoText = `FPS: ${avgFps}${backendTag}`;
            if (frameMs !== null) {
                infoText += ` (${frameMs}ms | ~${uncappedFps} FPS uncapped)`;
            }
            if (this.game && this.game.world && this.player) {
                const px = Math.floor(this.player.position.x);
                const pz = Math.floor(this.player.position.z);
                const biome = this.game.world.getBiomeAt ? this.game.world.getBiomeAt(px, pz) : null;
                if (biome) {
                    infoText += ` | ${biome.name}`;
                }
            }
            if (this.game && this.game.weatherManager) {
                const wType = this.game.weatherManager.type;
                const weatherIcons = { clear: '☀️ Ясно', rain: '🌧️ Дождь', thunder: '⛈️ Гроза', snow: '❄️ Снегопад' };
                if (weatherIcons[wType]) {
                    infoText += ` | ${weatherIcons[wType]}`;
                }
            }
            this.hudFps.textContent = infoText;
            this.lastFpsUpdate = now;
        }

        // Underwater Overlay & Oxygen Bubbles HUD
        const underwaterOverlay = document.getElementById('underwater-overlay');
        const hudOxygen = document.getElementById('hud-oxygen');
        const underwaterEnabled = !this.game || this.game.underwaterEffectsEnabled !== false;

        if (underwaterOverlay) {
            const shouldShowOverlay = !!(underwaterEnabled && this.player && this.player.isSubmerged);
            if (this._overlayShowing !== shouldShowOverlay) {
                this._overlayShowing = shouldShowOverlay;
                underwaterOverlay.style.display = shouldShowOverlay ? 'block' : 'none';
            }
        }

        if (hudOxygen) {
            if (underwaterEnabled && this.player && (this.player.isSubmerged || this.player.oxygen < 99.5)) {
                const oxy = Math.max(0, Math.round(this.player.oxygen));
                if (this._lastRenderedOxygen !== oxy) {
                    this._lastRenderedOxygen = oxy;
                    hudOxygen.style.display = 'inline-flex';
                    const bubbleCount = Math.ceil(oxy / 10);
                    let bubbleStr = "";
                    for (let i = 0; i < 10; i++) {
                        bubbleStr += i < bubbleCount ? "🫧" : "○";
                    }
                    const isCritical = oxy <= 20;
                    hudOxygen.innerHTML = `<span class="oxygen-strip ${isCritical ? 'oxygen-danger' : ''}">${bubbleStr}</span> <span style="font-size:12px;color:${isCritical ? '#ff4d4d' : '#70d6ff'};font-weight:bold;">${oxy}%</span>`;
                }
            } else {
                if (this._lastRenderedOxygen !== null) {
                    this._lastRenderedOxygen = null;
                    hudOxygen.style.display = 'none';
                }
            }
        }

        // Death Screen
        if (this.player.isDead) {
            this.showDeathScreen();
        }
    }

    // --- HUD LAYOUT CUSTOMIZER & DRAG-AND-DROP ---
    initLayoutCustomizer() {
        const DEFAULT_HUD_LAYOUT = {
            preset: 'default',
            btnScale: 1.0,
            btnOpacity: 0.95,
            hotbarScale: 1.0,
            leftHanded: false,
            splitButtons: false,
            buttonsPos: null,
            buttonPositions: {},
            hotbarPos: null
        };

        const HUD_LAYOUT_PRESETS = {
            default: {
                preset: 'default',
                btnScale: 1.0,
                btnOpacity: 0.95,
                hotbarScale: 1.0,
                leftHanded: false,
                splitButtons: false,
                buttonsPos: null,
                buttonPositions: {},
                hotbarPos: null
            },
            left_handed: {
                preset: 'left_handed',
                btnScale: 1.0,
                btnOpacity: 0.95,
                hotbarScale: 1.0,
                leftHanded: true,
                splitButtons: false,
                buttonsPos: { left: '12px', right: 'auto', bottom: '56px', top: 'auto' },
                buttonPositions: {},
                hotbarPos: null
            },
            claw: {
                preset: 'claw',
                btnScale: 1.1,
                btnOpacity: 0.85,
                hotbarScale: 0.9,
                leftHanded: false,
                splitButtons: false,
                buttonsPos: { right: '16px', bottom: '110px', left: 'auto', top: 'auto' },
                buttonPositions: {},
                hotbarPos: { bottom: '4px', left: '50%', right: 'auto', top: 'auto' }
            },
            compact: {
                preset: 'compact',
                btnScale: 0.8,
                btnOpacity: 0.8,
                hotbarScale: 0.85,
                leftHanded: false,
                splitButtons: false,
                buttonsPos: { right: '8px', bottom: '45px', left: 'auto', top: 'auto' },
                buttonPositions: {},
                hotbarPos: { bottom: '4px', left: '50%', right: 'auto', top: 'auto' }
            },
            giant: {
                preset: 'giant',
                btnScale: 1.35,
                btnOpacity: 0.98,
                hotbarScale: 1.15,
                leftHanded: false,
                splitButtons: false,
                buttonsPos: { right: '14px', bottom: '60px', left: 'auto', top: 'auto' },
                buttonPositions: {},
                hotbarPos: { bottom: '10px', left: '50%', right: 'auto', top: 'auto' }
            }
        };

        this.DEFAULT_HUD_LAYOUT = DEFAULT_HUD_LAYOUT;
        this.HUD_LAYOUT_PRESETS = HUD_LAYOUT_PRESETS;

        let parsed = null;
        try {
            const saved = localStorage.getItem('eblankraft_hud_layout');
            if (saved) parsed = JSON.parse(saved);
        } catch(e) {}

        this.layout = Object.assign({}, DEFAULT_HUD_LAYOUT, parsed || {});
        if (!this.layout.buttonPositions) this.layout.buttonPositions = {};

        const closeBtn = document.getElementById('layout-close');
        const btnSave = document.getElementById('btn-save-layout');
        const btnReset = document.getElementById('btn-reset-layout');
        const btnStartDrag = document.getElementById('btn-start-drag-mode');

        const sliderBtnScale = document.getElementById('slider-btn-scale');
        const sliderBtnOpacity = document.getElementById('slider-btn-opacity');
        const sliderHotbarScale = document.getElementById('slider-hotbar-scale');
        const chkLeftHanded = document.getElementById('chk-left-handed');
        const chkSplitButtons = document.getElementById('chk-split-buttons');

        if (closeBtn) closeBtn.onclick = () => this.toggleLayoutModal(false);

        // Preset buttons
        const presetBtns = document.querySelectorAll('.layout-preset-btn');
        presetBtns.forEach(btn => {
            btn.onclick = () => {
                const presetKey = btn.dataset.preset;
                if (this.HUD_LAYOUT_PRESETS[presetKey]) {
                    this.applyLayout(this.HUD_LAYOUT_PRESETS[presetKey]);
                    this.saveLayout();
                    this.soundManager.playClick();
                    this.showToast(`📐 Розкладка: ${btn.textContent.trim()}`);
                }
            };
        });

        // Sliders
        if (sliderBtnScale) {
            sliderBtnScale.oninput = (e) => {
                const val = parseInt(e.target.value, 10) / 100;
                this.layout.btnScale = val;
                this.layout.preset = 'custom';
                this.applyLayout(this.layout);
            };
            sliderBtnScale.onchange = () => this.saveLayout();
        }

        if (sliderBtnOpacity) {
            sliderBtnOpacity.oninput = (e) => {
                const val = parseInt(e.target.value, 10) / 100;
                this.layout.btnOpacity = val;
                this.layout.preset = 'custom';
                this.applyLayout(this.layout);
            };
            sliderBtnOpacity.onchange = () => this.saveLayout();
        }

        if (sliderHotbarScale) {
            sliderHotbarScale.oninput = (e) => {
                const val = parseInt(e.target.value, 10) / 100;
                this.layout.hotbarScale = val;
                this.layout.preset = 'custom';
                this.applyLayout(this.layout);
            };
            sliderHotbarScale.onchange = () => this.saveLayout();
        }

        if (chkLeftHanded) {
            chkLeftHanded.onchange = (e) => {
                this.layout.leftHanded = e.target.checked;
                this.layout.preset = 'custom';
                if (!this.layout.splitButtons && !this.layout.buttonsPos) {
                    if (this.layout.leftHanded) {
                        this.layout.buttonsPos = { left: '12px', right: 'auto', bottom: '56px', top: 'auto' };
                    } else {
                        this.layout.buttonsPos = null;
                    }
                }
                this.applyLayout(this.layout);
                this.saveLayout();
            };
        }

        if (chkSplitButtons) {
            chkSplitButtons.onchange = (e) => {
                this.layout.splitButtons = e.target.checked;
                this.layout.preset = 'custom';
                this.applyLayout(this.layout);
                this.saveLayout();
                this.showToast(this.layout.splitButtons ? "🔀 Режим розділених кнопок увімкнено!" : "📦 Кнопки згруповано в один блок");
            };
        }

        if (btnSave) {
            btnSave.onclick = () => {
                this.saveLayout();
                this.toggleLayoutModal(false);
                this.showToast("💾 Розкладку збережено!");
            };
        }

        if (btnReset) {
            btnReset.onclick = () => {
                if (confirm("Скинути розкладку кнопок до стандартної?")) {
                    this.applyLayout(this.DEFAULT_HUD_LAYOUT);
                    this.saveLayout();
                    this.showToast("🔄 Розкладку скинуто до стандартної!");
                }
            };
        }

        if (btnStartDrag) {
            btnStartDrag.onclick = () => {
                this.startHudDragMode();
            };
        }

        // Apply on initial load
        this.applyLayout(this.layout);
    }

    applyLayout(layout) {
        this.layout = Object.assign({}, this.DEFAULT_HUD_LAYOUT, layout);
        if (!this.layout.buttonPositions) this.layout.buttonPositions = {};

        const buttonsEl = document.getElementById('touch-action-buttons');
        const hotbarEl = document.getElementById('hotbar-container');
        const actionButtonIds = ['btn-attack', 'btn-break', 'btn-place', 'btn-jump', 'btn-sprint', 'btn-tnt'];

        // Split buttons handling
        if (this.layout.splitButtons) {
            if (buttonsEl) {
                buttonsEl.style.pointerEvents = 'none';
                buttonsEl.style.transform = 'none';
                buttonsEl.style.position = 'static';
            }

            const isLeft = !!this.layout.leftHanded;
            actionButtonIds.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (!btn) return;
                btn.classList.add('is-split');
                btn.style.pointerEvents = 'auto';
                btn.style.transform = `scale(${this.layout.btnScale || 1.0})`;
                btn.style.opacity = `${this.layout.btnOpacity || 0.95}`;

                const pos = this.layout.buttonPositions[btnId];
                if (pos) {
                    btn.style.left = pos.left || 'auto';
                    btn.style.top = pos.top || 'auto';
                    btn.style.right = pos.right || 'auto';
                    btn.style.bottom = pos.bottom || 'auto';
                } else {
                    const defaults = {
                        'btn-attack': isLeft ? { left: '130px', bottom: '130px' } : { right: '130px', bottom: '130px' },
                        'btn-break':  isLeft ? { left: '25px',  bottom: '130px' } : { right: '25px',  bottom: '130px' },
                        'btn-place':  isLeft ? { left: '130px', bottom: '50px' }  : { right: '130px', bottom: '50px' },
                        'btn-jump':   isLeft ? { left: '25px',  bottom: '50px' }  : { right: '25px',  bottom: '50px' },
                        'btn-sprint': isLeft ? { left: '130px', bottom: '215px' } : { right: '130px', bottom: '215px' },
                        'btn-tnt':    isLeft ? { left: '25px',  bottom: '215px' } : { right: '25px',  bottom: '215px' }
                    };
                    const def = defaults[btnId] || {};
                    btn.style.left = def.left || 'auto';
                    btn.style.top = 'auto';
                    btn.style.right = def.right || 'auto';
                    btn.style.bottom = def.bottom || 'auto';
                }
            });
        } else {
            // Grouped cluster mode
            actionButtonIds.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (!btn) return;
                btn.classList.remove('is-split');
                btn.style.pointerEvents = '';
                btn.style.position = '';
                btn.style.left = '';
                btn.style.top = '';
                btn.style.right = '';
                btn.style.bottom = '';
                btn.style.transform = '';
                btn.style.opacity = '';
            });

            if (buttonsEl) {
                buttonsEl.style.pointerEvents = '';
                buttonsEl.style.transform = `scale(${this.layout.btnScale || 1.0})`;
                buttonsEl.style.opacity = `${this.layout.btnOpacity || 0.95}`;

                if (this.layout.buttonsPos) {
                    buttonsEl.style.position = 'fixed';
                    buttonsEl.style.left = this.layout.buttonsPos.left || 'auto';
                    buttonsEl.style.right = this.layout.buttonsPos.right || 'auto';
                    buttonsEl.style.top = this.layout.buttonsPos.top || 'auto';
                    buttonsEl.style.bottom = this.layout.buttonsPos.bottom || 'auto';
                    buttonsEl.style.transformOrigin = this.layout.leftHanded ? 'bottom left' : 'bottom right';
                } else {
                    buttonsEl.style.position = 'absolute';
                    if (this.layout.leftHanded) {
                        buttonsEl.style.left = '12px';
                        buttonsEl.style.right = 'auto';
                        buttonsEl.style.bottom = '56px';
                        buttonsEl.style.top = 'auto';
                        buttonsEl.style.transformOrigin = 'bottom left';
                    } else {
                        buttonsEl.style.left = 'auto';
                        buttonsEl.style.right = '12px';
                        buttonsEl.style.bottom = '56px';
                        buttonsEl.style.top = 'auto';
                        buttonsEl.style.transformOrigin = 'bottom right';
                    }
                }
            }
        }

        // Hotbar positioning
        if (hotbarEl) {
            hotbarEl.style.opacity = `${Math.min(1.0, (this.layout.btnOpacity || 0.95) + 0.05)}`;

            if (this.layout.hotbarPos) {
                hotbarEl.style.position = 'fixed';
                hotbarEl.style.left = this.layout.hotbarPos.left || 'auto';
                hotbarEl.style.right = this.layout.hotbarPos.right || 'auto';
                hotbarEl.style.top = this.layout.hotbarPos.top || 'auto';
                hotbarEl.style.bottom = this.layout.hotbarPos.bottom || 'auto';
                hotbarEl.style.transform = `scale(${this.layout.hotbarScale || 1.0})`;
                hotbarEl.style.transformOrigin = 'center center';
            } else {
                hotbarEl.style.position = 'absolute';
                hotbarEl.style.left = '50%';
                hotbarEl.style.right = 'auto';
                hotbarEl.style.top = 'auto';
                hotbarEl.style.bottom = '8px';
                hotbarEl.style.transform = `translateX(-50%) scale(${this.layout.hotbarScale || 1.0})`;
                hotbarEl.style.transformOrigin = 'bottom center';
            }
        }

        if (this.game && this.game.controls) {
            this.game.controls.setLayout(this.layout);
        }

        this.syncLayoutUIControls();
    }

    syncLayoutUIControls() {
        if (!this.layout) return;
        const sliderBtnScale = document.getElementById('slider-btn-scale');
        const sliderBtnOpacity = document.getElementById('slider-btn-opacity');
        const sliderHotbarScale = document.getElementById('slider-hotbar-scale');
        const chkLeftHanded = document.getElementById('chk-left-handed');
        const chkSplitButtons = document.getElementById('chk-split-buttons');
        const lblBtnScale = document.getElementById('lbl-btn-scale');
        const lblBtnOpacity = document.getElementById('lbl-btn-opacity');
        const lblHotbarScale = document.getElementById('lbl-hotbar-scale');

        if (sliderBtnScale) sliderBtnScale.value = Math.round((this.layout.btnScale || 1.0) * 100);
        if (sliderBtnOpacity) sliderBtnOpacity.value = Math.round((this.layout.btnOpacity || 0.95) * 100);
        if (sliderHotbarScale) sliderHotbarScale.value = Math.round((this.layout.hotbarScale || 1.0) * 100);
        if (chkLeftHanded) chkLeftHanded.checked = !!this.layout.leftHanded;
        if (chkSplitButtons) chkSplitButtons.checked = !!this.layout.splitButtons;

        if (lblBtnScale) lblBtnScale.textContent = `${Math.round((this.layout.btnScale || 1.0) * 100)}%`;
        if (lblBtnOpacity) lblBtnOpacity.textContent = `${Math.round((this.layout.btnOpacity || 0.95) * 100)}%`;
        if (lblHotbarScale) lblHotbarScale.textContent = `${Math.round((this.layout.hotbarScale || 1.0) * 100)}%`;

        const presetBtns = document.querySelectorAll('.layout-preset-btn');
        presetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === this.layout.preset);
        });
    }

    saveLayout() {
        try {
            localStorage.setItem('eblankraft_hud_layout', JSON.stringify(this.layout));
        } catch(e) {}
    }

    toggleLayoutModal(forceState = null) {
        const modal = document.getElementById('layout-modal');
        if (!modal) return;
        this.layoutModalOpen = forceState !== null ? forceState : (modal.style.display !== 'flex');
        modal.style.display = this.layoutModalOpen ? 'flex' : 'none';
        this.soundManager.playClick();
        if (this.layoutModalOpen) {
            if (document.pointerLockElement) document.exitPointerLock();
            this.syncLayoutUIControls();
        }
    }

    startHudDragMode() {
        this.toggleLayoutModal(false);

        const overlay = document.getElementById('hud-drag-overlay');
        const buttonsEl = document.getElementById('touch-action-buttons');
        const hotbarEl = document.getElementById('hotbar-container');
        const actionButtonIds = ['btn-attack', 'btn-break', 'btn-place', 'btn-jump', 'btn-sprint', 'btn-tnt'];

        if (!overlay) return;

        this.dragModeOpen = true;
        overlay.style.display = 'flex';

        this._preDragLayout = JSON.parse(JSON.stringify(this.layout));
        this._dragCleanups = [];
        this._elementCleanups = [];

        const attachDrag = (el, isHotbar = false) => {
            let isDragging = false;
            let startPointerX = 0, startPointerY = 0;
            let origLeft = 0, origTop = 0;

            const onStart = (e) => {
                if (e.button !== undefined && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                isDragging = true;
                const touch = e.touches ? e.touches[0] : e;
                startPointerX = touch.clientX;
                startPointerY = touch.clientY;

                const rect = el.getBoundingClientRect();
                origLeft = rect.left;
                origTop = rect.top;

                el.style.position = 'fixed';
                el.style.left = `${origLeft}px`;
                el.style.top = `${origTop}px`;
                el.style.right = 'auto';
                el.style.bottom = 'auto';
                if (isHotbar) {
                    el.style.transform = `scale(${this.layout.hotbarScale || 1.0})`;
                } else if (this.layout.splitButtons) {
                    el.style.transform = `scale(${this.layout.btnScale || 1.0})`;
                }

                window.addEventListener('pointermove', onMove, { passive: false });
                window.addEventListener('pointerup', onEnd);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onEnd);
                window.addEventListener('touchcancel', onEnd);
            };

            const onMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                e.stopPropagation();
                const touch = e.touches ? e.touches[0] : e;
                const dx = touch.clientX - startPointerX;
                const dy = touch.clientY - startPointerY;

                const rect = el.getBoundingClientRect();
                const maxLeft = window.innerWidth - rect.width;
                const maxTop = window.innerHeight - rect.height;

                const newLeft = Math.max(0, Math.min(origLeft + dx, Math.max(0, maxLeft)));
                const newTop = Math.max(0, Math.min(origTop + dy, Math.max(0, maxTop)));

                el.style.left = `${newLeft}px`;
                el.style.top = `${newTop}px`;
            };

            const onEnd = (e) => {
                if (!isDragging) return;
                isDragging = false;
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onEnd);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onEnd);
                window.removeEventListener('touchcancel', onEnd);
            };

            el.addEventListener('pointerdown', onStart);
            el.addEventListener('touchstart', onStart, { passive: false });

            const cleanupFn = () => {
                el.removeEventListener('pointerdown', onStart);
                el.removeEventListener('touchstart', onStart);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onEnd);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onEnd);
                window.removeEventListener('touchcancel', onEnd);
            };
            this._elementCleanups.push(cleanupFn);
        };

        const setupDraggables = () => {
            if (this._elementCleanups) {
                this._elementCleanups.forEach(c => {
                    try { c(); } catch(e) {}
                });
            }
            this._elementCleanups = [];

            if (buttonsEl) buttonsEl.classList.remove('hud-draggable-active');
            actionButtonIds.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.classList.remove('hud-draggable-active');
            });

            if (hotbarEl) {
                hotbarEl.classList.add('hud-draggable-active');
                attachDrag(hotbarEl, true);
            }

            if (this.layout.splitButtons) {
                actionButtonIds.forEach(id => {
                    const btn = document.getElementById(id);
                    if (btn) {
                        btn.classList.add('hud-draggable-active');
                        attachDrag(btn, false);
                    }
                });
            } else {
                if (buttonsEl) {
                    buttonsEl.classList.add('hud-draggable-active');
                    attachDrag(buttonsEl, false);
                }
            }
        };

        setupDraggables();

        // Overlay control buttons
        const btnCancel = document.getElementById('btn-drag-cancel');
        const btnSave = document.getElementById('btn-drag-save');
        const btnEmergencyExit = document.getElementById('btn-drag-emergency-exit');
        const btnToggleSplit = document.getElementById('btn-drag-toggle-split');

        const bindButtonAction = (el, action) => {
            if (!el) return;
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                action();
            };
            el.addEventListener('click', handler);
            el.addEventListener('touchstart', handler, { passive: false });
            this._dragCleanups.push(() => {
                el.removeEventListener('click', handler);
                el.removeEventListener('touchstart', handler);
            });
        };

        bindButtonAction(btnEmergencyExit, () => this.stopHudDragMode(false));
        bindButtonAction(btnCancel, () => this.stopHudDragMode(false));
        bindButtonAction(btnSave, () => this.stopHudDragMode(true));

        bindButtonAction(btnToggleSplit, () => {
            this.layout.splitButtons = !this.layout.splitButtons;
            this.applyLayout(this.layout);
            setupDraggables();
            this.showToast(this.layout.splitButtons ? "🔀 Кнопки розділено! Перетягуйте кожну окремо" : "📦 Кнопки згруповано в один блок!");
        });

        // Escape key exit
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.stopHudDragMode(false);
            }
        };
        window.addEventListener('keydown', onKeydown);
        this._dragCleanups.push(() => window.removeEventListener('keydown', onKeydown));
    }

    stopHudDragMode(saveChanges) {
        this.dragModeOpen = false;

        const overlay = document.getElementById('hud-drag-overlay');
        const buttonsEl = document.getElementById('touch-action-buttons');
        const hotbarEl = document.getElementById('hotbar-container');
        const actionButtonIds = ['btn-attack', 'btn-break', 'btn-place', 'btn-jump', 'btn-sprint', 'btn-tnt'];

        if (overlay) overlay.style.display = 'none';
        if (buttonsEl) buttonsEl.classList.remove('hud-draggable-active');
        if (hotbarEl) hotbarEl.classList.remove('hud-draggable-active');
        actionButtonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.remove('hud-draggable-active');
        });

        if (this._elementCleanups) {
            this._elementCleanups.forEach(cleanup => {
                try { cleanup(); } catch(e) {}
            });
            this._elementCleanups = [];
        }

        if (this._dragCleanups) {
            this._dragCleanups.forEach(cleanup => {
                try { cleanup(); } catch(e) {}
            });
            this._dragCleanups = [];
        }

        if (saveChanges) {
            if (this.layout.splitButtons) {
                this.layout.buttonPositions = this.layout.buttonPositions || {};
                actionButtonIds.forEach(id => {
                    const btn = document.getElementById(id);
                    if (btn) {
                        const rect = btn.getBoundingClientRect();
                        this.layout.buttonPositions[id] = {
                            left: `${Math.round(rect.left)}px`,
                            top: `${Math.round(rect.top)}px`,
                            right: 'auto',
                            bottom: 'auto'
                        };
                    }
                });
            } else {
                if (buttonsEl) {
                    const bRect = buttonsEl.getBoundingClientRect();
                    this.layout.buttonsPos = {
                        left: `${Math.round(bRect.left)}px`,
                        top: `${Math.round(bRect.top)}px`,
                        right: 'auto',
                        bottom: 'auto'
                    };
                }
            }

            if (hotbarEl) {
                const hRect = hotbarEl.getBoundingClientRect();
                this.layout.hotbarPos = {
                    left: `${Math.round(hRect.left)}px`,
                    top: `${Math.round(hRect.top)}px`,
                    right: 'auto',
                    bottom: 'auto'
                };
            }
            this.layout.preset = 'custom';
            this.saveLayout();
            this.applyLayout(this.layout);
            this.showToast("💾 Розкладку кнопок успішно збережено!");
        } else {
            if (this._preDragLayout) {
                this.applyLayout(this._preDragLayout);
            }
            this.showToast("Розстановку скасовано");
        }
    }
}

window.UIManager = UIManager;
