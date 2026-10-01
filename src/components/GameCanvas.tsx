/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  LevelData,
  Obstacle,
  Checkpoint,
  GameMode,
  EInkConfig,
  CANVAS_W,
  CANVAS_H,
  TILE_SIZE,
  FLOOR_Y,
  CEIL_Y,
  PLAYER_SIZE,
  PLAYER_X,
  FIXED_TIMESTEP,
  MAX_ACCUMULATOR,
  BASE_GRAVITY,
  TERMINAL_VELOCITY,
  JUMP_FORCE,
  COYOTE_TIME_MAX,
  JUMP_BUFFER_MAX,
  CUBE_ROT_SPEED,
  GD_BASE_SPEED,
  SPEED_05X,
  SPEED_1X,
  SPEED_2X,
  SPEED_3X,
  SPEED_4X,
  PAD_FORCE,
  RING_FORCE,
  SHIP_H,
  SHIP_RISE,
  SHIP_FALL,
  SHIP_TERMINAL
} from '../types';
import { parseLevelToObstacles } from '../utils/levelParser';
import { RotateCcw, Play, Pause, Flag, ArrowLeft, Download } from 'lucide-react';
import { generateSingleFileHTML } from '../utils/singleHtmlExporter';

interface GameCanvasProps {
  level: LevelData;
  isPractice: boolean;
  einkConfig: EInkConfig;
  onQuitToMenu: () => void;
  onLevelComplete: (levelId: string, gearsMask: number, isPractice: boolean) => void;
  onNextLevel?: () => void;
  hasNextLevel?: boolean;
}

const SHIP_PTS = [[-15, 0], [-8, -11], [8, -11], [15, 0], [8, 11], [-8, 11]];
const SHIP_MINI = [[-7, 0], [-4, -5], [4, -5], [7, 0], [4, 5], [-4, 5]];
const SPOKE_DIRS = [[9, 0], [7, 7], [0, 9], [-7, 7], [-9, 0], [-7, -7], [0, -9], [7, -7]];

