import { useRef, useEffect } from 'react';

/**
 * Hook customizado para detectar gestos de swipe
 * @param {Function} onSwipeLeft - Callback quando swipe para esquerda
 * @param {Function} onSwipeRight - Callback quando swipe para direita
 * @param {Function} onSwipeUp - Callback quando swipe para cima
 * @param {Function} onSwipeDown - Callback quando swipe para baixo
 * @param {number} threshold - Distância mínima para considerar swipe (padrão: 50px)
 */
export const useSwipe = (
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50
) => {
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const touchEnd = useRef({ x: 0, y: 0, time: 0 });

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    touchEnd.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = () => {
    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const deltaTime = touchEnd.current.time - touchStart.current.time;
    
    // Velocidade do swipe (px/ms)
    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;
    
    // Determinar direção dominante
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    
    // Swipe horizontal
    if (isHorizontal && Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight({ deltaX, velocityX });
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft({ deltaX, velocityX });
      }
    }
    
    // Swipe vertical
    if (!isHorizontal && Math.abs(deltaY) > threshold) {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown({ deltaY, velocityY });
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp({ deltaY, velocityY });
      }
    }
    
    // Reset
    touchStart.current = { x: 0, y: 0, time: 0 };
    touchEnd.current = { x: 0, y: 0, time: 0 };
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};

/**
 * Hook para detectar long press (toque longo)
 * @param {Function} callback - Função chamada após long press
 * @param {number} duration - Duração mínima em ms (padrão: 500ms)
 */
export const useLongPress = (callback, duration = 500) => {
  const timeout = useRef(null);
  const target = useRef(null);

  const start = (e) => {
    target.current = e.currentTarget;
    timeout.current = setTimeout(() => {
      callback(e);
    }, duration);
  };

  const clear = () => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
  };

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear
  };
};

/**
 * Hook para pull-to-refresh
 * @param {Function} onRefresh - Callback quando pull-to-refresh é ativado
 * @param {number} threshold - Distância mínima para ativar (padrão: 80px)
 */
export const usePullToRefresh = (onRefresh, threshold = 80) => {
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e) => {
    // Só ativa se estiver no topo da página
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current) return;

    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY.current;

    if (pullDistance > 0) {
      // Prevenir scroll nativo enquanto puxa
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e) => {
    if (!isPulling.current) return;

    const endY = e.changedTouches[0].clientY;
    const pullDistance = endY - startY.current;

    if (pullDistance > threshold) {
      onRefresh();
    }

    isPulling.current = false;
    startY.current = 0;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};

export default { useSwipe, useLongPress, usePullToRefresh };
