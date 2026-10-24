/**
 * Eblankraft - Complete Mobile Touch & PC Keyboard/Mouse Controls System
 */

class Controls {
    constructor(player, domElement) {
        this.player = player;
        this.domElement = domElement;

        // Input states
        this.inputVector = new THREE.Vector2(0, 0); // x: strafe (-1..1), y: forward (-1..1)
        this.jumpPressed = false;
        this.touchJumpPressed = false;

        // Sensitivity
        this.touchLookSensitivity = 0.0045;
        this.mouseSensitivity = 0.0022;

        // Touch Tracking
        this.joystickTouchId = null;
        this.lookTouchId = null;
        this.joystickOrigin = new THREE.Vector2();
        this.joystickCurrent = new THREE.Vector2();
        this.lookPrevPos = new THREE.Vector2();
        this.joystickMaxRadius = 45; // pixels
        this.leftHanded = false;
        this.layout = null;

        // Desktop Keyboard & Mouse
        this.keys = {};
        this.isPointerLocked = false;
        this.mouseMiningInterval = null;
        this.touchMiningInterval = null;
        this.mouseLeftDown = false;
        this.mouseRightDown = false;
        this.mouseMiddleDown = false;
        this.attackBtnPressed = false;
        this.breakBtnPressed = false;
        this.attackHoldTimer = 0;

        // Auto-detect PC vs Touch device
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
        const maxTouchPoints = (typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number') ? navigator.maxTouchPoints : 0;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua) ||
            (maxTouchPoints > 1 && /Macintosh/.test(ua));
        const hasTouchCapability = (typeof window !== 'undefined' && 'ontouchstart' in window) || (maxTouchPoints > 0);
        const hasCoarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        const hasFine = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;

        // If UA indicates mobile or coarse touch is primary, treat as touch device.
        this.isTouchDevice = isMobileUA || (hasTouchCapability && (hasCoarse || !hasFine));
        if (typeof document !== 'undefined' && document.body?.classList) {
            if (this.isTouchDevice) {
                document.body.classList.remove?.('is-pc');
                document.body.classList.add?.('force-touch');
            } else {
                document.body.classList.add?.('is-pc');
                document.body.classList.remove?.('force-touch');
            }
        }

        // Auto-switch to touch mode on any touch interaction
        const activateTouchMode = () => {
            const hasIsPC = document.body?.classList?.contains ? document.body.classList.contains('is-pc') : false;
            if (hasIsPC || !this.isTouchDevice) {
                document.body?.classList?.remove?.('is-pc');
                document.body?.classList?.add?.('force-touch');
                this.isTouchDevice = true;
            }
        };
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('touchstart', activateTouchMode, { passive: true });
        }

        // Auto-switch to PC mode only on actual PC desktop interaction (not on mobile devices or touch events)
        const activatePCMode = (e) => {
            if (isMobileUA) return;
            if (e && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
            if (e && e.pointerType && e.pointerType === 'touch') return;
            const hasIsPC = document.body?.classList?.contains ? document.body.classList.contains('is-pc') : false;
            if (!hasIsPC) {
                document.body?.classList?.add?.('is-pc');
                document.body?.classList?.remove?.('force-touch');
                this.isTouchDevice = false;
            }
        };
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('keydown', (e) => {
                if (!isMobileUA) activatePCMode(e);
            }, { passive: true });
            window.addEventListener('mousedown', activatePCMode, { passive: true });
            window.addEventListener('mousemove', (e) => {
                if (e.movementX !== 0 || e.movementY !== 0) activatePCMode(e);
            }, { passive: true });
            window.addEventListener('wheel', activatePCMode, { passive: true });
        }

        this.setupTouchControls();
        this.setupDesktopControls();
    }

    setLayout(layout) {
        if (!layout) return;
        this.layout = layout;
        this.leftHanded = !!layout.leftHanded;
    }

