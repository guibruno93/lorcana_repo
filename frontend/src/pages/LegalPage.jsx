import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function LegalPage({ title, children }) {
  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <Link to="/" className="legal-back">
          ← Início
        </Link>
        <h1>{title}</h1>
      </header>
      <div className="legal-page-body">{children}</div>
    </div>
  );
}
