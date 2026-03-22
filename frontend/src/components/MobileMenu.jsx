/**
 * frontend/src/components/MobileMenu.jsx
 * Menu hamburger mobile adaptado para tabs
 */

import React, { useState, useEffect } from 'react';
import './MobileMenu.css';

export default function MobileMenu({ tabs, activeTab, onTabChange }) {
  const [isOpen, setIsOpen] = useState(false);

  // Fechar menu ao mudar de tab
  useEffect(() => {
    setIsOpen(false);
  }, [activeTab]);

  // Prevenir scroll quando menu aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleTabClick = (tabId) => {
    onTabChange(tabId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Button */}
      <button 
        className="mobile-menu-button mobile-only"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Menu"
      >
        <div className={`hamburger ${isOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>

      {/* Overlay */}
      <div 
        className={`mobile-menu-overlay ${isOpen ? 'visible' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <nav className={`mobile-menu-drawer ${isOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <div className="mobile-menu-logo">
            <span className="logo-icon">🃏</span>
            <span className="logo-text">LORCANA AI</span>
          </div>
          <button 
            className="mobile-menu-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="mobile-menu-items">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`mobile-menu-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className="menu-item-icon">{tab.icon}</span>
              <span className="menu-item-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="mobile-menu-footer">
          <div className="menu-footer-item">
            <span>Version 1.0.0</span>
          </div>
          <div className="menu-footer-item">
            <span>© 2026 Lorcana AI</span>
          </div>
        </div>
      </nav>
    </>
  );
}