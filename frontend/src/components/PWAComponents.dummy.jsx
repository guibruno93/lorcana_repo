import React from 'react';

/**
 * PWAManager - Wrapper simplificado
 * Apenas passa os children sem adicionar funcionalidade PWA
 */
export const PWAManager = ({ children }) => {
  return <>{children}</>;
};

/**
 * Componentes PWA desabilitados (retornam null)
 * Para não quebrar imports mas não mostrar nada
 */
export const InstallPrompt = () => null;
export const OfflineBanner = () => null;
export const UpdateNotification = () => null;
export const ConnectionStatus = () => null;
export const InstallButton = () => null;
export const CacheIndicator = () => null;

export default {
  PWAManager,
  InstallPrompt,
  OfflineBanner,
  UpdateNotification,
  ConnectionStatus,
  InstallButton,
  CacheIndicator
};
