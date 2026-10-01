/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Level Editor Component
 * Compliant with Kindle Browser Compatibility Guide (No flex gap, ES2019, SystemModal instead of alert/prompt).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LevelData,
  TileType,
  EInkConfig,
  TILE_TYPES,
  TILE_SIZE,
  CANVAS_W,
  CANVAS_H,
  ROWS,
  FLOOR_Y,
  CEIL_Y
} from '../types';
import { GameCanvas } from './GameCanvas';
import { generateSingleFileHTML } from '../utils/singleHtmlExporter';
import { SystemModal, ModalConfig } from './SystemModal';
import { Download, Play, Edit3, Copy, FileText, Save, UploadCloud, FileUp } from 'lucide-react';
import { isPCDevice } from '../utils/device';
import { parseGMDContent } from '../utils/gmdParser';

interface LevelEditorProps {
  initialLevel?: LevelData;
  einkConfig: EInkConfig;
  onSaveToCommunity: (level: LevelData) => void;
  onQuitToMenu: () => void;
}

export const LevelEditor: React.FC<LevelEditorProps> = ({
  initialLevel,
  einkConfig,
  onSaveToCommunity,
  onQuitToMenu
}) => {
  const [appMode, setAppMode] = useState<'edit' | 'play'>('edit');
  const [lvlName, setLvlName] = useState<string>((initialLevel && initialLevel.name) ? initialLevel.name : 'MY GRID LEVEL');
  const [lvlAuthor, setLvlAuthor] = useState<string>((initialLevel && initialLevel.author) ? initialLevel.author : 'Creator');
  const [lvlDiff, setLvlDiff] = useState<number>((initialLevel && typeof initialLevel.diff === 'number') ? initialLevel.diff : 1);
  const [lvlSpeed, setLvlSpeed] = useState<number>(() => {
    if (initialLevel && typeof initialLevel.speed === 'number') {
      return initialLevel.speed <= 2.5 ? initialLevel.speed : 1.0;
    }
    return 1.0;
  });
  const [lvlCols, setLvlCols] = useState<number>((initialLevel && initialLevel.cols) ? initialLevel.cols : 60);
  const [currentTile, setCurrentTile] = useState<string>('s');
  const [editorScrollX, setEditorScrollX] = useState<number>(0);
  const [exportText, setExportText] = useState<string>('');
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  // PC Device Detection for .GMD Import
  const [isPC, setIsPC] = useState<boolean>(false);
  const gmdEditorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsPC(isPCDevice());
  }, []);

  // 12-row grid data matrix state
  const [gridData, setGridData] = useState<string[][]>(() => {
    if (initialLevel && initialLevel.grid && initialLevel.grid.length === ROWS) {
      return initialLevel.grid.map((rowStr: string) => rowStr.split(''));
    }
    const cols = (initialLevel && initialLevel.cols) ? initialLevel.cols : 60;
    const g = Array.from({ length: ROWS }, () => Array(cols).fill('.'));
    // Add default finish line at end
    for (let r = 2; r < 10; r++) g[r][cols - 2] = 'e';
    return g;
  });

  const [noCeiling, setNoCeiling] = useState<boolean>(initialLevel?.noCeiling ?? false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMouseDownRef = useRef<boolean>(false);

  // Resize column count
  const handleResizeCols = (newCols: number) => {
    if (newCols < 15) newCols = 15;
    if (newCols > 300) newCols = 300;
    setLvlCols(newCols);

    setGridData(prevGrid => {
      const currentCols = prevGrid[0].length;
      return prevGrid.map(row => {
        if (newCols > currentCols) {
          return [...row, ...Array(newCols - currentCols).fill('.')];
        } else {
          return row.slice(0, newCols);
        }
      });
    });
  };

  const [editorStatusMsg, setEditorStatusMsg] = useState<string>('');

  const clearGrid = () => {
    const g = Array.from({ length: ROWS }, () => Array(lvlCols).fill('.'));
    for (let r = 2; r < 10; r++) g[r][lvlCols - 2] = 'e';
    setGridData(g);
    setEditorStatusMsg('Grid cleared.');
    setTimeout(() => setEditorStatusMsg(''), 2500);
  };

  // Canvas drawing loop for Editor Grid
  useEffect(() => {
    if (appMode !== 'edit') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Floor boundary (Ceiling is invisible in editor as requested)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, FLOOR_Y, CANVAS_W, 4);

    // Grid lines
    ctx.fillStyle = '#e5e5e5';
    const startCol = Math.floor(editorScrollX / TILE_SIZE);
    const endCol = startCol + Math.ceil(CANVAS_W / TILE_SIZE) + 1;

    for (let c = startCol; c <= endCol; c++) {
      const lineX = Math.round(c * TILE_SIZE - editorScrollX);
      ctx.fillRect(lineX, 0, 1, CANVAS_H);
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.fillRect(0, Math.round(r * TILE_SIZE), CANVAS_W, 1);
    }

    // Render tiles from gridData
    for (let r = 0; r < ROWS; r++) {
      for (let c = startCol; c <= Math.min(endCol, gridData[0].length - 1); c++) {
        const ch = gridData[r][c];
        if (ch === '.') continue;
        const ox = Math.round(c * TILE_SIZE - editorScrollX);
        const oy = Math.round(r * TILE_SIZE);

        if (ch === 's' || ch === 'D') {
          // Spike (Full Floor) or Deco Spike (Safe decoration)
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox, oy + TILE_SIZE);
          ctx.lineTo(ox + TILE_SIZE / 2, oy);
          ctx.lineTo(ox + TILE_SIZE, oy + TILE_SIZE);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner facet
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(ox + TILE_SIZE / 2, oy + 4);
          ctx.lineTo(ox + TILE_SIZE - 4, oy + TILE_SIZE - 1);
          ctx.lineTo(ox + TILE_SIZE / 2, oy + TILE_SIZE - 1);
          ctx.closePath();
          ctx.fill();

          // If decoration spike, subtle editor cue: tiny "d" tag
          if (ch === 'D') {
            ctx.font = 'bold 7px monospace';
            ctx.fillStyle = '#000000';
            ctx.fillText('d', ox + 3, oy + TILE_SIZE - 3);
          }
        } else if (ch === 'h') {
          // Half Spike (Floor - sleek proportional hazard)
          const spikeW = 14;
          const left = ox + Math.round((TILE_SIZE - spikeW) / 2);
          const right = left + spikeW;
          const tipX = ox + TILE_SIZE / 2;
          const baseY = oy + TILE_SIZE;
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
        } else if (ch === 'c' || ch === 'd') {
          // Ceil Spike (Full Ceiling) or Ceil Deco Spike
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox + 1, oy);
          ctx.lineTo(ox + TILE_SIZE / 2, oy + TILE_SIZE - 1);
          ctx.lineTo(ox + TILE_SIZE - 1, oy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner facet
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(ox + TILE_SIZE / 2, oy + TILE_SIZE - 4);
          ctx.lineTo(ox + TILE_SIZE - 3, oy + 1);
          ctx.lineTo(ox + TILE_SIZE / 2, oy + 1);
          ctx.closePath();
          ctx.fill();

          if (ch === 'd') {
            ctx.font = 'bold 7px monospace';
            ctx.fillStyle = '#000000';
            ctx.fillText('d', ox + 3, oy + 9);
          }
        } else if (ch === 'H') {
          // Ceil Half Spike (Ceiling - sleek proportional hazard)
          const spikeW = 14;
          const left = ox + Math.round((TILE_SIZE - spikeW) / 2);
          const right = left + spikeW;
          const tipX = ox + TILE_SIZE / 2;
          const baseY = oy;
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
        } else if (ch === '<') {
          // Left Wall Spike (pointing left, base against block on right)
          const tipX = ox + 2;
          const tipY = oy + TILE_SIZE / 2;
          const baseX = ox + TILE_SIZE;

          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(baseX, oy + 1);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(baseX, oy + TILE_SIZE - 1);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner facet
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(tipX + 4, tipY);
          ctx.lineTo(baseX - 1, oy + TILE_SIZE - 3);
          ctx.lineTo(baseX - 1, tipY);
          ctx.closePath();
          ctx.fill();
        } else if (ch === '>') {
          // Right Wall Spike (pointing right, base against block on left)
          const tipX = ox + TILE_SIZE - 2;
          const tipY = oy + TILE_SIZE / 2;
          const baseX = ox;

          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(baseX, oy + 1);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(baseX, oy + TILE_SIZE - 1);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner facet
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(tipX - 4, tipY);
          ctx.lineTo(baseX + 1, oy + TILE_SIZE - 3);
          ctx.lineTo(baseX + 1, tipY);
          ctx.closePath();
          ctx.fill();
        } else if (ch === 'x') {
          // Saw Blade
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === 'b') {
          // Solid block (Classic Geometry Dash style)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(ox, oy, TILE_SIZE, TILE_SIZE);

          // Inset frame
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(ox + 3.5, oy + 3.5, TILE_SIZE - 7, TILE_SIZE - 7);

          // Center accent
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox + 8, oy + 8, TILE_SIZE - 16, TILE_SIZE - 16);
        } else if (ch === 'f') {
          // Passable Wall / Fake Block (editor view: block with dashed inner border indicating walk-through)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(ox, oy, TILE_SIZE, TILE_SIZE);

          // Dashed inner cue in editor
          ctx.strokeStyle = '#555555';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(ox + 3.5, oy + 3.5, TILE_SIZE - 7, TILE_SIZE - 7);
          ctx.setLineDash([]);

          // Ghost center accent
          ctx.fillStyle = '#777777';
          ctx.fillRect(ox + 8, oy + 8, TILE_SIZE - 16, TILE_SIZE - 16);
        } else if (ch === '=' || ch === 'B') {
          // Platform / Slab (Half height - 12px)
          const platH = Math.round(TILE_SIZE / 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ox, oy, TILE_SIZE, platH);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(ox, oy, TILE_SIZE, platH);

          // Top grip rail
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox, oy, TILE_SIZE, 2);

          // Center grip dash
          ctx.fillRect(ox + 8, oy + 5, 8, 2);
        } else if (ch === 'p') {
          // Jump Pad
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox + 2, oy + 18, TILE_SIZE - 4, 6);
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 18, 7, Math.PI, 0, false);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 18, 4, Math.PI, 0, false);
          ctx.fill();
        } else if (ch === 'o' || ch === 'r') {
          // Jump Ring / Orb
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 4, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ch === 'g') {
          // Grav Up Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(ox + 2, oy, 20, TILE_SIZE);
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(ox + 12, oy + 4);
          ctx.lineTo(ox + 6, oy + 14);
          ctx.lineTo(ox + 18, oy + 14);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(ox + 10, oy + 14, 4, 6);
        } else if (ch === 'n') {
          // Grav Down Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(ox + 2, oy, 20, TILE_SIZE);
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(ox + 12, oy + 20);
          ctx.lineTo(ox + 6, oy + 10);
          ctx.lineTo(ox + 18, oy + 10);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(ox + 10, oy + 4, 4, 6);
        } else if (ch === 'w') {
          // Ship Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox + 12, oy + 12, 10, 11, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(ox + 7, oy + 15);
          ctx.lineTo(ox + 16, oy + 12);
          ctx.lineTo(ox + 7, oy + 9);
          ctx.closePath();
          ctx.fill();
        } else if (ch === 'q') {
          // Cube Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox + 12, oy + 12, 10, 11, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox + 8, oy + 8, 8, 8);
        } else if (ch === 'a') {
          // Ball Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox + 12, oy + 12, 10, 11, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#000000';
          ctx.fill();
        } else if (ch === 'u') {
          // UFO Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox + 12, oy + 12, 10, 11, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(ox + 12, oy + 13, 6, 3, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#000000';
          ctx.fill();
        } else if (ch === 'v') {
          // Wave Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox + 12, oy + 12, 10, 11, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.moveTo(ox + 16, oy + 12);
          ctx.lineTo(ox + 8, oy + 8);
          ctx.lineTo(ox + 8, oy + 16);
          ctx.closePath();
          ctx.fill();
        } else if (ch === 'k') {
          // Robot Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox + 12, oy + 12, 10, 11, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeRect(ox + 7, oy + 7, 10, 10);
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox + 9, oy + 10, 6, 2);
        } else if (ch === 'y') {
          // Swing Portal
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ox + 12, oy + 12, 10, 11, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox + 6, oy + 11, 12, 2);
        } else if (ch === '1' || ch === '2' || ch === '3' || ch === '4') {
          // Speed Portals
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(ox + 3, oy + 2, 18, 20);
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = ch === '1' ? '<' : (ch === '2' ? '>' : (ch === '3' ? '>>' : '>>>'));
          ctx.fillText(label, ox + 12, oy + 12);
        } else if (ch === '*') {
          // Coin (Limit 3)
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 5, 0, Math.PI * 2);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox + 11, oy + 9, 2, 6);
        } else if (ch === 'S') {
          // StartPos marker (Diamond with inner circle and 'S')
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox + 12, oy + 2);
          ctx.lineTo(ox + 22, oy + 12);
          ctx.lineTo(ox + 12, oy + 22);
          ctx.lineTo(ox + 2, oy + 12);
          ctx.closePath();
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 5, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#000000';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', ox + 12, oy + 12);
        } else if (ch === 'Z' || ch === 'z' || ch === '0') {
          // Camera Zoom Trigger
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(ox + 2, oy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.setLineDash([]);

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = ch === 'Z' ? 'Z+' : (ch === 'z' ? 'Z-' : 'Z1x');
          ctx.fillText(label, ox + 12, oy + 12);
        } else if (ch === 'e') {
          // Finish line
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeRect(ox, oy, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000000';
          for (let cy = 0; cy < 3; cy++) {
            for (let cx = 0; cx < 3; cx++) {
              if ((cx + cy) % 2 === 0) {
                ctx.fillRect(ox + cx * 8, oy + cy * 8, 8, 8);
              }
            }
          }
        }
      }
    }
  }, [appMode, editorScrollX, gridData]);

  // Pointer interaction for grid tile editing
  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (appMode !== 'edit') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;

    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const worldX = mx + editorScrollX;
    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(my / TILE_SIZE);

    if (row >= 0 && row < ROWS && col >= 0 && col < lvlCols) {
      setGridData(prevGrid => {
        const currentVal = prevGrid[row][col];
        if (currentTile === '*' && currentVal !== '*') {
          let count = 0;
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < lvlCols; c++) {
              if (prevGrid[r][c] === '*') count++;
            }
          }
          if (count >= 3) {
            setEditorStatusMsg('Coin limit reached (3 max per level)!');
            setTimeout(() => setEditorStatusMsg(''), 2500);
            return prevGrid;
          }
        }
        const next = prevGrid.map(r => [...r]);
        next[row][col] = currentVal === currentTile ? '.' : currentTile;
        return next;
      });
    }
  };

  const currentLevelObj = useCallback((): LevelData => {
    const gridStrings = gridData.map(r => r.join(''));
    let gearsCount = 0;
    gridStrings.forEach(s => {
      gearsCount += (s.match(/\*/g) || []).length;
    });

    return {
      id: (initialLevel && initialLevel.id) ? initialLevel.id : `custom-${Date.now()}`,
      name: lvlName.toUpperCase(),
      author: lvlAuthor,
      diff: lvlDiff,
      speed: lvlSpeed,
      cols: lvlCols,
      rows: ROWS,
      grid: gridStrings,
      gearsTotal: gearsCount,
      isCommunity: true,
      createdAt: (initialLevel && initialLevel.createdAt) ? initialLevel.createdAt : Date.now(),
      noCeiling
    };
  }, [gridData, lvlName, lvlAuthor, lvlDiff, lvlSpeed, lvlCols, initialLevel, noCeiling]);

  const hasStartPos = gridData.some(r => r.includes('S'));

  const jumpToStartPos = () => {
    for (let c = 0; c < lvlCols; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (gridData[r] && gridData[r][c] === 'S') {
          setEditorScrollX(Math.max(0, Math.min(maxScroll, c * TILE_SIZE - CANVAS_W / 2)));
          setEditorStatusMsg(`Centered camera on StartPos at Col ${c}`);
          return;
        }
      }
    }
  };

  const clearStartPos = () => {
    setGridData(prev => prev.map(row => row.map(ch => (ch === 'S' ? '.' : ch))));
    setEditorStatusMsg('Removed all StartPos objects.');
  };

  const handleSaveToCommunity = () => {
    if (hasStartPos) {
      setModalConfig({
        type: 'alert',
        title: 'CANNOT PUBLISH WITH STARTPOS',
        message: 'Geometry Dash rules prohibit publishing or saving levels with a StartPos object.\n\nPlease delete all StartPos objects (or click "Clear StartPos") before publishing!'
      });
      return;
    }
    onSaveToCommunity(currentLevelObj());
  };

  const exportFormatted = () => {
    const lvl = currentLevelObj();
    setExportText(JSON.stringify(lvl, null, 2));
  };

  const handlePublishToServer = async () => {
    if (hasStartPos) {
      setModalConfig({
        type: 'alert',
        title: 'CANNOT PUBLISH WITH STARTPOS',
        message: 'Geometry Dash rules prohibit publishing levels with a StartPos object.\n\nPlease delete all StartPos objects (or click "Clear StartPos") before publishing!'
      });
      return;
    }
    const lvl = currentLevelObj();
    try {
      const res = await fetch('/api/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lvl)
      });
      if (res.ok) {
        const saved = await res.json();
        onSaveToCommunity(saved);
        setEditorStatusMsg(`"${saved.name}" published to Community Server!`);
        setModalConfig({
          type: 'alert',
          title: 'PUBLISH SUCCESS',
          message: `"${saved.name}" successfully published to the Community Server!`
        });
      } else {
        const err = await res.json();
        setModalConfig({
          type: 'alert',
          title: 'PUBLISH ERROR',
          message: `Failed to publish: ${err.error || res.statusText}`
        });
      }
    } catch (err: any) {
      onSaveToCommunity(lvl);
      setModalConfig({
        type: 'alert',
        title: 'SERVER NOTICE',
        message: `Could not reach server (${err.message || 'Offline'}). Level saved locally.`
      });
    }
  };

  const copyExportCode = () => {
    if (!exportText) exportFormatted();
    const jsonStr = exportText || JSON.stringify(currentLevelObj(), null, 2);
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr);
    }
    setModalConfig({
      type: 'alert',
      title: 'EXPORT SUCCESS',
      message: 'Level JSON code copied to clipboard!'
    });
  };

  const handleGMDImportToEditor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target ? (event.target.result as string) : '';
      const result = parseGMDContent(text, file.name);
      if (result.success && result.level) {
        const lvl = result.level;
        setGridData(lvl.grid.map((r: string) => r.split('')));
        setLvlCols(lvl.cols);
        setLvlName(lvl.name);
        setLvlAuthor(lvl.author || 'GD Creator');
        setLvlSpeed(lvl.speed);
        setLvlDiff(lvl.diff);
        setEditorStatusMsg(`Loaded .GMD: ${lvl.name}`);
        const objCount = result.stats ? result.stats.objectCount : 0;
        setModalConfig({
          type: 'alert',
          title: 'GMD IMPORTED TO EDITOR',
          message: `Loaded "${lvl.name}" into Level Editor!\nObstacles: ${objCount}, Columns: ${lvl.cols}`
        });
      } else {
        setModalConfig({
          type: 'alert',
          title: 'GMD IMPORT ERROR',
          message: result.error || 'Failed to parse .GMD file.'
        });
      }
    };
    reader.onerror = () => {
      setModalConfig({
        type: 'alert',
        title: 'FILE READ ERROR',
        message: 'Could not read the selected .GMD file.'
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const importFromJSON = () => {
    setModalConfig({
      type: 'prompt',
      title: 'IMPORT LEVEL CODE',
      message: isPC ? 'Paste exported level JSON or .GMD Plist string below:' : 'Paste exported level JSON object below:',
      placeholder: '{\n  "name": "MY LEVEL",\n  "grid": [...]\n}',
      confirmText: 'IMPORT',
      onConfirm: (str?: string) => {
        if (!str || !str.trim()) return;
        const trimmed = str.trim();

        // Support direct paste of GMD Plist XML, RobTop <d>, or GD Level String
        const isGMD =
          trimmed.startsWith('<') ||
          trimmed.indexOf('<plist') !== -1 ||
          trimmed.indexOf('<dict') !== -1 ||
          trimmed.indexOf('<d>') !== -1 ||
          trimmed.indexOf('<d ') !== -1 ||
          trimmed.indexOf('<k>') !== -1 ||
          trimmed.indexOf('<key>') !== -1 ||
          trimmed.indexOf('kS') === 0 ||
          trimmed.indexOf('kA') === 0 ||
          trimmed.indexOf('H4sI') === 0 ||
          (trimmed.indexOf(';') !== -1 && trimmed.indexOf('1,') !== -1);

        if (isGMD) {
          const gmdResult = parseGMDContent(trimmed);
          if (gmdResult.success && gmdResult.level) {
            const lvl = gmdResult.level;
            setGridData(lvl.grid.map((r: string) => r.split('')));
            setLvlCols(lvl.cols);
            setLvlName(lvl.name);
            setLvlAuthor(lvl.author || 'GD Creator');
            setLvlSpeed(lvl.speed);
            setLvlDiff(lvl.diff);
            setEditorStatusMsg(`Loaded .GMD: ${lvl.name}`);
            setModalConfig({
              type: 'alert',
              title: 'GMD IMPORT COMPLETE',
              message: `Level "${lvl.name}" imported into editor successfully!`
            });
            return;
          }
        }

        try {
          const parsed = JSON.parse(trimmed) as LevelData;
          if (parsed.grid && parsed.grid.length === ROWS) {
            setGridData(parsed.grid.map((r: string) => r.split('')));
            if (parsed.cols) setLvlCols(parsed.cols);
            if (parsed.name) setLvlName(parsed.name);
            if (parsed.author) setLvlAuthor(parsed.author);
            if (parsed.speed) setLvlSpeed(parsed.speed);
            if (parsed.diff !== undefined) setLvlDiff(parsed.diff);
            setModalConfig({
              type: 'alert',
              title: 'IMPORT COMPLETE',
              message: `Level "${parsed.name || 'Custom'}" imported successfully!`
            });
            return;
          } else if (parsed.name && (parsed as any).k4) {
            const gmdResult = parseGMDContent(trimmed);
            if (gmdResult.success && gmdResult.level) {
              const lvl = gmdResult.level;
              setGridData(lvl.grid.map((r: string) => r.split('')));
              setLvlCols(lvl.cols);
              setLvlName(lvl.name);
              setLvlAuthor(lvl.author || 'GD Creator');
              setLvlSpeed(lvl.speed);
              setLvlDiff(lvl.diff);
              setEditorStatusMsg(`Loaded .GMD: ${lvl.name}`);
              setModalConfig({
                type: 'alert',
                title: 'GMD IMPORT COMPLETE',
                message: `Level "${lvl.name}" imported into editor successfully!`
              });
              return;
            }
          } else {
            setModalConfig({
              type: 'alert',
              title: 'IMPORT ERROR',
              message: 'Invalid level format: grid must have exactly 12 string rows.'
            });
            return;
          }
        } catch (e) {
          // Fallback to GMD parser if JSON parse fails
          const gmdResult = parseGMDContent(trimmed);
          if (gmdResult.success && gmdResult.level) {
            const lvl = gmdResult.level;
            setGridData(lvl.grid.map((r: string) => r.split('')));
            setLvlCols(lvl.cols);
            setLvlName(lvl.name);
            setLvlAuthor(lvl.author || 'GD Creator');
            setLvlSpeed(lvl.speed);
            setLvlDiff(lvl.diff);
            setEditorStatusMsg(`Loaded .GMD: ${lvl.name}`);
            setModalConfig({
              type: 'alert',
              title: 'GMD IMPORT COMPLETE',
              message: `Level "${lvl.name}" imported into editor successfully!`
            });
            return;
          }

          setModalConfig({
            type: 'alert',
            title: 'IMPORT ERROR',
            message: gmdResult.error || 'Failed to parse JSON / GMD level data. Check formatting.'
          });
        }
      }
    });
  };

  const maxScroll = Math.max(0, lvlCols * TILE_SIZE - CANVAS_W + 100);

  return (
    <div className="window-content" style={{ width: '100%' }}>
      {/* Top Mode Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
        <div>
          <button
            className={`tool-btn ${appMode === 'edit' ? 'active' : ''}`}
            onClick={() => setAppMode('edit')}
            style={{ marginRight: '6px' }}
          >
            <Edit3 size={11} style={{ display: 'inline', marginRight: '4px' }} /> EDIT MODE
          </button>
          <button
            className={`tool-btn ${appMode === 'play' ? 'active' : ''}`}
            onClick={() => setAppMode('play')}
          >
            <Play size={11} style={{ display: 'inline', marginRight: '4px' }} /> PLAYTEST
          </button>
        </div>

        <div>
          <button className="tool-btn" onClick={clearGrid} style={{ marginRight: '6px' }}>
            CLEAR
          </button>
          <button className="tool-btn" onClick={exportFormatted}>
            EXPORT FORMAT
          </button>
        </div>
      </div>

      {editorStatusMsg && (
        <div
          style={{
            background: 'black',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            padding: '3px 8px',
            marginBottom: '6px',
            textAlign: 'center',
            width: '100%'
          }}
        >
          {editorStatusMsg}
        </div>
      )}

      {appMode === 'edit' ? (
        <>
          {/* Level Properties Form (No flex gap - uses margins) */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              background: '#f8f8f8',
              padding: '8px',
              border: '2px solid black',
              width: '100%',
              marginBottom: '8px'
            }}
          >
            <label style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '10px', marginBottom: '4px' }}>
              Name:{' '}
              <input
                type="text"
                value={lvlName}
                onChange={e => setLvlName(e.target.value)}
                style={{ border: '2px solid black', padding: '2px 4px', width: '110px' }}
              />
            </label>
            <label style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '10px', marginBottom: '4px' }}>
              Diff:{' '}
              <select
                value={lvlDiff}
                onChange={e => setLvlDiff(Number(e.target.value))}
                style={{ border: '2px solid black', padding: '2px', background: 'white' }}
              >
                <option value={0}>0 (Easy)</option>
                <option value={1}>1 (Normal)</option>
                <option value={2}>2 (Hard)</option>
                <option value={3}>3 (Brutal)</option>
              </select>
            </label>
            <label style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '10px', marginBottom: '4px' }}>
              Speed:{' '}
              <select
                value={lvlSpeed}
                onChange={e => setLvlSpeed(Number(e.target.value))}
                style={{ border: '2px solid black', padding: '2px' }}
              >
                <option value={0.5}>0.5x (Slow)</option>
                <option value={1.0}>1.0x (Normal - GD Default)</option>
                <option value={2.0}>2.0x (Fast)</option>
                <option value={3.0}>3.0x (Faster)</option>
                <option value={4.0}>4.0x (Fastest)</option>
              </select>
            </label>
            <label style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
              Cols:{' '}
              <input
                type="number"
                min={20}
                max={300}
                value={lvlCols}
                onChange={e => handleResizeCols(Number(e.target.value))}
                style={{ border: '2px solid black', padding: '2px', width: '55px' }}
              />
            </label>
          </div>

          {/* Palette Selector (No flex gap - uses child margins) */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              background: '#f0f0f0',
              padding: '6px',
              border: '2px solid black',
              width: '100%',
              marginBottom: '8px'
            }}
          >
            {TILE_TYPES.map(t => (
              <button
                key={t.char}
                className={`tool-btn ${currentTile === t.char ? 'active' : ''}`}
                onClick={() => setCurrentTile(t.char)}
                style={{ fontSize: '0.75rem', padding: '4px 6px', marginRight: '4px', marginBottom: '4px' }}
                title={t.description}
              >
                {t.name} [{t.char}]
              </button>
            ))}
          </div>

          {/* Editor Canvas Container */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={e => {
                isMouseDownRef.current = true;
                handleCanvasPointer(e);
              }}
              onPointerMove={e => {
                if (isMouseDownRef.current) handleCanvasPointer(e);
              }}
              onPointerUp={() => (isMouseDownRef.current = false)}
              onPointerCancel={() => (isMouseDownRef.current = false)}
              style={{
                display: 'block',
                border: '4px solid black',
                boxShadow: '4px 4px 0 black',
                background: 'white',
                cursor: 'pointer',
                touchAction: 'none'
              }}
            />

            {/* Scroll Slider Controls (No flex gap - child margins) */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginTop: '8px' }}>
              <button className="tool-btn" onClick={() => setEditorScrollX(s => Math.max(0, s - TILE_SIZE * 4))} style={{ marginRight: '6px' }}>
                &lt;&lt;
              </button>
              <input
                type="range"
                min={0}
                max={maxScroll}
                value={editorScrollX}
                onChange={e => setEditorScrollX(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'black', marginRight: '6px' }}
              />
              <button className="tool-btn" onClick={() => setEditorScrollX(s => Math.min(maxScroll, s + TILE_SIZE * 4))} style={{ marginRight: '8px' }}>
                &gt;&gt;
              </button>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold', minWidth: '55px' }}>
                Col: {Math.floor(editorScrollX / TILE_SIZE)}
              </span>
            </div>

            {/* Kindle-Compliant Camera Controls & Flight Ceiling Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                background: '#f2f2f2',
                border: '2px solid black',
                padding: '4px 6px',
                marginTop: '8px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.75rem', marginRight: '6px' }}>
                CAMERA:
              </span>
              <button className="tool-btn" onClick={() => setEditorScrollX(0)} style={{ marginRight: '4px', fontSize: '0.7rem', padding: '3px 6px' }} title="Jump camera to Start">
                |◀ 0%
              </button>
              <button className="tool-btn" onClick={() => setEditorScrollX(s => Math.max(0, s - TILE_SIZE * 10))} style={{ marginRight: '4px', fontSize: '0.7rem', padding: '3px 6px' }} title="Scroll left 10 columns">
                ◀◀ -10
              </button>
              <button className="tool-btn" onClick={() => setEditorScrollX(s => Math.max(0, s - TILE_SIZE * 2))} style={{ marginRight: '4px', fontSize: '0.7rem', padding: '3px 6px' }} title="Scroll left 2 columns">
                ◀ -2
              </button>
              <button className="tool-btn" onClick={() => setEditorScrollX(s => Math.min(maxScroll, s + TILE_SIZE * 2))} style={{ marginRight: '4px', fontSize: '0.7rem', padding: '3px 6px' }} title="Scroll right 2 columns">
                +2 ▶
              </button>
              <button className="tool-btn" onClick={() => setEditorScrollX(s => Math.min(maxScroll, s + TILE_SIZE * 10))} style={{ marginRight: '4px', fontSize: '0.7rem', padding: '3px 6px' }} title="Scroll right 10 columns">
                +10 ▶▶
              </button>
              <button className="tool-btn" onClick={() => setEditorScrollX(maxScroll)} style={{ marginRight: '6px', fontSize: '0.7rem', padding: '3px 6px' }} title="Jump camera to End">
                100% ▶|
              </button>

              {hasStartPos && (
                <>
                  <button className="tool-btn active" onClick={jumpToStartPos} style={{ marginRight: '4px', fontSize: '0.7rem', padding: '3px 6px' }} title="Jump camera directly to StartPos">
                    ⚑ TO STARTPOS
                  </button>
                  <button className="tool-btn" onClick={clearStartPos} style={{ marginRight: '6px', fontSize: '0.7rem', padding: '3px 6px' }} title="Clear all StartPos objects so level can be published">
                    CLEAR STARTPOS
                  </button>
                </>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <button
                  className={`tool-btn ${noCeiling ? 'active' : ''}`}
                  onClick={() => setNoCeiling(v => !v)}
                  style={{ fontSize: '0.7rem', padding: '3px 6px' }}
                  title="Toggle whether flight gamemodes (Ship, UFO, Wave, Swing) are clamped by ceiling or have free open flight"
                >
                  CEILING: {noCeiling ? 'REMOVED (OPEN FLIGHT)' : 'DEFAULT (CLAMPED)'}
                </button>
              </div>
            </div>

            {hasStartPos && (
              <div
                style={{
                  background: '#000000',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '5px 8px',
                  marginTop: '6px',
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid black'
                }}
              >
                ⚠️ LEVEL CONTAINS STARTPOS: Publishing to server & community is disabled until StartPos is removed. Use "CLEAR STARTPOS" above before publishing.
              </div>
            )}
          </div>

          {/* Export / Import Box */}
          <div style={{ marginTop: '12px', width: '100%' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.8rem' }}>
              Level JSON / Share Code:
            </span>
            <textarea
              value={exportText}
              onChange={e => setExportText(e.target.value)}
              placeholder="Click 'EXPORT FORMAT' or enter JSON code here..."
              style={{
                width: '100%',
                height: '70px',
                border: '2px solid black',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                padding: '4px',
                marginTop: '4px',
                boxSizing: 'border-box'
              }}
            />
            {/* Action Buttons (No flex gap - child margins) */}
            <div style={{ display: 'flex', marginTop: '6px', flexWrap: 'wrap' }}>
              <button className="tool-btn" onClick={copyExportCode} style={{ marginRight: '6px', marginBottom: '6px' }}>
                <Copy size={11} style={{ display: 'inline', marginRight: '3px' }} /> Copy Code
              </button>
              <button className="tool-btn" onClick={importFromJSON} style={{ marginRight: '6px', marginBottom: '6px' }}>
                <FileText size={11} style={{ display: 'inline', marginRight: '3px' }} /> Import JSON
              </button>
              {isPC && (
                <>
                  <button
                    className="tool-btn"
                    onClick={() => {
                      if (gmdEditorInputRef.current) gmdEditorInputRef.current.click();
                    }}
                    style={{ marginRight: '6px', marginBottom: '6px' }}
                    title="Import Geometry Dash level (.GMD) - Available on PC"
                  >
                    <FileUp size={11} style={{ display: 'inline', marginRight: '3px' }} /> Import .GMD (PC)
                  </button>
                  <input
                    type="file"
                    ref={gmdEditorInputRef}
                    accept=".gmd,.gmd2,.xml,.plist,.txt"
                    style={{ display: 'none' }}
                    onChange={handleGMDImportToEditor}
                  />
                </>
              )}
              <button
                className={`tool-btn ${hasStartPos ? '' : ''}`}
                onClick={handleSaveToCommunity}
                style={{
                  marginRight: '6px',
                  marginBottom: '6px',
                  opacity: hasStartPos ? 0.6 : 1,
                  cursor: hasStartPos ? 'not-allowed' : 'pointer'
                }}
                title={hasStartPos ? 'Remove StartPos before saving to community' : 'Save level to local community list'}
              >
                <Save size={11} style={{ display: 'inline', marginRight: '3px' }} /> Save to Community
              </button>
              <button
                className="tool-btn"
                onClick={handlePublishToServer}
                style={{
                  marginRight: '6px',
                  marginBottom: '6px',
                  opacity: hasStartPos ? 0.6 : 1,
                  cursor: hasStartPos ? 'not-allowed' : 'pointer'
                }}
                title={hasStartPos ? 'Remove StartPos before publishing' : 'Publish level to online server'}
              >
                <UploadCloud size={11} style={{ display: 'inline', marginRight: '3px' }} /> Publish to Server
              </button>
              <button
                className="tool-btn"
                onClick={() => {
                  const htmlStr = generateSingleFileHTML(currentLevelObj());
                  const blob = new Blob([htmlStr], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${lvlName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
                  a.click();
                }}
                style={{ marginBottom: '6px' }}
              >
                <Download size={11} style={{ display: 'inline', marginRight: '3px' }} /> Download Single-File HTML
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Playtest Mode */
        <GameCanvas
          level={currentLevelObj()}
          isPractice={true}
          einkConfig={einkConfig}
          onQuitToMenu={() => setAppMode('edit')}
          onLevelComplete={() => setAppMode('edit')}
        />
      )}

      {/* System Modal for alerts and prompt dialogs */}
      <SystemModal config={modalConfig} onClose={() => setModalConfig(null)} />
    </div>
  );
};
