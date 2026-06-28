# PuzzleNet Verse 🧩

**دنیای تعاملی ایزومتریک گروه فنی پازل‌نت**

> An isometric 3D interactive world built with pure Canvas — no frameworks, no dependencies.

## 🌐 Live Demo
**[puzzlenet.github.io/puzzlenet-verse](https://puzzlenet.github.io/puzzlenet-verse)**

---

## 🗂 Project Structure

```
puzzlenet-verse/
├── index.html          # Entry point
├── css/
│   └── style.css       # All styles + animations
├── js/
│   ├── rooms.js        # 32 room definitions (services data)
│   ├── renderer.js     # Isometric renderer + puzzle shape engine
│   └── world.js        # Camera, loop, interaction, minimap
└── README.md
```

## 🎮 Controls

| Action | Control |
|--------|---------|
| Move camera | Drag / WASD / Arrow keys |
| Zoom | Scroll wheel / Pinch |
| Select room | Click on puzzle tile |
| Reset view | R key |
| Close panel | Escape |

## 🧩 Features

- **32 puzzle-piece rooms** — each an interlocking isometric tile
- **True puzzle shape** — tabs and blanks connect adjacent pieces
- **3D extrusion** — each piece has left/right dark faces for depth
- **Animated characters** — per room, with blinking and walking
- **Data packets** — travel along connection edges
- **Room info panel** — slides in on click with service details
- **Minimap** — always visible, shows viewport position
- **Boot sequence** — branded loading screen

## 🚀 Deploy to GitHub Pages

```bash
# 1. Create repo on GitHub named: puzzlenet-verse
# 2. Push this folder:
git init
git add .
git commit -m "🧩 Initial PuzzleNet Verse release"
git remote add origin https://github.com/YOUR_USERNAME/puzzlenet-verse.git
git push -u origin main

# 3. Enable GitHub Pages:
#    Settings → Pages → Source: Deploy from branch → main → / (root)
```

## ➕ Adding New Rooms

Edit `js/rooms.js` and add a new entry to the `ROOMS` array:

```js
{
  id: 32, col: 4, row: 0,   // position in the grid
  icon: '🆕', name: 'نام اتاق', service: 'Service Name',
  color: '#00d4ff', accent: '#0099bb',
  desc: 'توضیحات خدمت...',
  link: 'https://t.me/pazzle_net',
  tabs: [0, +1, -1, 0],    // N, E, S, W: +1=tab out, -1=blank in, 0=flat
  chars: ['نام شخصیت'],
  objects: ['شی ۱'],
}
```

The puzzle map will automatically expand!

---

**© گروه فنی پازل‌نت — PuzzleNet Technical Group**
