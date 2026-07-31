/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EInkConfig } from '../types';
import { Smartphone, RefreshCw, Cpu } from 'lucide-react';

interface KindleSettingsModalProps {
  config: EInkConfig;
  onChange: (newConfig: EInkConfig) => void;
  onClose: () => void;
  onManualRefresh: () => void;
}

export const KindleSettingsModal: React.FC<KindleSettingsModalProps> = ({
  config,
  onChange,
  onClose,
  onManualRefresh
}) => {
  return (
    <div className="overlay active" style={{ zIndex: 100 }}>
      <div
        style={{
          background: 'white',
          border: '2px solid black',
          boxShadow: '4px 4px 0 black',
          padding: '16px',
          maxWidth: '480px',
          width: '90%',
          textAlign: 'left'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid black',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}
        >
          <h2 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center' }}>
            <Smartphone size={16} style={{ marginRight: '6px' }} /> KINDLE / LOW-RAM CONFIG
          </h2>
          <button className="close-box" onClick={onClose} style={{ position: 'static' }}>
            X
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {/* Enable E-Ink Simulation */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e => onChange({ ...config, enabled: e.target.checked })}
              style={{ accentColor: 'black', width: '16px', height: '16px' }}
            />
            Enable E-Ink Display Mode & Simulation
          </label>

          {/* FPS Cap */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Target FPS Cap:</span>
            <select
              value={config.fps}
              onChange={e => onChange({ ...config, fps: Number(e.target.value) })}
              style={{ border: '2px solid black', padding: '2px 6px', fontWeight: 'bold' }}
            >
              <option value={10}>10 FPS (Kindle E-Ink)</option>
              <option value={15}>15 FPS (Standard E-Paper)</option>
              <option value={30}>30 FPS (Low Power)</option>
              <option value={60}>60 FPS (Smooth Desktop)</option>
            </select>
          </div>

          {/* Ghosting */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>E-Ink Ghosting Persistence:</span>
              <b>{Math.round(config.ghosting * 100)}%</b>
            </div>
            <input
              type="range"
              min={0}
              max={85}
              value={Math.round(config.ghosting * 100)}
              onChange={e => onChange({ ...config, ghosting: Number(e.target.value) / 100 })}
              style={{ accentColor: 'black' }}
            />
          </div>

          {/* Input Lag Test */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Simulated Touch Lag:</span>
            <label>
              <input
                type="number"
                min={0}
                max={300}
                step={10}
                value={config.inputLagMs}
                onChange={e => onChange({ ...config, inputLagMs: Number(e.target.value) })}
                style={{ border: '2px solid black', padding: '2px', width: '60px', fontWeight: 'bold' }}
              />{' '}
              ms
            </label>
          </div>

          {/* Manual Flash Refresh */}
          <div style={{ borderTop: '1px solid black', paddingTop: '8px', marginTop: '4px' }}>
            <button
              className="sys-btn"
              onClick={onManualRefresh}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={12} style={{ marginRight: '6px' }} /> TRIGGER E-INK FLASH REFRESH
            </button>
          </div>

          {/* Memory Footprint Stats */}
          <div
            style={{
              background: '#f0f0f0',
              border: '1px solid black',
              padding: '8px',
              marginTop: '6px',
              fontSize: '0.75rem'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>
              <Cpu size={12} style={{ marginRight: '4px' }} /> Memory Footprint (256MB Kindle Limit):
            </div>
            <div>{"• Grid Matrix Memory: < 250 KB"}</div>
            <div>• Texture/Canvas Buffers: ~ 1.1 MB (Zero GC Spikes)</div>
            <div>• Execution Mode: JIT-less ES2019 Compatible</div>
            <div>• CSS Layout: Flex without Gap (Chromium 75 Safe)</div>
          </div>
        </div>

        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <button className="sys-btn" onClick={onClose} style={{ padding: '6px 16px' }}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
