# 📦 .eblan — формат паков (супер-простой)

`.eblan` = обычный ZIP. Переименуй в `.zip` — откроется любым архиватором.

## Структура

```
my_pack/
  manifest.json          (необязательно)
  textures/dirt.png      переопределить текстуру блока/предмета
  textures/ak47.png      новая иконка (id = имя файла → Items.register pixels не нужен,
                         иконка доступна сразу по ключу "ak47")
  models/chair.glb       модель для Models.spawn("chair", x, y, z)
  lua/hello.lua          (необязательно) каждый файл ставится как включённый Lua-мод
```

`manifest.json`: `{"name": "Мой пак", "version": "1.0", "author": "Я"}`

## Ключи текстур (что можно переопределить)

Блоки: `dirt grass_top grass_side stone cobblestone wood_side wood_top planks leaves
bricks glass sand tnt_side tnt_top diamond gold eblan bedrock glowstone bookshelf
craft_top craft_side water lava sponge cat coal_ore iron_ore obsidian netherrack
soul_sand nether_bricks nether_quartz netherite_block end_stone dragon_egg
portal_nether portal_end`
Предметы: `stick coal iron_ingot gold_ingot diamond_item netherite_scrap ender_eye
blaze_rod gunpowder rotten_flesh apple cooked_steak meme_doner junk_sock junk_beer
junk_cig junk_nut junk_token case_hobo case_diamond case_nether case_dragon`
Размер любой квадратный (родной 16×16). Чанки перестраиваются сами.

## Модели

- `models/<id>.glb` → `Models.spawn("<id>", x, y, z)` из Lua.
- `.gltf` только embedded (без внешних `.bin`).
- После импорта модель сразу в кеше, спавн через консоль: `Models.spawn("chair", 0, 20, 0)` —
  координаты игрока подскажет HUD (XYZ).

## Сборка / установка

```bash
python3 eblan_pack.py ./my_pack ./my_pack.eblan
```

В игре: Моды → `📦 Імпорт .eblan` → выбрать файл. Пак действует до перезагрузки
страницы (в localStorage не сохраняется — тяжёлые PNG/GLB туда не влезут).

## Готовые паки в `packs/`
- `demo.eblan` — пример (текстура + lua).
- `ak47.eblan` — 3D-модель АК-47 (Sketchfab TastyTony, CC) + иконки + копия мода.
  Собрать заново: `python3 eblan_pack.py packs/ak47 packs/ak47.eblan`.
