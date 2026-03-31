import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './LegalDisclaimer.css';

export default function LegalDisclaimer() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="legal-disclaimer-page">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="legal-disclaimer-back"
      >
        ← {t('legal.back')}
      </button>
      <h1>{t('legal.title')}</h1>
      <section>
        <h2>{t('legal.trademarks.title')}</h2>
        <p>{t('legal.trademarks.content')}</p>
      </section>
      <section>
        <h2>{t('legal.copyright.title')}</h2>
        <p>{t('legal.copyright.content')}</p>
      </section>
      <section>
        <h2>{t('legal.fairUse.title')}</h2>
        <p>{t('legal.fairUse.content')}</p>
      </section>
      <section>
        <h2>{t('legal.noAffiliation.title')}</h2>
        <p>{t('legal.noAffiliation.content')}</p>
      </section>
      <section>
        <h2>{t('legal.liability.title')}</h2>
        <p>{t('legal.liability.content')}</p>
      </section>
      <section>
        <h2>{t('legal.contact.title')}</h2>
        <p>{t('legal.contact.content')}</p>
      </section>
    </div>
  );
}
