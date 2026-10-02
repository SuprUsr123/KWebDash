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
  rows: number; // Default 12, dynamically expandable for tall levels
  floorRow?: number; // Row index of ground obstacle tiles. Floor line is at (floorRow + 1) * TILE_SIZE. Default: rows > 12 ? rows - 3 : 9
  grid: string[]; // Array of strings, each `cols` characters long
  raw?: string; // Legacy 1D string if imported
  gearsTotal?: number;
  isCommunity?: boolean;
  createdAt?: number;
  noCeiling?: boolean; // When true, disables the ceiling clamp in flight gamemodes (ship, ufo, wave, swing)
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

export type GameMode = 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'robot' | 'swing';

export interface Checkpoint {
  scrollX: number;
  playerY: number;
  playerVy: number;
  playerRotation: number;
  grav: number;
  speedScale: number;
  mode: GameMode;
  pct: number;
  zoom?: number;
}

export interface SaveState {
  username?: string;
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

// GD Physics Constants (Authentic balanced GD gravity & jump arc: tuned for fair staircase climbs and consistent triple spikes)
export const GD_BASE_SPEED = 4.1544; // 1.0x Normal speed (px/frame)
export const BASE_GRAVITY = 0.65; // GD Cube gravity acceleration (px/frame^2, perfectly balanced weight)
export const TERMINAL_VELOCITY = 10.8; // Terminal fall velocity (px/frame)
export const JUMP_FORCE = -8.40; // GD Cube jump impulse (clears 2.3 blocks high, 4.85 blocks distance)
export const CUBE_ROT_SPEED = (2 * Math.PI) / 28; // ~0.2244 rad/frame (one exact 360° rotation across 28-frame jump arc)
export const COYOTE_TIME_MAX = 5;
export const JUMP_BUFFER_MAX = 6;

// GD Speed Portal Multipliers (relative to 10.386 b/s)
export const SPEED_05X = 8.38 / 10.386; // ~0.8068 (Slow)
export const SPEED_1X = 1.0; // 1.0 (Normal)
export const SPEED_2X = 12.91 / 10.386; // ~1.2430 (Fast)
export const SPEED_3X = 15.60 / 10.386; // ~1.5020 (Faster)
export const SPEED_4X = 19.20 / 10.386; // ~1.8486 (Fastest)

// GD Jump Pad & Ring Forces (OpenGD propellPlayer & ringJump)
export const PAD_FORCE = -10.6; // ~3.5 blocks peak height
export const RING_FORCE = -8.40; // Matches full jump height (m_dJumpHeight)

// GD Ship Mode Physics (OpenGD PlayerObject ship acceleration)
export const SHIP_H = 20;
export const SHIP_RISE = -0.38; // Holding up acceleration
export const SHIP_FALL = 0.32; // Releasing fall acceleration
export const SHIP_TERMINAL = 5.2; // Max vertical ship speed

export const TILE_TYPES: TileType[] = [
  { char: '.', name: 'Eraser', description: 'Clear tile', color: '#ffffff' },
  { char: 's', name: 'Spike', description: 'Floor hazard (Full)', color: '#000000' },
  { char: 'D', name: 'Deco Spike', description: 'Decorative Floor Spike (No hitbox / safe to touch)', color: '#000000' },
  { char: 'h', name: 'Half Spike', description: 'Floor hazard (Half height)', color: '#000000' },
  { char: 'c', name: 'Ceil Spike', description: 'Ceiling hazard (Full)', color: '#000000' },
  { char: 'd', name: 'Ceil Deco Spike', description: 'Decorative Ceil Spike (No hitbox / safe to touch)', color: '#000000' },
  { char: 'H', name: 'Ceil Half Spike', description: 'Ceiling hazard (Half height)', color: '#000000' },
  { char: '<', name: 'Left Wall Spike', description: 'Wall hazard pointing left', color: '#000000' },
  { char: '>', name: 'Right Wall Spike', description: 'Wall hazard pointing right', color: '#000000' },
  { char: 'x', name: 'Saw Blade', description: 'Deadly spinning blade', color: '#000000' },
  { char: 'b', name: 'Solid Block', description: 'Obstacle / Step', color: '#ffffff' },
  { char: 'B', name: 'Platform', description: 'Thin platform', color: '#ffffff' },
  { char: 'f', name: 'Passable Wall', description: 'Phasable / Fake block (walk through to coins)', color: '#ffffff' },
  { char: 'S', name: 'StartPos', description: 'Practice / Spawn start position', color: '#000000' },
  { char: 'p', name: 'Bounce Pad', description: 'Super jump', color: '#000000' },
  { char: 'r', name: 'Jump Ring', description: 'Air jump orb', color: '#000000' },
  { char: 'g', name: 'Grav Up', description: 'Invert gravity', color: '#000000' },
  { char: 'n', name: 'Grav Down', description: 'Normal gravity', color: '#000000' },
  { char: 'q', name: 'Cube Portal', description: 'Enter Cube Mode', color: '#000000' },
  { char: 'w', name: 'Ship Portal', description: 'Enter Ship Mode', color: '#000000' },
  { char: 'a', name: 'Ball Portal', description: 'Enter Ball Mode (Tap flips gravity)', color: '#000000' },
  { char: 'u', name: 'UFO Portal', description: 'Enter UFO Mode (Mid-air jumps)', color: '#000000' },
  { char: 'v', name: 'Wave Portal', description: 'Enter Wave Mode (Diagonal dart)', color: '#000000' },
  { char: 'k', name: 'Robot Portal', description: 'Enter Robot Mode (Hold to jump higher)', color: '#000000' },
  { char: 'y', name: 'Swing Portal', description: 'Enter Swing Mode (Tap flips in mid-air)', color: '#000000' },
  { char: '1', name: 'Speed 0.5x', description: 'Slow speed portal (0.8x)', color: '#000000' },
  { char: '2', name: 'Speed 1.0x', description: 'Normal speed portal (1.0x)', color: '#000000' },
  { char: '3', name: 'Speed 2.0x', description: 'Fast speed portal (1.3x)', color: '#000000' },
  { char: '4', name: 'Speed 3.0x', description: 'Very fast speed portal (1.6x)', color: '#000000' },
  { char: 'Z', name: 'Zoom In', description: 'Camera Zoom In trigger (1.4x closer view)', color: '#000000' },
  { char: 'z', name: 'Zoom Out', description: 'Camera Zoom Out trigger (0.7x wider view)', color: '#000000' },
  { char: '0', name: 'Zoom Reset', description: 'Camera Zoom Reset trigger (1.0x normal view)', color: '#000000' },
  { char: '*', name: 'Coin', description: 'Collectible Coin (Max 3)', color: '#000000' },
  { char: 'e', name: 'Finish Line', description: 'Level Goal', color: '#000000' }
];

export const DIFF_NAMES = ['EASY', 'NORMAL', 'HARD', 'BRUTAL'];

/**
 * Filter to guarantee legacy demo levels ('NEON ASCENT', 'AERO PULSE', 'custom-1', 'custom-2', 'custom-3')
 * are never present anywhere in client or server.
 */
export function isBannedLegacyLevel(level: any): boolean {
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
