/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * System 7 Mandatory Title Bar Structure (Kindle Browser Compatibility)
 */

import React from 'react';

interface TitleBarProps {
  title: string;
  totalPct: number;
  username?: string;
  onEditUsername?: () => void;
  onClose?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  totalPct,
  username,
  onEditUsername,
  onClose
}) => {
  return (
    <div className="title-bar">
      {/* Background Stripes Layer (z-index: 0) */}
      <div className="title-stripes" />

      {/* Interactive Close Box (z-index: 2) */}
      <div className="close-box" onClick={onClose} title="Main Menu">
        X
      </div>

      {/* Centered Title Text with White Background (z-index: 1) */}
      <span className="title-text" data-i18n="app.title">
        {title}
        <span className="beta-badge">E-INK</span>
      </span>

      {/* Secondary Stats Group (z-index: 2) */}
      <div className="title-right-group" style={{ display: 'flex', alignItems: 'center' }}>
        {onEditUsername && (
          <button
            onClick={onEditUsername}
            title="Click to change your username"
            style={{
              background: '#141414',
              color: '#ffffff',
              border: '1px solid #ffffff',
              padding: '1px 5px',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              marginRight: '6px',
              cursor: 'pointer'
            }}
          >
            @{username || 'Player'}
          </button>
        )}
        TOTAL:&nbsp;<span>{totalPct}%</span>
      </div>
    </div>
  );
};
