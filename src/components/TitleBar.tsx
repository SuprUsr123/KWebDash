/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Cpu, RefreshCw, Smartphone } from 'lucide-react';

interface TitleBarProps {
  title: string;
  totalPct: number;
  totalGears?: string;
  onOpenSettings?: () => void;
  onClose?: () => void;
  activeTab: 'menu' | 'editor' | 'community' | 'game';
  setActiveTab: (tab: 'menu' | 'editor' | 'community' | 'game') => void;
  einkEnabled: boolean;
  onManualRefresh?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  totalPct,
  totalGears,
  onOpenSettings,
  onClose,
  activeTab,
  setActiveTab,
  einkEnabled,
  onManualRefresh
}) => {
  return (
    <div className="title-bar">
      {/* Left controls & Brand Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="close-box"
          onClick={onClose}
          title="Return to Main Menu"
        >
          X
        </button>

        <span className="title-badge">NANO_CORE v1.2</span>

        <h1 className="title-text">
          <span>{title}</span>
        </h1>
      </div>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className={`tool-btn ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
          style={{ fontSize: '0.7rem', padding: '2px 8px' }}
        >
          LEVELS
        </button>
        <button
          className={`tool-btn ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
          style={{ fontSize: '0.7rem', padding: '2px 8px' }}
        >
          EDITOR
        </button>
        <button
          className={`tool-btn ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => setActiveTab('community')}
          style={{ fontSize: '0.7rem', padding: '2px 8px' }}
        >
          COMMUNITY
        </button>
      </div>

      {/* Right controls & Metrics */}
      <div className="title-right-group" style={{ gap: '10px' }}>
        {totalGears && (
          <span title="Collected Gears" style={{ opacity: 0.9 }}>
            ⚙️ {totalGears}
          </span>
        )}
        <span>
          COMPLETION: <b>{totalPct}%</b>
        </span>

        {einkEnabled && onManualRefresh && (
          <button
            onClick={onManualRefresh}
            style={{
              background: '#ffffff',
              border: '1px solid #141414',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '1px 1px 0 #141414'
            }}
            title="E-Ink Flash Refresh"
          >
            <RefreshCw size={10} style={{ marginRight: '3px' }} /> FLASH
          </button>
        )}

        <button
          onClick={onOpenSettings}
          style={{
            background: '#ffffff',
            border: '1px solid #141414',
            padding: '2px 6px',
            cursor: 'pointer',
            fontSize: '0.68rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '1px 1px 0 #141414'
          }}
          title="Kindle & Low RAM Settings"
        >
          <Smartphone size={11} style={{ marginRight: '3px' }} /> KINDLE
        </button>
      </div>
    </div>
  );
};
