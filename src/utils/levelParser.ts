/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelData, Obstacle, TILE_SIZE, FLOOR_Y, CEIL_Y, ROWS } from '../types';

/**
 * Parses raw 1D level string into a 12-row grid matrix
 */
export function rawStringToGrid(raw: string): string[] {
  const chars = raw.split('');
  const cols = chars.length + 10;
  const grid: string[][] = Array.from({ length: ROWS }, () => Array(cols).fill('.'));

  // Fill finish line at the end
  const finishCol = cols - 2;
  for (let r = 2; r < 10; r++) {
    grid[r][finishCol] = 'e';
  }

  // Parse each character into the 12-row layout
  for (let c = 0; c < chars.length; c++) {
    const ch = chars[c];
    if (ch === '.') continue;

    const col = c + 5; // offset start
    if (col >= cols) break;

    switch (ch) {
      case 's':
        grid[9][col] = 's'; // Floor spike
        break;
      case 'd':
        grid[9][col] = 's';
        if (col + 1 < cols) grid[9][col + 1] = 's';
        break;
      case '3':
        grid[9][col] = 's';
        if (col + 1 < cols) grid[9][col + 1] = 's';
        if (col + 2 < cols) grid[9][col + 2] = 's';
        break;
      case 'b':
        grid[9][col] = 'b'; // Single block on floor
        break;
      case 'h':
        grid[9][col] = 'b'; // 2-high block
        grid[8][col] = 'b';
        break;
      case 'S':
        grid[9][col] = 'b'; // Block with spike on top
        grid[8][col] = 's';
        break;
      case 'c':
        grid[2][col] = 'c'; // Ceiling spike
        break;
      case 'P':
        for (let r = 6; r <= 9; r++) grid[r][col] = 'b'; // Pillar
        break;
      case 'U':
        for (let r = 2; r <= 5; r++) grid[r][col] = 'b'; // Hangpillar
        break;
      case 'B':
        grid[6][col] = 'B'; // Floating platform
        break;
      case 'p':
        grid[9][col] = 'p'; // Bounce pad
        break;
      case 'r':
        grid[5][col] = 'r'; // Air ring
        break;
      case 'g':
        for (let r = 2; r <= 9; r++) grid[r][col] = 'g'; // Gravity portal
        break;
      case 'n':
        for (let r = 2; r <= 9; r++) grid[r][col] = 'n'; // Grav down portal
        break;
      case 'f':
      case 'o':
        // Speed portals
        break;
      case 'w':
        for (let r = 2; r <= 9; r++) grid[r][col] = 'w'; // Ship portal
        break;
      case 'q':
        for (let r = 2; r <= 9; r++) grid[r][col] = 'q'; // Cube portal
        break;
      case '*':
        grid[5][col] = '*'; // Gear star
        break;
      case 'e':
        for (let r = 2; r <= 9; r++) grid[r][col] = 'e';
        break;
      default:
        break;
    }
  }

  return grid.map(row => row.join(''));
}

/**
 * Converts a level definition (Grid or Raw) into active physical obstacles for the engine.
 */
