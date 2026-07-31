/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelData } from '../types';

/**
 * Generates a self-contained, single-file HTML document containing the engine,
 * the physics, e-ink simulation options, System 7 theme, and embedded level data.
 */
export function generateSingleFileHTML(level: LevelData, allLevels?: LevelData[]): string {
  const levelList = allLevels && allLevels.length > 0 ? allLevels : [level];
  const levelJson = JSON.stringify(levelList, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <meta charset="UTF-8">
    <title>Cube Dash - ${escapeHtml(level.name)}</title>
    <style>
        :root {
            --border: 2px solid #000000;
            --shadow: 4px 4px 0px #000000;
            --stripe-pattern: repeating-linear-gradient(0deg, transparent, transparent 2px, #000 3px, #000 4px);
        }
        * { box-sizing: border-box; user-select: none; transition: none !important; animation: none !important; }
        body {
            image-rendering: pixelated;
            font-family: "Geneva", "Verdana", "Courier New", monospace, sans-serif;
            background-color: #e5e5e5;
            margin: 0; padding: 10px; min-height: 100vh;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .window {
            background: white; border: var(--border); box-shadow: var(--shadow);
            display: flex; flex-direction: column; width: 100%; max-width: 600px;
            max-height: 95vh; overflow-y: auto; position: relative;
        }
        .title-bar {
            height: 35px; border-bottom: var(--border); display: flex;
            align-items: center; justify-content: center; background: white;
            padding: 0 10px; position: relative; flex-shrink: 0;
        }
        .title-stripes {
            position: absolute; top: 4px; bottom: 4px; left: 4px; right: 4px;
            background-image: var(--stripe-pattern); z-index: 0;
        }
        .title-text {
            background: white; padding: 0 12px; font-weight: bold; z-index: 1; font-size: 1.0rem;
        }
        .title-right {
            position: absolute; right: 10px; z-index: 2; background: white;
            padding: 0 4px; font-family: "Courier New", monospace; font-size: 0.8rem; font-weight: bold;
        }
        .window-content { padding: 12px; display: flex; flex-direction: column; align-items: center; background: white; }
        .hud-row {
            display: flex; align-items: center; justify-content: space-between;
            width: 100%; font-family: "Courier New", monospace; font-weight: bold; font-size: 0.8rem;
        }
        .progress-outer { margin-top: 6px; width: 100%; height: 12px; border: var(--border); background: white; }
        #progress-fill { height: 100%; width: 0%; background: black; }
        canvas {
            display: block; margin: 10px auto 0 auto; border: 4px solid black;
            box-shadow: 4px 4px 0 black; background: white; image-rendering: pixelated; touch-action: none;
            width: 100%; max-width: 512px; height: auto;
        }
        .sys-btn {
            background: white; border: var(--border); box-shadow: 3px 3px 0 black;
            font-family: inherit; font-weight: bold; font-size: 0.85rem; padding: 6px 12px; cursor: pointer;
        }
        .sys-btn:active { background: black; color: white; transform: translate(2px, 2px); box-shadow: none; }
        .overlay {
            display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: white; z-index: 20; flex-direction: column; align-items: center;
            justify-content: center; padding: 20px; text-align: center;
        }
        .overlay.active { display: flex; }
        .btn-group { display: flex; margin-top: 8px; width: 100%; }
        .btn-group button { flex: 1; margin-right: 6px; }
        .btn-group button:last-child { margin-right: 0; }
    </style>
</head>
<body>
<div class="window">
    <div class="title-bar">
        <div class="title-stripes"></div>
        <span class="title-text">CUBE DASH (SINGLE-FILE RUNTIME)</span>
        <span class="title-right" id="pct-badge">0%</span>
    </div>
    <div class="window-content">
        <div class="hud-row">
            <span id="hud-name">${escapeHtml(level.name)}</span>
            <span id="hud-msg">ATTEMPT 1</span>
            <button class="sys-btn" id="btn-pause" onclick="togglePause()">II</button>
        </div>
        <div class="progress-outer"><div id="progress-fill"></div></div>
        <canvas id="gameCanvas" width="512" height="288"></canvas>
        <div class="btn-group" style="margin-top: 10px;">
            <button class="sys-btn" onclick="dropCheckpoint()">+ CHECKPOINT</button>
            <button class="sys-btn" onclick="clearCheckpoint()">- CLEAR CP</button>
            <button class="sys-btn" onclick="restartLevel()">RESTART</button>
        </div>
    </div>
    <div class="overlay" id="overlay-pause">
        <h2>PAUSED</h2>
        <p id="pause-info"></p>
        <button class="sys-btn" onclick="togglePause()" style="margin-bottom:8px;">RESUME</button>
        <button class="sys-btn" onclick="restartLevel()">RESTART</button>
    </div>
    <div class="overlay" id="overlay-complete">
        <h2>LEVEL COMPLETE!</h2>
        <p id="complete-info"></p>
        <button class="sys-btn" onclick="restartLevel()">PLAY AGAIN</button>
    </div>
</div>

<script>
    var EMBEDDED_LEVELS = ${levelJson};
    var currentLvlIdx = 0;
    var level = EMBEDDED_LEVELS[0];

    var TILE_SIZE = 24, CANVAS_W = 512, CANVAS_H = 288, ROWS = 12;
    var FLOOR_Y = 240, CEIL_Y = 48, PLAYER_SIZE = 24, PLAYER_X = 96;
    var TARGET_FPS = 60, FIXED_TIMESTEP = 1000 / TARGET_FPS;
    var BASE_GRAVITY = 1.0, TERMINAL_VELOCITY = 13, JUMP_FORCE = -14, COYOTE_TIME_MAX = 6, JUMP_BUFFER_MAX = 7;
    var SHIP_H = 20, SHIP_RISE = -0.85, SHIP_FALL = 0.65, SHIP_TERMINAL = 6.5;

    var canvas = document.getElementById('gameCanvas');
    var ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;

    var state = {
        isPlaying: true, isPaused: false, isDead: false, isCompleted: false,
        scrollX: 0, finishX: 8000, pct: 0, speedScale: 1.0, grav: 1, mode: 'cube',
        attempts: 1, checkpoints: []
    };
    var inputHeld = false;
    var obstacles = [];
    var player = { y: FLOOR_Y - PLAYER_SIZE, vy: 0, rotation: 0, grounded: true, coyote: 0, buffer: 0 };

    function parseGrid() {
        obstacles = [];
        state.finishX = 8000;
        if (!level.grid) return;
        for (var r = 0; r < level.grid.length; r++) {
            var row = level.grid[r];
            for (var c = 0; c < row.length; c++) {
                var ch = row[c];
                if (ch === '.') continue;
                var x = c * TILE_SIZE, y = r * TILE_SIZE;
                if (ch === 's') obstacles.push({ type: 'spike', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE });
                else if (ch === 'c') obstacles.push({ type: 'ceilspike', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE });
                else if (ch === 'b') obstacles.push({ type: 'block', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE });
                else if (ch === 'B') obstacles.push({ type: 'platform', x: x, top: y, w: TILE_SIZE, h: 12 });
                else if (ch === 'p') obstacles.push({ type: 'pad', x: x, top: y + 16, w: TILE_SIZE, h: 8 });
                else if (ch === 'r') obstacles.push({ type: 'ring', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE, inZone: false, used: false });
                else if (ch === 'g') obstacles.push({ type: 'gravup', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE });
                else if (ch === 'n') obstacles.push({ type: 'gravdown', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE });
                else if (ch === 'w') obstacles.push({ type: 'shipon', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE });
                else if (ch === 'q') obstacles.push({ type: 'shipoff', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE });
                else if (ch === 'e') {
                    obstacles.push({ type: 'end', x: x, top: y, w: TILE_SIZE, h: TILE_SIZE });
                    if (x < state.finishX) state.finishX = x;
                }
            }
        }
    }

    function restartLevel() {
        state.isDead = false; state.isCompleted = false; state.isPaused = false;
        state.scrollX = 0; state.pct = 0; state.grav = 1; state.mode = 'cube';
        state.checkpoints = []; player.y = FLOOR_Y - PLAYER_SIZE; player.vy = 0; player.rotation = 0;
        document.getElementById('overlay-pause').className = 'overlay';
        document.getElementById('overlay-complete').className = 'overlay';
        parseGrid(); state.isPlaying = true;
    }

    function dropCheckpoint() {
        if (!state.isPlaying || state.isDead || state.isPaused) return;
        state.checkpoints.push({
            scrollX: state.scrollX, playerY: player.y, playerVy: player.vy,
            playerRotation: player.rotation, grav: state.grav, mode: state.mode, pct: state.pct
        });
    }

    function clearCheckpoint() { state.checkpoints.pop(); }

    function restoreCheckpoint() {
        if (state.checkpoints.length === 0) { restartLevel(); return; }
        var cp = state.checkpoints[state.checkpoints.length - 1];
        state.scrollX = cp.scrollX; player.y = cp.playerY; player.vy = cp.playerVy;
        player.rotation = cp.playerRotation; state.grav = cp.grav; state.mode = cp.mode;
        state.pct = cp.pct; state.isDead = false; state.isPlaying = true;
    }

    function triggerDeath() {
        state.isDead = true;
        setTimeout(function() {
            if (state.checkpoints.length > 0) restoreCheckpoint();
            else { state.attempts++; restartLevel(); }
        }, 400);
    }

    function triggerCompletion() {
        state.isCompleted = true; state.isPlaying = false;
        document.getElementById('complete-info').innerText = level.name + ' - 100% (Attempts: ' + state.attempts + ')';
        document.getElementById('overlay-complete').className = 'overlay active';
    }

    function togglePause() {
        state.isPaused = !state.isPaused;
        if (state.isPaused) {
            document.getElementById('pause-info').innerText = level.name + ' - ' + state.pct + '%';
            document.getElementById('overlay-pause').className = 'overlay active';
        } else {
            document.getElementById('overlay-pause').className = 'overlay';
        }
    }

    function executeJump() {
        if (!state.isPlaying || state.isDead || state.isPaused || state.isCompleted) return;
        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.type === 'ring' && o.inZone && !o.used) {
                player.vy = (state.mode === 'ship' ? -8 : JUMP_FORCE * 0.95) * state.grav;
                player.grounded = false; o.used = true; o.inZone = false; return;
            }
        }
        if (state.mode === 'cube') player.buffer = JUMP_BUFFER_MAX;
    }

    function updatePhysics() {
        if (!state.isPlaying || state.isDead || state.isPaused || state.isCompleted) return;
        var speed = level.speed || 6.0; var vx = speed * state.speedScale;

        if (state.mode === 'ship') {
            player.vy += (inputHeld ? SHIP_RISE : SHIP_FALL) * state.grav;
            if (player.vy > SHIP_TERMINAL) player.vy = SHIP_TERMINAL;
            if (player.vy < -SHIP_TERMINAL) player.vy = -SHIP_TERMINAL;
            player.y += player.vy; state.scrollX += vx;
            if (player.y > FLOOR_Y - SHIP_H) { player.y = FLOOR_Y - SHIP_H; player.vy = 0; }
            if (player.y < CEIL_Y) { player.y = CEIL_Y; player.vy = 0; }

            for (var si = 0; si < obstacles.length; si++) {
                var so = obstacles[si];
                if (so.x < state.scrollX - 100 || so.x > state.scrollX + CANVAS_W + 100) continue;
                var sox = so.x - state.scrollX;
                if (!(PLAYER_X < sox + so.w && PLAYER_X + 24 > sox && player.y + 16 > so.top && player.y < so.top + so.h)) continue;
                if (so.type === 'spike' || so.type === 'ceilspike') triggerDeath();
                else if (so.type === 'block' || so.type === 'platform') {
                    if (state.grav === 1) {
                        if (player.y + 16 <= so.top + 10 && player.vy >= 0) { player.y = so.top - SHIP_H; player.vy = 0; }
                        else if (player.y >= so.top + so.h - 10 && player.vy <= 0) { player.y = so.top + so.h; player.vy = 0; }
                        else { triggerDeath(); return; }
                    } else {
                        if (player.y >= so.top + so.h - 10 && player.vy <= 0) { player.y = so.top + so.h; player.vy = 0; }
                        else if (player.y + 16 <= so.top + 10 && player.vy >= 0) { player.y = so.top - SHIP_H; player.vy = 0; }
                        else { triggerDeath(); return; }
                    }
                }
                else if (so.type === 'pad') { player.vy = -10 * state.grav; }
                else if (so.type === 'gravup') { if (state.grav === 1) { state.grav = -1; player.vy = -3; } }
                else if (so.type === 'gravdown') { if (state.grav === -1) { state.grav = 1; player.vy = 3; } }
                else if (so.type === 'shipoff') { state.mode = 'cube'; player.grounded = false; }
                else if (so.type === 'end') { triggerCompletion(); return; }
            }
        } else {
            if (player.buffer > 0) player.buffer--;
            if (player.coyote > 0) player.coyote--;
            if (inputHeld && player.grounded && player.buffer === 0) player.buffer = 2;

            if (player.buffer > 0 && (player.grounded || player.coyote > 0)) {
                player.vy = JUMP_FORCE * state.grav; player.grounded = false; player.coyote = 0; player.buffer = 0;
            }

            player.vy += BASE_GRAVITY * state.grav;
            if (player.vy > TERMINAL_VELOCITY) player.vy = TERMINAL_VELOCITY;
            if (player.vy < -TERMINAL_VELOCITY) player.vy = -TERMINAL_VELOCITY;

            var prevTop = player.y; player.y += player.vy; state.scrollX += vx;
            var touching = false;

            if (state.grav === 1) {
                if (player.y >= FLOOR_Y - PLAYER_SIZE) { player.y = FLOOR_Y - PLAYER_SIZE; player.vy = 0; player.grounded = true; touching = true; }
            } else {
                if (player.y <= CEIL_Y) { player.y = CEIL_Y; player.vy = 0; player.grounded = true; touching = true; }
            }
            if (!touching) player.rotation += 0.09 * state.grav;

            for (var i = 0; i < obstacles.length; i++) {
                var o = obstacles[i];
                if (o.x < state.scrollX - 100 || o.x > state.scrollX + CANVAS_W + 100) continue;
                var ox = o.x - state.scrollX;
                if (!(PLAYER_X < ox + o.w && PLAYER_X + 24 > ox && player.y + 24 > o.top && player.y < o.top + o.h)) continue;

                if (o.type === 'spike' || o.type === 'ceilspike') { triggerDeath(); return; }
                else if (o.type === 'block' || o.type === 'platform') {
                    if (state.grav === 1) {
                        if (prevTop + 24 <= o.top + 11 && player.vy >= 0) { player.y = o.top - PLAYER_SIZE; player.vy = 0; player.grounded = true; touching = true; }
                        else { triggerDeath(); return; }
                    } else {
                        if (prevTop >= o.top + o.h - 11 && player.vy <= 0) { player.y = o.top + o.h; player.vy = 0; player.grounded = true; touching = true; }
                        else { triggerDeath(); return; }
                    }
                } else if (o.type === 'pad') { player.vy = JUMP_FORCE * 1.3 * state.grav; player.grounded = false; }
                else if (o.type === 'shipon') { state.mode = 'ship'; player.grounded = false; }
                else if (o.type === 'gravup') { if (state.grav === 1) { state.grav = -1; player.vy = -3; } }
                else if (o.type === 'gravdown') { if (state.grav === -1) { state.grav = 1; player.vy = 3; } }
                else if (o.type === 'end') { triggerCompletion(); return; }
            }
            if (!touching && player.grounded) { player.grounded = false; player.coyote = COYOTE_TIME_MAX; }
        }

        var pct = Math.min(100, Math.max(0, Math.floor((state.scrollX / (state.finishX - PLAYER_X)) * 100)));
        state.pct = pct;
        document.getElementById('progress-fill').style.width = pct + '%';
        document.getElementById('pct-badge').innerText = pct + '%';
    }

    function drawFrame() {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, CEIL_Y - 4, CANVAS_W, 4);
        ctx.fillRect(0, FLOOR_Y, CANVAS_W, 4);

        for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i]; var ox = Math.round(o.x - state.scrollX);
            if (ox < -30 || ox > CANVAS_W + 30) continue;
            if (o.type === 'spike') {
                ctx.beginPath(); ctx.moveTo(ox, o.top + o.h); ctx.lineTo(ox + o.w / 2, o.top); ctx.lineTo(ox + o.w, o.top + o.h); ctx.fill();
            } else if (o.type === 'block') {
                ctx.strokeRect(ox, o.top, o.w, o.h);
            } else if (o.type === 'platform') {
                ctx.fillStyle = '#ffffff'; ctx.fillRect(ox, o.top, o.w, o.h);
                ctx.strokeRect(ox, o.top, o.w, o.h);
                ctx.fillStyle = '#000000'; ctx.fillRect(ox, o.top, o.w, 3);
            } else if (o.type === 'pad') {
                ctx.fillStyle = '#000000'; ctx.fillRect(ox + 2, o.top + o.h - 6, o.w - 4, 6);
                ctx.beginPath(); ctx.moveTo(ox + o.w / 2, o.top + 2); ctx.lineTo(ox + o.w - 4, o.top + o.h - 7); ctx.lineTo(ox + 4, o.top + o.h - 7); ctx.closePath(); ctx.fill();
            }
            } else if (o.type === 'end') {
                ctx.strokeRect(ox, o.top, o.w, o.h);
            }
        }

        ctx.strokeRect(PLAYER_X, player.y, PLAYER_SIZE, PLAYER_SIZE);
    }

    var lastTime = performance.now(), accumulator = 0;
    function loop(now) {
        var delta = now - lastTime; lastTime = now;
        if (delta > 100) delta = 100; accumulator += delta;
        while (accumulator >= FIXED_TIMESTEP) { updatePhysics(); accumulator -= FIXED_TIMESTEP; }
        drawFrame(); requestAnimationFrame(loop);
    }

    window.addEventListener('keydown', function(e) {
        if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); if (!inputHeld) executeJump(); inputHeld = true; }
        if (e.key === 'Escape') togglePause();
    });
    window.addEventListener('keyup', function(e) { if (e.key === ' ' || e.key === 'ArrowUp') inputHeld = false; });
    canvas.addEventListener('touchstart', function(e) { e.preventDefault(); if (!inputHeld) executeJump(); inputHeld = true; });
    canvas.addEventListener('touchend', function() { inputHeld = false; });

    parseGrid();
    requestAnimationFrame(loop);
</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
