import React from 'react';
import './LoadingStates.css';

/**
 * Skeleton genérico com shimmer effect
 */
export const Skeleton = ({ width, height, borderRadius = '8px', className = '' }) => {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || '20px',
        borderRadius 
      }}
    />
  );
};

/**
 * Skeleton para card de carta
 */
export const CardSkeleton = () => {
  return (
    <div className="card-skeleton">
      <Skeleton height="160px" borderRadius="12px" className="card-image-skeleton" />
      <div className="card-skeleton-info">
        <Skeleton height="14px" width="80%" className="mb-8" />
        <div className="card-skeleton-stats">
          <div>
            <Skeleton height="12px" width="40px" className="mb-4" />
            <Skeleton height="8px" width="50px" />
          </div>
          <div>
            <Skeleton height="12px" width="30px" className="mb-4" />
            <Skeleton height="8px" width="30px" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton para linha de arquétipo
 */
export const ArchetypeSkeleton = () => {
  return (
    <div className="archetype-skeleton">
      <div className="archetype-skeleton-header">
        <div className="archetype-skeleton-left">
          <Skeleton height="24px" width="180px" className="mb-8" />
          <div className="inks-skeleton">
            <Skeleton height="20px" width="60px" borderRadius="6px" />
            <Skeleton height="20px" width="70px" borderRadius="6px" />
          </div>
        </div>
        <div className="archetype-skeleton-stats">
          <div className="stat-skeleton">
            <Skeleton height="20px" width="50px" className="mb-4" />
            <Skeleton height="10px" width="60px" />
          </div>
          <div className="stat-skeleton">
            <Skeleton height="20px" width="50px" className="mb-4" />
            <Skeleton height="10px" width="70px" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton para tier completo
 */
export const TierSkeleton = ({ archetypeCount = 3 }) => {
  return (
    <div className="tier-skeleton">
      <div className="tier-skeleton-header">
        <Skeleton height="32px" width="100px" />
        <Skeleton height="24px" width="80px" borderRadius="20px" />
      </div>
      <div className="tier-skeleton-content">
        {Array.from({ length: archetypeCount }).map((_, idx) => (
          <ArchetypeSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
};

/**
 * Spinner de loading
 */
export const Spinner = ({ size = 'medium', color = '#667eea' }) => {
  const sizeMap = {
    small: '20px',
    medium: '40px',
    large: '60px'
  };

  return (
    <div 
      className="spinner"
      style={{ 
        width: sizeMap[size], 
        height: sizeMap[size],
        borderTopColor: color
      }}
    />
  );
};

/**
 * Loading state com mensagem
 */
export const LoadingMessage = ({ message = 'Loading...', showSpinner = true }) => {
  return (
    <div className="loading-message">
      {showSpinner && <Spinner />}
      <p className="loading-text">{message}</p>
    </div>
  );
};

/**
 * Cards grid skeleton (para quando expandir arquétipo)
 */
export const CardsGridSkeleton = ({ count = 8 }) => {
  return (
    <div className="cards-grid">
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </div>
  );
};

/**
 * Pulse loader (3 dots animados)
 */
export const PulseLoader = () => {
  return (
    <div className="pulse-loader">
      <div className="pulse-dot"></div>
      <div className="pulse-dot"></div>
      <div className="pulse-dot"></div>
    </div>
  );
};

/**
 * Progress bar para operações longas
 */
export const ProgressBar = ({ progress = 0, showPercentage = true }) => {
  return (
    <div className="progress-bar-container">
      <div className="progress-bar-track">
        <div 
          className="progress-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {showPercentage && (
        <span className="progress-percentage">{Math.round(progress)}%</span>
      )}
    </div>
  );
};

export default {
  Skeleton,
  CardSkeleton,
  ArchetypeSkeleton,
  TierSkeleton,
  Spinner,
  LoadingMessage,
  CardsGridSkeleton,
  PulseLoader,
  ProgressBar
};