export function parseLevelToObstacles(level: LevelData): { obstacles: Obstacle[]; finishX: number; gearTotal: number } {
  const obstacles: Obstacle[] = [];
  let finishX = 8000;
  let gearTotal = 0;

  // If level has grid data, parse 2D grid matrix
  if (level.grid && level.grid.length > 0) {
    const rows = level.grid.length;
    for (let r = 0; r < rows; r++) {
      const rowStr = level.grid[r];
      for (let c = 0; c < rowStr.length; c++) {
        const ch = rowStr[c];
        if (ch === '.') continue;

        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        switch (ch) {
          case 's':
            obstacles.push({ type: 'spike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'c':
            obstacles.push({ type: 'ceilspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'b':
            obstacles.push({ type: 'block', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'B':
            obstacles.push({ type: 'platform', x, top: y, w: TILE_SIZE, h: Math.round(TILE_SIZE / 2) });
            break;
          case 'p':
            obstacles.push({ type: 'pad', x, top: y + TILE_SIZE - 8, w: TILE_SIZE, h: 8 });
            break;
          case 'r':
            obstacles.push({ type: 'ring', x, top: y, w: TILE_SIZE, h: TILE_SIZE, inZone: false, used: false });
            break;
          case 'g':
            obstacles.push({ type: 'gravup', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'n':
            obstacles.push({ type: 'gravdown', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'w':
            obstacles.push({ type: 'shipon', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'q':
            obstacles.push({ type: 'shipoff', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case '*':
            obstacles.push({
              type: 'gear',
              x,
              top: y,
              w: TILE_SIZE,
              h: TILE_SIZE,
              gearIndex: gearTotal,
              taken: false
            });
            gearTotal++;
            break;
          case 'e':
            obstacles.push({ type: 'end', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            if (x < finishX || finishX === 8000) finishX = x;
            break;
          default:
            break;
        }
      }
    }
    if (finishX === 8000) {
      finishX = (level.cols || 60) * TILE_SIZE - 40;
    }
    return { obstacles, finishX, gearTotal };
  }

  // Fallback parsing for legacy 1D raw string
  if (level.raw) {
    const chars = level.raw.split('');
    const STEP = 130;
    const START_X = 520;
    const SPIKE_W = 30;

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const x = START_X + i * STEP;
      if (c === '.') continue;

      if (c === 's') obstacles.push({ type: 'spike', x, top: FLOOR_Y - SPIKE_W, w: SPIKE_W, h: SPIKE_W });
      else if (c === 'd') obstacles.push({ type: 'double', x, top: FLOOR_Y - SPIKE_W, w: SPIKE_W * 2, h: SPIKE_W });
      else if (c === '3') obstacles.push({ type: 'triple', x, top: FLOOR_Y - SPIKE_W, w: SPIKE_W * 3, h: SPIKE_W });
      else if (c === 'b') obstacles.push({ type: 'block', x, top: FLOOR_Y - 36, w: 36, h: 36 });
      else if (c === 'h') obstacles.push({ type: 'block', x, top: FLOOR_Y - 72, w: 36, h: 72 });
      else if (c === 'S') obstacles.push({ type: 'spikeblock', x, top: FLOOR_Y - 66, w: 36, h: 66 });
      else if (c === 'c') obstacles.push({ type: 'ceilspike', x, top: CEIL_Y, w: SPIKE_W, h: SPIKE_W });
      else if (c === 'P') obstacles.push({ type: 'pillar', x, top: FLOOR_Y - 88, w: 36, h: 88 });
      else if (c === 'U') obstacles.push({ type: 'hangpillar', x, top: CEIL_Y, w: 36, h: 88 });
      else if (c === 'B') obstacles.push({ type: 'platform', x, top: FLOOR_Y - 92, w: 36, h: 36 });
      else if (c === 'p') obstacles.push({ type: 'pad', x, top: FLOOR_Y - 8, w: 30, h: 8 });
      else if (c === 'r') obstacles.push({ type: 'ring', x: x + 3, top: FLOOR_Y - 110, w: 24, h: 24, inZone: false, used: false });
      else if (c === 'g') obstacles.push({ type: 'gravup', x, top: CEIL_Y, w: 26, h: FLOOR_Y - CEIL_Y });
      else if (c === 'n') obstacles.push({ type: 'gravdown', x, top: CEIL_Y, w: 26, h: FLOOR_Y - CEIL_Y });
      else if (c === 'f') obstacles.push({ type: 'speed2', x, top: CEIL_Y, w: 26, h: FLOOR_Y - CEIL_Y });
      else if (c === 'o') obstacles.push({ type: 'speed1', x, top: CEIL_Y, w: 26, h: FLOOR_Y - CEIL_Y });
      else if (c === 'w') obstacles.push({ type: 'shipon', x, top: CEIL_Y, w: 26, h: FLOOR_Y - CEIL_Y });
      else if (c === 'q') obstacles.push({ type: 'shipoff', x, top: CEIL_Y, w: 26, h: FLOOR_Y - CEIL_Y });
      else if (c === '*') {
        obstacles.push({ type: 'gear', x: x - 60, top: 76, w: 70, h: 110, gearIndex: gearTotal, taken: false });
        gearTotal++;
      } else if (c === 'e') {
        obstacles.push({ type: 'end', x, top: CEIL_Y, w: 40, h: FLOOR_Y - CEIL_Y });
        finishX = x;
      }
    }
  }

  return { obstacles, finishX, gearTotal };
}
