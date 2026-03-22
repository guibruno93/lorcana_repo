import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importar traduções
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';

const resources = {
  'pt-BR': {
    translation: ptBR
  },
  en: {
    translation: en
  }
};

i18n
  // Detectar idioma do browser/localStorage
  .use(LanguageDetector)
  // Integração com React
  .use(initReactI18next)
  // Inicializar
  .init({
    resources,
    fallbackLng: 'pt-BR', // Idioma padrão se não detectar
    lng: localStorage.getItem('language') || 'pt-BR', // Ler do localStorage
    
    detection: {
      // Ordem de detecção
      order: ['localStorage', 'navigator'],
      // Cache no localStorage
      caches: ['localStorage'],
      lookupLocalStorage: 'language'
    },

    interpolation: {
      escapeValue: false // React já faz sanitização
    },

    // Debug apenas em desenvolvimento
    debug: process.env.NODE_ENV === 'development'
  });

// Salvar mudanças de idioma no localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18n;
