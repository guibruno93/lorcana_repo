// Logo Inkwell Labs — imagem oficial (public/logo.png) com fallback SVG
import React, { useState } from 'react';
import './Logo.css';

const Logo = ({ size = 'medium', animated = false }) => {
  const sizes = {
    small: { imgHeight: 32, fontSize: '0.85rem' },
    medium: { imgHeight: 44, fontSize: '1.05rem' },
    large: { imgHeight: 56, fontSize: '1.25rem' },
    header: { imgHeight: 64, fontSize: '1.22rem' },
  };

  const { imgHeight, fontSize } = sizes[size] || sizes.medium;
  const [useImage, setUseImage] = useState(true);
  const pub = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const logoSrc = pub ? `${pub}/logo.png` : '/logo.png';

  return (
    <div
      className={`logo-container logo-size-${size} ${animated ? 'animated' : ''}`}
    >
      {useImage ? (
        <img
          src={logoSrc}
          alt="Inkwell Labs"
          width={imgHeight}
          height={imgHeight}
          className="logo-image"
          style={{
            height: imgHeight,
            width: 'auto',
            maxWidth: size === 'header' ? imgHeight * 3.2 : imgHeight * 2.2,
          }}
          onError={() => setUseImage(false)}
          decoding="async"
        />
      ) : (
        <svg
          width={imgHeight}
          height={imgHeight}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="logo-icon logo-icon--fallback"
          aria-hidden
        >
          <defs>
            <linearGradient id="inkGradientFallback" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#A855F7" />
            </linearGradient>
          </defs>
          <path
            d="M20 35 Q20 28 24 24 L40 24 Q44 28 44 35 L44 48 Q44 52 40 52 L24 52 Q20 52 20 48 Z"
            fill="url(#inkGradientFallback)"
          />
        </svg>
      )}

      <div className="logo-text" style={{ fontSize }}>
        <span className="logo-brand">inkwell</span>
        <span className="logo-labs">LABS</span>
      </div>
    </div>
  );
};

export default Logo;
