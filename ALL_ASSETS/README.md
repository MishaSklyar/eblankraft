# 📦 ALL_ASSETS — Повна база ресурсів Єбланкрафт (Eblankraft 3.0)

Ця папка містить **абсолютно всі текстури, звуки та 3D-моделі** гри Єбланкрафт, експортовані у стандартних універсальних форматах:
- **Текстури**: `.png` (Pixel-Art 16x16, 32x32, 64x64 та повний атлас `atlas.png`)
- **Звуки**: `.wav` (PCM 44.1 kHz, 16-bit моно) та `.mp3`
- **3D-моделі**: `.obj` + `.mtl` (Wavefront 3D з кольоровими матеріалами) та `.glb` (Binary glTF)

---

## 📁 Структура папки

### 🎨 1. TEXTURES/ (Всі Текстури)
- `blocks/` — Текстури блоків (трава, земля, камінь, бедрок, обсидіан, алмазний блок, TNT, пісок, вода, лава, цегла, руди тощо).
- `items/` — Текстури предметів та зброї (алмазний меч, кайло, їжа, шаурма, пиво, тотем безсмертя, АК-47, AWP, патрони, кейси, жигулі).
- `armor/` — Текстури броні (алмазний, незеритовий та залізний шоломи, нагрудники, поножі, черевики).
- `skins/` — Офіційні 64x64 скіни гравця у форматі Minecraft (Steve, Alex, Гопнік, Багатій, Кібер, Демон, Військовий, Єблан, Україна, Popcat, GigaChad).
- `mobs/` — Карти нормалей води (`waternormals.jpg`) та текстури істот.
- `ui/` — Іконки, тріщини ламання блоків (`crack_0`..`crack_4`), приціли, спрайти.
- `all_textures/` — Всі 150+ текстур в одній загальній папці без підпапок.
- `atlas.png` — Повний зведений атлас текстур (512x512).

---

### 🔊 2. SOUNDS/ (Всі Звуки)
- `blocks/` — Звуки взаємодії з блоками (`break_stone.wav`, `break_wood.wav`, `break_grass.wav`, `break_glass.wav`, `place_stone.wav` тощо).
- `combat/` — Бойові звуки (`hurt.wav`, `crit_hit.wav`, `strong_hit.wav`, `parry.wav` — дзвін меча, `shield_block.wav` — удар щита, `whiff.wav`, `dodge_roll.wav`).
- `entities/` — Звуки мобів (`villager_hrmm.wav`, `zombie_groan.wav`, `creeper_hiss.wav`, `dragon_roar.wav`).
- `environment/` — Оточення (`explosion.wav`, `tnt_fuse.wav`, `thunder.wav`, `portal_warp.wav`, `splash.wav`, `swim.wav`, `lava_pop.wav`, `sizzle.wav`).
- `player/` — Звуки гравця (`step.wav`, `jump.wav`, `eat.wav` — хрускіт їжі).
- `ui/` — Інтерфейс та фанфари (`click.wav`, `lever_click.wav`, `totem_activate.wav`, `pc_startup.wav`, `win_fanfare.wav`, `super_eblan_fanfare.wav`).
- `all_sounds/` — Всі 35+ аудіофайлів в одній загальній папці.

---

### 🗿 3. MODELS/ (Всі 3D-моделі)
- `obj/` — 3D-моделі у відкритому форматі Wavefront OBJ (з окремими файлами матеріалів `.mtl`):
  1. `player_steve.obj` — Стандартна 3D-модель гравця Стіва.
  2. `player_diamond_armor.obj` — Гравець у повному алмазному сеті броні.
  3. `duelist_bot.obj` — Бот-Дуелянт в алмазній броні з мечем і щитом.
  4. `zombie.obj` — Зомбі з витягнутими вперед руками.
  5. `creeper.obj` — 4-ногий Кріпер.
  6. `skeleton.obj` — Скелет з луком.
  7. `spider.obj` — 8-ногий павук.
  8. `villager.obj` — Житель зі схрещеними руками та носом.
  9. `ender_dragon.obj` — Дракон Краю з крилами, хвостом та рогами.
  10. `car_zhiguli.obj` — Автомобіль ВАЗ-2101 «Жигулі» (кузов, скло, колеса, бампери, фари).
  11. `diamond_sword.obj` — Об'ємний 3D алмазний меч.
  12. `diamond_pickaxe.obj` — 3D алмазне кайло.
  13. `shield.obj` — 3D щит із залізною оправою та ручкою.
  14. `ak47.obj` — Автомат Калашникова АК-47.
  15. `block_cube.obj` — Універсальний воксельний блок 1x1x1.
  16. `tnt_block.obj` — Блок динаміту TNT з гнітом.
- `glb/` — Бінарні моделі glTF (`ak47.glb`).
- `all_models/` — Усі 3D-моделі в одній папці.

---

## 🛠️ Як відкривати та використовувати:
- **Текстури**: Будь-який переглядач зображень, Photoshop, Aseprite, GIMP, Paint.NET.
- **Звуки**: Будь-який медіаплеєр (VLC, mpv, Audacity).
- **3D-моделі**: Будь-який 3D-редактор або рушій: **Blender**, **Unity**, **Unreal Engine**, **Godot**, Windows 3D Viewer.
