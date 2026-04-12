/**
 * frontend/src/components/Header.jsx
 * Header responsivo com menu mobile
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MobileMenu from './MobileMenu';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Meta Analysis', path: '/meta' },
    { label: 'Decks', path: '/decks' },
    { label: 'Cards', path: '/cards' }
  ];

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Mobile Menu */}
        <MobileMenu />

        {/* Logo */}
        <div className="header-logo" onClick={() => navigate('/')}>
          <span className="logo-icon" aria-hidden="true" />
          <span className="logo-text">Inkwell Labs</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="header-nav desktop-only">
          {navItems.map((item, index) => (
            <button
              key={index}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="header-actions">
          <button type="button" className="header-action-button" aria-label="Idioma">
            Lang
          </button>
        </div>
      </div>
    </header>
  );
}