import React from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X } from 'lucide-react';
import '../../index.css';

const Titlebar = () => {
  const { t } = useTranslation();

  const handleMinimize = () => {
    if (window.api?.window?.minimize) {
      window.api.window.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.api?.window?.maximize) {
      window.api.window.maximize();
    }
  };

  const handleClose = () => {
    if (window.api?.window?.close) {
      window.api.window.close();
    }
  };

  return (
    <div className="custom-titlebar">
      <div className="titlebar-drag-region"></div>
      <div className="titlebar-content">
        <div className="titlebar-brand">
          <span className="titlebar-title">{t('app.name', 'Tecton')}</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={handleMinimize} title={t('window.minimize', 'Küçült')}>
            <Minus size={16} />
          </button>
          <button className="titlebar-btn" onClick={handleMaximize} title={t('window.maximize', 'Büyült')}>
            <Square size={14} />
          </button>
          <button className="titlebar-btn close-btn" onClick={handleClose} title={t('window.close', 'Kapat')}>
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Titlebar;
