// LazyImage.jsx - Lazy loading avançado com IntersectionObserver
import React, { useState, useEffect, useRef } from 'react';
import './LazyImage.css';

/**
 * Componente de imagem com lazy loading avançado
 * 
 * Features:
 * - IntersectionObserver para detecção de visibilidade
 * - Preload quando imagem está próxima (rootMargin)
 * - Placeholder blur enquanto carrega
 * - Suporte a erro (fallback)
 * - Progressive loading (low quality → high quality)
 */
const LazyImage = ({
  src,
  alt,
  placeholder = null,
  className = '',
  width,
  height,
  threshold = 0.01,
  rootMargin = '50px', // Começa a carregar 50px antes de ficar visível
  onLoad,
  onError
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [imageRef, setImageRef] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const imgElementRef = useRef();

  useEffect(() => {
    let observer;
    
    const imageElement = imgElementRef.current;
    
    if (!imageElement || !src) return;

    // Criar IntersectionObserver
    observer = new IntersectionObserver(
      ([entry]) => {
        // Quando a imagem estiver visível (ou próxima)
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    observer.observe(imageElement);

    return () => {
      if (observer && imageElement) {
        observer.disconnect();
      }
    };
  }, [src, threshold, rootMargin]);

  const handleLoad = (e) => {
    setIsLoading(false);
    if (onLoad) {
      onLoad(e);
    }
  };

  const handleError = (e) => {
    setIsLoading(false);
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  return (
    <div 
      className={`lazy-image-container ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || 'auto',
        position: 'relative'
      }}
    >
      {/* Skeleton loader enquanto carrega */}
      {isLoading && (
        <div className="lazy-image-skeleton" />
      )}

      {/* Imagem */}
      <img
        ref={imgElementRef}
        src={imageSrc}
        alt={alt}
        className={`lazy-image ${isLoading ? 'lazy-image-loading' : 'lazy-image-loaded'}`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy" // Fallback nativo
        decoding="async"
        style={{
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />

      {/* Fallback em caso de erro */}
      {hasError && (
        <div className="lazy-image-error">
          <span className="lazy-image-error-icon" aria-hidden="true">IMG</span>
          <span className="lazy-image-error-text">Imagem não disponível</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(LazyImage);
