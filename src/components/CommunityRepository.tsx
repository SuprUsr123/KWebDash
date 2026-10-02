/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Community Levels Repository Component
 * Compliant with Kindle Browser Compatibility Guide (No flex gap, ES2019, SystemModal instead of alert/confirm).
 */

import React, { useState, useEffect, useRef } from 'react';
import { LevelData, DIFF_NAMES, isBannedLegacyLevel } from '../types';
import { Play, Edit3, Download, Copy, Trash2, Plus, Search, Code, RefreshCw, Server, Globe, UploadCloud, FileUp, Save, Upload } from 'lucide-react';
import { generateSingleFileHTML } from '../utils/singleHtmlExporter';
import { SystemModal, ModalConfig } from './SystemModal';
import { isPCDevice } from '../utils/device';
import { parseGMDContent } from '../utils/gmdParser';

interface CommunityRepositoryProps {
  levels: LevelData[];
  saveProgress: Record<string, number>;
  saveGears: Record<string, number>;
  username?: string;
  onEditUsername?: () => void;
  onPlayLevel: (level: LevelData, isPractice: boolean) => void;
  onEditLevel: (level: LevelData) => void;
  onDeleteLevel: (levelId: string) => void;
  onImportLevel: (level: LevelData) => void;
  onSyncLevels?: (levels: LevelData[]) => void;
  onCreateNewLevel: () => void;
}

