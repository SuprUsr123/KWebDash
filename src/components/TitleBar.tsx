/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface TitleBarProps {
  title: string;
  totalPct: number;
  onClose?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  totalPct,
  onClose
}) => {
  return (
    <div className="title-bar">
      <div className="title-stripes" />
      <div className="close-box" onClick={onClose} title="Main Menu">
        X
      </div>
      <span className="title-text">{title}</span>
      <div className="title-right-group">
        TOTAL:&nbsp;<span>{totalPct}%</span>
      </div>
    </div>
  );
};

