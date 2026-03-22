import { useEffect, useState } from 'react';

/**
 * Hook para gerenciar PWA e Service Worker
 * @returns {Object} Estado e funções do PWA
 */
export const usePWA = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // ==========================================
  // REGISTRAR SERVICE WORKER
  // ==========================================
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('[PWA] Service Worker registered:', reg);
      setRegistration(reg);

      // Verificar updates a cada 1 hora
      setInterval(() => {
        reg.update();
      }, 60 * 60 * 1000);

      // Detectar update disponível
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] Update available');
            setUpdateAvailable(true);
          }
        });
      });

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  };

  // ==========================================
  // DETECTAR STATUS ONLINE/OFFLINE
  // ==========================================
  useEffect(() => {
    const handleOnline = () => {
      console.log('[PWA] Back online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('[PWA] Gone offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ==========================================
  // DETECTAR INSTALLABLE (beforeinstallprompt)
  // ==========================================
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      console.log('[PWA] Install prompt available');
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // ==========================================
  // DETECTAR SE JÁ ESTÁ INSTALADO
  // ==========================================
  useEffect(() => {
    // Verificar se está rodando em standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                      || window.navigator.standalone 
                      || document.referrer.includes('android-app://');
    
    setIsInstalled(isStandalone);

    // Listener para mudanças no display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e) => {
      setIsInstalled(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // ==========================================
  // FUNÇÃO: INSTALAR APP
  // ==========================================
  const promptInstall = async () => {
    if (!deferredPrompt) {
      console.warn('[PWA] Install prompt not available');
      return false;
    }

    // Mostrar prompt nativo
    deferredPrompt.prompt();

    // Aguardar escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`[PWA] Install prompt outcome: ${outcome}`);

    if (outcome === 'accepted') {
      setIsInstallable(false);
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    return outcome === 'accepted';
  };

  // ==========================================
  // FUNÇÃO: APLICAR UPDATE
  // ==========================================
  const applyUpdate = () => {
    if (!registration || !registration.waiting) {
      return;
    }

    // Dizer ao SW para skipWaiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Recarregar quando o novo SW assumir controle
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  };

  // ==========================================
  // FUNÇÃO: LIMPAR CACHE
  // ==========================================
  const clearCache = async () => {
    if (!registration) {
      return;
    }

    registration.active.postMessage({ type: 'CLEAR_CACHE' });
    
    // Recarregar após limpar cache
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // ==========================================
  // FUNÇÃO: VERIFICAR CONECTIVIDADE
  // ==========================================
  const checkConnectivity = async () => {
    try {
      await fetch('/api/health', { method: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  };

  return {
    // Estados
    isOnline,
    isInstallable,
    isInstalled,
    updateAvailable,
    registration,
    
    // Funções
    promptInstall,
    applyUpdate,
    clearCache,
    checkConnectivity
  };
};

/**
 * Hook para detectar se está offline e mostrar indicador
 */
export const useOfflineDetector = () => {
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      if (wasOffline) {
        // Mostrar banner "Back online" temporariamente
        setShowOfflineBanner(true);
        setTimeout(() => {
          setShowOfflineBanner(false);
          setWasOffline(false);
        }, 3000);
      }
    };

    const handleOffline = () => {
      setShowOfflineBanner(true);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar status inicial
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return {
    isOffline: !navigator.onLine,
    showOfflineBanner,
    wasOffline
  };
};

/**
 * Hook para cache de dados específicos
 */
export const useOfflineCache = (key, fetcher, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const {
    cacheTime = 5 * 60 * 1000, // 5 minutos padrão
    staleWhileRevalidate = true
  } = options;

  useEffect(() => {
    const loadData = async () => {
      try {
        // Tentar buscar do cache primeiro
        const cached = localStorage.getItem(key);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;

          if (age < cacheTime) {
            // Cache válido
            setData(cachedData);
            setFromCache(true);
            setLoading(false);

            // Se stale-while-revalidate, buscar em background
            if (staleWhileRevalidate) {
              fetchAndCache();
            }
            return;
          }
        }

        // Cache miss ou expirado, buscar fresh data
        await fetchAndCache();
      } catch (error) {
        console.error('[Cache] Error loading data:', error);
        setLoading(false);
      }
    };

    const fetchAndCache = async () => {
      try {
        const freshData = await fetcher();
        
        // Salvar no cache
        localStorage.setItem(key, JSON.stringify({
          data: freshData,
          timestamp: Date.now()
        }));

        setData(freshData);
        setFromCache(false);
        setLoading(false);
      } catch (error) {
        console.error('[Cache] Error fetching data:', error);
        // Se falhar, manter dados do cache se houver
        setLoading(false);
      }
    };

    loadData();
  }, [key, cacheTime, staleWhileRevalidate]);

  const invalidate = () => {
    localStorage.removeItem(key);
    setData(null);
    setLoading(true);
  };

  return {
    data,
    loading,
    fromCache,
    invalidate
  };
};

export default { usePWA, useOfflineDetector, useOfflineCache };
