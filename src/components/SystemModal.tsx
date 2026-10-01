/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * System 7 Compatible Modal Dialog (No window.alert/confirm/prompt)
 * Conforms to Kindle Browser Compatibility constraints (Chromium 75 / ES2019).
 */

import React, { useState } from 'react';

export type ModalType = 'alert' | 'confirm' | 'prompt';

export interface ModalConfig {
  type: ModalType;
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

interface SystemModalProps {
  config: ModalConfig | null;
  onClose: () => void;
}

export const SystemModal: React.FC<SystemModalProps> = ({ config, onClose }) => {
  if (!config) return null;

  const [promptValue, setPromptValue] = useState<string>(config.defaultValue || '');

  const handleConfirm = () => {
    if (config.onConfirm) {
      config.onConfirm(config.type === 'prompt' ? promptValue : undefined);
    }
    onClose();
  };

  const handleCancel = () => {
    if (config.onCancel) {
      config.onCancel();
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        {/* Title bar of modal */}
        <div
          style={{
            borderBottom: '2px solid black',
            paddingBottom: '6px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span
            style={{
              fontWeight: 'bold',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            {config.title || 'SYSTEM NOTICE'}
          </span>
          <button
            className="close-box"
            onClick={handleCancel}
            style={{ position: 'static' }}
          >
            X
          </button>
        </div>

        {/* Message body */}
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '0.85rem',
            lineHeight: '1.4',
            fontFamily: '"Geneva", "Verdana", sans-serif',
            wordBreak: 'break-word'
          }}
        >
          {config.message}
        </p>

        {/* Prompt Input if type is prompt */}
        {config.type === 'prompt' && (
          <div style={{ marginBottom: '14px' }}>
            <textarea
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={config.placeholder || 'Enter value...'}
              rows={4}
              style={{
                width: '100%',
                border: '2px solid black',
                padding: '6px',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                boxSizing: 'border-box',
                background: 'white'
              }}
            />
          </div>
        )}

        {/* Modal Buttons (Margins instead of Flexbox Gap for Chromium 75) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '8px'
          }}
        >
          {(config.type === 'confirm' || config.type === 'prompt') && (
            <button
              className="sys-btn"
              onClick={handleCancel}
              style={{
                minWidth: '80px',
                minHeight: '36px',
                padding: '4px 12px',
                margin: 0,
                marginRight: '8px'
              }}
            >
              {config.cancelText || 'CANCEL'}
            </button>
          )}
          <button
            className="sys-btn"
            onClick={handleConfirm}
            style={{
              minWidth: '80px',
              minHeight: '36px',
              padding: '4px 12px',
              margin: 0
            }}
          >
            {config.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
