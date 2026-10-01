/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Main App Component
 * Conforms to Kindle Browser Compatibility Guide (No flex gap, ES2019, SystemModal instead of alert).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LevelData, SaveState, EInkConfig, DIFF_NAMES, isBannedLegacyLevel } from './types';
import { OFFICIAL_LEVELS } from './constants/levels';
import { TitleBar } from './components/TitleBar';
import { GameCanvas } from './components/GameCanvas';
import { LevelEditor } from './components/LevelEditor';
import { CommunityRepository } from './components/CommunityRepository';
import { KindleSettingsModal } from './components/KindleSettingsModal';
import { SystemModal, ModalConfig } from './components/SystemModal';

const LEVELS_PER_PAGE = 4;

export default function App() {
  const [activeTab, setActiveTab] = useState<'menu' | 'editor' | 'community' | 'game'>('menu');
  const [menuPage, setMenuPage] = useState<number>(0);
  const [selectedLevel, setSelectedLevel] = useState<LevelData | null>(OFFICIAL_LEVELS.length > 0 ? OFFICIAL_LEVELS[0] : null);
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [editingLevel, setEditingLevel] = useState<LevelData | undefined>(undefined);
  const [showKindleSettings, setShowKindleSettings] = useState<boolean>(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  // Persistence State - Guaranteed to never contain banned legacy levels
  const [saveState, setSaveState] = useState<SaveState>(() => {
    try {
      const stored = localStorage.getItem('cubedash_save_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        const cleanCustom = (parsed.customLevels || []).filter(
          (lvl: LevelData) => lvl && !isBannedLegacyLevel(lvl)
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
      const cleanCustom = (saveState.customLevels || []).filter(l => !isBannedLegacyLevel(l));
      localStorage.setItem('cubedash_save_v2', JSON.stringify({
        ...saveState,
        customLevels: cleanCustom
      }));
    } catch (e) {
      // Ignore
    }
  }, [saveState]);

  // Bi-directional Auto-Sync with Server on mount so levels are NEVER lost across republishes or restarts
  useEffect(() => {
    let isMounted = true;
    const syncWithServer = async () => {
      try {
        const cleanLocal = (saveState.customLevels || []).filter(l => !isBannedLegacyLevel(l));
        const res = await fetch('/api/levels/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanLocal)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.levels) && isMounted) {
            const cleanServer: LevelData[] = data.levels.filter(
              (l: any) => l && l.grid && l.grid.length === 12 && !isBannedLegacyLevel(l)
            );
            setSaveState(prev => {
              const map = new Map<string, LevelData>();
              // Load all server levels
              cleanServer.forEach(l => map.set(l.id, l));
              // Merge local levels
              prev.customLevels.forEach(l => {
                if (!isBannedLegacyLevel(l) && !map.has(l.id)) {
                  map.set(l.id, l);
                }
              });
              return {
                progress: prev.progress,
                gears: prev.gears,
                customLevels: Array.from(map.values())
              };
            });
          }
        }
      } catch {
        // Server might be running on a different port or offline; local data remains safe
      }
    };

    syncWithServer();
    return () => {
      isMounted = false;
    };
  }, []);

  // Level Complete Handler
  const handleLevelComplete = useCallback((levelId: string, gearsMask: number, _isPractice: boolean) => {
    setSaveState(prev => {
      const newProgress = Object.assign({}, prev.progress);
      newProgress[levelId] = 100;
      const currentGears = prev.gears[levelId] || 0;
      const newGears = Object.assign({}, prev.gears);
      newGears[levelId] = currentGears | gearsMask;
      return {
        progress: newProgress,
        gears: newGears,
        customLevels: prev.customLevels
      };
    });
  }, []);

  // Total Percentage Calculator
  const totalLevelsCount = OFFICIAL_LEVELS.length + saveState.customLevels.length;
  let totalPctSum = 0;
  let totalGearsGot = 0;
  let totalGearsMax = 0;

  const allLevels = OFFICIAL_LEVELS.concat(saveState.customLevels);
  allLevels.forEach(lvl => {
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
    if (isBannedLegacyLevel(lvl)) return;

    setSaveState(prev => {
      const existingIdx = prev.customLevels.findIndex(l => l.id === lvl.id);
      let updatedCustoms: LevelData[];
      if (existingIdx >= 0) {
        updatedCustoms = [...prev.customLevels];
        updatedCustoms[existingIdx] = lvl;
      } else {
        updatedCustoms = [lvl, ...prev.customLevels];
      }
      return {
        progress: prev.progress,
        gears: prev.gears,
        customLevels: updatedCustoms
      };
    });

    // Also persist to server in the background so it survives republishing
    fetch('/api/levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lvl)
    }).catch(() => {});

    setModalConfig({
      type: 'alert',
      title: 'LEVEL SAVED',
      message: `Level "${lvl.name}" saved to Community Repository!`
    });
  };

  const handleDeleteCustomLevel = (id: string) => {
    setSaveState(prev => ({
      progress: prev.progress,
      gears: prev.gears,
      customLevels: prev.customLevels.filter(l => l.id !== id)
    }));
    // Also delete on server if server-persisted
    if (id.startsWith('srv-lvl-')) {
      fetch(`/api/levels/${id}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const handleImportLevel = (lvl: LevelData) => {
    handleSaveToCommunity(lvl);
  };

  const handleSyncLevels = (syncedLevels: LevelData[]) => {
    setSaveState(prev => {
      const map = new Map<string, LevelData>();
      syncedLevels.forEach(l => {
        if (!isBannedLegacyLevel(l)) map.set(l.id, l);
      });
      prev.customLevels.forEach(l => {
        if (!isBannedLegacyLevel(l) && !map.has(l.id)) {
          map.set(l.id, l);
        }
      });
      return {
        progress: prev.progress,
        gears: prev.gears,
        customLevels: Array.from(map.values())
      };
    });
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

      {/* Navigation Tab Bar (Flexbox without gap - margin on siblings) */}
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
          <h2 className="menu-heading" data-i18n="menu.select_level">Select Level</h2>
          <div className="menu-stats">
            COINS: <b>{totalGearsGot} / {totalGearsMax}</b>
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
                  alignItems: 'center'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '8px' }}>NO OFFICIAL LEVELS DEFINED</div>
                <p style={{ margin: '0 0 12px 0', maxWidth: '420px', lineHeight: '1.4', opacity: 0.8 }}>
                  The official levels list is currently empty. Use the Level Editor to create levels or switch to the Community tab to play community-hosted courses.
                </p>
                <button className="sys-btn" onClick={() => setActiveTab('editor')} style={{ minHeight: '40px' }}>
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

          {/* Pagination (Touch targets >= 48px) */}
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
            Tap screen or press <b>SPACE</b> / <b>UP ARROW</b> to jump. Hold to fly ship. Avoid spikes!
          </p>

          {/* Kindle / Low-RAM Display Mode Button */}
          <div style={{ marginTop: '6px', textAlign: 'center' }}>
            <button
              className="tool-btn"
              onClick={() => setShowKindleSettings(true)}
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}
            >
              KINDLE / LOW-RAM CONFIG
            </button>
          </div>
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
          onSyncLevels={handleSyncLevels}
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
            const all = OFFICIAL_LEVELS.concat(saveState.customLevels);
            const idx = all.findIndex(l => l.id === selectedLevel.id);
            if (idx >= 0 && idx + 1 < all.length) {
              setSelectedLevel(all[idx + 1]);
              setIsPracticeMode(false);
            }
          }}
          hasNextLevel={
            OFFICIAL_LEVELS.concat(saveState.customLevels).findIndex(l => l.id === selectedLevel.id) + 1 <
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

      {/* System Modal for alerts */}
      <SystemModal config={modalConfig} onClose={() => setModalConfig(null)} />
    </div>
  );
}
