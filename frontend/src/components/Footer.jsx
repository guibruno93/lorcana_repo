import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Footer.css';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-disclaimers">
        <p>{t('footer.disclaimer1')}</p>
        <p>{t('footer.disclaimer2')}</p>
      </div>
      <nav className="footer-links" aria-label={t('footer.legal')}>
        <Link to="/legal">{t('footer.legal')}</Link>
        <Link to="/terms">{t('footer.terms')}</Link>
        <Link to="/privacy">{t('footer.privacy')}</Link>
        <a href="mailto:contact@inkwelllabs.com">{t('footer.contact')}</a>
      </nav>
      <div className="footer-copyright">
        © 2024–2026 Inkwell Labs. {t('footer.rights')}
      </div>
    </footer>
  );
}
