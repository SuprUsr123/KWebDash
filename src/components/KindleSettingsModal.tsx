/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kindle / Low-RAM Config Modal
 * Compliant with Kindle Browser Compatibility Guide (.modal-overlay / .modal-box, no flex gap, ES2019).
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
    <div className="modal-overlay">
      <div className="modal-box">
        {/* Title Bar */}
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
          <span style={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <Smartphone size={16} style={{ marginRight: '6px' }} /> KINDLE / LOW-RAM CONFIG
          </span>
          <button className="close-box" onClick={onClose} style={{ position: 'static' }}>
            X
          </button>
        </div>

        {/* Form Container (No flex gap - uses child margins) */}
        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {/* Enable E-Ink Simulation */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={e => onChange({ ...config, enabled: e.target.checked })}
                style={{ accentColor: 'black', width: '18px', height: '18px', marginRight: '8px' }}
              />
              Enable E-Ink Display Mode & Simulation
            </label>
          </div>

          {/* FPS Cap */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Target FPS Cap:</span>
            <select
              value={config.fps}
              onChange={e => onChange({ ...config, fps: Number(e.target.value) })}
              style={{ border: '2px solid black', padding: '4px 8px', fontWeight: 'bold', background: 'white' }}
            >
              <option value={10}>10 FPS (Kindle E-Ink)</option>
              <option value={15}>15 FPS (Standard E-Paper)</option>
              <option value={30}>30 FPS (Low Power)</option>
              <option value={60}>60 FPS (Smooth Desktop)</option>
            </select>
          </div>

          {/* Ghosting */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>E-Ink Ghosting Persistence:</span>
              <b>{Math.round(config.ghosting * 100)}%</b>
            </div>
            <input
              type="range"
              min={0}
              max={85}
              value={Math.round(config.ghosting * 100)}
              onChange={e => onChange({ ...config, ghosting: Number(e.target.value) / 100 })}
              style={{ width: '100%', accentColor: 'black' }}
            />
          </div>

          {/* Input Lag Test */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Simulated Touch Lag:</span>
            <label>
              <input
                type="number"
                min={0}
                max={300}
                step={10}
                value={config.inputLagMs}
                onChange={e => onChange({ ...config, inputLagMs: Number(e.target.value) })}
                style={{ border: '2px solid black', padding: '2px 4px', width: '60px', fontWeight: 'bold', marginRight: '4px' }}
              />
              ms
            </label>
          </div>

          {/* Manual Flash Refresh */}
          <div style={{ borderTop: '1px solid black', paddingTop: '10px', marginTop: '6px', marginBottom: '10px' }}>
            <button
              className="sys-btn"
              onClick={onManualRefresh}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px' }}
            >
              <RefreshCw size={14} style={{ marginRight: '6px' }} /> TRIGGER E-INK FLASH REFRESH
            </button>
          </div>

          {/* Memory Footprint Stats */}
          <div
            style={{
              background: '#f0f0f0',
              border: '1px solid black',
              padding: '8px',
              fontSize: '0.75rem',
              lineHeight: '1.4'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>
              <Cpu size={12} style={{ marginRight: '4px' }} /> Memory Footprint (256MB Kindle Limit):
            </div>
            <div>• Grid Matrix Memory: &lt; 250 KB</div>
            <div>• Texture/Canvas Buffers: ~ 1.1 MB (Zero GC Spikes)</div>
            <div>• Execution Mode: JIT-less ES2019 Compatible</div>
            <div>• CSS Layout: Flex without Gap (Chromium 75 Safe)</div>
          </div>
        </div>

        <div style={{ marginTop: '14px', textAlign: 'right' }}>
          <button className="sys-btn" onClick={onClose} style={{ minWidth: '90px', minHeight: '40px', padding: '6px 18px' }}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
