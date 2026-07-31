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
│   ├── constants/              # Level definitions and constants
│   ├── utils/                  # Single-file HTML exporter and grid helpers
│   ├── App.tsx                 # Main application view container
│   ├── index.css               # Retro window, button, and layout styles
│   └── main.tsx                # React application entry point
├── server/                     # Standalone Level Hosting Server (Node.js + Express)
│   ├── data/                   # JSON file store for community levels
│   ├── package.json            # Server package dependencies
│   ├── README.md               # Server documentation
│   └── server.js               # Express REST API server entry point
├── index.html                  # Main HTML document
├── metadata.json               # Platform applet metadata
└── package.json                # Frontend package configuration
```

---

## 🚀 Getting Started (Game Frontend)

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **yarn**

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:3000` to play the game.

### 3. Build for Production

```bash
npm run build
```

The production output will be generated in the `dist/` folder.

---

## 🌐 Setting Up Your Own Level Server

The `/server` directory contains a self-contained, standalone Node.js / Express backend server designed to host and serve community levels.

### 1. Navigate to the Server Folder

```bash
cd server
```

### 2. Install Server Dependencies

```bash
npm install
```

### 3. Start the Level Server

```bash
npm start
```

For development mode with automatic restart on code changes:

```bash
npm run dev
```

By default, the server will start listening on `http://localhost:3001`.

---

### 📡 Server REST API Reference

The level server exposes the following JSON endpoints:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Checks server health and status. |
| `GET` | `/api/levels` | Fetches an array of all hosted community levels. |
| `GET` | `/api/levels/:id` | Fetches details for a single level by ID. |
| `POST` | `/api/levels` | Publishes a new community level. |
| `DELETE` | `/api/levels/:id` | Deletes a level by ID. |

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

You can host the standalone level server on any cloud platform:

#### Option A: Docker / Cloud Run

You can deploy `server/server.js` using Docker or Google Cloud Run by pointing to the `/server` directory and binding to `$PORT`.

#### Option B: Render / Railway / Vercel

1. Create a new Web Service pointing to your GitHub repository.
2. Set the **Root Directory** to `server`.
3. Set the **Build Command** to `npm install`.
4. Set the **Start Command** to `npm start`.
5. Environment Variables: Set `PORT` (defaults to `3001` if unset).

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
- `q` : Ship Mode OFF Portal
- `*` : Collectible Gear
- `e` : Finish Line

---

## 📜 License

Apache-2.0 License.
