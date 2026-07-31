/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LevelData, SaveState, EInkConfig, DIFF_NAMES } from './types';
import { OFFICIAL_LEVELS } from './constants/levels';
import { TitleBar } from './components/TitleBar';
import { GameCanvas } from './components/GameCanvas';
import { LevelEditor } from './components/LevelEditor';
import { CommunityRepository } from './components/CommunityRepository';
import { KindleSettingsModal } from './components/KindleSettingsModal';

const LEVELS_PER_PAGE = 4;

export default function App() {
  const [activeTab, setActiveTab] = useState<'menu' | 'editor' | 'community' | 'game'>('menu');
  const [menuPage, setMenuPage] = useState<number>(0);
  const [selectedLevel, setSelectedLevel] = useState<LevelData | null>(OFFICIAL_LEVELS[0] || null);
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [editingLevel, setEditingLevel] = useState<LevelData | undefined>(undefined);
  const [showKindleSettings, setShowKindleSettings] = useState<boolean>(false);

  // Persistence State
  const [saveState, setSaveState] = useState<SaveState>(() => {
    try {
      const stored = localStorage.getItem('cubedash_save_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        const legacyShowcaseIds = ['custom-1', 'custom-2', 'custom-3'];
        const cleanCustom = (parsed.customLevels || []).filter(
          (lvl: LevelData) => !legacyShowcaseIds.includes(lvl.id)
        );
        return {
          progress: parsed.progress || {},
          gears: parsed.gears || {},
          customLevels: cleanCustom
        };
      }
    } catch (e) {
      // Ignore fallback
    }
    return {
      progress: {},
      gears: {},
      customLevels: []
    };
  });

  // E-Ink Configuration
  const [einkConfig, setEinkConfig] = useState<EInkConfig>({
    enabled: false,
    fps: 15,
    ghosting: 0.5,
    inputLagMs: 0,
    flashInterval: 60
  });

  // Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('cubedash_save_v2', JSON.stringify(saveState));
    } catch (e) {
      // Ignore
    }
  }, [saveState]);

  // Level Complete Handler
  const handleLevelComplete = useCallback((levelId: string, gearsMask: number, isPractice: boolean) => {
    setSaveState(prev => {
      const newProgress = { ...prev.progress, [levelId]: 100 };
      const currentGears = prev.gears[levelId] || 0;
      const newGears = { ...prev.gears, [levelId]: currentGears | gearsMask };
      return { ...prev, progress: newProgress, gears: newGears };
    });
  }, []);

  // Total Percentage Calculator
  const totalLevelsCount = OFFICIAL_LEVELS.length + saveState.customLevels.length;
  let totalPctSum = 0;
  let totalGearsGot = 0;
  let totalGearsMax = 0;

  [...OFFICIAL_LEVELS, ...saveState.customLevels].forEach(lvl => {
    totalPctSum += saveState.progress[lvl.id] || 0;
    const mask = saveState.gears[lvl.id] || 0;
    let tempMask = mask;
    while (tempMask > 0) {
      if (tempMask & 1) totalGearsGot++;
      tempMask >>= 1;
    }
    totalGearsMax += lvl.gearsTotal || 0;
  });

  const overallAvgPct = totalLevelsCount > 0 ? Math.floor(totalPctSum / totalLevelsCount) : 0;

  // Level Action Launchers
  const startPlayLevel = (lvl: LevelData, practice: boolean) => {
    setSelectedLevel(lvl);
    setIsPracticeMode(practice);
    setActiveTab('game');
  };

  const handleEditLevel = (lvl: LevelData) => {
    setEditingLevel(lvl);
    setActiveTab('editor');
  };

  const handleSaveToCommunity = (lvl: LevelData) => {
    setSaveState(prev => {
      const existingIdx = prev.customLevels.findIndex(l => l.id === lvl.id);
      let updatedCustoms: LevelData[];
      if (existingIdx >= 0) {
        updatedCustoms = [...prev.customLevels];
        updatedCustoms[existingIdx] = lvl;
      } else {
        updatedCustoms = [lvl, ...prev.customLevels];
      }
      return { ...prev, customLevels: updatedCustoms };
    });
    alert(`Level "${lvl.name}" saved to Community Repository!`);
  };

  const handleDeleteCustomLevel = (id: string) => {
    setSaveState(prev => ({
      ...prev,
      customLevels: prev.customLevels.filter(l => l.id !== id)
    }));
  };

  const handleImportLevel = (lvl: LevelData) => {
    handleSaveToCommunity(lvl);
  };

  const maxPage = Math.max(0, Math.ceil(OFFICIAL_LEVELS.length / LEVELS_PER_PAGE) - 1);
  const currentOfficialPageLevels = OFFICIAL_LEVELS.slice(
    menuPage * LEVELS_PER_PAGE,
    (menuPage + 1) * LEVELS_PER_PAGE
  );

  return (
    <div className="window">
      {/* Retro Window Titlebar */}
      <TitleBar
        title="Cube Dash"
        totalPct={overallAvgPct}
        onClose={() => setActiveTab('menu')}
      />

      {/* Navigation Tab Bar */}
      <div className="tab-nav-bar">
        <button
          className={`tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          LEVELS
        </button>
        <button
          className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          EDITOR
        </button>
        <button
          className={`tab-btn ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => setActiveTab('community')}
        >
          COMMUNITY
        </button>
      </div>

      {/* Tab View Routers */}
      {activeTab === 'menu' && (
        <div className="window-content screen active">
          <h2 className="menu-heading">Select Level</h2>
          <div className="menu-stats">
            GEARS: <b>{totalGearsGot} / {totalGearsMax}</b>
          </div>

          {/* Official Level Row Cards */}
          <div id="level-list" style={{ width: '100%', marginBottom: '10px' }}>
            {OFFICIAL_LEVELS.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '28px 16px',
                  border: '2px dashed black',
                  background: 'white',
                  width: '100%',
                  marginBottom: '10px',
                  fontFamily: '"Courier New", monospace',
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>NO OFFICIAL LEVELS DEFINED</div>
                <p style={{ margin: 0, maxWidth: '420px', lineHeight: '1.4', opacity: 0.8 }}>
                  The official levels list is currently empty so you can add your own level definitions later. Use the Level Editor to create levels or switch to the Community tab.
                </p>
                <button className="sys-btn" onClick={() => setActiveTab('editor')} style={{ marginTop: '4px' }}>
                  CREATE A LEVEL IN EDITOR
                </button>
              </div>
            ) : (
              currentOfficialPageLevels.map(lvl => {
                const bestPct = saveState.progress[lvl.id] || 0;
                const mask = saveState.gears[lvl.id] || 0;
                let gGot = 0;
                let temp = mask;
                while (temp > 0) {
                  if (temp & 1) gGot++;
                  temp >>= 1;
                }

                return (
                  <div key={lvl.id} className="lvl-row">
                    <button className="lvl-main" onClick={() => startPlayLevel(lvl, false)}>
                      <span className="lvl-name-line">{lvl.name}</span>
                      <span className="lvl-sub-line">
                        <span className={`lvl-chip d${lvl.diff}`}>
                          {DIFF_NAMES[lvl.diff]}
                        </span>
                        {bestPct}% — Gears {gGot}/{lvl.gearsTotal || 0}
                      </span>
                    </button>
                    <button className="lvl-prac" onClick={() => startPlayLevel(lvl, true)}>
                      PRACTICE
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="pager-row">
            <button
              className="pager-btn"
              disabled={menuPage === 0}
              onClick={() => setMenuPage(p => Math.max(0, p - 1))}
              style={{ opacity: menuPage === 0 ? 0.4 : 1 }}
            >
              PREV
            </button>
            <span id="page-indicator">
              {menuPage + 1} / {maxPage + 1}
            </span>
            <button
              className="pager-btn"
              disabled={menuPage === maxPage}
              onClick={() => setMenuPage(p => Math.min(maxPage, p + 1))}
              style={{ opacity: menuPage === maxPage ? 0.4 : 1 }}
            >
              NEXT
            </button>
          </div>

          <p className="menu-instructions">
            Tap or press <b>SPACE</b> / <b>UP ARROW</b> to jump. Hold to fly the ship. Avoid spikes and reach 100%!
          </p>
        </div>
      )}

      {activeTab === 'editor' && (
        <LevelEditor
          initialLevel={editingLevel}
          einkConfig={einkConfig}
          onSaveToCommunity={handleSaveToCommunity}
          onQuitToMenu={() => setActiveTab('menu')}
        />
      )}

      {activeTab === 'community' && (
        <CommunityRepository
          levels={saveState.customLevels}
          saveProgress={saveState.progress}
          saveGears={saveState.gears}
          onPlayLevel={startPlayLevel}
          onEditLevel={handleEditLevel}
          onDeleteLevel={handleDeleteCustomLevel}
          onImportLevel={handleImportLevel}
          onCreateNewLevel={() => {
            setEditingLevel(undefined);
            setActiveTab('editor');
          }}
        />
      )}

      {activeTab === 'game' && selectedLevel && (
        <GameCanvas
          level={selectedLevel}
          isPractice={isPracticeMode}
          einkConfig={einkConfig}
          onQuitToMenu={() => setActiveTab('menu')}
          onLevelComplete={handleLevelComplete}
          onNextLevel={() => {
            const all = [...OFFICIAL_LEVELS, ...saveState.customLevels];
            const idx = all.findIndex(l => l.id === selectedLevel.id);
            if (idx >= 0 && idx + 1 < all.length) {
              setSelectedLevel(all[idx + 1]);
              setIsPracticeMode(false);
            }
          }}
          hasNextLevel={
            [...OFFICIAL_LEVELS, ...saveState.customLevels].findIndex(l => l.id === selectedLevel.id) + 1 <
            OFFICIAL_LEVELS.length + saveState.customLevels.length
          }
        />
      )}

      {/* Kindle Settings Modal */}
      {showKindleSettings && (
        <KindleSettingsModal
          config={einkConfig}
          onChange={setEinkConfig}
          onClose={() => setShowKindleSettings(false)}
          onManualRefresh={() => {
            // Flash trigger
          }}
        />
      )}
    </div>
  );
}
