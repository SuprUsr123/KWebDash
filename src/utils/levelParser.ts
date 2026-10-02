/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelData, Obstacle, TILE_SIZE, FLOOR_Y, CEIL_Y, ROWS, GameMode, SPEED_05X, SPEED_1X, SPEED_2X, SPEED_3X } from '../types';

export interface StartPosInfo {
  x: number;
  y: number;
  col: number;
  row: number;
  mode: GameMode;
  speedScale: number;
  grav: number;
  zoom?: number;
}

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
export function parseLevelToObstacles(level: LevelData): {
  obstacles: Obstacle[];
  finishX: number;
  gearTotal: number;
  startPos?: StartPosInfo | null;
} {
  const obstacles: Obstacle[] = [];
  let finishX = 8000;
  let gearTotal = 0;
  let startPos: StartPosInfo | null = null;

  // If level has grid data, parse 2D grid matrix
  if (level.grid && level.grid.length > 0) {
    const rows = level.grid.length;
    const cols = level.grid[0]?.length || 0;
    const floorRow = level.floorRow ?? (rows > 12 ? rows - 3 : 9);

    for (let r = 0; r < rows; r++) {
      const rowStr = level.grid[r];
      for (let c = 0; c < rowStr.length; c++) {
        const ch = rowStr[c];
        if (ch === '.') continue;

        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        switch (ch) {
          case 'S':
            // StartPos spawn marker
            obstacles.push({ type: 'startpos', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 's': {
            // Auto-detect wall orientation or ceiling placement if spike is floating against a block
            const rightChar = c < rowStr.length - 1 ? rowStr[c + 1] : '.';
            const leftChar = c > 0 ? rowStr[c - 1] : '.';
            const bottomChar = r < rows - 1 ? level.grid[r + 1][c] : '.';
            const topChar = r > 0 ? level.grid[r - 1][c] : '.';

            const isSolidRight = (rightChar === 'b' || rightChar === 'f' || rightChar === 'B');
            const isSolidLeft = (leftChar === 'b' || leftChar === 'f' || leftChar === 'B');
            const isSolidBottom = (bottomChar === 'b' || bottomChar === 'B');

            if (!isSolidBottom && isSolidRight && (r < floorRow || bottomChar === 's' || bottomChar === 'h' || bottomChar === '<')) {
              obstacles.push({ type: 'leftspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            } else if (!isSolidBottom && isSolidLeft && (r < floorRow || bottomChar === 's' || bottomChar === 'h' || bottomChar === '>')) {
              obstacles.push({ type: 'rightspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            } else if (r <= 2 && !isSolidBottom) {
              obstacles.push({ type: 'ceilspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            } else {
              obstacles.push({ type: 'spike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            }
            break;
          }
          case '<':
            obstacles.push({ type: 'leftspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case '>':
            obstacles.push({ type: 'rightspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'D':
            // Decorative Floor Spike (non-lethal / no hitbox, authentic visual decoration)
            obstacles.push({ type: 'decospike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'h': {
            // Half spike: detect if attached to left wall, right wall, ceiling, or floor
            const rightChar = c < rowStr.length - 1 ? rowStr[c + 1] : '.';
            const leftChar = c > 0 ? rowStr[c - 1] : '.';
            const bottomChar = r < rows - 1 ? level.grid[r + 1][c] : '.';

            const isSolidRight = (rightChar === 'b' || rightChar === 'f' || rightChar === 'B');
            const isSolidLeft = (leftChar === 'b' || leftChar === 'f' || leftChar === 'B');
            const isSolidBottom = (bottomChar === 'b' || bottomChar === 'B');

            if (!isSolidBottom && isSolidRight && (r < floorRow || bottomChar === 's' || bottomChar === 'h' || bottomChar === '<')) {
              obstacles.push({ type: 'leftspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            } else if (!isSolidBottom && isSolidLeft && (r < floorRow || bottomChar === 's' || bottomChar === 'h' || bottomChar === '>')) {
              obstacles.push({ type: 'rightspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            } else if (r <= 2 && !isSolidBottom) {
              obstacles.push({
                type: 'ceilhalfspike',
                x,
                top: y,
                w: TILE_SIZE,
                h: Math.round(TILE_SIZE / 2)
              });
            } else {
              obstacles.push({
                type: 'halfspike',
                x,
                top: y + Math.round(TILE_SIZE / 2),
                w: TILE_SIZE,
                h: Math.round(TILE_SIZE / 2)
              });
            }
            break;
          }
          case 'c':
            obstacles.push({ type: 'ceilspike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'd':
            // Decorative Ceiling Spike (non-lethal / no hitbox)
            obstacles.push({ type: 'ceildecospike', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'H':
            // Half spike on the ceiling (occupies the upper half of the cell)
            obstacles.push({
              type: 'ceilhalfspike',
              x,
              top: y,
              w: TILE_SIZE,
              h: Math.round(TILE_SIZE / 2)
            });
            break;
          case 'b':
            obstacles.push({ type: 'block', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'f':
            // Passable wall / Fake block (non-solid, player walks/jumps right through to secret coins)
            obstacles.push({ type: 'fakeblock', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
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
          case 'a':
            obstacles.push({ type: 'ballon', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'u':
            obstacles.push({ type: 'ufoon', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'v':
            obstacles.push({ type: 'waveon', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'k':
            obstacles.push({ type: 'roboton', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'y':
            obstacles.push({ type: 'swingon', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'x':
            obstacles.push({ type: 'saw', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case '1':
            obstacles.push({ type: 'speed05', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case '2':
            obstacles.push({ type: 'speed1', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case '3':
            obstacles.push({ type: 'speed2', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case '4':
            obstacles.push({ type: 'speed3', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'Z':
            // Camera Zoom In Trigger (1.4x)
            obstacles.push({ type: 'zoomin', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case 'z':
            // Camera Zoom Out Trigger (0.7x)
            obstacles.push({ type: 'zoomout', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
            break;
          case '0':
            // Camera Zoom Reset Trigger (1.0x Normal)
            obstacles.push({ type: 'zoomreset', x, top: y, w: TILE_SIZE, h: TILE_SIZE });
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
            // One object = one line that finishes the level when touched
            if (!obstacles.some(o => o.type === 'end' && o.x === x)) {
              obstacles.push({ type: 'end', x, top: 0, w: TILE_SIZE, h: rows * TILE_SIZE });
            }
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

    // Resolve active StartPos (if any 'S' tile was placed)
    // Find the rightmost / latest StartPos to spawn at
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (level.grid[r][c] === 'S') {
          // Pre-scan all speed, mode, gravity, and zoom triggers preceding this StartPos
          let mode: GameMode = 'cube';
          let speedScale = SPEED_1X;
          let grav = 1;
          let zoom = 1.0;
          for (let sc = 0; sc <= c; sc++) {
            for (let sr = 0; sr < rows; sr++) {
              const pch = level.grid[sr][sc];
              if (pch === 'w') mode = 'ship';
              else if (pch === 'q') mode = 'cube';
              else if (pch === 'a') mode = 'ball';
              else if (pch === 'u') mode = 'ufo';
              else if (pch === 'v') mode = 'wave';
              else if (pch === 'k') mode = 'robot';
              else if (pch === 'y') mode = 'swing';
              else if (pch === '1') speedScale = SPEED_05X;
              else if (pch === '2') speedScale = SPEED_1X;
              else if (pch === '3') speedScale = SPEED_2X;
              else if (pch === '4') speedScale = SPEED_3X;
              else if (pch === 'g') grav = -1;
              else if (pch === 'n') grav = 1;
              else if (pch === 'Z') zoom = 1.35;
              else if (pch === 'z') zoom = 0.72;
              else if (pch === '0') zoom = 1.0;
            }
          }
          startPos = {
            x: c * TILE_SIZE,
            y: r * TILE_SIZE,
            col: c,
            row: r,
            mode,
            speedScale,
            grav,
            zoom
          };
        }
      }
    }

    return { obstacles, finishX, gearTotal, startPos };
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
