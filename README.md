# RoboShell Savior 🐢🌊

> A 2D pixel-art underwater survival game built with the **Maki framework** for the Maki Game Hackathon 2026.

**GitHub Repository:** https://github.com/ismail-io/RoboShell

---

## 🎮 About the Game

**RoboShell Savior** puts you in control of a robot turtle on a mission to clean the ocean. Navigate through waves of sea waste — plastic bags, soda cans, tires, bottles and more — and blast them away before they reach you.

Survive long enough and you'll face **Giant Boss enemies** that chase you down and hit hard. Each boss wave gets bigger and more aggressive. How long can you protect the ocean?

---

## ✨ Features

- 🐢 **Robot Turtle player** with smooth 360° movement and directional shooting
- 🗑️ **6 unique sea waste obstacle types** — each with pixel-art sprites
- 👾 **Boss wave system** — giant enemies spawn every 50 points, increasing in count each wave
- ❤️ **5-heart health system** with invincibility frames after each hit
- 🏆 **High score tracking** saved in localStorage
- 🎬 **Intro video** with skip button
- 🎵 **Background music** during gameplay + game over music
- ⏸️ **Pause menu** with Resume, New Game, and Exit options
- 💀 **Animated Game Over screen** with typing effect
- 🌊 **Animated underwater background** — bubbles, fish, seaweed, light rays, parallax
- 📱 **Fullscreen responsive** — works at any screen size
- ⚡ **Loading screen** between scene transitions

---

## 🚀 How to Run

### Requirements
- [Node.js](https://nodejs.org/) installed (any recent version)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/ismail-io/RoboShell.git

# 2. Navigate into the game folder
cd RoboShell/starfish-savior

# 3. Start a local server
npx serve . -p 3000
```

Then open your browser and go to:
```
http://localhost:3000
```

> **No build step required.** The game runs entirely in the browser with vanilla JavaScript.

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Move Up |
| `S` / `↓` | Move Down |
| `A` / `←` | Move Left |
| `D` / `→` | Move Right |
| `Space` | Shoot |

---

## 🏗️ Built With

- **[Maki Framework](https://github.com/maki-framework)** — custom lightweight 2D pixel game engine
  - `Maki.Engine` — game loop & scene management
  - `Maki.Renderer` — pixel-art canvas drawing
  - `Maki.Input` — keyboard input handler
  - `Maki.Audio` — procedural Web Audio API sounds
  - `Maki.Particles` — particle burst system
  - `Maki.Math` — vector & collision helpers
- **Vanilla JavaScript** — no external dependencies
- **HTML5 Canvas** — all rendering
- **Web Audio API** — procedural sound effects

---

## 📁 Project Structure

```
starfish-savior/
├── index.html              # Main entry point
├── style.css               # All UI styles
├── src/
│   ├── maki.js             # Maki framework core
│   ├── loader.js           # Asset preloader
│   ├── background.js       # Animated underwater background
│   ├── assets.js           # Sprite drawing functions
│   ├── entities.js         # Player, Bullet, Trash, Boss classes
│   └── game.js             # Game scenes, logic, HUD
└── assets/
    ├── bg/                 # Game background image
    ├── menu/               # Main menu background
    ├── player/             # Turtle sprite
    ├── enemy/              # Boss sprite
    ├── obstacles/          # 6 sea waste obstacle sprites
    ├── music/              # BGM + game over music
    └── video/              # Intro video
```

---

## 🎯 Hackathon Submission

- **Event:** Maki Game Hackathon 2026
- **Category:** Most Creative Game
- **Framework:** Maki (custom 2D pixel game engine)
- **Theme:** Ocean conservation — clean the sea, defeat pollution bosses
- **Submitted by:** ismail-io
- **Deadline:** May 10, 2026

---

## 📜 License

This project was created for the Maki Game Hackathon 2026. All game assets and code are original work by the author.