    setupTouchControls() {
        const touchZoneLeft = document.getElementById('touch-zone-left');
        const touchZoneRight = document.getElementById('touch-zone-right');
        const joystickBase = document.getElementById('joystick-base');
        const joystickKnob = document.getElementById('joystick-knob');

        if (!touchZoneLeft || !touchZoneRight) return;

        const handleJoystickStart = (touch) => {
            if (this.joystickTouchId !== null) return;
            this.joystickTouchId = touch.identifier;
            this.joystickOrigin.set(touch.clientX, touch.clientY);
            this.joystickCurrent.set(touch.clientX, touch.clientY);

            if (joystickBase && joystickKnob) {
                joystickBase.style.display = 'block';
                joystickBase.style.left = `${touch.clientX}px`;
                joystickBase.style.top = `${touch.clientY}px`;
                joystickKnob.style.transform = `translate(-50%, -50%)`;
            }
        };

        const handleJoystickMove = (touch) => {
            this.joystickCurrent.set(touch.clientX, touch.clientY);
            const delta = new THREE.Vector2().subVectors(this.joystickCurrent, this.joystickOrigin);
            const distance = Math.min(delta.length(), this.joystickMaxRadius);
            const angle = Math.atan2(delta.y, delta.x);

            const knobX = Math.cos(angle) * distance;
            const knobY = Math.sin(angle) * distance;

            if (joystickKnob) {
                joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
            }

            const normalizedDist = distance / this.joystickMaxRadius;
            if (normalizedDist > 0.15) {
                this.inputVector.x = (knobX / this.joystickMaxRadius);
                this.inputVector.y = -(knobY / this.joystickMaxRadius); // Invert Y for forward
            } else {
                this.inputVector.set(0, 0);
            }
        };

        const resetJoystick = () => {
            this.joystickTouchId = null;
            this.inputVector.set(0, 0);
            if (joystickBase) joystickBase.style.display = 'none';
        };

        const handleLookStart = (touch) => {
            if (this.lookTouchId === null) {
                this.lookTouchId = touch.identifier;
                this.lookPrevPos.set(touch.clientX, touch.clientY);
            }
        };

        const handleLookMove = (touch) => {
            if (this.middleClickMenu || this.blockEditor) return;
            const dx = touch.clientX - this.lookPrevPos.x;
            const dy = touch.clientY - this.lookPrevPos.y;
            this.lookPrevPos.set(touch.clientX, touch.clientY);

            const aimScale = this.player.isAiming ? (this.player.camera?.fov || 72) / (this.player.aimBaseFov || 72) : 1;
            this.player.yaw -= dx * this.touchLookSensitivity * aimScale;
            this.player.pitch -= dy * this.touchLookSensitivity * aimScale;
            this.player.pitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, this.player.pitch));
        };

        const resetLook = () => {
            this.lookTouchId = null;
        };

        const isJoystickZone = (zoneName) => {
            return this.leftHanded ? (zoneName === 'right') : (zoneName === 'left');
        };

        const onTouchStart = (zoneName, e) => {
            if (this.middleClickMenu || this.blockEditor) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (isJoystickZone(zoneName)) {
                    e.preventDefault();
                    handleJoystickStart(touch);
                } else {
                    handleLookStart(touch);
                }
            }
        };

        const onTouchMove = (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.joystickTouchId) {
                    handleJoystickMove(touch);
                } else if (touch.identifier === this.lookTouchId) {
                    handleLookMove(touch);
                }
            }
        };

        const onTouchEnd = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.joystickTouchId) {
                    resetJoystick();
                } else if (touch.identifier === this.lookTouchId) {
                    resetLook();
                }
            }
        };

        touchZoneLeft.addEventListener('touchstart', (e) => onTouchStart('left', e), { passive: false });
        touchZoneRight.addEventListener('touchstart', (e) => onTouchStart('right', e), { passive: false });

        touchZoneLeft.addEventListener('touchmove', onTouchMove, { passive: false });
        touchZoneRight.addEventListener('touchmove', onTouchMove, { passive: false });

        touchZoneLeft.addEventListener('touchend', onTouchEnd);
        touchZoneRight.addEventListener('touchend', onTouchEnd);

        touchZoneLeft.addEventListener('touchcancel', onTouchEnd);
        touchZoneRight.addEventListener('touchcancel', onTouchEnd);

        // Touch Action Buttons
        this.bindTouchButton('btn-jump', (isDown) => {
            this.touchJumpPressed = isDown;
        });

        const btnAttack = document.getElementById('btn-attack');
        if (btnAttack) {
            const startAttack = (e) => {
                if (window.game && window.game.ui && window.game.ui.dragModeOpen) return;
                e.preventDefault();
                e.stopPropagation();
                this.attackBtnPressed = true;
                this.attackHoldTimer = 0;
                if (this.player.tryShootGun && this.player.tryShootGun()) {
                    this.player.isMining = false;
                    return;
                }
                this.player.attackMob();
                this.player.armSwing = 1.0;
            };
            const stopAttack = (e) => {
                this.attackBtnPressed = false;
                this.attackHoldTimer = 0;
                this.releaseFireTrigger();
            };
            btnAttack.addEventListener('touchstart', startAttack, { passive: false });
            btnAttack.addEventListener('touchend', stopAttack);
            btnAttack.addEventListener('touchcancel', stopAttack);
            btnAttack.addEventListener('mousedown', startAttack);
            btnAttack.addEventListener('mouseup', stopAttack);
            btnAttack.addEventListener('mouseleave', stopAttack);
        }

        const btnBreak = document.getElementById('btn-break');
        if (btnBreak) {
            const startBreak = (e) => {
                if (window.game && window.game.ui && window.game.ui.dragModeOpen) return;
                e.preventDefault();
                e.stopPropagation();
                this.breakBtnPressed = true;
                this.attackHoldTimer = 0;
                if (!this.player.attackMob()) {
                    this.player.isMining = true;
                }
            };
            const stopBreak = (e) => {
                this.breakBtnPressed = false;
                this.attackHoldTimer = 0;
                this.releaseFireTrigger();
                this.player.isMining = false;
                this.player.miningProgress = 0;
            };
            btnBreak.addEventListener('touchstart', startBreak, { passive: false });
            btnBreak.addEventListener('touchend', stopBreak);
            btnBreak.addEventListener('touchcancel', stopBreak);
            btnBreak.addEventListener('mousedown', startBreak);
            btnBreak.addEventListener('mouseup', stopBreak);
            btnBreak.addEventListener('mouseleave', stopBreak);
        }

        this.bindTouchButton('btn-place', (isDown) => {
            this.touchAimPressed = isDown;
            if (this.player.setAiming?.(isDown)) return;
            if (isDown) this.player.placeBlock();
        });

        this.bindTouchButton('btn-tnt', (isDown) => {
            if (!isDown) return;
            if (this.player.isCreative) this.openMiddleClickMenu(true);
            else this.player.detonateTNT();
        });

        this.bindTouchButton('btn-sprint', (isDown) => {
            if (isDown) {
                this.player.isSprinting = !this.player.isSprinting;
                const btn = document.getElementById('btn-sprint');
                if (btn) btn.classList.toggle('active', this.player.isSprinting);
            }
        });

        this.bindTouchButton('btn-dodge', (isDown) => {
            if (isDown) this.player.tryDodgeRoll(this.inputVector);
        });
    }

    bindTouchButton(id, callback) {
        const el = document.getElementById(id);
        if (!el) return;
        const onDown = (e) => {
            if (window.game && window.game.ui && window.game.ui.dragModeOpen) return;
            e.preventDefault();
            e.stopPropagation();
            callback(true);
        };
        const onUp = (e) => {
            if (window.game && window.game.ui && window.game.ui.dragModeOpen) return;
            e.preventDefault();
            callback(false);
        };
        el.addEventListener('touchstart', onDown, { passive: false });
        el.addEventListener('touchend', onUp);
        el.addEventListener('touchcancel', onUp);
        el.addEventListener('mousedown', onDown);
        el.addEventListener('mouseup', onUp);
        el.addEventListener('mouseleave', onUp);
    }


    requestPointerLock() {
        if (this.isTouchDevice === true) return;
        const target = this.domElement || document.body;
        const brands = navigator.userAgentData?.brands;
        const isChrome = brands
            ? brands.some(({ brand }) => brand === 'Google Chrome')
            : /Chrome\//.test(navigator.userAgent) &&
                !/Edg|OPR|Opera|SamsungBrowser|Vivaldi|YaBrowser/.test(navigator.userAgent);
        const request = (raw) => {
            try {
                const result = raw
                    ? target.requestPointerLock({ unadjustedMovement: true })
                    : target.requestPointerLock();
                if (result && result.catch) {
                    result.catch((error) => {
                        if (raw && error?.name === 'NotSupportedError') request(false);
                    });
                }
            } catch (error) {
                if (raw && error?.name === 'NotSupportedError') request(false);
            }
        };
        request(isChrome);
    }

    openMiddleClickMenu(touch = false) {
        if (this.middleClickMenu || this.blockEditor) return;
        if (!this.player.isCreative || this.player.game?.arenaClient?.isActive || !this.player.targetBlock) return;
        const target = { ...this.player.targetBlock };
        if (!window.BLOCK_INFO?.[target.type]) return;
        const options = [
            { name: 'Перекрасить', tab: 0, symbol: '🎨' },
            { name: 'Поменять размер', tab: 1, symbol: '▰' },
            { name: 'Заменить', tab: 2, symbol: '⇄' },
            { name: 'Properties', tab: 3, symbol: '⚙' },
            { name: 'Клонировать', clone: true, symbol: '▣' }
        ];
        const root = document.createElement('div');
        root.className = 'middle-click-menu' + (touch ? ' middle-click-touch' : '');
        const label = document.createElement('div');
        label.className = 'middle-click-label';
        label.textContent = 'Middle Click Menu';
        root.appendChild(label);
        const hint = document.createElement('div');
        hint.className = 'middle-click-hint';
        hint.textContent = touch ? 'Нажми на действие • касание фона — отмена' : 'Двигай мышью • отпусти для выбора • Esc — отмена';
        root.appendChild(hint);
        options.forEach((option, index) => {
            const element = document.createElement(touch ? 'button' : 'div');
            element.className = 'middle-click-option';
            const angle = index * Math.PI * 2 / options.length - Math.PI / 2;
            const radius = touch ? Math.min(150, window.innerWidth * .34, window.innerHeight * .30) : 165;
            element.style.transform = `translate(calc(-50% + ${Math.cos(angle) * radius}px), calc(-50% + ${Math.sin(angle) * radius}px))`;
            element.textContent = option.symbol || '■';
            element.title = option.name;
            if (touch) {
                element.type = 'button';
                element.setAttribute('aria-label', option.name);
                const caption = document.createElement('span'); caption.className = 'middle-click-caption'; caption.textContent = option.name;
                element.appendChild(caption);
                element.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    if (!this.middleClickMenu) return;
                    this.middleClickMenu.selected = index;
                    this.closeMiddleClickMenu(true);
                });
            }
            if (option.color) element.style.backgroundImage = `url(${option.color.toDataURL()})`;

            root.appendChild(element);
            option.element = element;
        });
        document.body.appendChild(root);
        this.middleClickMenu = { target, options, root, label, x: 0, y: 0, selected: -1, touch };
        if (touch) {
            root.addEventListener('click', event => { event.stopPropagation(); if (event.target === root || event.target === label) this.closeMiddleClickMenu(); });
            root.addEventListener('touchstart', event => event.stopPropagation(), { passive: true });
            root.addEventListener('mousedown', event => event.stopPropagation());
            root.addEventListener('mousemove', event => event.stopPropagation());
            this.inputVector.set(0, 0); this.keys = {}; this.joystickTouchId = this.lookTouchId = null;
        }
        this.player.isMining = false;
        this.player.setBlocking(false);
    }

    moveMiddleClickMenu(dx, dy) {
        const menu = this.middleClickMenu;
        if (!menu) return;
        menu.x += dx; menu.y += dy;
        // Keep a small neutral zone so a plain click does not alter a block.
        const index = Math.hypot(menu.x, menu.y) < 24 ? -1 :
            Math.round((Math.atan2(menu.y, menu.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
                / (Math.PI * 2) * menu.options.length) % menu.options.length;
        menu.selected = index;
        menu.options.forEach((option, i) => option.element.classList.toggle('selected', i === index));
        menu.label.textContent = index < 0 ? 'Middle Click Menu' : menu.options[index].name;
    }

    closeMiddleClickMenu(apply = false) {
        const menu = this.middleClickMenu;
        if (!menu) return;
        this.middleClickMenu = null;
        menu.root.remove();
        const option = menu.options[menu.selected];
        const player = this.player;
        if (!apply || !option || !player.isCreative || player.isDead ||
            player.world.getBlock(menu.target.x, menu.target.y, menu.target.z) !== menu.target.type) return;
        if (option.clone) window.BlockEditor.clone(this, menu.target);
        else window.BlockEditor.open(this, menu.target, option.tab);
    }

    setupDesktopControls() {
        // Request Pointer Lock on click anywhere
        const requestLock = () => {
            if (this.isTouchDevice === true) return;
            if (this.player.isDead || this.blockEditor) return;
            if (window.game && window.game.ui && (window.game.ui.mainMenuOpen || window.game.ui.inventoryOpen || window.game.ui.menuOpen || window.game.ui.layoutModalOpen || window.game.ui.dragModeOpen)) return;
            if (!this.isPointerLocked) {
                this.requestPointerLock();
            }
        };

        this.domElement.addEventListener('click', requestLock);
        window.addEventListener('click', (e) => {
            if (this.isPointerLocked) return;
            if (this.player.isDead || this.blockEditor) return;
            if (window.game && window.game.ui && (window.game.ui.mainMenuOpen || window.game.ui.inventoryOpen || window.game.ui.menuOpen || window.game.ui.layoutModalOpen || window.game.ui.dragModeOpen)) return;
            if (e.target.closest('#main-menu, .modal-overlay, #pause-menu, #inventory-modal, #crafting-modal, #blockly-modal, #game-dev-console, #mods-modal, #dust2-hud, #gun-hud, .touch-btn, #btn-chat-toggle, #btn-menu-toggle, .middle-click-menu')) {
                return;
            }
            requestLock();
        });
        document.addEventListener('pointerlockerror', () => {});

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = (document.pointerLockElement === this.domElement);
            document.body.classList.toggle('is-pointer-locked', !!this.isPointerLocked);
            if (!this.isPointerLocked) {
                this.closeMiddleClickMenu();
                this.mouseLeftDown = false;
                this.mouseRightDown = false;
                this.mouseMiddleDown = false;
                this.attackHoldTimer = 0;
                this.releaseFireTrigger();
                if (this.mouseMiningInterval) {
                    clearInterval(this.mouseMiningInterval);
                    this.mouseMiningInterval = null;
                }
            }
        });

        // Mouse look
        document.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                if (this.middleClickMenu) {
                    this.moveMiddleClickMenu(e.movementX, e.movementY);
                    return;
                }
                const aimScale = this.player.isAiming ? (this.player.camera?.fov || 72) / (this.player.aimBaseFov || 72) : 1;
                this.player.yaw -= e.movementX * this.mouseSensitivity * aimScale;
                this.player.pitch -= e.movementY * this.mouseSensitivity * aimScale;
                this.player.pitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, this.player.pitch));
            }
        });

        // Mouse Buttons (Left Click = Attack / Mine, Right Click = Place / Eat, Middle Click = Creative Menu / TNT)
        window.addEventListener('mousedown', (e) => {
            if (!this.isPointerLocked || this.blockEditor) return;
            if (e.button === 1) e.preventDefault();
            if (this.middleClickMenu) return;

            if (e.button === 0) this.mouseLeftDown = true;
            else if (e.button === 2) this.mouseRightDown = true;
            else if (e.button === 1) this.mouseMiddleDown = true;

            // Allow Lua mods to hook mouse button events and optionally cancel default actions
            if (window.modManager) {
                const cancel = window.modManager.triggerEvent("onMouseDown", e.button);
                if (cancel === false) return;
            }

            if (e.button === 0) { // Left Click
                this.attackHoldTimer = 0;
                if (this.player.tryShootGun && this.player.tryShootGun()) {
                    this.player.isMining = false;
                    return;
                }
                if (this.player.attackMob()) {
                    this.player.isMining = false;
                } else {
                    this.player.isMining = true;
                }
            } else if (e.button === 2) { // Right Click = Place, Eat, or Block (Shield/Sword)
                if (this.player.setAiming?.(true)) return;
                if (this.game?.arenaClient?.isActive) return;
                const held = this.player.getSelectedItem();
                const reg = (held && window.ITEM_REGISTRY) ? ITEM_REGISTRY[held.itemId] : null;
                if (reg && (reg.isShield || reg.isSword)) {
                    this.player.setBlocking(true);
                }
                this.player.placeBlock();
            } else if (e.button === 1) { // Creative block editor; survival keeps TNT.
                if (this.player.isCreative) this.openMiddleClickMenu();
                else this.player.detonateTNT();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouseLeftDown = false;
                this.attackHoldTimer = 0;
                this.releaseFireTrigger();
                this.player.isMining = false;
                this.player.miningProgress = 0;
            } else if (e.button === 2) {
                this.mouseRightDown = false;
                this.player.setAiming?.(false);
                this.player.setBlocking(false);
            } else if (e.button === 1) {
                this.closeMiddleClickMenu(true);
                this.mouseMiddleDown = false;
            }

            if (window.modManager) {
                window.modManager.triggerEvent("onMouseUp", e.button);
            }
        });

        // Mouse Scroll Wheel = Hotbar Slot Selection (ONLY during gameplay, NOT in menus/modals)!
        window.addEventListener('wheel', (e) => {
            const isMenuOpen = !!(
                (window.game && window.game.ui && (window.game.ui.mainMenuOpen || window.game.ui.inventoryOpen || window.game.ui.menuOpen || window.game.ui.layoutModalOpen || window.game.ui.dragModeOpen)) ||
                document.querySelector('.modal-overlay[style*="display: flex"]') ||
                document.querySelector('.modal-overlay[style*="display: block"]') ||
                document.querySelector('#game-dev-console[style*="display: flex"]') ||
                document.querySelector('#game-dev-console[style*="display: block"]') ||
                document.querySelector('#mods-modal[style*="display: flex"]') ||
                document.querySelector('#mods-modal[style*="display: block"]')
            );

            if (isMenuOpen || !this.isPointerLocked) {
                // Allow normal browser scrolling for all menus, modals, and lists!
                return;
            }

            e.preventDefault();
            if (this.middleClickMenu) return;
            if (this.game?.arenaClient?.isActive) {
                this.game.arenaClient.equip(this.game.arenaClient.localState?.slot === 1 ? 2 : 1);
                return;
            }
            let nextSlot = this.player.selectedHotbarIndex + (e.deltaY > 0 ? 1 : -1);
            if (nextSlot < 0) nextSlot = 8;
            if (nextSlot > 8) nextSlot = 0;
            if (window.game && window.game.ui) {
                window.game.ui.selectHotbarSlot(nextSlot);
            }
        }, { passive: false });

        // Prevent context menu
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            if (this.blockEditor) return;
            if (this.middleClickMenu) {
                if (e.code === 'Escape') this.closeMiddleClickMenu();
                e.preventDefault();
                return;
            }
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            const isTyping = (activeTag === 'INPUT' || activeTag === 'TEXTAREA');

            // Console toggle with ~ / ` or F8
            if (e.code === 'Backquote' || e.code === 'F8') {
                e.preventDefault();
                if (window.modManager) window.modManager.toggleDevConsole();
                return;
            }

            // Quick Low graphics preset with F6
            if (e.code === 'F6') {
                e.preventDefault();
                if (window.game && window.game.ui && window.game.ui.applyGraphicsPreset) {
                    window.game.ui.applyGraphicsPreset('low');
                }
                return;
            }

            if (isTyping) {
                if (e.code === 'Escape') {
                    document.activeElement.blur();
                }
                return;
            }

            if (window.game && window.game.ui && window.game.ui.mainMenuOpen) {
                if (e.code === 'Escape') {
                    if (window.game.ui.menuOpen) window.game.ui.togglePauseMenu(false);
                    if (window.game.multiplayer) window.game.multiplayer.toggleModal(false);
                    if (window.game.modManager) window.game.modManager.toggleModal(false);
                }
                return;
            }

            const spaceWasDown = !!this.keys['Space'];
            this.keys[e.code] = true;
            if (e.key) {
                this.keys[e.key.toLowerCase()] = true;
                this.keys[e.key.toUpperCase()] = true;
            }

            // Spacebar handling (prevent page scrolling)
            if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
                this.keys['Space'] = true;
                const modalOpen = (window.game && window.game.ui && (window.game.ui.inventoryOpen || window.game.ui.menuOpen));
                if (!modalOpen) {
                    e.preventDefault();
                }

                // Only distinct presses count as a double tap, never keyboard auto-repeat.
                if (!e.repeat && !spaceWasDown) {
                    const now = performance.now();
                    if (this._lastSpaceTime != null && (now - this._lastSpaceTime < 320)) {
                        if (this.player.isCreative || this.player.canFly || this.player.godMode) {
                            this.player.isFlying = !this.player.isFlying;
                            if (this.player.game && this.player.game.ui) {
                                this.player.game.ui.showToast(this.player.isFlying ? "🕊️ Політ: УВІМКНЕНО" : "🕊️ Політ: ВИМКНЕНО");
                            }
                            if (window.modManager) {
                                window.modManager.triggerEvent("onFlyToggle", this.player.isFlying);
                            }
                        }
                        this._lastSpaceTime = null;
                    } else {
                        this._lastSpaceTime = now;
                    }
                }
            }

            // Keyboard Shortcuts
            if (e.code === 'KeyE') {
                // Dust2 owns E as a held plant/defuse action; do not open inventory mid-round.
                if (window.game?.arenaClient?.isActive) {
                    e.preventDefault();
                    return;
                }
                if (this.player && this.player.mountedVehicle) {
                    this.player.dismountVehicle();
                    return;
                }
                const nearbyV = (window.modManager && window.modManager.vehicleManager) ? window.modManager.vehicleManager.getNearbyVehicles(this.player.position, 3.5) : [];
                if (nearbyV.length > 0) {
                    this.player.mountVehicle(nearbyV[0]);
                    return;
                }
                if (window.game && window.game.ui) {
                    window.game.ui.toggleInventory();
                    if (window.game.ui.inventoryOpen && document.exitPointerLock) {
                        document.exitPointerLock();
                    }
                }
            } else if (e.code === 'KeyH') {
                if (this.player && this.player.mountedVehicle) {
                    this.player.mountedVehicle.honk();
                    return;
                }
            } else if (e.code === 'KeyL') {
                if (this.player && this.player.mountedVehicle) {
                    this.player.mountedVehicle.toggleHeadlights();
                    return;
                }
            } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                if (this.player && this.player.mountedVehicle) {
                    this.player.dismountVehicle();
                    return;
                }
            } else if (e.code === 'Escape') {
                if (window.game && window.game.ui) {
                    window.game.ui.togglePauseMenu();
                    if (window.game.ui.menuOpen && document.exitPointerLock) {
                        document.exitPointerLock();
                    }
                }
            } else if (e.code === 'KeyF') {
                if (this.player && this.player.mountedVehicle) {
                    this.player.dismountVehicle();
                    return;
                }
                const vMgr = (window.modManager && window.modManager.vehicleManager) ||
                             (this.player.game && this.player.game.vehicleManager) ||
                             (this.player.game && this.player.game.modManager && this.player.game.modManager.vehicleManager);
                const nearbyV = vMgr ? vMgr.getNearbyVehicles(this.player.position, 4.5) : [];
                if (nearbyV.length > 0 && !nearbyV[0].driver) {
                    this.player.mountVehicle(nearbyV[0]);
                    return;
                }
                // Key F: Toggle flight in creative or godmode
                if (this.player.isCreative || this.player.canFly || this.player.godMode) {
                    this.player.isFlying = !this.player.isFlying;
                    if (this.player.game && this.player.game.ui) {
                        this.player.game.ui.showToast(this.player.isFlying ? "🕊️ Політ: УВІМКНЕНО" : "🕊️ Політ: ВИМКНЕНО");
                    }
                    if (window.modManager) {
                        window.modManager.triggerEvent("onFlyToggle", this.player.isFlying);
                    }
                }
            } else if (e.code === 'KeyG') {
                this.player.godMode = !this.player.godMode;
                const godChk = document.getElementById('chk-godmode');
                if (godChk) godChk.checked = this.player.godMode;
                this.player.soundManager.speakRandomMeme([this.player.godMode ? "Режим Бога увімкнено!" : "Режим Бога вимкнено!"]);
            } else if (e.code === 'KeyQ') {
                if (e.repeat) return;
                this.player.dropItem();
            } else if (e.code === 'KeyV') {
                this.player.toggleThirdPerson();
            } else if (e.code === 'KeyT') {
                this.player.detonateTNT();
            } else if (e.code === 'KeyR') {
                if (window.game?.arenaClient?.isActive && window.game.arenaClient.mode === 'dust2') return;
                if (this.player.getGunState?.()) {
                    e.preventDefault();
                    if (!e.repeat) this.player.reloadGun?.();
                } else if (e.shiftKey) {
                    this.player.spawnSafe();
                } else {
                    this.player.tryDodgeRoll(this.inputVector);
                }
            } else if (e.code === 'AltLeft' || e.code === 'AltRight') {
                e.preventDefault();
                this.player.tryDodgeRoll(this.inputVector);
            }

            // Hotbar 1..9
            if (e.key >= '1' && e.key <= '9') {
                if (this.game?.arenaClient?.isActive) { e.preventDefault(); return; }
                const idx = parseInt(e.key) - 1;
                if (window.game && window.game.ui) window.game.ui.selectHotbarSlot(idx);
            }

            // Mod Event: onKey
            if (window.modManager) {
                window.modManager.triggerEvent("onKey", e.code, true);
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.key) {
                this.keys[e.key.toLowerCase()] = false;
                this.keys[e.key.toUpperCase()] = false;
            }
            if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
                this.keys['Space'] = false;
            }
            // Mod Event: onKey release
            if (window.modManager) {
                window.modManager.triggerEvent("onKey", e.code, false);
            }
        });

        window.addEventListener('blur', () => {
            this.closeMiddleClickMenu();
            this.keys = {};
            this._lastSpaceTime = null;
            this.touchJumpPressed = false;
            this.jumpPressed = false;
            this.mouseLeftDown = false;
            this.mouseRightDown = false;
            this.touchAimPressed = false;
            this.player.setAiming?.(false);
            this.attackBtnPressed = false;
            this.breakBtnPressed = false;
            this.attackHoldTimer = 0;
            this.releaseFireTrigger();
        });
    }

    releaseFireTrigger() {
        if (!this.mouseRightDown && !this.touchAimPressed) this.player.setAiming?.(false);
        this.player.releaseGunTrigger?.();
        this.game?.arenaClient?.releaseTrigger();
    }

    updateGunHud() {
        const state = this.game?.arenaClient?.isActive ? null : this.player.getGunState?.();
        let hud = document.getElementById('gun-hud');
        const visible = !!state && !this.player.isDead && !this.game?.ui?.mainMenuOpen && !this.game?.ui?.menuOpen && !this.game?.ui?.inventoryOpen;
        if (!visible) { if (hud) hud.style.display = 'none'; return; }
        if (!hud && document.createElement && document.body?.appendChild) {
            hud = document.createElement('div');
            hud.id = 'gun-hud';
            hud.innerHTML = `
                <div class="eblan-gun-info">
                    <div id="gun-name-badge" class="eblan-gun-title">🔫 СТВОЛ</div>
                    <div class="eblan-gun-ammo-row">
                        <span id="gun-ammo-main" class="eblan-gun-count-big">0</span>
                        <span id="gun-ammo-capacity" class="eblan-gun-reserve">/ 0</span>
                        <span id="gun-ammo-reserve" class="eblan-gun-reserve" style="margin-left:4px">🎒 0</span>
                    </div>
                    <div id="gun-ammo-status" class="eblan-gun-status">⚡ ГОТОВИЙ ДО СТРІЛЯНИНИ</div>
                    <span id="gun-ammo-label" style="display:none"></span>
                </div>
                <button id="gun-reload-btn" class="eblan-gun-reload-btn" aria-label="Перезарядити зброю">[ R ] 🔄 ЗАРЯДИТИ</button>
            `;
            document.body.appendChild(hud);
            const btn = document.getElementById('gun-reload-btn');
            if (btn) btn.onclick = () => this.player.reloadGun?.();
        }
        if (!hud) return;
        hud.style.display = 'flex';
        const label = document.getElementById('gun-ammo-label');
        if (label) label.textContent = `${state.gunType.toUpperCase()} · ${state.ammo}/${state.capacity} · ${Number.isFinite(state.reserve) ? state.reserve : '∞'}${state.reloading ? ` · ↻ ${state.reloadRemaining.toFixed(1)}с` : ''}${performance.now() < (this.player.gunHitUntil || 0) ? ' · × HIT' : ''}`;

        const nameBadge = document.getElementById('gun-name-badge');
        if (nameBadge) nameBadge.textContent = `🔫 ${state.gunType.toUpperCase()}`;
        const mainCount = document.getElementById('gun-ammo-main');
        if (mainCount) {
            mainCount.textContent = state.ammo;
            mainCount.classList.toggle('low', state.ammo <= Math.ceil(state.capacity * 0.25));
        }
        const capEl = document.getElementById('gun-ammo-capacity');
        if (capEl) capEl.textContent = `/ ${state.capacity}`;
        const resEl = document.getElementById('gun-ammo-reserve');
        if (resEl) resEl.textContent = `🎒 ${Number.isFinite(state.reserve) ? state.reserve : '∞'}`;
        const statusEl = document.getElementById('gun-ammo-status');
        if (statusEl) {
            if (state.reloading) {
                statusEl.textContent = `⚠️ ПЕРЕЗАРЯДКА (${state.reloadRemaining.toFixed(1)}с)...`;
                statusEl.className = 'eblan-gun-status';
            } else if (performance.now() < (this.player.gunHitUntil || 0)) {
                statusEl.textContent = `💥 ВЛУЧИВ ПО ЄБЛАНУ!`;
                statusEl.className = 'eblan-gun-status hit';
            } else if (state.ammo === 0) {
                statusEl.textContent = `❌ ПУСТО! ТИСНИ [ R ]`;
                statusEl.className = 'eblan-gun-status hit';
            } else {
                statusEl.textContent = `⚡ ГОТОВИЙ ДО СТРІЛЯНИНИ`;
                statusEl.className = 'eblan-gun-status';
            }
        }
    }


    update(dt) {
        if (this._editorButtonCreative !== this.player.isCreative) {
            this._editorButtonCreative = this.player.isCreative;
            const button = document.getElementById('btn-tnt');
            if (button) {
                button.innerHTML = this.player.isCreative ? '🎨<br><span>Редактор</span>' : '💣<br><span>ТНТ</span>';
                button.setAttribute('aria-label', this.player.isCreative ? 'Редактор блока' : 'ТНТ');
            }
        }
        if (this.blockEditor || this.middleClickMenu?.touch) { this.inputVector.set(0, 0); this.jumpPressed = false; return; }
        this.updateGunHud();
        if (this.game && this.game.ui && this.game.ui.mainMenuOpen) {
            this.inputVector.set(0, 0);
            this.jumpPressed = false;
            return;
        }

        // Continuous auto-attack / auto-fire when holding down attack button, left click, or break button
        const paused = this.game?.ui?.menuOpen || this.game?.ui?.inventoryOpen || this.game?.arenaClient?.buyOpen || this.player.isDuelLocked?.();
        const isAttackingHold = !paused && ((this.mouseLeftDown && this.isPointerLocked) || this.attackBtnPressed || this.breakBtnPressed);
        if (isAttackingHold) {
            const heldItem = this.player.getSelectedItem();
            const heldReg = (heldItem && window.ITEM_REGISTRY) ? ITEM_REGISTRY[heldItem.itemId] : null;
            if (heldReg && heldReg.isGun) {
                if (this.player.tryShootGun) {
                    this.player.tryShootGun();
                }
                this.player.isMining = false;
            } else {
                this.attackHoldTimer = (this.attackHoldTimer || 0) + dt;
                // Attack when weapon attack cooldown is fully charged (or at least 0.5s)
                const attackReady = (this.player.attackCooldown >= 0.88) || (this.attackHoldTimer >= 0.55);
                if (attackReady) {
                    this.attackHoldTimer = 0;
                    if (this.attackBtnPressed) {
                        this.player.attackMob();
                        this.player.armSwing = 1.0;
                    } else if (this.player.attackMob()) {
                        this.player.isMining = false;
                    }
                }
            }
        } else {
            this.attackHoldTimer = 0;
            this.releaseFireTrigger();
        }

        // Integrate keyboard into inputVector (supports WASD, Arrow keys, and Cyrillic Ц/Ы/В/Ф)
        let kx = 0;
        let ky = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'] || this.keys['ц'] || this.keys['Ц']) ky += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown'] || this.keys['s'] || this.keys['S'] || this.keys['ы'] || this.keys['Ы']) ky -= 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A'] || this.keys['ф'] || this.keys['Ф']) kx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight'] || this.keys['d'] || this.keys['D'] || this.keys['в'] || this.keys['В']) kx += 1;

        if (kx !== 0 || ky !== 0) {
            this.inputVector.set(kx, ky).normalize();
        } else if (this.joystickTouchId === null) {
            this.inputVector.set(0, 0);
        }

        const spaceDown = !!(this.keys['Space'] || this.keys['KeySpace'] || this.keys[' ']);
        this.jumpPressed = spaceDown || this.touchJumpPressed;
        this.player.isSprinting = !!(this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['ShiftLeft'] || this.keys['ShiftRight']);

        const flyUpPressed = !!(spaceDown || this.touchFlyUp);
        const flyDownPressed = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyC'] || this.touchFlyDown);

        // Apply physics to player
        this.player.updatePhysics(
            dt,
            this.inputVector,
            this.jumpPressed,
            flyUpPressed,
            flyDownPressed
        );
    }
}

window.Controls = Controls;
