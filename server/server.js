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
const DATA_FILE = path.join(__dirname, 'data', 'levels.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Helper function to read levels safely
function readLevels() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading levels file:', err);
    return [];
  }
}

// Helper function to write levels safely
function saveLevels(levels) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(levels, null, 2), 'utf8');
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
  const { name, author, diff, speed, cols, rows, grid, gearsTotal } = req.body;

  if (!name || !grid || !Array.isArray(grid) || grid.length !== 12) {
    return res.status(400).json({ error: 'Invalid level format. Grid must be an array of 12 string rows.' });
  }

  const levels = readLevels();
  const newLevel = {
    id: `srv-lvl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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

  levels.unshift(newLevel);
  if (saveLevels(levels)) {
    res.status(201).json(newLevel);
  } else {
    res.status(500).json({ error: 'Failed to persist level to database' });
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
