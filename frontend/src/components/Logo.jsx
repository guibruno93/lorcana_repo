// Logo.jsx - Logo profissional do Inkwell Labs
import React from 'react';
import './Logo.css';

const Logo = ({ size = 'medium', animated = false }) => {
  const sizes = {
    small: { width: 32, height: 32, fontSize: '0.9rem' },
    medium: { width: 48, height: 48, fontSize: '1.2rem' },
    large: { width: 64, height: 64, fontSize: '1.5rem' },
  };

  const { width, height, fontSize } = sizes[size];

  return (
    <div className={`logo-container ${animated ? 'animated' : ''}`}>
      {/* SVG Icon - Inkwell com Pena */}
      <svg
        width={width}
        height={height}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="logo-icon"
      >
        {/* Inkwell (Tinteiro) */}
        <defs>
          <linearGradient id="inkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#764ba2" />
          </linearGradient>
          <linearGradient id="featherGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f093fb" />
            <stop offset="100%" stopColor="#f5576c" />
          </linearGradient>
        </defs>

        {/* Base do Tinteiro */}
        <path
          d="M20 35 Q20 28 24 24 L40 24 Q44 28 44 35 L44 48 Q44 52 40 52 L24 52 Q20 52 20 48 Z"
          fill="url(#inkGradient)"
          className="inkwell-base"
        />

        {/* Tinta líquida */}
        <ellipse
          cx="32"
          cy="42"
          rx="10"
          ry="4"
          fill="#4c51bf"
          opacity="0.6"
          className="ink-liquid"
        />

        {/* Pena de escrever */}
        <path
          d="M38 30 L48 12 Q49 10 50 12 L52 16 Q53 18 51 19 L40 34 Z"
          fill="url(#featherGradient)"
          className="feather"
        />

        {/* Detalhes da pena */}
        <path
          d="M42 22 L44 18 M44 25 L46 21 M46 28 L48 24"
          stroke="#fff"
          strokeWidth="1"
          opacity="0.5"
          className="feather-detail"
        />

        {/* Brilho no tinteiro */}
        <ellipse
          cx="28"
          cy="30"
          rx="4"
          ry="6"
          fill="#fff"
          opacity="0.2"
          className="shine"
        />
      </svg>

      {/* Texto do Logo */}
      <div className="logo-text" style={{ fontSize }}>
        <span className="logo-brand">Inkwell</span>
        <span className="logo-labs">Labs</span>
      </div>
    </div>
  );
};

export default Logo;
