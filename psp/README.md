# 🎮 Eblankraft 2.0 — Sony PSP 2000 / 3000 Edition

Офіційний нативний порт **Eblankraft 2.0** для портативної консолі **Sony PlayStation Portable (PSP-2000 Slim / PSP-3000)**, написаний з нуля на C/C++ з використанням офіційного графічного процесора Sony PSP GU (`libgu` / `libgum`) та PSPSDK.

---

## 💾 Як запустити на реальній PSP 3000

Гра збирається одразу у двох форматах:

### Варіант А: Через ISO (рекомендовано для зручності)
1. Підключіть PSP через USB до комп'ютера.
2. Скопіюйте файл [dist_psp/eblankraft.iso](file:///home/mishasklyar/Downloads/eblankraft/dist_psp/eblankraft.iso) у папку на карті пам'яті:
   ```
   ms0:/ISO/eblankraft.iso
   ```
3. Запустіть гру з меню PSP **Гра (Game) -> Memory Stick™ -> Eblankraft 2.0 PSP**!

### Варіант Б: Через Homebrew EBOOT.PBP
1. Скопіюйте файл [dist_psp/EBOOT.PBP](file:///home/mishasklyar/Downloads/eblankraft/dist_psp/EBOOT.PBP) у папку:
   ```
   ms0:/PSP/GAME/EBLANKRAFT/EBOOT.PBP
   ```

---

## 🖥️ Як запустити на ПК в емуляторі
```bash
./run_psp_emulator.sh
```
Або:
```bash
PPSSPPSDL dist_psp/eblankraft.iso
```
