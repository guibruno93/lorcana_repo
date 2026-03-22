import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const currentLang = i18n.language || 'en';

  return (
    <div className="language-selector">
      <button
        onClick={() => changeLanguage('pt-BR')}
        className={`lang-btn ${currentLang === 'pt-BR' ? 'active' : ''}`}
        title="Português (Brasil)"
      >
        🇧🇷 PT-BR
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={`lang-btn ${currentLang === 'en' ? 'active' : ''}`}
        title="English"
      >
        🇺🇸 EN
      </button>
    </div>
  );
}
