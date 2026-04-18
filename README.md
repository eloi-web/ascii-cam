# ASCII Cam

A real-time ASCII art camera web app built with React, TypeScript, and Vite. It captures your webcam feed and renders it as a live ASCII character grid on an HTML canvas, with customizable color palettes, zoom control, video recording, photo capture, and post-processing effects.

---

## Features

- **Live ASCII Rendering** — Webcam video is downsampled to a character grid (`cols × rows`) and drawn as monospaced ASCII text on a `<canvas>` at configurable FPS (15 / 30 / 60).
- **Truecolor Mode** — Uses canvas composite operations (`source-in` / `destination-over`) to mask the original video colors through the ASCII characters.
- **Color Palettes** — 11 built-in single-color palettes (mint, forest, cyan, magenta, etc.) plus the truecolor mode.
- **Zoom** — Digital zoom via a vertical slider or two-finger pinch on touch devices (1×–5×).
- **Video Recording** — Records the ASCII canvas stream using `MediaRecorder` and exports as `.webm` / `.mp4`.
- **Photo Capture** — Exports the current canvas frame as a `.jpg`.
- **ASCII Text Export** — Copies the current ASCII frame to clipboard as plain text.
- **Adjustable Settings** — Font size, contrast, gain (brightness), and FPS cap sliders.
- **6 Character Sets** — Standard, Binary (`01`), Blocks (`░▒▓█`), Dots (`·•●`), Minimal, and Braille.
- **Focus Mode** — Radial vignette effect to emphasize the center subject and dim the background.
- **Invert Mode** — Reverses the character density ramp for an inverted look.
- **CRT Effect** — Retro scanline + vignette overlay with subtle flicker.
- **Responsive Grid** — Column count adapts to viewport width (80 / 120 / 160 cols). Row count is dynamically calculated from the video aspect ratio.
- **Keyboard Shortcuts** — Full keyboard control for power users.
- **Animated UI** — HUD panels and transitions powered by Framer Motion (`motion/react`).

---

## Tech Stack

| Layer        | Tool                                               |
| ------------ | -------------------------------------------------- |
| Framework    | React 19                                           |
| Language     | TypeScript 5.8                                     |
| Build Tool   | Vite 6                                             |
| Styling      | Tailwind CSS v4 (via `@tailwindcss/vite` plugin)   |
| Animations   | Motion (Framer Motion)                             |
| Icons        | Lucide React                                       |
| Fonts        | **Array** (headlines), **Poppins** (body), **DM Sans Mono** (mono / ASCII) |

---

## Project Structure

```
ascii-cam/
├── index.html              # Entry HTML (mounts #root)
├── metadata.json           # App metadata (name, camera permissions)
├── package.json
├── tsconfig.json
├── vite.config.ts          # Vite config (React + Tailwind plugins, path aliases)
├── vercel.json             # Vercel deployment configuration
└── src/
    ├── main.tsx            # React root mount
    ├── App.tsx             # Full application (camera, canvas, controls)
    ├── index.css           # Tailwind imports, @font-face imports, theme tokens
    ├── vite-env.d.ts       # Vite client type declarations
    ├── css/
    │   └── array.css       # @font-face declarations for all Array font variants
    └── fonts/
        ├── Array-Bold.woff2
        ├── Array-BoldWide.woff2
        ├── Array-Regular.woff2
        ├── Array-Semibold.woff2
        ├── Array-SemiboldWide.woff2
        ├── Array-Wide.woff2
        └── ... (.woff, .ttf variants)
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- A device with a **webcam** (or a browser that supports `getUserMedia`)

### Install & Run

```bash
# 1. Clone the repo
git clone https://github.com/eloi-web/ascii-cam.git
cd ascii-cam

# 2. Install dependencies
npm install

# 3. Start the dev server (port 3000)
npm run dev
```

The app will be available at `http://localhost:3000`.

### Build for Production

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

---

## Deployment (Vercel)

