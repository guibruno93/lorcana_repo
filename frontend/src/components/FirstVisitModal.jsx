import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './FirstVisitModal.css';

const STORAGE_KEY = 'inkwell_disclaimer_accepted';

export default function FirstVisitModal() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 id="first-visit-modal-title">{t('modal.title')}</h2>
        <div className="modal-disclaimers">
          <p>{t('modal.disclaimer1')}</p>
          <p>{t('modal.disclaimer2')}</p>
          <p>{t('modal.disclaimer3')}</p>
        </div>
        <p className="modal-legal-link">
          {t('modal.readMore')}{' '}
          <Link to="/legal">{t('modal.legalPage')}</Link>.
        </p>
        <label className="modal-checkbox-label">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          <span>{t('modal.dontShowAgain')}</span>
        </label>
        <button
          type="button"
          className="modal-accept-button"
          onClick={handleAccept}
        >
          {t('modal.accept')}
        </button>
      </div>
    </div>
  );
}
