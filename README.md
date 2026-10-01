# ⏹️ Cube Dash

An ultra-compact, retro-styled rhythm platformer and level creation engine built for modern web browsers and low-refresh E-Ink devices (such as Kindle Paperwhite).

---

## 📖 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started (Game Frontend)](#getting-started-game-frontend)
- [Setting Up Your Own Level Server](#setting-up-your-own-level-server)
  - [Server REST API Reference](#server-rest-api-reference)
  - [Connecting the Game to Your Server](#connecting-the-game-to-your-server)
  - [Deploying the Backend Server](#deploying-the-backend-server)
- [Adding Official Levels](#-adding-official-levels)
- [Level Data Specification](#level-data-specification)
- [License](#license)

---

## ✨ Features

- **Retro Aesthetic**: Minimalist high-contrast monochrome design inspired by classic classic System 7 and E-Ink UI styling.
- **Dynamic Physics & Mechanics**: Jump over spikes, balance on platforms, fly gravity ships, use speed portals, gravity flippers, and jump pads.
- **Built-in Level Editor**: Design custom 12-row levels directly in your browser with paint tools, checkpoint testing, and gear placement.
- **Single-File HTML Exporter**: Export custom levels into a zero-dependency, self-contained single HTML file playable on any browser or Kindle device.
- **Community Level Repository**: Connect to any custom API server endpoint to fetch, share, and play levels published by players worldwide.

---

## 📁 Project Structure

```text
├── src/                        # Game Frontend Source (React + Vite + TypeScript)
│   ├── components/             # React UI components (Canvas, Editor, Repository, etc.)
│   ├── constants/              # Official levels and level definitions
│   ├── utils/                  # Single-file HTML exporter and grid helpers
│   ├── App.tsx                 # Main application view container
│   ├── index.css               # Retro window, button, and layout styles
│   └── main.tsx                # React application entry point
├── server.ts                   # Unified Full-Stack Server (Express + Vite middlewares / static)
├── data/                       # Persistent JSON store for community levels
│   └── levels.json             # Community levels database
├── index.html                  # Main HTML document & SEO metadata
├── metadata.json               # Platform applet metadata
└── package.json                # Unified full-stack dependencies & deployment scripts
```

---

## 🚀 Unified Full-Stack Architecture

Cube Dash is configured as a **single unified full-stack application**: both the Express backend REST API and the React frontend client run together inside the same deployment container!

### How Publishing Works
When you press **Publish** in Google AI Studio:
1. AI Studio executes `npm run build`, which compiles the Vite client into the `dist/` directory.
2. AI Studio launches the container using `npm start` (`node server.ts`).
3. `server.ts` acts as the unified host:
   - Serves all community level API routes (`/api/levels`, `/api/health`, etc.)
   - Serves the static client bundles from `dist/`
   - Automatically falls back to `dist/index.html` for single-page routing
   - Persists community levels to `data/levels.json`

Both the client and the server are deployed simultaneously with zero extra infrastructure or separate hosting required!

---

## 💻 Local Development

### 1. Run Development Server

```bash
npm run dev
```

This boots `server.ts` via `tsx` on port 3000, mounting Vite's development middlewares for instant hot module reloading (HMR) while also actively serving the `/api/levels` REST endpoints.

### 2. Build for Production

```bash
npm run build
```

The production assets will be generated in `dist/`.

### 3. Run Production Server Locally

```bash
npm start
```

---

## 🌐 Community Level Server & REST API Reference

The backend exposes the following JSON endpoints on the same origin (no CORS configuration needed):

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Checks server health and status. |
| `GET` | `/api/levels` | Fetches an array of all hosted community levels. |
| `GET` | `/api/levels/:id` | Fetches details for a single level by ID. |
| `POST` | `/api/levels` | Publishes a new community level to the server. |
| `DELETE` | `/api/levels/:id` | Deletes a community level by ID. |

#### Example POST Request Body (`/api/levels`)

```json
{
  "name": "Orbital Hazard",
  "author": "PlayerOne",
  "diff": 2,
  "speed": 6.5,
  "cols": 60,
  "rows": 12,
  "gearsTotal": 3,
  "grid": [
    "............................................................",
    "............................................................",
    "............................................................",
    "............................................................",
    "............................................................",
    "............................................................",
    "............................................................",
    "............................................................",
    "............................................................",
    "....b....b....b.............................................",
    "....s....s....s.............................................",
    "............................................................"
  ]
}
```

---

### 🔗 Connecting the Game to Your Server

1. Launch the **Cube Dash** web client.
2. Click on the **COMMUNITY** tab in the navigation bar.
3. In the **SERVER ENDPOINT** input field, enter your server's level API URL:
   - For local development: `http://localhost:3001/api/levels`
   - For production: `https://your-server-domain.com/api/levels`
4. Click **SYNC SERVER**. The game will fetch all levels hosted on your backend.

---

### ☁️ Deploying the Backend Server

You can host the standalone level server on any cloud platform, or run it directly via GitHub Actions:

#### Option A: GitHub Actions Trigger (Automated & Manual Hosting)

This repository includes a dedicated GitHub Actions workflow (`.github/workflows/host-server.yml`) that can automatically validate and host the server directly in GitHub:

1. In your GitHub repository, go to the **Actions** tab.
2. Select the **Host Level Server** workflow.
3. Click **Run workflow** (via `workflow_dispatch`).
4. Select your options:
   - **Server Port**: `3001` (or custom)
   - **Server Type**: `standalone` (`server/server.js`) or `fullstack` (`server.ts`)
   - **Duration**: Duration to keep the server hosted and monitored on the runner (default: 30 minutes)
5. The workflow installs all dependencies, automatically purges any legacy demo levels, starts the Express server, runs health checks against `/api/health` and `/api/levels`, and reports ready status!

#### Option B: Docker / Cloud Run

You can deploy `server/server.js` using Docker or Google Cloud Run by pointing to the `/server` directory and binding to `$PORT`.

#### Option C: Render / Railway / Vercel

1. Create a new Web Service pointing to your GitHub repository.
2. Set the **Root Directory** to `server`.
3. Set the **Build Command** to `npm install`.
4. Set the **Start Command** to `npm start`.
5. Environment Variables: Set `PORT` (defaults to `3001` if unset).

---

## 🛠️ Adding Official Levels

Official levels are statically compiled into the game source code and are available to all players under the main **SELECT LEVEL** screen.

### Method 1: Using the In-Game Editor (Recommended)

1. Open **Cube Dash** and navigate to the **EDITOR** tab.
2. Paint your level layout using the tile palette (Spikes, Platforms, Portals, Coins, Finish Line).
3. Click **EXPORT JSON** in the editor top toolbar. This automatically validates your level and copies the `LevelData` JSON object to your clipboard.
4. Open `src/constants/levels.ts` in your code editor.
5. Paste the copied object into the `OFFICIAL_LEVELS` array.
6. Save the file. The new level will automatically appear on the level select menu!

### Method 2: Manual Code Entry

Open `src/constants/levels.ts` and add a new entry to the `OFFICIAL_LEVELS` array:

```typescript
export const OFFICIAL_LEVELS: LevelData[] = [
  // ... existing levels
  {
    id: 'official-4',
    name: 'Aero Rush',
    diff: 1,           // 0 = Easy, 1 = Normal, 2 = Hard, 3 = Brutal
    speed: 5.5,        // Scroll speed
    cols: 60,          // Column count (40 - 200)
    rows: 12,          // Always 12
    gearsTotal: 3,     // Total coins placed (max 3 per level)
    grid: [
      "............................................................",
      "............................................................",
      "............................................................",
      "............................................................",
      "............................................................",
      "............................................................",
      "............................................................",
      "............................................................",
      "............................................................",
      "....b....B....B.............................................",
      "....s....s....s.............................................",
      "............................................................"
    ]
  }
];
```

---

## 📄 Level Data Specification

Levels are represented in JSON format with a 12-row ASCII grid string array:

```typescript
export interface LevelData {
  id: string;
  name: string;
  diff: number;      // 0 = EASY, 1 = NORMAL, 2 = HARD, 3 = BRUTAL
  speed: number;     // Movement speed (default 5.5)
  cols: number;      // Grid length in columns (min 40, max 200)
  rows: number;      // Always 12
  grid: string[];    // Array of 12 strings, each representing 1 row
  gearsTotal?: number;
  author?: string;
  isCommunity?: boolean;
}
```

### Grid Characters Key

- `.` : Empty Space
- `s` : Floor Spike
- `d` : Double Spike
- `3` : Triple Spike
- `b` : Brick Block (36x36)
- `h` : High Pillar (36x72)
- `S` : Spike-headed Block
- `c` : Ceiling Spike
- `P` : Floor Pillar
- `U` : Hanging Pillar
- `B` : Floating Platform
- `p` : Jump Pad
- `r` : Jump Ring
- `g` : Gravity Flip UP Portal
- `n` : Gravity Flip DOWN Portal
- `f` : Fast Speed Portal (1.3x)
- `o` : Normal Speed Portal (1.0x)
- `w` : Ship Mode ON Portal
- `q` : Cube Mode Portal
- `a` : Ball Mode Portal (tap to flip gravity when grounded)
- `u` : UFO Mode Portal (mid-air flap jumps)
- `v` : Wave Mode Portal (diagonal dart flight)
- `k` : Robot Mode Portal (grounded jump, hold to boost significantly higher)
- `y` : Swing Mode Portal (mid-air tap toggles gravity)
- `x` : Spinning Saw Blade
- `1` : Speed 0.5x Portal (0.8x)
- `2` : Speed 1.0x Portal (1.0x)
- `3` : Speed 2.0x Portal (1.3x)
- `4` : Speed 3.0x Portal (1.6x)
- `*` : Collectible Coin
- `e` : Finish Line (Full-height checkered goal line)

---

## 🎮 Geometry Dash .GMD File Import (PC Only)

Cube Dash includes a `.GMD` (Geometry Dash Level file) importer that allows PC players to import custom Geometry Dash levels directly into Cube Dash!

- **Platform-Restricted**: Per performance and device requirements, `.GMD` import is exclusively active when a PC / Desktop browser environment is detected.
- **Dynamic Vertical Camera**: Smoothly tracks the player's Y position as they fly high or jump over towering structures.
- **Supported Formats**:
  - GDShare / MegaHack XML Plists (`.gmd`, `.plist`, `.xml`) with Base64 GZIP / ZLIB `k4` compressed level strings.
  - Geometry Dash JSON level exports (`.gmd`, `.json`).
  - Raw uncompressed or base64 Geometry Dash level object strings (`kS38,...`).
- **Object Translation**: Automatically converts Geometry Dash spikes, blocks, half-slabs, bounce pads, jump rings, gravity portals, vehicle portals (Cube, Ship, Ball, UFO, Wave, Robot, Swing), saws, speed triggers, and coins into Cube Dash's physical grid engine.
- **Access Points**:
  - **Community Repository**: Click `IMPORT .GMD (PC)` or use the `BROWSE .GMD` button in the import box.
  - **Level Editor**: Click `Import .GMD (PC)` to load a GD level directly into the editor for tuning and playtesting.

---

## 📜 License

Apache-2.0 License.
