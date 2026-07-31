/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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
import { Download, Play, Edit3, Trash2, Copy, FileText, Save, ArrowLeft, ArrowRight } from 'lucide-react';

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
  const [lvlName, setLvlName] = useState<string>(initialLevel?.name || 'MY GRID LEVEL');
  const [lvlAuthor, setLvlAuthor] = useState<string>(initialLevel?.author || 'Creator');
  const [lvlDiff, setLvlDiff] = useState<number>(initialLevel?.diff ?? 1);
  const [lvlSpeed, setLvlSpeed] = useState<number>(initialLevel?.speed || 6.0);
  const [lvlCols, setLvlCols] = useState<number>(initialLevel?.cols || 60);
  const [currentTile, setCurrentTile] = useState<string>('s');
  const [editorScrollX, setEditorScrollX] = useState<number>(0);
  const [exportText, setExportText] = useState<string>('');

  // 12-row grid data matrix state
  const [gridData, setGridData] = useState<string[][]>(() => {
    if (initialLevel?.grid && initialLevel.grid.length === ROWS) {
      return initialLevel.grid.map(rowStr => rowStr.split(''));
    }
    const cols = initialLevel?.cols || 60;
    const g = Array.from({ length: ROWS }, () => Array(cols).fill('.'));
    // Add default finish line at end
    for (let r = 2; r < 10; r++) g[r][cols - 2] = 'e';
    return g;
  });

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

  const clearGrid = () => {
    if (window.confirm("Clear all tiles on grid?")) {
      const g = Array.from({ length: ROWS }, () => Array(lvlCols).fill('.'));
      for (let r = 2; r < 10; r++) g[r][lvlCols - 2] = 'e';
      setGridData(g);
    }
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

    // Ceil & Floor boundaries
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, CEIL_Y - 4, CANVAS_W, 4);
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
        const oy = r * TILE_SIZE;

        if (ch === 's') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(ox, oy + TILE_SIZE);
          ctx.lineTo(ox + TILE_SIZE / 2, oy);
          ctx.lineTo(ox + TILE_SIZE, oy + TILE_SIZE);
          ctx.stroke();
        } else if (ch === 'c') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + TILE_SIZE / 2, oy + TILE_SIZE);
          ctx.lineTo(ox + TILE_SIZE, oy);
          ctx.stroke();
        } else if (ch === 'b') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeRect(ox, oy, TILE_SIZE, TILE_SIZE);
        } else if (ch === 'B') {
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox, oy, TILE_SIZE, 12);
        } else if (ch === 'p') {
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox, oy + TILE_SIZE - 8, TILE_SIZE, 8);
        } else if (ch === 'r') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 8, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ch === 'g' || ch === 'n') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(ox, oy, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#000000';
          ctx.fillRect(ox + 4, oy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        } else if (ch === 'w' || ch === 'q') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeRect(ox, oy, TILE_SIZE, TILE_SIZE);
        } else if (ch === '*') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ox + 12, oy + 12, 8, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ch === 'e') {
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

  // Mouse interaction for grid tile editing
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
        const next = prevGrid.map(r => [...r]);
        next[row][col] = next[row][col] === currentTile ? '.' : currentTile;
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
      id: initialLevel?.id || `custom-${Date.now()}`,
      name: lvlName.toUpperCase(),
      author: lvlAuthor,
      diff: lvlDiff,
      speed: lvlSpeed,
      cols: lvlCols,
      rows: ROWS,
      grid: gridStrings,
      gearsTotal: gearsCount,
      isCommunity: true,
      createdAt: initialLevel?.createdAt || Date.now()
    };
  }, [gridData, lvlName, lvlAuthor, lvlDiff, lvlSpeed, lvlCols, initialLevel]);

  const exportFormatted = () => {
    const lvl = currentLevelObj();
    setExportText(JSON.stringify(lvl, null, 2));
  };

  const copyExportCode = () => {
    if (!exportText) exportFormatted();
    navigator.clipboard.writeText(exportText || JSON.stringify(currentLevelObj(), null, 2));
    alert("Level JSON copied to clipboard!");
  };

  const importFromJSON = () => {
    const str = prompt("Paste level JSON object:");
    if (!str) return;
    try {
      const parsed = JSON.parse(str) as LevelData;
      if (parsed.grid && parsed.grid.length === ROWS) {
        setGridData(parsed.grid.map(r => r.split('')));
        if (parsed.cols) setLvlCols(parsed.cols);
        if (parsed.name) setLvlName(parsed.name);
        if (parsed.author) setLvlAuthor(parsed.author);
        if (parsed.speed) setLvlSpeed(parsed.speed);
        if (parsed.diff !== undefined) setLvlDiff(parsed.diff);
        alert("Level imported successfully!");
      } else {
        alert("Invalid level format: grid must have 12 rows.");
      }
    } catch (e) {
      alert("Failed to parse level JSON.");
    }
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

      {appMode === 'edit' ? (
        <>
          {/* Level Properties Form */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
              background: '#f8f8f8',
              padding: '8px',
              border: '2px solid black',
              width: '100%',
              marginBottom: '8px'
            }}
          >
            <label style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold' }}>
              Name:{' '}
              <input
                type="text"
                value={lvlName}
                onChange={e => setLvlName(e.target.value)}
                style={{ border: '2px solid black', padding: '2px 4px', width: '120px' }}
              />
            </label>
            <label style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold' }}>
              Diff:{' '}
              <select
                value={lvlDiff}
                onChange={e => setLvlDiff(Number(e.target.value))}
                style={{ border: '2px solid black', padding: '2px' }}
              >
                <option value={0}>0 (Easy)</option>
                <option value={1}>1 (Normal)</option>
                <option value={2}>2 (Hard)</option>
                <option value={3}>3 (Brutal)</option>
              </select>
            </label>
            <label style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold' }}>
              Speed:{' '}
              <input
                type="number"
                step={0.1}
                min={4.0}
                max={9.0}
                value={lvlSpeed}
                onChange={e => setLvlSpeed(Number(e.target.value))}
                style={{ border: '2px solid black', padding: '2px', width: '50px' }}
              />
            </label>
            <label style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold' }}>
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

          {/* Palette Selector */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
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
                style={{ fontSize: '0.75rem', padding: '4px 6px' }}
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

            {/* Scroll Slider Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginTop: '8px' }}>
              <button className="tool-btn" onClick={() => setEditorScrollX(s => Math.max(0, s - TILE_SIZE * 4))}>
                &lt;&lt;
              </button>
              <input
                type="range"
                min={0}
                max={maxScroll}
                value={editorScrollX}
                onChange={e => setEditorScrollX(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'black' }}
              />
              <button className="tool-btn" onClick={() => setEditorScrollX(s => Math.min(maxScroll, s + TILE_SIZE * 4))}>
                &gt;&gt;
              </button>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold', minWidth: '60px' }}>
                Col: {Math.floor(editorScrollX / TILE_SIZE)}
              </span>
            </div>
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
                marginTop: '4px'
              }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <button className="tool-btn" onClick={copyExportCode}>
                <Copy size={11} style={{ display: 'inline', marginRight: '3px' }} /> Copy Code
              </button>
              <button className="tool-btn" onClick={importFromJSON}>
                <FileText size={11} style={{ display: 'inline', marginRight: '3px' }} /> Import JSON
              </button>
              <button className="tool-btn" onClick={() => onSaveToCommunity(currentLevelObj())}>
                <Save size={11} style={{ display: 'inline', marginRight: '3px' }} /> Save to Community
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
    </div>
  );
};
