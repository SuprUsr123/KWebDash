/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Standalone Community Level Server for Cube Dash
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Dual file paths for unified persistence whether hosted standalone or within full-stack app
const SERVER_DATA_FILE = path.join(__dirname, 'data', 'levels.json');
const ROOT_DATA_FILE = path.join(__dirname, '..', 'data', 'levels.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Robust blacklist filter to ensure unwanted legacy demo levels are never present
function isBannedLegacyLevel(level) {
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

// Helper function to read levels safely from both primary and root data files
function readLevels() {
  const map = new Map();

  // Try reading from server/data/levels.json
  try {
    if (fs.existsSync(SERVER_DATA_FILE)) {
      const raw = fs.readFileSync(SERVER_DATA_FILE, 'utf8');
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
    console.error('Error reading server data file:', err);
  }

  // Try reading and merging from root data/levels.json if available
  try {
    if (fs.existsSync(ROOT_DATA_FILE)) {
      const raw = fs.readFileSync(ROOT_DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(l => {
          if (l && l.id && !isBannedLegacyLevel(l) && !map.has(l.id)) {
            map.set(l.id, l);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error reading root data file:', err);
  }

  return Array.from(map.values());
}

// Helper function to write levels safely to both data locations
function saveLevels(levels) {
  try {
    const clean = Array.isArray(levels) ? levels.filter(l => !isBannedLegacyLevel(l)) : [];
    const jsonStr = JSON.stringify(clean, null, 2);

    // Save to server/data/levels.json
    fs.mkdirSync(path.dirname(SERVER_DATA_FILE), { recursive: true });
    fs.writeFileSync(SERVER_DATA_FILE, jsonStr, 'utf8');

    // Also persist to root data/levels.json so nothing is lost across restarts or publishing
    try {
      fs.mkdirSync(path.dirname(ROOT_DATA_FILE), { recursive: true });
      fs.writeFileSync(ROOT_DATA_FILE, jsonStr, 'utf8');
    } catch {
      // Ignore if root directory is not accessible in standalone container
    }

    return true;
  } catch (err) {
    console.error('Error writing levels file:', err);
    return false;
  }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Cube Dash Community Level Server', timestamp: new Date().toISOString() });
});

// GET /api/levels - Fetch all community levels
app.get('/api/levels', (req, res) => {
  const levels = readLevels();
  res.json(levels);
});

// GET /api/levels/:id - Fetch single level by ID
app.get('/api/levels/:id', (req, res) => {
  const levels = readLevels();
  const level = levels.find(l => l.id === req.params.id);
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }
  res.json(level);
});

// POST /api/levels - Submit a new community level
app.post('/api/levels', (req, res) => {
  const { name, author, diff, speed, cols, rows, grid, gearsTotal, id: requestedId } = req.body;

  if (!name || !grid || !Array.isArray(grid) || grid.length !== 12) {
    return res.status(400).json({ error: 'Invalid level format. Grid must be an array of 12 string rows.' });
  }

  // Reject banned legacy levels
  if (isBannedLegacyLevel({ name, id: requestedId })) {
    return res.status(400).json({ error: 'Legacy demo level name/ID is not allowed.' });
  }

  const levels = readLevels();
  const levelId = requestedId && !requestedId.startsWith('custom-')
    ? requestedId
    : `srv-lvl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  const existingIdx = levels.findIndex(l => l.id === levelId || (l.name === name.toString().slice(0, 50) && l.author === (author || 'Anonymous').toString().slice(0, 30)));

  const newLevel = {
    id: existingIdx >= 0 ? levels[existingIdx].id : levelId,
    name: name.toString().slice(0, 50),
    author: (author || 'Anonymous').toString().slice(0, 30),
    diff: typeof diff === 'number' ? Math.max(0, Math.min(3, diff)) : 0,
    speed: typeof speed === 'number' ? Math.max(3, Math.min(10, speed)) : 5.5,
    cols: typeof cols === 'number' ? cols : (grid[0] ? grid[0].length : 60),
    rows: 12,
    grid,
    gearsTotal: gearsTotal || 0,
    isCommunity: true,
    createdAt: Date.now()
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

// POST /api/levels/sync - Bidirectional sync endpoint: restores and merges levels so nothing gets lost
app.post('/api/levels/sync', (req, res) => {
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Expected an array of levels to sync' });
  }

  const current = readLevels();
  const map = new Map();

  // Load existing server levels
  current.forEach(l => {
    if (!isBannedLegacyLevel(l)) map.set(l.id, l);
  });

  // Merge incoming client levels (never overwriting unless updated, keeping all)
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

// DELETE /api/levels/:id - Delete a level
app.delete('/api/levels/:id', (req, res) => {
  const levels = readLevels();
  const filtered = levels.filter(l => l.id !== req.params.id);
  
  if (filtered.length === levels.length) {
    return res.status(404).json({ error: 'Level not found' });
  }

  if (saveLevels(filtered)) {
    res.json({ success: true, deletedId: req.params.id });
  } else {
    res.status(500).json({ error: 'Failed to update database' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cube Dash Level Hosting Server running on http://0.0.0.0:${PORT}`);
});