export const CommunityRepository: React.FC<CommunityRepositoryProps> = ({
  levels,
  saveProgress,
  saveGears,
  username,
  onEditUsername,
  onPlayLevel,
  onEditLevel,
  onDeleteLevel,
  onImportLevel,
  onSyncLevels,
  onCreateNewLevel
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDiff, setFilterDiff] = useState<number | 'all'>('all');
  const [importCodeText, setImportCodeText] = useState<string>('');
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  // PC Device Detection (.GMD import is restricted to PC browsers)
  const [isPC, setIsPC] = useState<boolean>(false);
  const gmdInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsPC(isPCDevice());
  }, []);

  // Server Integration Configuration
  const [serverEndpoint, setServerEndpoint] = useState<string>('https://kwebdash.onrender.com/api/levels');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<string>('CONNECTING...');
  const [serverLevels, setServerLevels] = useState<LevelData[]>([]);

  // Combine server levels and local levels (guaranteed free of legacy banned levels)
  const combinedLevels = React.useMemo(() => {
    const map = new Map<string, LevelData>();
    serverLevels.forEach(lvl => {
      if (lvl && !isBannedLegacyLevel(lvl)) map.set(lvl.id, lvl);
    });
    levels.forEach(lvl => {
      if (lvl && !isBannedLegacyLevel(lvl)) map.set(lvl.id, lvl);
    });
    return Array.from(map.values());
  }, [serverLevels, levels]);

  const filteredLevels = combinedLevels.filter(lvl => {
    const nameMatch = lvl.name.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1;
    const authorMatch = lvl.author ? lvl.author.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1 : false;
    const matchesSearch = nameMatch || authorMatch;
    const matchesDiff = filterDiff === 'all' || lvl.diff === filterDiff;
    return matchesSearch && matchesDiff;
  });

  // Server Sync Handler - Two-way sync prevents any levels from being lost across republishes
  const handleFetchFromServer = async () => {
    setIsFetching(true);
    setServerStatus(`CONNECTING TO ${serverEndpoint}...`);

    try {
      const cleanLocal = levels.filter(l => !isBannedLegacyLevel(l));

      // If targeting default or relative /api/levels, use /api/levels/sync for robust 2-way sync
      if (serverEndpoint === '/api/levels' || serverEndpoint.endsWith('/api/levels')) {
        const syncUrl = serverEndpoint.replace(/\/api\/levels\/?$/, '/api/levels/sync');
        try {
          const syncRes = await fetch(syncUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanLocal)
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData && Array.isArray(syncData.levels)) {
              const validLevels: LevelData[] = syncData.levels.filter(
                (lvl: LevelData) => lvl && lvl.grid && lvl.grid.length === 12 && !isBannedLegacyLevel(lvl)
              );
              setServerLevels(validLevels);
              if (onSyncLevels) onSyncLevels(validLevels);
              setServerStatus(`ONLINE — ${validLevels.length} LEVEL(S) SYNCED`);
              setIsFetching(false);
              return;
            }
          }
        } catch {
          // Fall back to standard GET below
        }
      }

      const response = await fetch(serverEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const fetchedData = await response.json();
      if (Array.isArray(fetchedData)) {
        const validLevels = fetchedData.filter(
          (lvl: LevelData) => lvl && lvl.grid && lvl.grid.length === 12 && !isBannedLegacyLevel(lvl)
        );
        setServerLevels(validLevels);
        if (onSyncLevels) onSyncLevels(validLevels);
        setServerStatus(`ONLINE — ${validLevels.length} LEVEL(S)`);
      } else {
        setServerStatus('SERVER RESPONDED (INVALID DATA)');
      }
    } catch (err: any) {
      setServerLevels([]);
      setServerStatus(`SERVER DISCONNECTED (${err.message || 'Offline'})`);
    } finally {
      setIsFetching(false);
    }
  };

  // Auto-connect to server on mount
  useEffect(() => {
    handleFetchFromServer();
  }, []);

  const handlePublishToServer = async (lvl: LevelData) => {
    if (isBannedLegacyLevel(lvl)) return;
    try {
      const res = await fetch('/api/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lvl)
      });
      if (res.ok) {
        const saved = await res.json();
        onImportLevel(saved);
        setModalConfig({
          type: 'alert',
          title: 'PUBLISH SUCCESS',
          message: `Level "${saved.name}" successfully published to the Community Server!`
        });
        handleFetchFromServer();
      } else {
        const err = await res.json();
        setModalConfig({
          type: 'alert',
          title: 'PUBLISH ERROR',
          message: `Failed to publish: ${err.error || res.statusText}`
        });
      }
    } catch (err: any) {
      setModalConfig({
        type: 'alert',
        title: 'SERVER NOTICE',
        message: `Could not reach community server: ${err.message || 'Offline'}`
      });
    }
  };

  const handleExportBackup = () => {
    const cleanToExport = combinedLevels.filter(l => !isBannedLegacyLevel(l));
    const jsonStr = JSON.stringify(cleanToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cubedash_levels_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setModalConfig({
      type: 'alert',
      title: 'BACKUP CREATED',
      message: `Exported ${cleanToExport.length} level(s) to backup file. Keep this file safe so you can restore your levels anytime!`
    });
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target ? (event.target.result as string) : '';
        const parsed = JSON.parse(content);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const valid = list.filter((l: any) => l && l.grid && l.grid.length === 12 && !isBannedLegacyLevel(l));
        if (valid.length > 0) {
          valid.forEach((l: LevelData) => onImportLevel(l));
          if (onSyncLevels) onSyncLevels(valid);
          fetch('/api/levels/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(valid)
          }).catch(() => {});
          setModalConfig({
            type: 'alert',
            title: 'BACKUP RESTORED',
            message: `Successfully restored ${valid.length} level(s) from "${file.name}"!`
          });
        } else {
          setModalConfig({
            type: 'alert',
            title: 'RESTORE ERROR',
            message: 'No valid level data found in the backup file.'
          });
        }
      } catch (err: any) {
        setModalConfig({
          type: 'alert',
          title: 'RESTORE ERROR',
          message: `Failed to parse backup file: ${err.message}`
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteWithServerSync = (lvl: LevelData) => {
    setModalConfig({
      type: 'confirm',
      title: 'CONFIRM DELETE',
      message: `Are you sure you want to delete level "${lvl.name}"?`,
      confirmText: 'DELETE',
      cancelText: 'CANCEL',
      onConfirm: async () => {
        if (lvl.id.startsWith('srv-lvl-')) {
          try {
            await fetch(`/api/levels/${lvl.id}`, { method: 'DELETE' });
            setServerLevels(prev => prev.filter(l => l.id !== lvl.id));
          } catch (err) {
            console.error('Failed to delete on server', err);
          }
        }
        onDeleteLevel(lvl.id);
      }
    });
  };

  const handleGMDFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target ? (event.target.result as string) : '';
      const result = parseGMDContent(text, file.name);
      if (result.success && result.level) {
        onImportLevel(result.level);
        const objCount = result.stats ? result.stats.objectCount : 0;
        const coins = result.stats ? result.stats.coins : 0;
        setModalConfig({
          type: 'alert',
          title: 'GMD IMPORT SUCCESS',
          message: `Successfully imported "${result.level.name}" from .GMD file!\nObstacles: ${objCount}, Coins: ${coins}, Length: ${result.level.cols} columns.\n\nNote: Portals are 3 blocks tall with 8 directional rotations (0, 45, 90, 135, 180, -135, -90, -45). You can tweak the level in the Level Editor until desirable!`
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

  const handleImportSubmit = () => {
    const text = importCodeText.trim();
    if (!text) return;

    // Check if pasted content is .GMD format (Plist XML, RobTop <d>, or Geometry Dash level string)
    const isGMD =
      text.startsWith('<') ||
      text.indexOf('<plist') !== -1 ||
      text.indexOf('<dict') !== -1 ||
      text.indexOf('<d>') !== -1 ||
      text.indexOf('<d ') !== -1 ||
      text.indexOf('<k>') !== -1 ||
      text.indexOf('<key>') !== -1 ||
      text.indexOf('kS') === 0 ||
      text.indexOf('kA') === 0 ||
      text.indexOf('H4sI') === 0 ||
      (text.indexOf(';') !== -1 && text.indexOf('1,') !== -1);

    if (isGMD) {
      const gmdResult = parseGMDContent(text);
      if (gmdResult.success && gmdResult.level) {
        onImportLevel(gmdResult.level);
        setImportCodeText('');
        setModalConfig({
          type: 'alert',
          title: 'GMD IMPORT SUCCESS',
          message: `Successfully imported "${gmdResult.level.name}" from Geometry Dash .GMD data!\n\nNote: Portals are 3 blocks tall with 8 directional rotations. You can tweak the level in the Level Editor until desirable!`
        });
        return;
      }
    }

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const cleanArr = parsed.filter(
          (l: any) => l && l.grid && l.grid.length === 12 && !isBannedLegacyLevel(l)
        );
        if (cleanArr.length > 0) {
          cleanArr.forEach((l: LevelData) => onImportLevel(l));
          if (onSyncLevels) onSyncLevels(cleanArr);
          fetch('/api/levels/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanArr)
          }).catch(() => {});
          setImportCodeText('');
          setModalConfig({
            type: 'alert',
            title: 'BACKUP RESTORED',
            message: `Successfully restored ${cleanArr.length} level(s) from backup!`
          });
          return;
        }
      }

      if (parsed && parsed.grid && parsed.grid.length === 12 && !isBannedLegacyLevel(parsed)) {
        const newLvl: LevelData = {
          ...parsed,
          id: parsed.id && !parsed.id.startsWith('custom-') ? parsed.id : `custom-imp-${Date.now()}`,
          isCommunity: true
        };
        onImportLevel(newLvl);
        fetch('/api/levels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newLvl)
        }).catch(() => {});
        setImportCodeText('');
        setModalConfig({
          type: 'alert',
          title: 'IMPORT SUCCESS',
          message: `Successfully imported "${newLvl.name}"!`
        });
        return;
      } else if (parsed && parsed.name && (parsed as any).k4) {
        const gmdResult = parseGMDContent(text);
        if (gmdResult.success && gmdResult.level) {
          onImportLevel(gmdResult.level);
          setImportCodeText('');
          setModalConfig({
            type: 'alert',
            title: 'GMD IMPORT SUCCESS',
            message: `Successfully imported "${gmdResult.level.name}"!`
          });
          return;
        }
      } else {
        setModalConfig({
          type: 'alert',
          title: 'IMPORT ERROR',
          message: 'Invalid level data: grid must have 12 rows.'
        });
        return;
      }
    } catch (e) {
      // Fallback: Attempt GMD parsing if JSON parse threw syntax error
      const gmdResult = parseGMDContent(text);
      if (gmdResult.success && gmdResult.level) {
        onImportLevel(gmdResult.level);
        setImportCodeText('');
        setModalConfig({
          type: 'alert',
          title: 'GMD IMPORT SUCCESS',
          message: `Successfully imported "${gmdResult.level.name}" from Geometry Dash .GMD data!`
        });
        return;
      }

      setModalConfig({
        type: 'alert',
        title: 'IMPORT ERROR',
        message: gmdResult.error || 'Invalid JSON or Geometry Dash .GMD level format.'
      });
    }
  };

  return (
    <div className="window-content" style={{ width: '100%', alignItems: 'stretch' }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>
          COMMUNITY LEVELS REPOSITORY
        </h2>
        <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', margin: 0 }}>
          Server API Integration & Community Level Hub
        </p>
      </div>

      {/* Server Integration Header Banner (No flex gap - uses margins) */}
      <div
        style={{
          border: '2px solid #141414',
          background: '#EDEDEB',
          padding: '8px 10px',
          marginBottom: '12px',
          fontFamily: 'monospace',
          fontSize: '0.75rem'
        }}
      >
        {/* User Profile Header Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed #999' }}>
          <div>
            <span style={{ fontWeight: 'bold' }}>LOGGED IN AS: </span>
            <span style={{ background: '#141414', color: '#ffffff', padding: '2px 6px', fontWeight: 'bold' }}>
              @{username || 'Player'}
            </span>
          </div>
          {onEditUsername && (
            <button
              className="tool-btn"
              onClick={onEditUsername}
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
            >
              CHANGE USERNAME
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
            <Server size={14} style={{ marginRight: '6px' }} />
            <span>SERVER ENDPOINT:</span>
          </div>
          <span
            style={{
              background: '#141414',
              color: '#E4E3E0',
              padding: '1px 6px',
              fontSize: '0.65rem',
              fontWeight: 'bold'
            }}
          >
            {serverStatus}
          </span>
        </div>

        <div style={{ display: 'flex' }}>
          <input
            type="text"
            value={serverEndpoint}
            onChange={e => setServerEndpoint(e.target.value)}
            placeholder="e.g. /api/levels or https://api.my-game.com/levels"
            style={{
              flex: 1,
              border: '1px solid #141414',
              padding: '3px 6px',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              background: 'white',
              marginRight: '6px'
            }}
          />
          <button
            className="tool-btn"
            onClick={handleFetchFromServer}
            disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} style={{ marginRight: '4px' }} />
            SYNC SERVER
          </button>
        </div>
      </div>

      {/* Top Action Bar */}
      <div style={{ display: 'flex', marginBottom: '12px' }}>
        <button
          className="sys-btn"
          onClick={onCreateNewLevel}
          style={{ flex: 1, padding: '6px 12px' }}
        >
          <Plus size={12} style={{ display: 'inline', marginRight: '4px' }} /> CREATE NEW LEVEL
        </button>
      </div>

      {/* Search & Filter Bar (No flex gap - uses child margins) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f8f8f8',
          padding: '8px',
          border: '2px solid #141414',
          marginBottom: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: '180px', marginRight: '10px' }}>
          <Search size={14} style={{ marginRight: '6px' }} />
          <input
            type="text"
            placeholder="Search level or author..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              border: '1px solid #141414',
              padding: '4px 6px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              width: '100%',
              background: 'white'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '6px' }}>Diff:</span>
          <select
            value={filterDiff}
            onChange={e => setFilterDiff(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{ border: '1px solid #141414', padding: '3px', fontFamily: 'monospace', fontSize: '0.8rem', background: 'white' }}
          >
            <option value="all">ALL</option>
            <option value={0}>EASY</option>
            <option value={1}>NORMAL</option>
            <option value={2}>HARD</option>
            <option value={3}>BRUTAL</option>
          </select>
        </div>
      </div>

      {/* Levels List or Server Integration Empty State */}
      <div style={{ marginBottom: '16px' }}>
        {filteredLevels.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 16px',
              border: '2px dashed #141414',
              background: '#fcfcfc',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <Globe size={24} opacity={0.6} style={{ marginBottom: '10px' }} />
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px' }}>NO COMMUNITY LEVELS AVAILABLE</div>
            <p style={{ margin: '0 0 12px 0', maxWidth: '420px', lineHeight: '1.4', opacity: 0.8 }}>
              No online levels found or server disconnected. Connect to a community level server using the endpoint field above, or create custom levels in the Level Editor.
            </p>
            <div style={{ display: 'flex' }}>
              <button className="tool-btn" onClick={onCreateNewLevel} style={{ marginRight: '8px' }}>
                <Plus size={11} style={{ display: 'inline', marginRight: '4px' }} /> CREATE LOCAL LEVEL
              </button>
              <button className="tool-btn" onClick={handleFetchFromServer}>
                <RefreshCw size={11} style={{ display: 'inline', marginRight: '4px' }} /> TEST API FETCH
              </button>
            </div>
          </div>
        ) : (
          filteredLevels.map(lvl => {
            const bestPct = saveProgress[lvl.id] || 0;
            return (
              <div
                key={lvl.id}
                style={{
                  background: 'white',
                  border: '2px solid #141414',
                  boxShadow: '3px 3px 0 #141414',
                  padding: '8px 12px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {lvl.name}
                    </span>
                    <span
                      onClick={() => setSearchQuery(lvl.author || '')}
                      title={`Filter levels by ${lvl.author || 'Anonymous'}`}
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        marginLeft: '8px',
                        color: '#333',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      by @{lvl.author || 'Anonymous'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span
                      style={{
                        border: '1px solid #141414',
                        padding: '1px 5px',
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        background: lvl.diff >= 2 ? '#141414' : 'white',
                        color: lvl.diff >= 2 ? '#E4E3E0' : '#141414',
                        marginRight: '6px'
                      }}
                    >
                      {DIFF_NAMES[lvl.diff]}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {bestPct}%
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    className="tool-btn"
                    onClick={() => onPlayLevel(lvl, false)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', marginRight: '6px', marginBottom: '4px' }}
                  >
                    <Play size={10} style={{ display: 'inline', marginRight: '3px' }} /> PLAY
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => onPlayLevel(lvl, true)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', marginRight: '6px', marginBottom: '4px' }}
                  >
                    PRACTICE
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => onEditLevel(lvl)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', marginRight: '6px', marginBottom: '4px' }}
                  >
                    <Edit3 size={10} style={{ display: 'inline', marginRight: '3px' }} /> EDIT
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => {
                      const htmlStr = generateSingleFileHTML(lvl);
                      const blob = new Blob([htmlStr], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${lvl.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
                      a.click();
                    }}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', marginRight: '6px', marginBottom: '4px' }}
                  >
                    <Download size={10} style={{ display: 'inline', marginRight: '3px' }} /> HTML
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => {
                      if (navigator && navigator.clipboard) {
                        navigator.clipboard.writeText(JSON.stringify(lvl, null, 2));
                      }
                      setModalConfig({
                        type: 'alert',
                        title: 'CODE COPIED',
                        message: `Copied JSON code for ${lvl.name} to clipboard.`
                      });
                    }}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', marginRight: '6px', marginBottom: '4px' }}
                  >
                    <Copy size={10} style={{ display: 'inline', marginRight: '3px' }} /> COPY
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => handlePublishToServer(lvl)}
                    title="Publish this level to the community server"
                    style={{ padding: '3px 8px', fontSize: '0.75rem', marginRight: '6px', marginBottom: '4px' }}
                  >
                    <UploadCloud size={10} style={{ display: 'inline', marginRight: '3px' }} /> UPLOAD
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => handleDeleteWithServerSync(lvl)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', marginLeft: 'auto', marginBottom: '4px' }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Import Level Box */}
      <div style={{ border: '2px solid #141414', padding: '8px', background: '#f8f8f8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.8rem' }}>
            <Code size={12} style={{ display: 'inline', marginRight: '4px' }} /> Import Level Code (JSON / GMD):
          </span>
          {isPC && (
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'monospace',
                background: '#141414',
                color: '#fff',
                padding: '1px 5px',
                fontWeight: 'bold'
              }}
            >
              PC DETECTED: .GMD ENABLED
            </span>
          )}
        </div>
        <div style={{ display: 'flex' }}>
          <input
            type="text"
            placeholder={isPC ? "Paste JSON or .GMD Plist string..." : "Paste JSON level code..."}
            value={importCodeText}
            onChange={e => setImportCodeText(e.target.value)}
            style={{
              flex: 1,
              border: '1px solid #141414',
              padding: '4px',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              background: 'white',
              marginRight: '6px'
            }}
          />
          <button className="tool-btn" onClick={handleImportSubmit} style={{ marginRight: isPC ? '6px' : 0 }}>
            IMPORT
          </button>
          {isPC && (
            <>
              <input
                type="file"
                ref={gmdInputRef}
                accept=".gmd,.gmd2,.xml,.plist,.txt"
                style={{ display: 'none' }}
                onChange={handleGMDFileSelect}
              />
              <button
                className="tool-btn"
                onClick={() => {
                  if (gmdInputRef.current) gmdInputRef.current.click();
                }}
                title="Browse for a .GMD level file"
              >
                <FileUp size={11} style={{ display: 'inline', marginRight: '3px' }} /> BROWSE .GMD
              </button>
            </>
          )}
        </div>
      </div>

      {/* Level Backup & Recovery Hub (Guarantees zero data loss across republishes) */}
      <div
        style={{
          border: '2px solid #141414',
          marginTop: '10px',
          padding: '8px 10px',
          background: '#EDEDEB',
          fontFamily: 'monospace',
          fontSize: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <Save size={13} style={{ marginRight: '5px' }} /> LEVEL PERSISTENCE & BACKUP:
          </div>
          <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>AUTO-SYNC ACTIVE</span>
        </div>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.7rem', lineHeight: '1.3', opacity: 0.85 }}>
          Levels auto-sync between your browser and server so republishing never loses your work. You can also export or restore a complete JSON backup file at any time.
        </p>
        <div style={{ display: 'flex' }}>
          <button
            className="tool-btn"
            onClick={handleExportBackup}
            style={{ flex: 1, marginRight: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Download all community and custom levels as a backup JSON file"
          >
            <Download size={11} style={{ marginRight: '4px' }} /> EXPORT BACKUP (JSON)
          </button>
          <input
            type="file"
            ref={backupInputRef}
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleBackupFileSelect}
          />
          <button
            className="tool-btn"
            onClick={() => {
              if (backupInputRef.current) backupInputRef.current.click();
            }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Restore levels from a saved backup JSON file"
          >
            <Upload size={11} style={{ marginRight: '4px' }} /> RESTORE BACKUP
          </button>
        </div>
      </div>

      {/* System Modal for alerts and confirms */}
      <SystemModal config={modalConfig} onClose={() => setModalConfig(null)} />
    </div>
  );
};
