/** Creative block editor. Drafts are applied atomically to one world cell. */
(function () {
    const TABS = ['Перекрасить', 'Поменять размер', 'Заменить', 'Properties'];
    const COLORS = ['#ffffff', '#e47a22', '#b548b6', '#55a9d1', '#eccb36', '#83b837', '#df88aa', '#484d51',
        '#9b9b94', '#258a91', '#713fa3', '#344eaa', '#74503a', '#50672d', '#ac3632', '#25282c'];
    const SHAPES = [['cube', 'Полный блок'], ['slab', 'Полублок'], ['panel_x', 'Панель ↔'],
        ['panel_z', 'Панель ↕'], ['pillar', 'Столбик'], ['beam', 'Балка']];
    const copy = value => value ? JSON.parse(JSON.stringify(value)) : null;
    const element = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    };
    const button = (text, action, parent, className = '') => {
        const node = element('button', text, className); node.type = 'button';
        node.addEventListener('click', action); parent.appendChild(node); return node;
    };
    function itemFor(type) {
        let item = Object.values(ITEM_REGISTRY).find(item => item.blockType === type);
        if (!item) {
            const id = 'editor_block_' + type;
            item = ITEM_REGISTRY[id] = { id, name: BLOCK_INFO[type]?.name || 'Блок', blockType: type,
                category: 'block', maxStack: 64, icon: 'stone' };
        }
        return item;
    }
    function cloneBlock(controls, target) {
        const player = controls.player;
        if (!player.isCreative || player.isDead || player.world.getBlock(target.x, target.y, target.z) !== target.type) return;
        const item = itemFor(target.type), design = copy(player.world.getBlockDesign(target.x, target.y, target.z));
        player.inventory[player.selectedHotbarIndex] = { itemId: item.id, count: 64, ...(design ? { design } : {}) };
        player.saveInventoryDebounced(); player.updateHeldBlock(); player.syncInventoryWithServer();
        player.game.ui?.initHotbar(); player.game.ui?.showToast('Клон добавлен в выбранный слот');
    }
    class BlockEditor {
        constructor(controls, target, tab = 0) {
            this.controls = controls; this.player = controls.player; this.target = { ...target };
            this.type = target.type; this.originalDesign = copy(this.player.world.getBlockDesign(target.x, target.y, target.z));
            const info = BLOCK_INFO[this.type];
            const source = this.player.game.textureManager.getBlockMaterial(this.type);
            const material = Array.isArray(source) ? source[0] : source;
            this.draft = copy(this.originalDesign) || { shape: info.shape?.toLowerCase() || 'cube', color: '#ffffff', opacity: Math.max(.05, material.opacity ?? 1), solid: !window.isPassThroughBlock(this.type), emissive: 0 };
            this.layer = 4; this.pixelTool = 'remove'; this.cells = new Set(this.draft.cells || []);
            controls.blockEditor = this;
            controls.keys = {}; controls.inputVector.set(0, 0);
            controls.mouseLeftDown = controls.mouseRightDown = false;
            this.player.isMining = false; this.player.setBlocking(false); controls.releaseFireTrigger();
            document.exitPointerLock?.();
            this.root = element('div', '', 'modal-overlay block-editor-overlay');
            this.root.style.display = 'flex'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
            this.root.setAttribute('aria-label', 'Middle Click Menu');
            this.panel = element('section', '', 'block-editor-panel'); this.root.appendChild(this.panel);
            const header = element('header', '', 'block-editor-header'); this.panel.appendChild(header);
            header.appendChild(element('h2', 'Middle Click Menu'));
            button('Клонировать', () => { cloneBlock(controls, target); this.close(); }, header);
            button('✕', () => this.close(), header).setAttribute('aria-label', 'Закрыть');
            this.tabs = element('nav', '', 'block-editor-tabs'); this.tabs.setAttribute('aria-label', 'Настройки блока');
            this.panel.appendChild(this.tabs);
            this.tabButtons = TABS.map((name, i) => button(name, () => this.showTab(i), this.tabs));
            const body = element('div', '', 'block-editor-body'); this.panel.appendChild(body);
            this.content = element('div', '', 'block-editor-content'); body.appendChild(this.content);
            this.preview = element('div', '', 'block-editor-preview'); body.appendChild(this.preview);
            this.previewLabel = element('p'); this.preview.appendChild(this.previewLabel);
            this.previewHost = element('div'); this.preview.appendChild(this.previewHost);
            this.preview.appendChild(element('p', 'Перетаскивай для поворота. Custom: выбери инструмент и коснись пикселя. На ПК: ЛКМ удалить, ПКМ добавить.', 'block-editor-help'));
            const footer = element('footer', '', 'block-editor-footer'); this.panel.appendChild(footer);
            this.status = element('span'); this.status.setAttribute('aria-live', 'polite'); footer.appendChild(this.status);
            button('Отмена', () => this.close(), footer);
            button('Применить', () => this.apply(), footer, 'block-editor-apply');
            this.root.addEventListener('click', event => event.stopPropagation());
            this.root.addEventListener('mousedown', event => event.stopPropagation());
            this.root.addEventListener('mousemove', event => event.stopPropagation());
            this.onKey = event => {
                event.stopPropagation();
                if (event.code === 'Escape') { event.preventDefault(); this.close(); }
            };
            this.root.addEventListener('keydown', this.onKey);
            document.body.appendChild(this.root);
            this.showTab(tab); this.initPreview(); this.renderPreview(); this.tabButtons[tab].focus();
        }
        showTab(tab) {
            this.tab = tab; this.content.replaceChildren();
            this.tabButtons.forEach((node, i) => { node.classList.toggle('active', tab === i); node.setAttribute('aria-pressed', String(tab === i)); });
            if (tab === 0) this.colors();
            if (tab === 1) this.sizes();
            if (tab === 2) this.replacements();
            if (tab === 3) this.properties();
        }
        colors() {
            this.content.appendChild(element('h3', 'Цвет блока'));
            const palette = element('div', '', 'block-editor-palette'); this.content.appendChild(palette);
            COLORS.forEach(color => {
                const node = button('', () => { this.draft.color = color; this.renderPreview(); }, palette, 'block-editor-swatch');
                node.style.backgroundColor = color; node.setAttribute('aria-label', color); node.title = color;
            });
            button('Custom', () => this.customColor(), this.content);
            this.rgbHost = element('div'); this.content.appendChild(this.rgbHost);
            button('Сбросить оттенок', () => { this.draft.color = '#ffffff'; this.renderPreview(); }, this.content);
        }
        customColor() {
            this.rgbHost.replaceChildren();
            const picker = element('input'); picker.type = 'color'; picker.value = this.draft.color;
            picker.setAttribute('aria-label', 'RGB палитра'); this.rgbHost.appendChild(picker);
            const fields = ['R', 'G', 'B'].map((name, index) => {
                const label = element('label', name); const input = element('input'); input.type = 'number'; input.min = 0; input.max = 255;
                input.value = parseInt(this.draft.color.slice(1 + index * 2, 3 + index * 2), 16);
                label.appendChild(input); this.rgbHost.appendChild(label); return input;
            });
            picker.addEventListener('input', () => {
                this.draft.color = picker.value;
                fields.forEach((input, i) => { input.value = parseInt(picker.value.slice(1 + i * 2, 3 + i * 2), 16); });
                this.renderPreview();
            });
            fields.forEach(input => input.addEventListener('input', () => {
                const values = fields.map(field => Math.max(0, Math.min(255, Number(field.value) || 0)));
                this.draft.color = '#' + values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
                picker.value = this.draft.color; this.renderPreview();
            }));
        }
        sizes() {
            this.content.appendChild(element('h3', 'Форма любого блока'));
            const choices = element('div', '', 'block-editor-choices'); this.content.appendChild(choices);
            SHAPES.forEach(([shape, name]) => button(name, () => {
                this.draft.shape = shape; delete this.draft.cells; this.showTab(1); this.renderPreview();
            }, choices, this.draft.shape === shape ? 'active' : ''));
            button('Custom — пиксели 8×8×8', () => {
                if (this.draft.shape !== 'custom') {
                    const bounds = window.DESIGN_SHAPES[this.draft.shape] || window.DESIGN_SHAPES.cube;
                    this.cells.clear();
                    for (let cell = 0; cell < 512; cell++) {
                        const xyz = [cell % 8, Math.floor(cell / 8) % 8, Math.floor(cell / 64)].map(v => (v + .5) / 8);
                        if (xyz.every((v, i) => v >= bounds[i] && v <= bounds[i + 3])) this.cells.add(cell);
                    }
                    this.draft.shape = 'custom'; this.updateCells();
                }
                this.showTab(1); this.renderPreview();
            }, this.content, this.draft.shape === 'custom' ? 'active' : '');
            if (this.draft.shape === 'custom') {
                const tools = element('div', '', 'block-editor-choices'); this.content.appendChild(tools);
                for (const [tool, name] of [['remove', 'Удалять пиксели'], ['add', 'Добавлять пиксели']]) {
                    button(name, () => { this.pixelTool = tool; this.showTab(1); }, tools, this.pixelTool === tool ? 'active' : '');
                }
                this.pixelGrid();
            }
        }
        updateCells() { this.draft.cells = [...this.cells].sort((a, b) => a - b); }
        editPixel(cell, add) {
            if (cell < 0 || cell >= 512) return;
            if (add) this.cells.add(cell); else this.cells.delete(cell);
            this.updateCells(); this.showTab(1); this.renderPreview();
        }
        pixelGrid() {
            const label = element('label', 'Слой Y: ' + (this.layer + 1));
            const layer = element('input'); layer.type = 'range'; layer.min = 0; layer.max = 7; layer.value = this.layer;
            label.appendChild(layer); this.content.appendChild(label);
            layer.addEventListener('input', () => { this.layer = Number(layer.value); this.showTab(1); });
            this.content.appendChild(element('p', 'Нажми клетку, чтобы поставить или сломать пиксель.', 'block-editor-help'));
            const grid = element('div', '', 'block-editor-pixel-grid'); this.content.appendChild(grid);
            for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
                const cell = x + this.layer * 8 + z * 64;
                const node = button('', () => this.editPixel(cell, !this.cells.has(cell)), grid, this.cells.has(cell) ? 'filled' : '');
                node.setAttribute('aria-label', `Пиксель ${x + 1}, ${this.layer + 1}, ${z + 1}`);
                node.setAttribute('aria-pressed', String(this.cells.has(cell)));
            }
            button('Заполнить', () => { this.cells = new Set(Array.from({ length: 512 }, (_, i) => i)); this.updateCells(); this.showTab(1); this.renderPreview(); }, this.content);
            button('Очистить', () => { this.cells.clear(); this.updateCells(); this.showTab(1); this.renderPreview(); }, this.content);
        }
        replacements() {
            const groups = { 'Строительные': [], 'Природа': [], 'Механизмы': [], 'Другие': [] };
            const natural = /DIRT|GRASS|WOOD|LEAVES|SAND|SNOW|ICE|FLOWER|MUSHROOM|CACTUS|ORE|CLAY|GRAVEL|WATER|LAVA/;
            const mechanisms = /REDSTONE|COMPUTER|LEVER|BUTTON|PRESSURE|TNT|CRAFTING/;
            for (const [key, type] of Object.entries(BLOCK_TYPES)) {
                if (!type || BLOCK_INFO[type]?.baseType) continue;
                const name = mechanisms.test(key) ? 'Механизмы' : natural.test(key) ? 'Природа' : type >= 65 || /STONE|BRICK|PLANK|BLOCK|GLASS|TERRACOTTA/.test(key) ? 'Строительные' : 'Другие';
                groups[name].push(type);
            }
            const nav = element('nav', '', 'block-editor-tabs'); this.content.appendChild(nav);
            const list = element('div', '', 'block-editor-block-list'); this.content.appendChild(list);
            const show = category => {
                list.replaceChildren();
                Array.from(nav.children).forEach(node => node.classList.toggle('active', node.textContent === category));
                groups[category].forEach(type => {
                    const node = button(BLOCK_INFO[type].name, () => { this.type = type; show(category); this.renderPreview(); }, list, type === this.type ? 'active' : '');
                    const icon = element('img'); icon.alt = ''; const item = itemFor(type);
                    icon.src = this.player.game.textureManager.getTextureCanvas(item.icon).toDataURL(); node.prepend(icon);
                });
            };
            Object.keys(groups).forEach(name => button(name, () => show(name), nav)); show('Строительные');
        }
        properties() {
            this.content.appendChild(element('h3', 'Properties'));
            this.slider('Прозрачность', 0, 95, Math.round((1 - this.draft.opacity) * 100), value => { this.draft.opacity = 1 - value / 100; });
            this.slider('Свечение', 0, 100, Math.round(this.draft.emissive * 100), value => { this.draft.emissive = value / 100; });
            const label = element('label', 'Коллизия (твёрдый блок) '); const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = this.draft.solid;
            label.appendChild(checkbox); this.content.appendChild(label);
            checkbox.addEventListener('change', () => { this.draft.solid = checkbox.checked; this.renderPreview(); });
        }
        slider(name, min, max, value, update) {
            const label = element('label', name + ': '); const output = element('output', value + '%'); label.appendChild(output);
            const input = element('input'); input.type = 'range'; input.min = min; input.max = max; input.value = value;
            label.appendChild(input); this.content.appendChild(label);
            input.addEventListener('input', () => { output.textContent = input.value + '%'; update(Number(input.value)); this.renderPreview(); });
        }
        initPreview() {
            try {
                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.renderer.setSize(300, 270);
                this.previewHost.appendChild(this.renderer.domElement);
                this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(40, 300 / 270, .1, 10);
                this.angle = .8; this.scene.add(new THREE.AmbientLight(0xffffff, .8));
                const light = new THREE.DirectionalLight(0xffffff, .7); light.position.set(2, 4, 3); this.scene.add(light);
                this.group = new THREE.Group(); this.scene.add(this.group);
                this.geometry = new THREE.BoxGeometry(1, 1, 1);
                const canvas = this.renderer.domElement;
                canvas.addEventListener('contextmenu', event => event.preventDefault());
                let down = null;
                canvas.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY, angle: this.angle, button: event.pointerType === 'touch' ? (this.pixelTool === 'add' ? 2 : 0) : event.button }; canvas.setPointerCapture(event.pointerId); });
                canvas.addEventListener('pointermove', event => { if (down) { this.angle = down.angle + (event.clientX - down.x) * .01; this.drawPreview(); } });
                canvas.addEventListener('pointerup', event => {
                    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5 && this.draft.shape === 'custom') {
                        const rect = canvas.getBoundingClientRect(); const ray = new THREE.Raycaster();
                        ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
                        const hit = ray.intersectObjects(this.group.children)[0];
                        if (hit) {
                            const normal = hit.face.normal;
                            const coord = ['x', 'y', 'z'].map(axis => Math.max(0, Math.min(7, Math.floor((hit.point[axis] + .5 - normal[axis] * .0001) * 8))));
                            const cell = coord[0] + coord[1] * 8 + coord[2] * 64;
                            if (down.button === 0) this.editPixel(cell, false);
                            else if (down.button === 2) {
                                const xyz = [cell % 8, Math.floor(cell / 8) % 8, Math.floor(cell / 64)];
                                xyz[0] += Math.round(normal.x); xyz[1] += Math.round(normal.y); xyz[2] += Math.round(normal.z);
                                if (xyz.every(v => v >= 0 && v < 8)) this.editPixel(xyz[0] + xyz[1] * 8 + xyz[2] * 64, true);
                            }
                        }
                    }
                    down = null;
                });
            } catch (error) { this.previewHost.textContent = '3D-превью недоступно. Редактирование по слоям работает.'; }
        }
        renderPreview() {
            this.previewLabel.textContent = BLOCK_INFO[this.type]?.name || 'Блок';
            if (!this.renderer || !this.group) return;
            this.previewGeometry?.dispose(); this.previewGeometry = null;
            this.group.clear(); this.disposePreviewMaterial();
            const source = this.player.game.textureManager.getDesignMaterial(this.type, this.draft);
            this.previewMaterial = Array.isArray(source) ? source.map(material => material.clone()) : source.clone();
            if (this.draft.shape === 'custom' && !this.cells.size) { this.drawPreview(); return; }
            if (this.draft.shape === 'custom') {
                const positions = [], normals = [], uvs = [];
                const geometry = this.previewGeometry = new THREE.BufferGeometry();
                const surface = carvedSurface(this.draft);
                for (let f = 0; f < 6; f++) {
                    const start = positions.length / 3;
                    for (const slice of surface.sides[f]) for (const bounds of slice.faces) for (const corner of CHUNK_FACES[f].corners) {
                        const p = [0, 1, 2].map(axis => bounds[axis] + corner[axis] * (bounds[axis + 3] - bounds[axis]));
                        positions.push(p[0] - .5, p[1] - .5, p[2] - .5);
                        normals.push(...CHUNK_FACES[f].normal); uvs.push(...blockFaceUV(f, ...p));
                    }
                    geometry.addGroup(start, positions.length / 3 - start, Array.isArray(this.previewMaterial) ? f : 0);
                }
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                this.group.add(new THREE.Mesh(geometry, this.previewMaterial));
                this.drawPreview(); return;
            }
            const boxes = window.blockDesignBoxes(this.type, this.draft);
            boxes.forEach((bounds, index) => {
                const mesh = new THREE.Mesh(this.geometry, this.previewMaterial);
                mesh.scale.set(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]);
                mesh.position.set((bounds[0] + bounds[3]) / 2 - .5, (bounds[1] + bounds[4]) / 2 - .5, (bounds[2] + bounds[5]) / 2 - .5);
                mesh.userData.cell = this.draft.cells?.[index]; this.group.add(mesh);
            });
            this.drawPreview();
        }
        drawPreview() {
            if (!this.renderer) return;
            this.camera.position.set(Math.sin(this.angle) * 2.8, 1.7, Math.cos(this.angle) * 2.8);
            this.camera.lookAt(0, 0, 0); this.camera.updateMatrixWorld(); this.scene.updateMatrixWorld(); this.renderer.render(this.scene, this.camera);
        }
        apply() {
            const p = this.player, t = this.target;
            if (!p.isCreative || p.isDead || p.world.getBlock(t.x, t.y, t.z) !== t.type ||
                JSON.stringify(p.world.getBlockDesign(t.x, t.y, t.z)) !== JSON.stringify(this.originalDesign)) { this.status.textContent = 'Блок изменился. Открой редактор снова.'; return; }
            let design;
            try { design = window.normalizeBlockDesign(this.draft); } catch (error) { this.status.textContent = 'Оставь хотя бы один пиксель.'; return; }
            if (window.modManager?.canPlaceBlock(t.x, t.y, t.z, this.type, p) === false) { this.status.textContent = 'Здесь нельзя изменять блок.'; return; }
            if (design.solid && window.blockDesignBoxes(this.type, design).some(b =>
                p.position.x + p.width / 2 > t.x + b[0] && p.position.x - p.width / 2 < t.x + b[3] &&
                p.position.y + p.height > t.y + b[1] && p.position.y < t.y + b[4] &&
                p.position.z + p.depth / 2 > t.z + b[2] && p.position.z - p.depth / 2 < t.z + b[5])) { this.status.textContent = 'Новая форма пересекается с игроком.'; return; }
            p.world.setBlock(t.x, t.y, t.z, this.type, design); p.world.updateMeshes();
            p.game.multiplayer?.broadcastBlockPlace(t.x, t.y, t.z, this.type, t.type, design);
            p.soundManager?.playPlace(BLOCK_INFO[this.type]?.sound || 'stone'); this.close();
        }
        disposePreviewMaterial() {
            if (this.previewMaterial) for (const material of Array.isArray(this.previewMaterial) ? this.previewMaterial : [this.previewMaterial]) material.dispose();
        }
        close() {
            this.root.remove(); this.disposePreviewMaterial(); this.geometry?.dispose(); this.previewGeometry?.dispose(); this.renderer?.dispose();
            this.controls.blockEditor = null; if (!this.controls.isTouchDevice) this.controls.requestPointerLock();
        }
    }
    window.BlockEditor = { open: (controls, target, tab) => new BlockEditor(controls, target, tab), clone: cloneBlock };
})();
