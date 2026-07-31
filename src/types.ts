/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TileType {
  char: string;
  name: string;
  description: string;
  color: string;
}

export interface LevelData {
  id: string;
  name: string;
  author?: string;
  diff: number; // 0: Easy, 1: Normal, 2: Hard, 3: Brutal
  speed: number;
  cols: number;
  rows: number; // Default 12
  grid: string[]; // Array of 12 strings, each `cols` characters long
  raw?: string; // Legacy 1D string if imported
  gearsTotal?: number;
  isCommunity?: boolean;
  createdAt?: number;
}

export interface Obstacle {
  type: string; // 'spike' | 'ceilspike' | 'double' | 'triple' | 'block' | 'platform' | 'pillar' | 'hangpillar' | 'pad' | 'ring' | 'gravup' | 'gravdown' | 'speed1' | 'speed2' | 'shipon' | 'shipoff' | 'gear' | 'end';
  x: number;
  top: number;
  w: number;
  h: number;
  gearIndex?: number;
  taken?: boolean;
  inZone?: boolean;
  used?: boolean;
}

export interface Checkpoint {
  scrollX: number;
  playerY: number;
  playerVy: number;
  playerRotation: number;
  grav: number;
  speedScale: number;
  mode: 'cube' | 'ship';
  pct: number;
}

export interface SaveState {
  progress: Record<string, number>; // levelId -> percentage
  gears: Record<string, number>; // levelId -> bitmask
  customLevels: LevelData[];
}

export interface EInkConfig {
  enabled: boolean;
  fps: number; // e.g. 10, 15, 30, 60
  ghosting: number; // 0.0 to 0.85
  inputLagMs: number;
  flashInterval: number; // Flash every N frames
}

// Engine Constants
export const TILE_SIZE = 24;
export const CANVAS_W = 512;
export const CANVAS_H = 288;
export const ROWS = 12; // Math.floor(288 / 24)
export const FLOOR_Y = 10 * TILE_SIZE; // 240
export const CEIL_Y = 2 * TILE_SIZE; // 48
export const PLAYER_SIZE = 24;
export const PLAYER_X = 96;

export const TARGET_FPS = 60;
export const FIXED_TIMESTEP = 1000 / TARGET_FPS;
export const MAX_ACCUMULATOR = 100;

export const BASE_GRAVITY = 1.0;
export const TERMINAL_VELOCITY = 13;
export const JUMP_FORCE = -14;
export const COYOTE_TIME_MAX = 6;
export const JUMP_BUFFER_MAX = 7;

export const SHIP_H = 20;
export const SHIP_RISE = -0.85;
export const SHIP_FALL = 0.65;
export const SHIP_TERMINAL = 6.5;

export const TILE_TYPES: TileType[] = [
  { char: '.', name: 'Eraser', description: 'Clear tile', color: '#ffffff' },
  { char: 's', name: 'Spike', description: 'Floor hazard', color: '#000000' },
  { char: 'c', name: 'Ceil Spike', description: 'Ceiling hazard', color: '#000000' },
  { char: 'b', name: 'Solid Block', description: 'Obstacle / Step', color: '#ffffff' },
  { char: 'B', name: 'Platform', description: 'Thin platform', color: '#ffffff' },
  { char: 'p', name: 'Bounce Pad', description: 'Super jump', color: '#000000' },
  { char: 'r', name: 'Jump Ring', description: 'Air jump orb', color: '#000000' },
  { char: 'g', name: 'Grav Up', description: 'Invert gravity', color: '#000000' },
  { char: 'n', name: 'Grav Down', description: 'Normal gravity', color: '#000000' },
  { char: 'w', name: 'Ship Portal', description: 'Enter Ship Mode', color: '#000000' },
  { char: 'q', name: 'Cube Portal', description: 'Enter Cube Mode', color: '#000000' },
  { char: '*', name: 'Gear Star', description: 'Collectible', color: '#000000' },
  { char: 'e', name: 'Finish Line', description: 'Level Goal', color: '#000000' }
];

export const DIFF_NAMES = ['EASY', 'NORMAL', 'HARD', 'BRUTAL'];
