import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Static imports get bundled
import en from './locales/en/common.json' with { type: 'json' };

void i18n
  .use(LanguageDetector)   // detects from localStorage, navigator, etc.
  .use(initReactI18next)
  .init({
    // preload both languages
    resources: {
      en: { common: en }
    },
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag', 'cookie'],
      caches: ['localStorage']
    },
    returnNull: false
  });

export default i18n;
