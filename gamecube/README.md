# 🎮 Eblankraft 2.0 — Nintendo GameCube Edition

Офіційний нативний порт **Eblankraft 2.0** для консолі **Nintendo GameCube** (а також сумісний з Nintendo Wii), написаний на C/C++ з використанням офіційного графічного процесора ATI Flipper GX (`libogc`), звукового DSP (`libasnd`) та тулчейну devkitPPC.

---

## 🕹️ Керування на геймпаді GameCube

- **Основний аналоговий стік**: Пересування персонажа вперед / назад / стрейф
- **C-Stick (правий жовтий стік)**: Плавний огляд камерою (Pitch / Yaw) — повноцінне Dual-Stick керування!
- **Кнопка (A)**: Стрибок
- **R-Trigger / (B)**: Ламати блок (затиснути) / Атакувати моба або дракона
- **L-Trigger / (Y)**: Ставити блок / Їсти шаурму/їжу
- **Хрестовина (D-Pad) Вліво / Вправо**: Перемикання слотів хотбару
- **Кнопка (X)**: Відкрити Бомж-Кейс (Рулетка CS:GO)
- **Кнопка (Z)**: Відкрити Кейс Дракона
- **Кнопка (START)**: Пауза / Меню телепортації по світах (Overworld / Nether / The End)

---

## 💾 Як запустити на реальному GameCube / Wii

Збірка знаходиться у папці [dist_gamecube/](file:///home/mishasklyar/Downloads/eblankraft/dist_gamecube/):

### Варіант А: Через Swiss / SD Gecko / GC Loader (.dol)
1. Скопіюйте файл [dist_gamecube/eblankraft.dol](file:///home/mishasklyar/Downloads/eblankraft/dist_gamecube/eblankraft.dol) на SD-карту.
2. Запустіть файл через Swiss або інший хоумбрю-лоадер.

### Варіант Б: Через ISO (.iso)
1. Завантажте [dist_gamecube/eblankraft_gamecube.iso](file:///home/mishasklyar/Downloads/eblankraft/dist_gamecube/eblankraft_gamecube.iso).
2. Запустіть через GC Loader, Swiss або запишіть на mini-DVD.

---

## 🖥️ Як запустити на ПК в емуляторі Dolphin

```bash
./run_gamecube_emulator.sh
```
Або відкрийте Dolphin вручну і оберіть:
- [dist_gamecube/eblankraft_gamecube.iso](file:///home/mishasklyar/Downloads/eblankraft/dist_gamecube/eblankraft_gamecube.iso)
- або [dist_gamecube/eblankraft.dol](file:///home/mishasklyar/Downloads/eblankraft/dist_gamecube/eblankraft.dol)

---

## 🔨 Як перезібрати самостійно

```bash
./build_gamecube.sh
```
Скрипт автоматично використовує Docker з образом `devkitpro/devkitppc` для чистої компіляції DOL та генерації ISO.
