/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LevelData, DIFF_NAMES } from '../types';
import { Play, Edit3, Download, Copy, Trash2, Plus, Search, Code, RefreshCw, Server, Globe } from 'lucide-react';
import { generateSingleFileHTML } from '../utils/singleHtmlExporter';

interface CommunityRepositoryProps {
  levels: LevelData[];
  saveProgress: Record<string, number>;
  saveGears: Record<string, number>;
  onPlayLevel: (level: LevelData, isPractice: boolean) => void;
  onEditLevel: (level: LevelData) => void;
  onDeleteLevel: (levelId: string) => void;
  onImportLevel: (level: LevelData) => void;
  onCreateNewLevel: () => void;
}

export const CommunityRepository: React.FC<CommunityRepositoryProps> = ({
  levels,
  saveProgress,
  saveGears,
  onPlayLevel,
  onEditLevel,
  onDeleteLevel,
  onImportLevel,
  onCreateNewLevel
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDiff, setFilterDiff] = useState<number | 'all'>('all');
  const [importCodeText, setImportCodeText] = useState<string>('');

  // Server Integration Stub Configuration
  const [serverEndpoint, setServerEndpoint] = useState<string>('/api/levels');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<string>('SERVER STUB READY');

  const filteredLevels = levels.filter(lvl => {
    const matchesSearch =
      lvl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lvl.author && lvl.author.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDiff = filterDiff === 'all' || lvl.diff === filterDiff;
    return matchesSearch && matchesDiff;
  });

  // Server Sync Handler Stub
  const handleFetchFromServer = async () => {
    setIsFetching(true);
    setServerStatus(`CONNECTING TO ${serverEndpoint}...`);

    try {
      const response = await fetch(serverEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const fetchedData = await response.json();
      if (Array.isArray(fetchedData)) {
        fetchedData.forEach((lvl: LevelData) => {
          if (lvl.grid && lvl.grid.length === 12) {
            onImportLevel(lvl);
          }
        });
        setServerStatus(`LOADED ${fetchedData.length} LEVEL(S)`);
      } else {
        setServerStatus('SERVER RESPONDED (INVALID DATA)');
      }
    } catch (err: any) {
      setServerStatus(`SERVER DISCONNECTED (${err.message || 'Offline'})`);
    } finally {
      setIsFetching(false);
    }
  };

  const handleImportSubmit = () => {
    if (!importCodeText.trim()) return;
    try {
      const parsed = JSON.parse(importCodeText.trim()) as LevelData;
      if (parsed.grid && parsed.grid.length === 12) {
        const newLvl: LevelData = {
          ...parsed,
          id: `custom-imp-${Date.now()}`,
          isCommunity: true
        };
        onImportLevel(newLvl);
        setImportCodeText('');
        alert(`Successfully imported "${newLvl.name}"!`);
      } else {
        alert("Invalid level data: grid must have 12 rows.");
      }
    } catch (e) {
      alert("Invalid JSON level format.");
    }
  };

  return (
    <div className="window-content" style={{ width: '100%', alignItems: 'stretch' }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>
          COMMUNITY LEVELS REPOSITORY
        </h2>
        <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', margin: 0 }}>
          Server API Integration Stub & Community Level Hub
        </p>
      </div>

      {/* Server Integration Stub Header Banner */}
      <div
        style={{
          border: '2px solid #141414',
          background: '#EDEDEB',
          padding: '8px 10px',
          marginBottom: '12px',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
            <Server size={14} />
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

        <div style={{ display: 'flex', gap: '6px' }}>
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
              background: 'white'
            }}
          />
          <button
            className="tool-btn"
            onClick={handleFetchFromServer}
            disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
            SYNC SERVER
          </button>
        </div>
      </div>

      {/* Top Action Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button className="sys-btn" onClick={onCreateNewLevel} style={{ flex: 1, padding: '6px 12px' }}>
          <Plus size={12} style={{ display: 'inline', marginRight: '4px' }} /> CREATE NEW LEVEL
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          background: '#f8f8f8',
          padding: '8px',
          border: '2px solid #141414',
          marginBottom: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '180px' }}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search level or author..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              border: '1px solid #141414',
              padding: '3px 6px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              width: '100%',
              background: 'white'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 'bold' }}>Diff:</span>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
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
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Globe size={24} opacity={0.6} />
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>COMMUNITY REPOSITORY IS EMPTY</div>
            <p style={{ margin: 0, maxWidth: '420px', lineHeight: '1.4', opacity: 0.8 }}>
              This tab is set up as a server adapter stub. Connect your backend API endpoint above to fetch community levels dynamically, or use the level editor to create custom levels.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button className="tool-btn" onClick={onCreateNewLevel}>
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
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {lvl.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', marginLeft: '8px', color: '#555' }}>
                      by {lvl.author || 'Anonymous'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        border: '1px solid #141414',
                        padding: '1px 5px',
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        background: lvl.diff >= 2 ? '#141414' : 'white',
                        color: lvl.diff >= 2 ? '#E4E3E0' : '#141414'
                      }}
                    >
                      {DIFF_NAMES[lvl.diff]}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {bestPct}%
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    className="tool-btn"
                    onClick={() => onPlayLevel(lvl, false)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                  >
                    <Play size={10} style={{ display: 'inline', marginRight: '3px' }} /> PLAY
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => onPlayLevel(lvl, true)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                  >
                    PRACTICE
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => onEditLevel(lvl)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
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
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                  >
                    <Download size={10} style={{ display: 'inline', marginRight: '3px' }} /> HTML
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(lvl, null, 2));
                      alert(`Copied JSON code for ${lvl.name}`);
                    }}
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                  >
                    <Copy size={10} style={{ display: 'inline', marginRight: '3px' }} /> COPY
                  </button>
                  <button
                    className="tool-btn"
                    onClick={() => {
                      if (window.confirm(`Delete level "${lvl.name}"?`)) {
                        onDeleteLevel(lvl.id);
                      }
                    }}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', marginLeft: 'auto' }}
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
        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
          <Code size={12} style={{ display: 'inline', marginRight: '4px' }} /> Import Level Code (JSON):
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="Paste JSON level code..."
            value={importCodeText}
            onChange={e => setImportCodeText(e.target.value)}
            style={{
              flex: 1,
              border: '1px solid #141414',
              padding: '4px',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              background: 'white'
            }}
          />
          <button className="tool-btn" onClick={handleImportSubmit}>
            IMPORT
          </button>
        </div>
      </div>
    </div>
  );
};