The project includes a `vercel.json` for zero-config deployment:

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy
vercel
```

Or connect the GitHub repo directly in the [Vercel dashboard](https://vercel.com/new) — it will auto-detect the Vite framework and deploy on every push.

---

## Available Scripts

| Script          | Description                                |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start Vite dev server on port 3000         |
| `npm run build` | Build for production                       |
| `npm run preview` | Preview the production build             |
| `npm run clean` | Remove the `dist/` folder                 |
| `npm run lint`  | Type-check with `tsc --noEmit`             |

---

## Keyboard Shortcuts

Press `?` in the app to view the shortcuts overlay.

| Key     | Action             |
| ------- | ------------------ |
| `Space` | Toggle Camera      |
| `R`     | Record / Stop      |
| `C`     | Capture Photo      |
| `E`     | Export ASCII Text   |
| `F`     | Toggle Focus       |
| `I`     | Toggle Invert      |
| `T`     | Toggle CRT Effect  |
| `?`     | Show / Hide Shortcuts |

> Shortcuts are disabled when an input field is focused.

---

## Typography

The app uses three font tiers defined as Tailwind theme tokens in `src/index.css`:

| Token             | Font Family                 | Usage                                      |
| ----------------- | --------------------------- | ------------------------------------------ |
| `--font-headline` | **Array-BoldWide** (self-hosted) | Logo, headings, nav labels, large display text |
| `--font-body`     | **Poppins** (Google Fonts)  | Body text, UI labels, tooltips             |
| `--font-mono`     | **DM Sans Mono** (Google Fonts) | ASCII canvas rendering, HUD data readouts |

All six Array variants are available (`Array-Wide`, `Array-Regular`, `Array-Semibold`, `Array-SemiboldWide`, `Array-BoldWide`, `Array-Bold`) — declared in [src/css/array.css](src/css/array.css) and loaded from [src/fonts/](src/fonts/).

---

## How It Works

1. **Camera Feed** — `getUserMedia` opens the front-facing camera. The `<video>` element is hidden and used only as a data source.
2. **Downsampling** — Each frame, the video is drawn onto a tiny off-screen canvas (`cols × rows` pixels). Each pixel becomes one ASCII character.
3. **Brightness Mapping** — Per-pixel luminance (`0.299R + 0.587G + 0.114B`) is multiplied by gain, then contrast-adjusted, then mapped to a character from the active charset.
4. **Focus Vignette** — When enabled, a radial falloff darkens pixels farther from center, making the background fade to space characters.
5. **Canvas Drawing** — Characters are drawn onto the visible display canvas using `fillText`. In truecolor mode, the video is composited through the text using `globalCompositeOperation`.
6. **Recording** — `captureStream(30)` on the display canvas feeds a `MediaRecorder` for video export.

---

## Settings Panel

Accessible via the sliders icon in the bottom toolbar:

| Setting     | Range         | Default | Description                                  |
| ----------- | ------------- | ------- | -------------------------------------------- |
| Font Size   | 8–28 px       | 16      | Size of each ASCII character on the canvas   |
| Contrast    | 0.5–3.0       | 1.5     | Contrast curve applied to luminance          |
| Gain        | 0.5–3.0x      | 1.0     | Brightness multiplier before contrast        |
| Focus       | ON/OFF + 10–100% | OFF  | Radial vignette to emphasize center subject  |
| Invert      | ON/OFF        | OFF     | Reverses the character density ramp          |
| CRT Effect  | ON/OFF        | OFF     | Scanline + vignette retro overlay            |
| FPS Cap     | 15 / 30 / 60  | 30     | Frame rate limit for the render loop         |
| Charset     | 6 presets     | Standard | Character set used for brightness mapping   |

---

## Color Palette System

Palettes are defined in `App.tsx` as a `PALETTES` array. Each entry has an `id` and a `hex` color (or `isGradient: true` for truecolor). The bottom toolbar lets users cycle through them, and the selected color is applied to `fillStyle` when drawing ASCII characters.

---

## License

See [LICENSE](LICENSE) for details.