export const GameCanvas: React.FC<GameCanvasProps> = ({
  level,
  isPractice,
  einkConfig,
  onQuitToMenu,
  onLevelComplete,
  onNextLevel,
  hasNextLevel
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Gameplay State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isDead, setIsDead] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [pct, setPct] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(1);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [lastCrashMsg, setLastCrashMsg] = useState<string>('');
  const [runJumps, setRunJumps] = useState<number>(0);
  const [runGears, setRunGears] = useState<number>(0);
  const [collectedGearsMask, setCollectedGearsMask] = useState<number>(0);

  // Engine Mutable Refs (to bypass React render lag on 60fps loop)
  const engineRef = useRef({
    scrollX: 0,
    cameraY: 0,
    finishX: 8000,
    speedScale: 1.0,
    grav: 1,
    mode: 'cube' as GameMode,
    robotBoost: 0,
    deathTimer: 0,
    frame: 0,
    gearTotal: 0,
    inputHeld: false,
    inputQueue: [] as { time: number; isDown: boolean }[],
    lastRefreshTime: 0,
    updateCount: 0,
    flashState: 0,
    player: {
      y: FLOOR_Y - PLAYER_SIZE,
      vy: 0,
      rotation: 0,
      grounded: true,
      coyote: 0,
      buffer: 0
    },
    zoom: 1.0,
    targetZoom: 1.0,
    obstacles: [] as Obstacle[],
    checkpoints: [] as Checkpoint[]
  });

  // Setup offscreen canvas for e-ink filtering & low memory operations
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    offCanvasRef.current = off;
  }, []);

  // Parse obstacles on level load
  const initEngine = useCallback(() => {
    const { obstacles, finishX, gearTotal, startPos } = parseLevelToObstacles(level);
    engineRef.current.obstacles = obstacles;
    engineRef.current.finishX = finishX;
    engineRef.current.gearTotal = gearTotal;

    if (startPos) {
      engineRef.current.scrollX = Math.max(0, startPos.x - PLAYER_X);
      engineRef.current.cameraY = 0;
      engineRef.current.speedScale = startPos.speedScale;
      engineRef.current.grav = startPos.grav;
      engineRef.current.mode = startPos.mode;
      engineRef.current.zoom = startPos.zoom ?? 1.0;
      engineRef.current.targetZoom = startPos.zoom ?? 1.0;
      engineRef.current.player = {
        y: Math.max(0, Math.min(FLOOR_Y - PLAYER_SIZE, startPos.y)),
        vy: 0,
        rotation: 0,
        grounded: startPos.y >= FLOOR_Y - PLAYER_SIZE - 2,
        coyote: 0,
        buffer: 0
      };
    } else {
      engineRef.current.scrollX = 0;
      engineRef.current.cameraY = 0;
      engineRef.current.speedScale = 1.0;
      engineRef.current.grav = 1;
      engineRef.current.mode = 'cube';
      engineRef.current.zoom = 1.0;
      engineRef.current.targetZoom = 1.0;
      engineRef.current.player = {
        y: FLOOR_Y - PLAYER_SIZE,
        vy: 0,
        rotation: 0,
        grounded: true,
        coyote: 0,
        buffer: 0
      };
    }

    engineRef.current.robotBoost = 0;
    engineRef.current.deathTimer = 0;
    engineRef.current.frame = 0;
    engineRef.current.checkpoints = [];

    setIsDead(false);
    setIsCompleted(false);
    setIsPaused(false);
    setIsPlaying(true);
    setPct(startPos ? Math.min(100, Math.max(0, Math.floor((Math.max(0, startPos.x - PLAYER_X) / (finishX - PLAYER_X)) * 100))) : 0);
    setRunJumps(0);
    setRunGears(0);
    setCollectedGearsMask(0);
    setCheckpoints([]);
  }, [level]);

  useEffect(() => {
    initEngine();
  }, [initEngine]);

  // Input Handling
  const executeJump = useCallback(() => {
    const eng = engineRef.current;
    if (isDead || isPaused || isCompleted) return;

    // Check jump ring collision
    for (let i = 0; i < eng.obstacles.length; i++) {
      const o = eng.obstacles[i];
      if (o.type === 'ring' && o.inZone && !o.used) {
        eng.player.vy = (eng.mode === 'ship' || eng.mode === 'wave' || eng.mode === 'swing' ? -7 : RING_FORCE) * eng.grav;
        eng.player.grounded = false;
        o.used = true;
        o.inZone = false;
        setRunJumps(j => j + 1);
        return;
      }
    }

    if (eng.mode === 'swing') {
      // Swing Mode: mid-air tap toggles gravity
      eng.grav = -eng.grav;
      eng.player.vy = eng.player.vy * 0.35;
      setRunJumps(j => j + 1);
    } else if (eng.mode === 'ball') {
      if (eng.player.grounded) {
        eng.grav = -eng.grav;
        eng.player.grounded = false;
        eng.player.vy = 0;
        setRunJumps(j => j + 1);
      }
    } else if (eng.mode === 'robot') {
      // Robot Mode: grounded jump with booster
      if (eng.player.grounded || eng.player.coyote > 0) {
        eng.player.vy = JUMP_FORCE * 0.72 * eng.grav;
        eng.player.grounded = false;
        eng.player.coyote = 0;
        eng.robotBoost = 1;
        setRunJumps(j => j + 1);
      } else {
        eng.player.buffer = JUMP_BUFFER_MAX;
      }
    } else if (eng.mode === 'ufo') {
      eng.player.vy = -5.8 * eng.grav;
      eng.player.grounded = false;
      setRunJumps(j => j + 1);
    } else if (eng.mode === 'cube') {
      if (eng.player.grounded || eng.player.coyote > 0) {
        eng.player.vy = JUMP_FORCE * eng.grav;
        eng.player.grounded = false;
        eng.player.coyote = 0;
        eng.player.buffer = 0;
      } else {
        eng.player.buffer = JUMP_BUFFER_MAX;
      }
      setRunJumps(j => j + 1);
    }
  }, [isDead, isPaused, isCompleted]);

  const queueInput = useCallback((isDown: boolean) => {
    if (!einkConfig.enabled || einkConfig.inputLagMs <= 0) {
      engineRef.current.inputHeld = isDown;
      if (!isDown && engineRef.current.robotBoost > 0) {
        engineRef.current.robotBoost = -1; // stop boosting on release
      }
      if (isDown) executeJump();
    } else {
      engineRef.current.inputQueue.push({
        time: performance.now() + einkConfig.inputLagMs,
        isDown
      });
    }
  }, [einkConfig, executeJump]);

  const dropCheckpoint = useCallback(() => {
    if (!isPractice || isDead || isPaused || isCompleted) return;
    const eng = engineRef.current;
    const cp: Checkpoint = {
      scrollX: eng.scrollX,
      playerY: eng.player.y,
      playerVy: eng.player.vy,
      playerRotation: eng.player.rotation,
      grav: eng.grav,
      speedScale: eng.speedScale,
      mode: eng.mode,
      pct,
      zoom: eng.targetZoom
    };
    eng.checkpoints.push(cp);
    setCheckpoints([...eng.checkpoints]);
  }, [isPractice, isDead, isPaused, isCompleted, pct]);

  const clearCheckpoint = useCallback(() => {
    if (!isPractice) return;
    engineRef.current.checkpoints.pop();
    setCheckpoints([...engineRef.current.checkpoints]);
  }, [isPractice]);

  const restoreCheckpoint = useCallback(() => {
    const eng = engineRef.current;
    if (eng.checkpoints.length === 0) return;
    const cp = eng.checkpoints[eng.checkpoints.length - 1];
    eng.scrollX = cp.scrollX;
    eng.player.y = cp.playerY;
    eng.player.vy = cp.playerVy;
    eng.player.rotation = cp.playerRotation;
    eng.player.grounded = true;
    eng.player.buffer = 0;
    eng.player.coyote = 0;
    eng.grav = cp.grav;
    eng.speedScale = cp.speedScale;
    eng.mode = cp.mode;
    eng.zoom = cp.zoom ?? 1.0;
    eng.targetZoom = cp.zoom ?? 1.0;
    setPct(cp.pct);

    for (let i = 0; i < eng.obstacles.length; i++) {
      if (eng.obstacles[i].type === 'ring') {
        eng.obstacles[i].used = false;
        eng.obstacles[i].inZone = false;
      }
    }
    setIsDead(false);
    setIsPlaying(true);
  }, []);

  const triggerDeath = useCallback(() => {
    setIsDead(true);
    const crashPct = pct;
    setLastCrashMsg(`Crashed at ${crashPct}%`);
  }, [pct]);

  const triggerCompletion = useCallback(() => {
    setIsCompleted(true);
    setIsPlaying(false);
    let mask = 0;
    engineRef.current.obstacles.forEach(o => {
      if (o.type === 'gear' && o.taken && o.gearIndex !== undefined) {
        mask |= (1 << o.gearIndex);
      }
    });
    setCollectedGearsMask(mask);
    onLevelComplete(level.id, mask, isPractice);
  }, [level.id, isPractice, onLevelComplete]);

  // Main Loop Game Physics & Rendering
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let accumulator = 0;

    const gameLoop = (now: number) => {
      let delta = now - lastTime;
      lastTime = now;
      if (delta > MAX_ACCUMULATOR) delta = MAX_ACCUMULATOR;
      accumulator += delta;

      const eng = engineRef.current;

      // Process delayed inputs if E-ink lag test enabled
      while (eng.inputQueue.length > 0 && eng.inputQueue[0].time <= now) {
        const item = eng.inputQueue.shift()!;
        eng.inputHeld = item.isDown;
        if (item.isDown) executeJump();
      }

      // Physics timestep update
      while (accumulator >= FIXED_TIMESTEP) {
        if (isPlaying && !isDead && !isPaused && !isCompleted) {
          eng.frame++;
          // Geometry Dash accurate horizontal velocity (1x = 10.386 blocks/s -> 4.1544 px/frame)
          const baseSpeedFactor = (level.speed && level.speed <= 2.5) ? level.speed : 1.0;
          const vx = GD_BASE_SPEED * baseSpeedFactor * eng.speedScale;
          const prevTop = eng.player.y;
          let touching = false;

          if (eng.mode === 'wave') {
            // Wave Mode: perfect 45-degree diagonal trajectory in GD
            const waveVy = vx;
            eng.player.vy = (eng.inputHeld ? -waveVy : waveVy) * eng.grav;
            eng.player.y += eng.player.vy;
            eng.scrollX += vx;

            const waveBottom = FLOOR_Y - 18;
            if (eng.player.y > waveBottom) { eng.player.y = waveBottom; touching = true; }
            if (!level.noCeiling && eng.player.y < CEIL_Y) { eng.player.y = CEIL_Y; touching = true; }

            if (touching) {
              eng.player.rotation += (0 - eng.player.rotation) * 0.35;
            } else {
              const targetTilt = (eng.player.vy * eng.grav > 0 ? Math.PI / 4 : -Math.PI / 4) * eng.grav;
              eng.player.rotation += (targetTilt - eng.player.rotation) * 0.35;
            }
          } else if (eng.mode === 'ship') {
            // Ship Mode: authentic GD floaty thrusters and gravity
            eng.player.vy += (eng.inputHeld ? SHIP_RISE : SHIP_FALL) * eng.grav;
            if (eng.player.vy > SHIP_TERMINAL) eng.player.vy = SHIP_TERMINAL;
            if (eng.player.vy < -SHIP_TERMINAL) eng.player.vy = -SHIP_TERMINAL;
            eng.player.y += eng.player.vy;
            eng.scrollX += vx;

            const shipBottom = FLOOR_Y - SHIP_H;
            if (eng.player.y > shipBottom) { eng.player.y = shipBottom; eng.player.vy = 0; }
            if (!level.noCeiling && eng.player.y < CEIL_Y) { eng.player.y = CEIL_Y; eng.player.vy = 0; }

            const targetPitch = (eng.player.vy / SHIP_TERMINAL) * 0.65 * eng.grav;
            eng.player.rotation += (targetPitch - eng.player.rotation) * 0.22;
          } else if (eng.mode === 'ufo') {
            eng.player.vy += BASE_GRAVITY * 0.85 * eng.grav;
            if (eng.player.vy > 9) eng.player.vy = 9;
            if (eng.player.vy < -9) eng.player.vy = -9;
            eng.player.y += eng.player.vy;
            eng.scrollX += vx;

            const ufoBottom = FLOOR_Y - PLAYER_SIZE;
            if (eng.grav === 1) {
              if (eng.player.y > ufoBottom) { eng.player.y = ufoBottom; eng.player.vy = 0; eng.player.grounded = true; touching = true; }
              if (!level.noCeiling && eng.player.y < CEIL_Y) { eng.player.y = CEIL_Y; eng.player.vy = 0; }
            } else {
              if (!level.noCeiling && eng.player.y < CEIL_Y) { eng.player.y = CEIL_Y; eng.player.vy = 0; eng.player.grounded = true; touching = true; }
              if (eng.player.y > ufoBottom) { eng.player.y = ufoBottom; eng.player.vy = 0; }
            }

            const tilt = eng.player.vy * 0.04 * eng.grav;
            eng.player.rotation += (Math.max(-0.4, Math.min(0.4, tilt)) - eng.player.rotation) * 0.2;
          } else if (eng.mode === 'swing') {
            // Swing Mode: continuous flight, tap toggles gravity in mid-air
            eng.player.vy += BASE_GRAVITY * 0.55 * eng.grav;
            if (eng.player.vy > 6) eng.player.vy = 6;
            if (eng.player.vy < -6) eng.player.vy = -6;
            eng.player.y += eng.player.vy;
            eng.scrollX += vx;

            const swingBottom = FLOOR_Y - PLAYER_SIZE;
            if (eng.grav === 1) {
              if (eng.player.y > swingBottom) { eng.player.y = swingBottom; eng.player.vy = 0; eng.player.grounded = true; touching = true; }
              if (!level.noCeiling && eng.player.y < CEIL_Y) { eng.player.y = CEIL_Y; eng.player.vy = 0; }
            } else {
              if (!level.noCeiling && eng.player.y < CEIL_Y) { eng.player.y = CEIL_Y; eng.player.vy = 0; eng.player.grounded = true; touching = true; }
              if (eng.player.y > swingBottom) { eng.player.y = swingBottom; eng.player.vy = 0; }
            }

            const tilt = eng.player.vy * 0.05 * eng.grav;
            eng.player.rotation += (Math.max(-0.5, Math.min(0.5, tilt)) - eng.player.rotation) * 0.2;
          } else if (eng.mode === 'robot') {
            // Robot Mode: grounded jump, hold to boost significantly higher
            if (eng.player.buffer > 0) eng.player.buffer--;
            if (eng.player.coyote > 0) eng.player.coyote--;

            if ((eng.player.buffer > 0 || (eng.inputHeld && eng.player.buffer === 0)) && (eng.player.grounded || eng.player.coyote > 0)) {
              eng.player.vy = JUMP_FORCE * 0.72 * eng.grav;
              eng.player.grounded = false;
              eng.player.coyote = 0;
              eng.player.buffer = 0;
              eng.robotBoost = 1;
              setRunJumps(j => j + 1);
            }

            if (eng.inputHeld && eng.robotBoost > 0 && eng.robotBoost < 15) {
              eng.player.vy -= 0.65 * eng.grav;
              eng.robotBoost++;
            } else if (!eng.inputHeld && eng.robotBoost > 0) {
              eng.robotBoost = -1;
            }

            eng.player.vy += BASE_GRAVITY * eng.grav;
            if (eng.player.vy > TERMINAL_VELOCITY) eng.player.vy = TERMINAL_VELOCITY;
            if (eng.player.vy < -TERMINAL_VELOCITY * 1.2) eng.player.vy = -TERMINAL_VELOCITY * 1.2;

            eng.player.y += eng.player.vy;
            eng.scrollX += vx;

            if (eng.grav === 1) {
              if (eng.player.y >= FLOOR_Y - PLAYER_SIZE) {
                eng.player.y = FLOOR_Y - PLAYER_SIZE;
                eng.player.vy = 0;
                eng.player.grounded = true;
                eng.robotBoost = 0;
                touching = true;
              }
            } else {
              if (eng.player.y <= CEIL_Y) {
                eng.player.y = CEIL_Y;
                eng.player.vy = 0;
                eng.player.grounded = true;
                eng.robotBoost = 0;
                touching = true;
              }
            }

            if (!touching) {
              const targetRot = (eng.player.vy * 0.03) * eng.grav;
              eng.player.rotation += (targetRot - eng.player.rotation) * 0.2;
            } else {
              eng.player.rotation += (0 - eng.player.rotation) * 0.3;
            }
          } else {
            // Ball or Cube mode
            if (eng.mode === 'ball') {
              if (eng.inputHeld && eng.player.grounded && eng.player.buffer === 0) {
                eng.grav = -eng.grav;
                eng.player.grounded = false;
                eng.player.vy = 0;
                eng.player.buffer = 8;
                setRunJumps(j => j + 1);
              }
              if (eng.player.buffer > 0) eng.player.buffer--;
            } else {
              // Cube jump buffer & continuous jump when input is held (exact GD behavior)
              if (eng.player.buffer > 0) eng.player.buffer--;
              if (eng.player.coyote > 0) eng.player.coyote--;

              if (eng.inputHeld && eng.player.grounded && eng.player.buffer <= 0) {
                eng.player.buffer = 2;
              }

              if (eng.player.buffer > 0 && (eng.player.grounded || eng.player.coyote > 0)) {
                eng.player.vy = JUMP_FORCE * eng.grav;
                eng.player.grounded = false;
                eng.player.coyote = 0;
                eng.player.buffer = 0;
                setRunJumps(j => j + 1);
              }
            }

            // OpenGD gravity: Ball mode applies 0.6x gravity multiplier
            const effGravity = (eng.mode === 'ball' ? BASE_GRAVITY * 0.6 : BASE_GRAVITY) * eng.grav;
            eng.player.vy += effGravity;
            if (eng.player.vy > TERMINAL_VELOCITY) eng.player.vy = TERMINAL_VELOCITY;
            if (eng.player.vy < -TERMINAL_VELOCITY) eng.player.vy = -TERMINAL_VELOCITY;

            eng.player.y += eng.player.vy;
            eng.scrollX += vx;

            if (eng.grav === 1) {
              if (eng.player.y >= FLOOR_Y - PLAYER_SIZE) {
                eng.player.y = FLOOR_Y - PLAYER_SIZE;
                eng.player.vy = 0;
                eng.player.grounded = true;
                touching = true;
              }
            } else {
              if (eng.player.y <= CEIL_Y) {
                eng.player.y = CEIL_Y;
                eng.player.vy = 0;
                eng.player.grounded = true;
                touching = true;
              }
            }

            if (eng.mode === 'ball') {
              if (touching) eng.player.rotation += (vx / 10) * eng.grav;
            } else {
              if (touching) {
                // GD cube snap to nearest 90-degree flat face upon landing
                const nearestAngle = Math.round(eng.player.rotation / (Math.PI / 2)) * (Math.PI / 2);
                eng.player.rotation += (nearestAngle - eng.player.rotation) * 0.45;
                if (Math.abs(nearestAngle - eng.player.rotation) < 0.02) {
                  eng.player.rotation = nearestAngle;
                }
              } else {
                // OpenGD cube exact 360-degree rotation across 26-frame jump arc in gravity direction
                eng.player.rotation += CUBE_ROT_SPEED * eng.grav;
              }
            }
          }

          // Obstacle Collision
          const pSize = eng.mode === 'wave' ? 14 : (eng.mode === 'ship' ? SHIP_H * 0.8 : PLAYER_SIZE * 0.8);
          const pOff = (PLAYER_SIZE - pSize) / 2;
          const px = PLAYER_X + pOff;
          const py = eng.player.y + pOff;
          const prevTopOff = prevTop + pOff;
          const prevBottomOff = prevTopOff + pSize;
          const prevRightOff = px + pSize - vx;

          for (let si = 0; si < eng.obstacles.length; si++) {
            const so = eng.obstacles[si];
            if (so.x < eng.scrollX - 200 || so.x > eng.scrollX + CANVAS_W + 200) continue;
            const sox = so.x - eng.scrollX;

            // Finish line: one object = one full-height line that finishes the level when touched
            if (so.type === 'end') {
              if (px + pSize >= sox) {
                triggerCompletion();
                break;
              }
              continue;
            }

            // Geometry Dash authentic forgiving hitboxes (inset hazard box for near-misses)
            const pHitX = px + (eng.mode === 'wave' ? 6 : 4);
            const pHitW = pSize - (eng.mode === 'wave' ? 12 : 8);
            const pHitY = py + (eng.mode === 'wave' ? 4 : 3);
            const pHitH = pSize - (eng.mode === 'wave' ? 8 : 6);

            const broadOverlap = (px < sox + so.w && px + pSize > sox && py + pSize > so.top && py < so.top + so.h);
            if (!broadOverlap) {
              if (so.type === 'ring') so.inZone = false;
              continue;
            }

            if (['spike', 'double', 'triple', 'spikeblock'].includes(so.type)) {
              // Triangular Floor Spike: inset tip and triangular slope check
              const tipY = so.top + 5;
              const baseY = so.top + so.h;
              const testY = pHitY + pHitH; // Player feet
              if (testY > tipY && pHitY < baseY) {
                const progress = Math.max(0, Math.min(1, (testY - tipY) / (baseY - tipY)));
                const halfW = 2.5 + progress * (so.w / 2 - 6);
                const centerX = sox + so.w / 2;
                if (pHitX < centerX + halfW && pHitX + pHitW > centerX - halfW) {
                  triggerDeath();
                  break;
                }
              }
              continue;
            } else if (so.type === 'ceilspike') {
              // Triangular Ceiling Spike pointing downwards
              const tipY = so.top + so.h - 5;
              const baseY = so.top;
              const testY = pHitY; // Player head
              if (testY < tipY && pHitY + pHitH > baseY) {
                const progress = Math.max(0, Math.min(1, (tipY - testY) / (tipY - baseY)));
                const halfW = 2.5 + progress * (so.w / 2 - 6);
                const centerX = sox + so.w / 2;
                if (pHitX < centerX + halfW && pHitX + pHitW > centerX - halfW) {
                  triggerDeath();
                  break;
                }
              }
              continue;
            } else if (so.type === 'halfspike') {
              // Half Floor Spike (lower half of cell)
              const tipY = so.top + 3;
              const baseY = so.top + so.h;
              const testY = pHitY + pHitH;
              if (testY > tipY && pHitY < baseY) {
                const progress = Math.max(0, Math.min(1, (testY - tipY) / (baseY - tipY)));
                const halfW = 2 + progress * (so.w / 2 - 6);
                const centerX = sox + so.w / 2;
                if (pHitX < centerX + halfW && pHitX + pHitW > centerX - halfW) {
                  triggerDeath();
                  break;
                }
              }
              continue;
            } else if (so.type === 'ceilhalfspike') {
              // Half Ceiling Spike (upper half of cell)
              const tipY = so.top + so.h - 3;
              const baseY = so.top;
              const testY = pHitY;
              if (testY < tipY && pHitY + pHitH > baseY) {
                const progress = Math.max(0, Math.min(1, (tipY - testY) / (tipY - baseY)));
                const halfW = 2 + progress * (so.w / 2 - 6);
                const centerX = sox + so.w / 2;
                if (pHitX < centerX + halfW && pHitX + pHitW > centerX - halfW) {
                  triggerDeath();
                  break;
                }
              }
              continue;
            } else if (so.type === 'leftspike') {
              // Triangular Wall Spike pointing LEFT towards player (attached to block on right)
              const tipX = sox + 5;
              const baseX = sox + so.w;
              const testX = pHitX + pHitW; // Player leading right edge
              if (testX > tipX && pHitX < baseX) {
                const progress = Math.max(0, Math.min(1, (testX - tipX) / (baseX - tipX)));
                const halfH = 2.5 + progress * (so.h / 2 - 4);
                const centerY = so.top + so.h / 2;
                if (pHitY < centerY + halfH && pHitY + pHitH > centerY - halfH) {
                  triggerDeath();
                  break;
                }
              }
              continue;
            } else if (so.type === 'rightspike') {
              // Triangular Wall Spike pointing RIGHT (attached to block on left)
              const tipX = sox + so.w - 5;
              const baseX = sox;
              const testX = pHitX; // Player trailing left edge
              if (testX < tipX && testX + pHitW > baseX) {
                const progress = Math.max(0, Math.min(1, (tipX - testX) / (tipX - baseX)));
                const halfH = 2.5 + progress * (so.h / 2 - 4);
                const centerY = so.top + so.h / 2;
                if (pHitY < centerY + halfH && pHitY + pHitH > centerY - halfH) {
                  triggerDeath();
                  break;
                }
              }
              continue;
            } else if (so.type === 'saw') {
              // GD authentic forgiving saw hitbox: inner lethal core radius is 65% of visual radius
              const sawRad = so.w / 2;
              const lethalRad = sawRad * 0.65;
              const dist = Math.hypot((px + pSize / 2) - (sox + sawRad), (py + pSize / 2) - (so.top + sawRad));
              if (dist < lethalRad + (pHitW / 2)) {
                triggerDeath();
                break;
              }
            } else if (['block', 'pillar', 'hangpillar', 'platform'].includes(so.type)) {
              if (eng.mode === 'wave') {
                if (eng.grav === 1) {
                  if (prevBottomOff <= so.top + 9 && eng.player.vy >= 0) {
                    eng.player.y = so.top - pSize - pOff;
                    touching = true;
                  } else if (prevTopOff >= so.top + so.h - 9 && eng.player.vy <= 0) {
                    eng.player.y = so.top + so.h - pOff;
                    touching = true;
                  } else {
                    triggerDeath();
                    break;
                  }
                } else {
                  if (prevTopOff >= so.top + so.h - 9 && eng.player.vy <= 0) {
                    eng.player.y = so.top + so.h - pOff;
                    touching = true;
                  } else if (prevBottomOff <= so.top + 9 && eng.player.vy >= 0) {
                    eng.player.y = so.top - pSize - pOff;
                    touching = true;
                  } else {
                    triggerDeath();
                    break;
                  }
                }
              } else {
                if (eng.grav === 1) {
                  // Can land on top if feet are at or above the block surface, or descending onto it
                  if ((prevBottomOff <= so.top + 14 || py + pSize <= so.top + 8) && eng.player.vy >= -3.5) {
                    eng.player.y = so.top - pSize - pOff;
                    eng.player.vy = 0;
                    eng.player.grounded = true;
                    touching = true;
                  } else if (px + pSize > sox + 4 && prevRightOff <= sox + 8 && py + pSize > so.top + 6) {
                    triggerDeath();
                    break;
                  }
                } else {
                  if ((prevTopOff >= so.top + so.h - 14 || py >= so.top + so.h - 8) && eng.player.vy <= 3.5) {
                    eng.player.y = so.top + so.h - pOff;
                    eng.player.vy = 0;
                    eng.player.grounded = true;
                    touching = true;
                  } else if (px + pSize > sox + 4 && prevRightOff <= sox + 8 && py < so.top + so.h - 6) {
                    triggerDeath();
                    break;
                  }
                }
              }
            } else if (so.type === 'pad') {
              eng.player.vy = (eng.mode === 'ship' || eng.mode === 'wave' || eng.mode === 'swing' ? -10 : PAD_FORCE) * eng.grav;
              eng.player.grounded = false;
            } else if (so.type === 'ring') {
              so.inZone = true;
            } else if (so.type === 'gravup') {
              if (eng.grav === 1) { eng.grav = -1; eng.player.grounded = false; eng.player.vy = -3; }
            } else if (so.type === 'gravdown') {
              if (eng.grav === -1) { eng.grav = 1; eng.player.grounded = false; eng.player.vy = 3; }
            } else if (so.type === 'shipon') {
              eng.mode = 'ship';
              eng.player.grounded = false;
            } else if (so.type === 'shipoff') {
              eng.mode = 'cube';
              eng.player.grounded = false;
            } else if (so.type === 'ballon') {
              eng.mode = 'ball';
              eng.player.grounded = false;
            } else if (so.type === 'ufoon') {
              eng.mode = 'ufo';
              eng.player.grounded = false;
            } else if (so.type === 'waveon') {
              eng.mode = 'wave';
              eng.player.grounded = false;
            } else if (so.type === 'roboton') {
              eng.mode = 'robot';
              eng.player.grounded = false;
              eng.robotBoost = 0;
            } else if (so.type === 'swingon') {
              eng.mode = 'swing';
              eng.player.grounded = false;
            } else if (so.type === 'speed05') {
              eng.speedScale = SPEED_05X;
            } else if (so.type === 'speed1') {
              eng.speedScale = SPEED_1X;
            } else if (so.type === 'speed2') {
              eng.speedScale = SPEED_2X;
            } else if (so.type === 'speed3') {
              eng.speedScale = SPEED_3X;
            } else if (so.type === 'speed4') {
              eng.speedScale = SPEED_4X;
            } else if (so.type === 'zoomin') {
              eng.targetZoom = 1.35;
            } else if (so.type === 'zoomout') {
              eng.targetZoom = 0.72;
            } else if (so.type === 'zoomreset') {
              eng.targetZoom = 1.0;
            } else if (so.type === 'gear' && !so.taken) {
              so.taken = true;
              setRunGears(g => g + 1);
            }
          }

          // Check level finish line X
          if (eng.scrollX + PLAYER_X + pSize >= eng.finishX) {
            triggerCompletion();
          }

          // Smooth zoom interpolation (with snap threshold for Kindle e-ink stability)
          if (Math.abs(eng.zoom - eng.targetZoom) > 0.005) {
            eng.zoom += (eng.targetZoom - eng.zoom) * 0.08;
          } else {
            eng.zoom = eng.targetZoom;
          }

          // Smooth Camera Y Tracking according to player Y position (Kindle e-ink friendly integer quantization)
          let targetCamY = 0;
          if (level.noCeiling || ['ship', 'ufo', 'wave', 'swing'].includes(eng.mode)) {
            if (eng.player.y < 120) {
              targetCamY = eng.player.y - 120;
            }
          } else {
            if (eng.player.y < 110) {
              targetCamY = eng.player.y - 110;
            } else if (eng.player.y > FLOOR_Y - PLAYER_SIZE + 10) {
              targetCamY = eng.player.y - (FLOOR_Y - PLAYER_SIZE + 10);
            }
          }
          eng.cameraY += (targetCamY - eng.cameraY) * 0.16;

          if (!touching && eng.player.grounded && (eng.mode === 'cube' || eng.mode === 'ball' || eng.mode === 'robot')) {
            eng.player.grounded = false;
            eng.player.coyote = COYOTE_TIME_MAX;
          }

          // Calculate percentage
          const denom = eng.finishX - PLAYER_X;
          const currentPct = Math.min(100, Math.max(0, Math.floor((eng.scrollX / denom) * 100)));
          setPct(currentPct);

        } else if (isDead && !isPaused) {
          eng.deathTimer++;
          if (eng.deathTimer >= 30) {
            if (isPractice && eng.checkpoints.length > 0) {
              restoreCheckpoint();
            } else {
              setAttempts(a => a + 1);
              initEngine();
            }
          }
        }

        accumulator -= FIXED_TIMESTEP;
      }

      // Render Offscreen Buffer
      const offCanvas = offCanvasRef.current;
      if (offCanvas) {
        const offCtx = offCanvas.getContext('2d', { alpha: false });
        if (offCtx) {
          renderScene(offCtx, eng, isDead, level.noCeiling);
        }
      }

      // Copy to main Canvas with optional E-ink throttling & ghosting simulation
      const canvas = canvasRef.current;
      if (canvas && offCanvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          if (!einkConfig.enabled) {
            ctx.drawImage(offCanvas, 0, 0);
          } else {
            const interval = 1000 / einkConfig.fps;
            if (now - eng.lastRefreshTime >= interval) {
              eng.lastRefreshTime = now;
              eng.updateCount++;

              if (einkConfig.flashInterval > 0 && eng.updateCount % einkConfig.flashInterval === 0) {
                eng.flashState = 1;
              }

              if (eng.flashState === 1) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
                eng.flashState = 2;
              } else if (eng.flashState === 2) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
                eng.flashState = 0;
              } else {
                ctx.globalAlpha = 1.0 - einkConfig.ghosting;
                ctx.drawImage(offCanvas, 0, 0);
                ctx.globalAlpha = 1.0;
              }
            }
          }
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isDead, isPaused, isCompleted, level, einkConfig, triggerDeath, triggerCompletion, restoreCheckpoint, executeJump, initEngine, isPractice]);

  // Key Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        queueInput(true);
      } else if (e.key === 'Escape') {
        setIsPaused(p => !p);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        queueInput(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [queueInput]);

  return (
    <div className="window-content" style={{ width: '100%', alignItems: 'center' }}>
      {/* HUD Bar */}
      <div className="hud-row" style={{ width: '100%', maxWidth: '512px' }}>
        <span id="hud-name" style={{ fontWeight: 'bold' }}>
          {level.name}
        </span>
        <span id="hud-msg">
          ATTEMPT {attempts} - {isPractice ? 'PRACTICE' : 'NORMAL'}
        </span>
        <span id="hud-pct">{pct}%</span>
        <button
          className="sys-btn"
          style={{ padding: '2px 8px', minWidth: '36px' }}
          onClick={() => setIsPaused(p => !p)}
        >
          {isPaused ? <Play size={12} /> : <Pause size={12} />}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="progress-outer" style={{ width: '100%', maxWidth: '512px', marginTop: '6px' }}>
        <div id="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onPointerDown={e => {
          if ((e.target as HTMLElement).tagName !== 'BUTTON') {
            queueInput(true);
          }
        }}
        onPointerUp={() => queueInput(false)}
        onPointerCancel={() => queueInput(false)}
        style={{ cursor: 'pointer', touchAction: 'none' }}
      />

      {/* Practice Tools */}
      {isPractice && (
        <div style={{ display: 'flex', marginTop: '8px', width: '100%', maxWidth: '512px' }}>
          <button className="sys-btn" style={{ flex: 1, marginRight: '8px' }} onClick={dropCheckpoint}>
            + CHECKPOINT ({checkpoints.length})
          </button>
          <button className="sys-btn" style={{ flex: 1 }} onClick={clearCheckpoint}>
            - CLEAR CP
          </button>
        </div>
      )}

      {/* Pause Overlay */}
      {isPaused && (
        <div className="overlay active">
          <h2>PAUSED</h2>
          <p>{level.name} — {pct}%</p>
          <button className="sys-btn" onClick={() => setIsPaused(false)} style={{ marginBottom: '8px', width: '180px' }}>
            Resume
          </button>
          <button
            className="sys-btn"
            onClick={() => {
              setIsPaused(false);
              setAttempts(1);
              initEngine();
            }}
            style={{ marginBottom: '8px', width: '180px' }}
          >
            Restart
          </button>
          <button className="sys-btn" onClick={onQuitToMenu} style={{ width: '180px' }}>
            Quit to Menu
          </button>
        </div>
      )}

      {/* Complete Overlay */}
      {isCompleted && (
        <div className="overlay active">
          <h2>LEVEL COMPLETE!</h2>
          <p style={{ margin: '4px 0 12px 0' }}>{level.name} - 100%</p>
          <p style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
            Attempts: {attempts} | Jumps: {runJumps} | Coins: {runGears}/{engineRef.current.gearTotal}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '12px', width: '200px' }}>
            {hasNextLevel && onNextLevel && (
              <button className="sys-btn" onClick={onNextLevel} style={{ marginBottom: '6px' }}>
                Next Level
              </button>
            )}
            <button
              className="sys-btn"
              onClick={() => {
                const htmlStr = generateSingleFileHTML(level);
                const blob = new Blob([htmlStr], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${level.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
                a.click();
              }}
              style={{ marginBottom: '6px' }}
            >
              <Download size={12} style={{ display: 'inline', marginRight: '4px' }} /> Export HTML
            </button>
            <button className="sys-btn" onClick={onQuitToMenu}>
              Main Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Pixelated Canvas Helper Methods --- */
function renderScene(ctx: CanvasRenderingContext2D, eng: any, isDead: boolean, noCeiling?: boolean) {
  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Vertical Camera Scrolling & Zoom translation
  const camY = Math.round(eng.cameraY || 0);
  const zoom = eng.zoom || 1.0;
  ctx.save();
  if (Math.abs(zoom - 1.0) > 0.01) {
    ctx.translate(PLAYER_X + PLAYER_SIZE / 2, CANVAS_H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-(PLAYER_X + PLAYER_SIZE / 2), -CANVAS_H / 2);
  }
  ctx.translate(0, -camY);

  // Ceil & Floor boundaries
  ctx.fillStyle = '#000000';
  if (eng.grav === -1 || (!noCeiling && ['ship', 'ufo', 'wave', 'swing'].includes(eng.mode))) {
    ctx.fillRect(0, CEIL_Y - 4, CANVAS_W, 4);
    ctx.fillRect(0, -400, CANVAS_W, 400 + CEIL_Y); // Solid upper roof
  }
  ctx.fillRect(0, FLOOR_Y - 2, CANVAS_W, 4);
  ctx.fillRect(0, FLOOR_Y + 2, CANVAS_W, 400); // Solid lower ground

  // Ground ticks
  const tickOff = Math.round(eng.scrollX % 24);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  for (let ti = -1; ti < CANVAS_W / 24 + 1; ti++) {
    ctx.beginPath();
    ctx.moveTo(ti * 24 - tickOff, FLOOR_Y + 8);
    ctx.lineTo(ti * 24 - tickOff - 12, FLOOR_Y + 32);
    ctx.stroke();
  }
  ctx.fillRect(0, FLOOR_Y + 38, CANVAS_W, 4);

  // Practice checkpoints
  if (eng.checkpoints.length > 0) {
    ctx.fillStyle = '#000000';
    for (let ci = 0; ci < eng.checkpoints.length; ci++) {
      const cpx = Math.round(eng.checkpoints[ci].scrollX - eng.scrollX);
      if (cpx > -20 && cpx < CANVAS_W + 20) {
        const cpy = Math.round(eng.checkpoints[ci].playerY);
        ctx.fillRect(PLAYER_X + cpx + 10, cpy - 14, 4, 14);
        ctx.fillRect(PLAYER_X + cpx + 14, cpy - 14, 12, 8);
      }
    }
  }

  // Draw Player
  const pyc = Math.round(eng.player.y) + 12;
  const pxc = PLAYER_X + 12;

  if (!isDead) {
    if (eng.mode === 'ship') {
      let ang = eng.player.rotation;
      if (ang > 0.35) ang = 0.35;
      if (ang < -0.35) ang = -0.35;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      ctx.save();
      ctx.translate(pxc, pyc);
      ctx.rotate(ang);
      ctx.beginPath();
      SHIP_PTS.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (eng.mode === 'wave') {
      let ang = eng.player.rotation;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;

      ctx.save();
      ctx.translate(pxc, pyc);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-9, -7);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-1, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
    } else if (eng.mode === 'ufo') {
      let ang = eng.player.rotation;
      ctx.save();
      ctx.translate(pxc, pyc);
      ctx.rotate(ang);
      // Cockpit dome
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -2, 7, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      // Saucer base
      ctx.beginPath();
      ctx.ellipse(0, 3, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Center line
      ctx.fillStyle = '#000000';
      ctx.fillRect(-6, 2, 12, 2);
      ctx.restore();
    } else if (eng.mode === 'ball') {
      ctx.save();
      ctx.translate(pxc, pyc);
      ctx.rotate(eng.player.rotation);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Inner circle
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
      // 4 Spokes
      for (let s = 0; s < 4; s++) {
        const a = (s * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(5 * Math.cos(a), 5 * Math.sin(a));
        ctx.lineTo(11 * Math.cos(a), 11 * Math.sin(a));
        ctx.stroke();
      }
      ctx.restore();
    } else if (eng.mode === 'robot') {
      ctx.save();
      ctx.translate(pxc, pyc);
      ctx.rotate(eng.player.rotation);

      // Robot Head/Torso Chassis
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-10, -10, 20, 20);

      // Visor
      ctx.fillStyle = '#000000';
      ctx.fillRect(-7, -4, 14, 4);

      // Antenna
      ctx.fillRect(-2, -14, 4, 4);

      // Feet
      ctx.fillRect(-8, 10, 5, 3);
      ctx.fillRect(3, 10, 5, 3);

      // Booster flame
      if (eng.robotBoost > 0) {
        const flameH = 6 + (eng.frame % 3) * 3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(-5, 13);
        ctx.lineTo(0, 13 + flameH);
        ctx.lineTo(5, 13);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (eng.mode === 'swing') {
      ctx.save();
      ctx.translate(pxc, pyc);
      ctx.rotate(eng.player.rotation);

      // Gyro Sphere Outer Shell
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner Eye Ring
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();

      // Top & Bottom spinning rotors
      const rOffset = (eng.frame * 0.4) % 6;
      ctx.fillStyle = '#000000';
      ctx.fillRect(-7 + rOffset, -14, 6, 3);
      ctx.fillRect(-1, -14, 2, 4);
      ctx.fillRect(-7 + rOffset, 11, 6, 3);
      ctx.fillRect(-1, 10, 2, 4);

      ctx.restore();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(PLAYER_X, eng.player.y, PLAYER_SIZE, PLAYER_SIZE);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(PLAYER_X, eng.player.y, PLAYER_SIZE, PLAYER_SIZE);

      const qa = Math.round(eng.player.rotation / (Math.PI / 4));
      const dir = SPOKE_DIRS[((qa % 8) + 8) % 8];
      ctx.beginPath();
      ctx.moveTo(pxc, pyc);
      ctx.lineTo(pxc + dir[0], pyc + dir[1]);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pxc - 10, pyc - 10);
    ctx.lineTo(pxc + 10, pyc + 10);
    ctx.moveTo(pxc - 10, pyc + 10);
    ctx.lineTo(pxc + 10, pyc - 10);
    ctx.stroke();
  }

  // Draw Obstacles
  for (let i = 0; i < eng.obstacles.length; i++) {
    const o = eng.obstacles[i];
    const ox = Math.round(o.x - eng.scrollX);
    if (ox < -120 || ox > CANVAS_W + 120) continue;

    if (o.type === 'spike' || o.type === 'decospike') {
      const tipX = ox + o.w / 2;
      const baseY = o.top + o.h;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ox + 1, baseY);
      ctx.lineTo(tipX, o.top + 1);
      ctx.lineTo(ox + o.w - 1, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner signature shadow facet
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(tipX, o.top + 5);
      ctx.lineTo(ox + o.w - 4, baseY - 1);
      ctx.lineTo(tipX, baseY - 1);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'ceilspike' || o.type === 'ceildecospike') {
      const tipX = ox + o.w / 2;
      const baseY = o.top;
      const tipY = o.top + o.h;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ox + 1, baseY);
      ctx.lineTo(tipX, tipY - 1);
      ctx.lineTo(ox + o.w - 1, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner signature shadow facet
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY - 5);
      ctx.lineTo(ox + o.w - 4, baseY + 1);
      ctx.lineTo(tipX, baseY + 1);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'halfspike') {
      // Proportional sharp small spike (14px wide, 13px tall centered)
      const spikeW = 14;
      const left = ox + Math.round((o.w - spikeW) / 2);
      const right = left + spikeW;
      const tipX = ox + o.w / 2;
      const baseY = o.top + o.h;
      const tipY = baseY - 13;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(right, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner signature shadow facet
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY + 2.5);
      ctx.lineTo(right - 2, baseY - 1);
      ctx.lineTo(tipX, baseY - 1);
      ctx.closePath();
      ctx.fill();

      // Ground anchor trim
      ctx.fillRect(left - 1, baseY - 1.5, spikeW + 2, 1.5);
    } else if (o.type === 'ceilhalfspike') {
      // Proportional sharp small ceiling spike (14px wide, 13px tall centered)
      const spikeW = 14;
      const left = ox + Math.round((o.w - spikeW) / 2);
      const right = left + spikeW;
      const tipX = ox + o.w / 2;
      const baseY = o.top;
      const tipY = baseY + 13;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(right, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner signature shadow facet
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY - 2.5);
      ctx.lineTo(right - 2, baseY + 1);
      ctx.lineTo(tipX, baseY + 1);
      ctx.closePath();
      ctx.fill();

      // Ceiling anchor trim
      ctx.fillRect(left - 1, baseY, spikeW + 2, 1.5);
    } else if (o.type === 'leftspike') {
      // Wall Spike pointing LEFT towards incoming player (attached to block on right)
      const tipX = ox + 2;
      const tipY = o.top + o.h / 2;
      const baseX = ox + o.w;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(baseX, o.top + 1);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX, o.top + o.h - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner signature shadow facet (lower half)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(tipX + 5, tipY);
      ctx.lineTo(baseX - 1, o.top + o.h - 4);
      ctx.lineTo(baseX - 1, tipY);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'rightspike') {
      // Wall Spike pointing RIGHT (attached to block on left)
      const tipX = ox + o.w - 2;
      const tipY = o.top + o.h / 2;
      const baseX = ox;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(baseX, o.top + 1);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX, o.top + o.h - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner signature shadow facet (lower half)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(tipX - 5, tipY);
      ctx.lineTo(baseX + 1, o.top + o.h - 4);
      ctx.lineTo(baseX + 1, tipY);
      ctx.closePath();
      ctx.fill();
    } else if (['block', 'pillar', 'fakeblock'].includes(o.type)) {
      // Classic Geometry Dash Solid / Passable Block (Square 01 style)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, o.top, o.w, o.h);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ox, o.top, o.w, o.h);

      // Inset inner frame
      if (o.w >= 16 && o.h >= 16) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox + 3.5, o.top + 3.5, o.w - 7, o.h - 7);

        // Center square accent
        ctx.fillStyle = '#000000';
        ctx.fillRect(ox + 8, o.top + 8, o.w - 16, o.h - 16);
      }
    } else if (o.type === 'platform') {
      // Sleek Modern Floating Platform / Slab
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, o.top, o.w, o.h);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, o.top, o.w, o.h);

      // Top grip surface rail
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox, o.top, o.w, 2);

      // Inset accent panel
      if (o.w >= 12 && o.h >= 8) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + 3, o.top + 3.5, o.w - 6, o.h - 6.5);

        // Center grip dash
        ctx.fillStyle = '#000000';
        ctx.fillRect(ox + Math.round(o.w / 2) - 4, o.top + 4.5, 8, 2);
      }
    } else if (o.type === 'pad') {
      // Jump Pad - Base Plate with Upward Spring Triangle
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox + 2, o.top + o.h - 6, o.w - 4, 6);
      ctx.beginPath();
      ctx.moveTo(ox + o.w / 2, o.top + 2);
      ctx.lineTo(ox + o.w - 4, o.top + o.h - 7);
      ctx.lineTo(ox + 4, o.top + o.h - 7);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'ring') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ox + 12, o.top + 12, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (o.type === 'gravup') {
      // Grav Up Portal - Frame with UP Arrow
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ox + 2, o.top + 2, o.w - 4, o.h - 4);
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(ox + 12, o.top + 5);
      ctx.lineTo(ox + 18, o.top + 13);
      ctx.lineTo(ox + 14, o.top + 13);
      ctx.lineTo(ox + 14, o.top + 19);
      ctx.lineTo(ox + 10, o.top + 19);
      ctx.lineTo(ox + 10, o.top + 13);
      ctx.lineTo(ox + 6, o.top + 13);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'gravdown') {
      // Grav Down Portal - Frame with DOWN Arrow
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ox + 2, o.top + 2, o.w - 4, o.h - 4);
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(ox + 12, o.top + 19);
      ctx.lineTo(ox + 18, o.top + 11);
      ctx.lineTo(ox + 14, o.top + 11);
      ctx.lineTo(ox + 14, o.top + 5);
      ctx.lineTo(ox + 10, o.top + 5);
      ctx.lineTo(ox + 10, o.top + 11);
      ctx.lineTo(ox + 6, o.top + 11);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'shipon') {
      // Ship Portal - Oval Arch with Rocket
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ox + 12, o.top + 12, 10, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(ox + 19, o.top + 12);
      ctx.lineTo(ox + 6, o.top + 6);
      ctx.lineTo(ox + 10, o.top + 12);
      ctx.lineTo(ox + 6, o.top + 18);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'shipoff') {
      // Cube Portal - Oval Arch with Mini Cube
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ox + 12, o.top + 12, 10, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox + 7, o.top + 7, 10, 10);
    } else if (o.type === 'ballon') {
      // Ball Portal - Oval Arch with Rolling Ball
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ox + 12, o.top + 12, 10, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ox + 12, o.top + 12, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else if (o.type === 'ufoon') {
      // UFO Portal - Oval Arch with Saucer
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ox + 12, o.top + 12, 10, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ox + 12, o.top + 13, 6, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else if (o.type === 'waveon') {
      // Wave Portal - Oval Arch with Arrow Dart
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ox + 12, o.top + 12, 10, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(ox + 17, o.top + 12);
      ctx.lineTo(ox + 8, o.top + 7);
      ctx.lineTo(ox + 10, o.top + 12);
      ctx.lineTo(ox + 8, o.top + 17);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'roboton') {
      // Robot Portal - Arch with Visor
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ox + 12, o.top + 12, 10, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(ox + 7, o.top + 7, 10, 10);
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox + 9, o.top + 10, 6, 2);
    } else if (o.type === 'swingon') {
      // Swing Portal - Arch with Gyro Ring
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ox + 12, o.top + 12, 10, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ox + 12, o.top + 12, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox + 6, o.top + 11, 12, 2);
    } else if (o.type === 'startpos') {
      // StartPos Object: Diamond marker with inner circle and 'S'
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox + 12, o.top + 2);
      ctx.lineTo(ox + 22, o.top + 12);
      ctx.lineTo(ox + 12, o.top + 22);
      ctx.lineTo(ox + 2, o.top + 12);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ox + 12, o.top + 12, 5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', ox + 12, o.top + 12);
    } else if (o.type === 'saw') {
      // Spinning Circular Saw Blade
      const scx = ox + o.w / 2;
      const scy = o.top + o.h / 2;
      const sRad = o.w / 2 - 2;
      const spin = (eng.frame * 0.15) % (Math.PI * 2);
      ctx.save();
      ctx.translate(scx, scy);
      ctx.rotate(spin);
      ctx.beginPath();
      const teeth = 8;
      for (let t = 0; t < teeth * 2; t++) {
        const r = t % 2 === 0 ? sRad : sRad * 0.65;
        const a = (t * Math.PI) / teeth;
        if (t === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
        else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
    } else if (['zoomin', 'zoomout', 'zoomreset'].includes(o.type)) {
      // Camera Zoom Trigger
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(ox + 2, o.top + 2, o.w - 4, o.h - 4);
      ctx.setLineDash([]);

      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = o.type === 'zoomin' ? 'Z+' : (o.type === 'zoomout' ? 'Z-' : 'Z1x');
      ctx.fillText(label, ox + 12, o.top + 12);
    } else if (o.type === 'speed05' || o.type === 'speed1' || o.type === 'speed2' || o.type === 'speed3') {
      // Speed Portals
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + 3, o.top + 2, o.w - 6, o.h - 4);
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = o.type === 'speed05' ? '<' : (o.type === 'speed1' ? '>' : (o.type === 'speed2' ? '>>' : '>>>'));
      ctx.fillText(label, ox + 12, o.top + 12);
    } else if (o.type === 'gear') {
      if (!o.taken) {
        // Arcade Coin
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox + 12, o.top + 12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ox + 12, o.top + 12, 5, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.fillRect(ox + 11, o.top + 9, 2, 6);
      }
    } else if (o.type === 'end') {
      // Full-Height Checkered Finish Line
      const finishTop = CEIL_Y - 20;
      const finishH = FLOOR_Y - finishTop;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 4, finishTop, 16, finishH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ox + 4, finishTop, 16, finishH);

      // Alternating Checkered pattern
      ctx.fillStyle = '#000000';
      const rowsCount = Math.floor(finishH / 8);
      for (let cy = 0; cy < rowsCount; cy++) {
        for (let cx = 0; cx < 2; cx++) {
          if ((cx + cy) % 2 === 0) {
            ctx.fillRect(ox + 4 + cx * 8, finishTop + cy * 8, 8, 8);
          }
        }
      }

      // Finish Banner on Top
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox - 8, finishTop - 14, 40, 14);
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FINISH', ox + 12, finishTop - 7);
    }
  }

  // Restore camera translation
  ctx.restore();
}
