# ASCII Cam

A real-time ASCII art camera web app built with React, TypeScript, and Vite. It captures your webcam feed and renders it as a live ASCII character grid on an HTML canvas, with customizable color palettes, zoom control, video recording, and photo capture.

---

## Features

- **Live ASCII Rendering** — Webcam video is downsampled to a character grid (`cols × rows`) and drawn as monospaced ASCII text on a `<canvas>` at ~30 FPS.
- **Truecolor Mode** — Uses canvas composite operations (`source-in` / `destination-over`) to mask the original video colors through the ASCII characters.
- **Color Palettes** — 11 built-in single-color palettes (mint, forest, cyan, magenta, etc.) plus the truecolor mode.
- **Zoom** — Digital zoom via a vertical slider or two-finger pinch on touch devices (1×–5×).
- **Video Recording** — Records the ASCII canvas stream using `MediaRecorder` and exports as `.webm` / `.mp4`.
- **Photo Capture** — Exports the current canvas frame as a `.jpg`.
- **Responsive Grid** — Column count adapts to viewport width (80 / 120 / 160 cols). Row count is dynamically calculated from the video aspect ratio.
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
| Fonts        | **Array** (headlines), **Poppins** (body), **JetBrains Mono** (mono / ASCII) |

---

## Project Structure

```
ascii-cam/
├── index.html              # Entry HTML (mounts #root)
├── metadata.json           # App metadata (name, camera permissions)
├── package.json
├── tsconfig.json
├── vite.config.ts          # Vite config (React + Tailwind plugins, path aliases)
└── src/
    ├── main.tsx            # React root mount
    ├── App.tsx             # Full application (camera, canvas, controls)
    ├── index.css           # Tailwind imports, @font-face imports, theme tokens
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

## Available Scripts

| Script          | Description                                |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start Vite dev server on port 3000         |
| `npm run build` | Build for production                       |
| `npm run preview` | Preview the production build             |
| `npm run clean` | Remove the `dist/` folder                 |
| `npm run lint`  | Type-check with `tsc --noEmit`             |

---

## Typography

The app uses three font tiers defined as Tailwind theme tokens in `src/index.css`:

| Token             | Font Family                 | Usage                                      |
| ----------------- | --------------------------- | ------------------------------------------ |
| `--font-headline` | **Array-BoldWide** (self-hosted) | Logo, headings, nav labels, large display text |
| `--font-body`     | **Poppins** (Google Fonts)  | Body text, UI labels, tooltips             |
| `--font-mono`     | **JetBrains Mono** (Google Fonts) | ASCII canvas rendering, HUD data readouts |

All six Array variants are available (`Array-Wide`, `Array-Regular`, `Array-Semibold`, `Array-SemiboldWide`, `Array-BoldWide`, `Array-Bold`) — declared in [src/css/array.css](src/css/array.css) and loaded from [src/fonts/](src/fonts/).

---

## How It Works

1. **Camera Feed** — `getUserMedia` opens the front-facing camera. The `<video>` element is hidden and used only as a data source.
2. **Downsampling** — Each frame, the video is drawn onto a tiny off-screen canvas (`cols × rows` pixels). Each pixel becomes one ASCII character.
3. **Brightness Mapping** — Per-pixel luminance (`0.299R + 0.587G + 0.114B`) is mapped to a character from the density ramp ` .:-=+*#%@`.
4. **Canvas Drawing** — Characters are drawn onto the visible display canvas using `fillText`. In truecolor mode, the video is composited through the text using `globalCompositeOperation`.
5. **Recording** — `captureStream(30)` on the display canvas feeds a `MediaRecorder` for video export.

---

## Color Palette System

Palettes are defined in `App.tsx` as a `PALETTES` array. Each entry has an `id` and a `hex` color (or `isGradient: true` for truecolor). The bottom toolbar lets users cycle through them, and the selected color is applied to `fillStyle` when drawing ASCII characters.

---

## Configuration

| Constant           | Location    | Default | Description                              |
| ------------------ | ----------- | ------- | ---------------------------------------- |
| `ASCII_CHARS`      | `App.tsx`   | ` .:-=+*#%@` | Character density ramp (light → dark)    |
| `gridSize.cols`    | `App.tsx`   | 80 / 120 / 160 | Column count by viewport breakpoint     |
| `charAspect`       | `App.tsx`   | `0.6`   | Monospace character width/height ratio   |
| FPS cap            | `App.tsx`   | 30      | `1000 / 30` ms throttle in `processFrame` |
| Zoom range         | `App.tsx`   | 1–5     | Min/max digital zoom                     |

---

## License

See [LICENSE](LICENSE) for details.
