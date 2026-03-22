import React, { useState, useEffect } from 'react';
import { usePWA, useOfflineDetector } from '../hooks/usePWA';
import './PWAComponents.css';

/**
 * Banner de instalação do PWA
 */
export const InstallPrompt = () => {
  const { isInstallable, isInstalled, promptInstall } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);

  // Verificar se já foi dismissado anteriormente
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (!accepted) {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Não mostrar se já instalado, não installable, ou foi dismissado
  if (isInstalled || !isInstallable || isDismissed) {
    return null;
  }

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <div className="install-prompt-icon">
          📱
        </div>
        <div className="install-prompt-text">
          <div className="install-prompt-title">Install Lorcana Meta</div>
          <div className="install-prompt-description">
            Quick access to tier lists, works offline!
          </div>
        </div>
        <div className="install-prompt-actions">
          <button 
            className="install-prompt-btn install-btn"
            onClick={handleInstall}
          >
            Install
          </button>
          <button 
            className="install-prompt-btn dismiss-btn"
            onClick={handleDismiss}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Banner de status offline/online
 */
export const OfflineBanner = () => {
  const { isOffline, showOfflineBanner, wasOffline } = useOfflineDetector();

  if (!showOfflineBanner) {
    return null;
  }

  return (
    <div className={`offline-banner ${isOffline ? 'offline' : 'online'}`}>
      <div className="offline-banner-content">
        {isOffline ? (
          <>
            <span className="offline-icon">📡</span>
            <span className="offline-text">You're offline - Showing cached data</span>
          </>
        ) : (
          <>
            <span className="online-icon">✓</span>
            <span className="online-text">Back online</span>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Notificação de update disponível
 */
export const UpdateNotification = () => {
  const { updateAvailable, applyUpdate } = usePWA();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setIsVisible(true);
    }
  }, [updateAvailable]);

  const handleUpdate = () => {
    applyUpdate();
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !updateAvailable) {
    return null;
  }

  return (
    <div className="update-notification">
      <div className="update-notification-content">
        <div className="update-notification-icon">
          🔄
        </div>
        <div className="update-notification-text">
          <div className="update-notification-title">Update Available</div>
          <div className="update-notification-description">
            A new version is ready to install
          </div>
        </div>
        <div className="update-notification-actions">
          <button 
            className="update-notification-btn update-btn"
            onClick={handleUpdate}
          >
            Update Now
          </button>
          <button 
            className="update-notification-btn dismiss-btn"
            onClick={handleDismiss}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Indicador de status de conexão (sempre visível, discreto)
 */
export const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showStatus) {
    return null;
  }

  return (
    <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
      <div className="connection-status-dot" />
      <span className="connection-status-text">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
};

/**
 * Botão de instalação (para colocar em settings/menu)
 */
export const InstallButton = ({ className = '' }) => {
  const { isInstallable, isInstalled, promptInstall } = usePWA();

  if (isInstalled) {
    return (
      <div className={`install-status ${className}`}>
        <span className="install-status-icon">✓</span>
        <span className="install-status-text">App Installed</span>
      </div>
    );
  }

  if (!isInstallable) {
    return null;
  }

  return (
    <button 
      className={`install-button ${className}`}
      onClick={promptInstall}
    >
      <span className="install-button-icon">⬇️</span>
      <span className="install-button-text">Install App</span>
    </button>
  );
};

/**
 * Cache indicator (mostra quando dados vêm do cache)
 */
export const CacheIndicator = ({ fromCache }) => {
  if (!fromCache) {
    return null;
  }

  return (
    <div className="cache-indicator">
      <span className="cache-indicator-icon">💾</span>
      <span className="cache-indicator-text">Cached data</span>
    </div>
  );
};

/**
 * Wrapper com todos os componentes PWA
 */
export const PWAManager = ({ children }) => {
  return (
    <>
      <InstallPrompt />
      <OfflineBanner />
      <UpdateNotification />
      <ConnectionStatus />
      {children}
    </>
  );
};

export default {
  InstallPrompt,
  OfflineBanner,
  UpdateNotification,
  ConnectionStatus,
  InstallButton,
  CacheIndicator,
  PWAManager
};
