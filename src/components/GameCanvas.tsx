/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  LevelData,
  Obstacle,
  Checkpoint,
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
    finishX: 8000,
    speedScale: 1.0,
    grav: 1,
    mode: 'cube' as 'cube' | 'ship',
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
    const { obstacles, finishX, gearTotal } = parseLevelToObstacles(level);
    engineRef.current.obstacles = obstacles;
    engineRef.current.finishX = finishX;
    engineRef.current.gearTotal = gearTotal;
    engineRef.current.scrollX = 0;
    engineRef.current.speedScale = 1.0;
    engineRef.current.grav = 1;
    engineRef.current.mode = 'cube';
    engineRef.current.deathTimer = 0;
    engineRef.current.frame = 0;
    engineRef.current.checkpoints = [];
    engineRef.current.player = {
      y: FLOOR_Y - PLAYER_SIZE,
      vy: 0,
      rotation: 0,
      grounded: true,
      coyote: 0,
      buffer: 0
    };

    setIsDead(false);
    setIsCompleted(false);
    setIsPaused(false);
    setIsPlaying(true);
    setPct(0);
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
        eng.player.vy = (eng.mode === 'ship' ? -8 : JUMP_FORCE * 0.95) * eng.grav;
        eng.player.grounded = false;
        o.used = true;
        o.inZone = false;
        setRunJumps(j => j + 1);
        return;
      }
    }

    if (eng.mode === 'cube') {
      eng.player.buffer = JUMP_BUFFER_MAX;
      setRunJumps(j => j + 1);
    }
  }, [isDead, isPaused, isCompleted]);

  const queueInput = useCallback((isDown: boolean) => {
    if (!einkConfig.enabled || einkConfig.inputLagMs <= 0) {
      engineRef.current.inputHeld = isDown;
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
      pct
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
          const vx = level.speed * eng.speedScale;

          if (eng.mode === 'ship') {
            const prevTop = eng.player.y;
            eng.player.vy += (eng.inputHeld ? SHIP_RISE : SHIP_FALL) * eng.grav;
            if (eng.player.vy > SHIP_TERMINAL) eng.player.vy = SHIP_TERMINAL;
            if (eng.player.vy < -SHIP_TERMINAL) eng.player.vy = -SHIP_TERMINAL;
            eng.player.y += eng.player.vy;
            eng.scrollX += vx;

            const shipBottom = FLOOR_Y - SHIP_H;
            if (eng.player.y > shipBottom) { eng.player.y = shipBottom; eng.player.vy = 0; }
            if (eng.player.y < CEIL_Y) { eng.player.y = CEIL_Y; eng.player.vy = 0; }

            const tilt = eng.player.vy * 0.055 * eng.grav;
            eng.player.rotation += (Math.max(-0.5, Math.min(0.5, tilt)) - eng.player.rotation) * 0.2;

            const pw2 = SHIP_H * 0.8;
            const off2 = (SHIP_H - pw2) / 2;
            const sx2 = PLAYER_X + 3;
            const sy2 = eng.player.y + off2;
            const prevTopOff = prevTop + off2;
            const prevBottomOff = prevTopOff + pw2;
            const prevRightOff = sx2 + 24 - vx;

            for (let si = 0; si < eng.obstacles.length; si++) {
              const so = eng.obstacles[si];
              if (so.x < eng.scrollX - 200 || so.x > eng.scrollX + CANVAS_W + 200) continue;
              const sox = so.x - eng.scrollX;
              if (!(sx2 < sox + so.w && sx2 + 24 > sox && sy2 + pw2 > so.top && sy2 < so.top + so.h)) {
                if (so.type === 'ring') so.inZone = false;
                continue;
              }

              if (['spike', 'double', 'triple', 'ceilspike', 'spikeblock'].includes(so.type)) {
                triggerDeath();
                break;
              } else if (['block', 'pillar', 'hangpillar', 'platform'].includes(so.type)) {
                if (eng.grav === 1) {
                  if (prevBottomOff <= so.top + 10 && eng.player.vy >= 0) {
                    // Landing/sliding on top of block or platform
                    eng.player.y = so.top - SHIP_H;
                    eng.player.vy = 0;
                  } else if (prevTopOff >= so.top + so.h - 10 && eng.player.vy <= 0) {
                    // Bumping underside of block/hanging pillar
                    eng.player.y = so.top + so.h;
                    eng.player.vy = Math.max(0, eng.player.vy);
                  } else if (prevRightOff <= sox + 8) {
                    // Head-on crash into front wall
                    triggerDeath();
                    break;
                  } else {
                    triggerDeath();
                    break;
                  }
                } else {
                  // Inverted gravity
                  if (prevTopOff >= so.top + so.h - 10 && eng.player.vy <= 0) {
                    eng.player.y = so.top + so.h;
                    eng.player.vy = 0;
                  } else if (prevBottomOff <= so.top + 10 && eng.player.vy >= 0) {
                    eng.player.y = so.top - SHIP_H;
                    eng.player.vy = Math.min(0, eng.player.vy);
                  } else if (prevRightOff <= sox + 8) {
                    triggerDeath();
                    break;
                  } else {
                    triggerDeath();
                    break;
                  }
                }
              } else if (so.type === 'pad') {
                eng.player.vy = -10 * eng.grav;
              } else if (so.type === 'ring') {
                so.inZone = true;
              } else if (so.type === 'gravup') {
                if (eng.grav === 1) { eng.grav = -1; eng.player.vy = -3; }
              } else if (so.type === 'gravdown') {
                if (eng.grav === -1) { eng.grav = 1; eng.player.vy = 3; }
              } else if (so.type === 'shipoff') {
                eng.mode = 'cube';
                eng.player.grounded = false;
              } else if (so.type === 'gear' && !so.taken) {
                so.taken = true;
                setRunGears(g => g + 1);
              } else if (so.type === 'end') {
                triggerCompletion();
                break;
              }
            }
          } else {
            // Cube Physics Mode
            if (eng.player.buffer > 0) eng.player.buffer--;
            if (eng.player.coyote > 0) eng.player.coyote--;

            if (eng.inputHeld && eng.player.grounded && eng.player.buffer === 0) {
              eng.player.buffer = 2;
            }

            if (eng.player.buffer > 0 && (eng.player.grounded || eng.player.coyote > 0)) {
              eng.player.vy = JUMP_FORCE * eng.grav;
              eng.player.grounded = false;
              eng.player.coyote = 0;
              eng.player.buffer = 0;
            }

            eng.player.vy += BASE_GRAVITY * eng.grav;
            if (eng.player.vy > TERMINAL_VELOCITY) eng.player.vy = TERMINAL_VELOCITY;
            if (eng.player.vy < -TERMINAL_VELOCITY) eng.player.vy = -TERMINAL_VELOCITY;

            const prevTop = eng.player.y;
            eng.player.y += eng.player.vy;
            eng.scrollX += vx;

            let touching = false;
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

            if (!touching) eng.player.rotation += 0.09 * eng.grav;

            const pw = PLAYER_SIZE * 0.8;
            const off = (PLAYER_SIZE - pw) / 2;
            const px = PLAYER_X + off;
            const py = eng.player.y + off;
            const prevTopOff = prevTop + off;
            const prevBottomOff = prevTopOff + pw;
            const prevRightOff = px + pw - vx;

            for (let i = 0; i < eng.obstacles.length; i++) {
              const o = eng.obstacles[i];
              if (o.x < eng.scrollX - 200 || o.x > eng.scrollX + CANVAS_W + 200) continue;
              const ox = o.x - eng.scrollX;
              const overlap = (px < ox + o.w && px + pw > ox && py + pw > o.top && py < o.top + o.h);

              if (!overlap) {
                if (o.type === 'ring') o.inZone = false;
                continue;
              }

              if (o.type === 'spike' || o.type === 'double' || o.type === 'triple') {
                const segs = o.type === 'spike' ? 1 : (o.type === 'double' ? 2 : 3);
                for (let s = 0; s < segs; s++) {
                  const sx = ox + s * 30;
                  if (px + pw > sx + 5 && px < sx + 25 && py + pw > o.top + 10) {
                    triggerDeath();
                    break;
                  }
                }
              } else if (o.type === 'ceilspike') {
                if (px + pw > ox + 5 && px < ox + o.w - 5 && py < o.top + 20) {
                  triggerDeath();
                  break;
                }
              } else if (['block', 'pillar', 'platform'].includes(o.type)) {
                if (eng.grav === 1) {
                  if (prevBottomOff <= o.top + 11 && eng.player.vy >= 0) {
                    eng.player.y = o.top - PLAYER_SIZE;
                    eng.player.vy = 0;
                    eng.player.grounded = true;
                    touching = true;
                  } else if (prevRightOff <= ox + 8) {
                    triggerDeath();
                    break;
                  }
                } else {
                  if (prevTopOff >= o.top + o.h - 11 && eng.player.vy <= 0) {
                    eng.player.y = o.top + o.h;
                    eng.player.vy = 0;
                    eng.player.grounded = true;
                    touching = true;
                  } else if (prevRightOff <= ox + 8) {
                    triggerDeath();
                    break;
                  }
                }
              } else if (o.type === 'pad') {
                eng.player.vy = JUMP_FORCE * 1.3 * eng.grav;
                eng.player.grounded = false;
              } else if (o.type === 'ring') {
                o.inZone = true;
              } else if (o.type === 'gravup') {
                if (eng.grav === 1) { eng.grav = -1; eng.player.grounded = false; eng.player.vy = -3; }
              } else if (o.type === 'gravdown') {
                if (eng.grav === -1) { eng.grav = 1; eng.player.grounded = false; eng.player.vy = 3; }
              } else if (o.type === 'shipon') {
                eng.mode = 'ship';
                eng.player.grounded = false;
              } else if (o.type === 'gear' && !o.taken) {
                o.taken = true;
                setRunGears(g => g + 1);
              } else if (o.type === 'end') {
                triggerCompletion();
                break;
              }
            }

            if (!touching && eng.player.grounded) {
              eng.player.grounded = false;
              eng.player.coyote = COYOTE_TIME_MAX;
            }
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
          renderScene(offCtx, eng, isDead);
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
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', width: '100%', maxWidth: '512px' }}>
          <button className="sys-btn" style={{ flex: 1 }} onClick={dropCheckpoint}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', width: '200px' }}>
            {hasNextLevel && onNextLevel && (
              <button className="sys-btn" onClick={onNextLevel}>
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
function renderScene(ctx: CanvasRenderingContext2D, eng: any, isDead: boolean) {
  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Ceil & Floor boundaries
  ctx.fillStyle = '#000000';
  if (eng.grav === -1) ctx.fillRect(0, CEIL_Y - 4, CANVAS_W, 4);
  ctx.fillRect(0, FLOOR_Y - 2, CANVAS_W, 4);

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

    if (o.type === 'spike') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ox, o.top + o.h);
      ctx.lineTo(ox + o.w / 2, o.top);
      ctx.lineTo(ox + o.w, o.top + o.h);
      ctx.stroke();
    } else if (o.type === 'ceilspike') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ox, o.top);
      ctx.lineTo(ox + o.w / 2, o.top + o.h);
      ctx.lineTo(ox + o.w, o.top);
      ctx.stroke();
    } else if (['block', 'pillar'].includes(o.type)) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, o.top, o.w, o.h);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(ox, o.top, o.w, o.h);
    } else if (o.type === 'platform') {
      // Floating Platform - Structure Deck with Top Rail & Vertical Support Struts
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, o.top, o.w, o.h);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ox, o.top, o.w, o.h);
      ctx.fillStyle = '#000000';
      ctx.fillRect(ox, o.top, o.w, 3); // Solid top surface rail
      for (let sx = 4; sx < o.w - 2; sx += 8) {
        ctx.fillRect(ox + sx, o.top + 3, 2, o.h - 4); // Support struts
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
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(ox, o.top, o.w, o.h);
      ctx.fillStyle = '#000000';
      for (let cy = 0; cy < o.h / 8; cy++) {
        for (let cx = 0; cx < o.w / 8; cx++) {
          if ((cx + cy) % 2 === 0) {
            ctx.fillRect(ox + cx * 8, o.top + cy * 8, 8, 8);
          }
        }
      }
    }
  }
}
