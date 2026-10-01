/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Unified Full-Stack Server for Cube Dash
 * Hosts REST API endpoints for community level sharing (/api/*)
 * and serves the React frontend (Vite middlewares in dev, static dist in production).
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Community levels data store path
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'levels.json');
const LEGACY_DATA_FILE = path.join(__dirname, 'server', 'data', 'levels.json');

// Blacklist filter to ensure unwanted legacy demo levels are never present
function isBannedLegacyLevel(level: any): boolean {
  if (!level) return true;
  const id = String(level.id || '').toLowerCase().trim();
  const name = String(level.name || '').toUpperCase().trim();
  return (
    id === 'srv-lvl-neon-ascent' ||
    id === 'srv-lvl-aero-pulse' ||
    id === 'custom-1' ||
    id === 'custom-2' ||
    id === 'custom-3' ||
    id.includes('neon-ascent') ||
    id.includes('aero-pulse') ||
    name === 'NEON ASCENT' ||
    name === 'AERO PULSE' ||
    name.includes('NEON ASCENT') ||
    name.includes('AERO PULSE')
  );
}

function readLevels(): any[] {
  const map = new Map<string, any>();

  // Read from primary DATA_FILE
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(l => {
          if (l && l.id && !isBannedLegacyLevel(l)) {
            map.set(l.id, l);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error reading primary levels file:', err);
  }

  // Also check and merge from LEGACY_DATA_FILE if exists so nothing is lost
  try {
    if (fs.existsSync(LEGACY_DATA_FILE)) {
      const rawLegacy = fs.readFileSync(LEGACY_DATA_FILE, 'utf8');
      const parsedLegacy = JSON.parse(rawLegacy);
      if (Array.isArray(parsedLegacy)) {
        parsedLegacy.forEach(l => {
          if (l && l.id && !isBannedLegacyLevel(l) && !map.has(l.id)) {
            map.set(l.id, l);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error reading legacy levels file:', err);
  }

  return Array.from(map.values());
}

function saveLevels(levels: any[]): boolean {
  try {
    const clean = Array.isArray(levels) ? levels.filter(l => !isBannedLegacyLevel(l)) : [];
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(clean, null, 2), 'utf8');
    // Also keep legacy file in sync if legacy directory exists
    try {
      if (fs.existsSync(path.dirname(LEGACY_DATA_FILE))) {
        fs.writeFileSync(LEGACY_DATA_FILE, JSON.stringify(clean, null, 2), 'utf8');
      }
    } catch {
      // Ignore legacy sync error
    }
    return true;
  } catch (err) {
    console.error('Error writing levels file:', err);
    return false;
  }
}

async function startServer() {
  const app = express();

  // CORS Middleware
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // REST API Routes
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Cube Dash Full-Stack Engine',
      environment: isProd ? 'production' : 'development',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/levels', (_req, res) => {
    const levels = readLevels();
    res.json(levels);
  });

  app.get('/api/levels/:id', (req, res) => {
    const levels = readLevels();
    const level = levels.find((l: any) => l.id === req.params.id);
    if (!level) {
      return res.status(404).json({ error: 'Level not found' });
    }
    res.json(level);
  });

  app.post('/api/levels', (req, res) => {
    const { name, author, diff, speed, cols, grid, gearsTotal, id: requestedId } = req.body;

    if (!name || !grid || !Array.isArray(grid) || grid.length !== 12) {
      return res.status(400).json({
        error: 'Invalid level format. Grid must be an array of 12 string rows.'
      });
    }

    if (isBannedLegacyLevel({ name, id: requestedId })) {
      return res.status(400).json({ error: 'Legacy demo level name/ID is not allowed.' });
    }

    const levels = readLevels();
    const cleanName = String(name).slice(0, 50).toUpperCase();
    const cleanAuthor = String(author || 'Anonymous').slice(0, 30);
    const levelId = requestedId && !requestedId.startsWith('custom-')
      ? requestedId
      : `srv-lvl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const existingIdx = levels.findIndex(
      (l: any) => l.id === levelId || (l.name === cleanName && l.author === cleanAuthor)
    );

    const newLevel = {
      id: existingIdx >= 0 ? levels[existingIdx].id : levelId,
      name: cleanName,
      author: cleanAuthor,
      diff: typeof diff === 'number' ? Math.max(0, Math.min(3, diff)) : 0,
      speed: typeof speed === 'number' ? Math.max(3, Math.min(10, speed)) : 6.0,
      cols: typeof cols === 'number' ? cols : (grid[0] ? grid[0].length : 60),
      rows: 12,
      grid,
      gearsTotal: typeof gearsTotal === 'number' ? gearsTotal : 0,
      isCommunity: true,
      createdAt: existingIdx >= 0 ? (levels[existingIdx].createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };

    if (existingIdx >= 0) {
      levels[existingIdx] = newLevel;
    } else {
      levels.unshift(newLevel);
    }

    if (saveLevels(levels)) {
      res.status(201).json(newLevel);
    } else {
      res.status(500).json({ error: 'Failed to persist level to database' });
    }
  });

  // Batch sync endpoint: restores/syncs levels across republishes or between client cache and server
  app.post('/api/levels/sync', (req, res) => {
    const incoming = req.body;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: 'Expected an array of levels to sync' });
    }

    const current = readLevels();
    const map = new Map<string, any>();
    // Existing levels
    current.forEach(l => {
      if (!isBannedLegacyLevel(l)) map.set(l.id, l);
    });
    // Incoming levels
    incoming.forEach(l => {
      if (l && l.id && l.grid && Array.isArray(l.grid) && l.grid.length === 12 && !isBannedLegacyLevel(l)) {
        if (!map.has(l.id)) {
          map.set(l.id, l);
        }
      }
    });

    const merged = Array.from(map.values());
    if (saveLevels(merged)) {
      res.json({ success: true, count: merged.length, levels: merged });
    } else {
      res.status(500).json({ error: 'Failed to persist synced levels' });
    }
  });

  app.delete('/api/levels/:id', (req, res) => {
    const levels = readLevels();
    const filtered = levels.filter((l: any) => l.id !== req.params.id);

    if (filtered.length === levels.length) {
      return res.status(404).json({ error: 'Level not found' });
    }

    if (saveLevels(filtered)) {
      res.json({ success: true, deletedId: req.params.id });
    } else {
      res.status(500).json({ error: 'Failed to update database' });
    }
  });

  // Client Frontend Serving
  const distPath = path.resolve(__dirname, 'dist');
  const indexHtmlPath = path.resolve(distPath, 'index.html');

  if (isProd && fs.existsSync(indexHtmlPath)) {
    // Production Mode: Serve compiled frontend from dist
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(indexHtmlPath);
    });
  } else {
    // Development Mode (or fallback if dist not built): Mount Vite dev middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Cube Dash Full-Stack] Server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
