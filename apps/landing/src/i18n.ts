import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Only the strings the shared chrome needs on every page: navigation, the waitlist form and a
// handful of general labels. ~2.5 KiB gzipped.
import core from './locales/en/core.json' with { type: 'json' };

/**
 * i18n bootstrap.
 *
 * The whole locale used to be one 204 KiB file (56.5 KiB gzipped) statically imported here, so
 * every visitor downloaded the copy for all twenty pages to read one of them. It is now split:
 * this file carries the shared chrome, and each page's slice is fetched alongside its route chunk
 * by `routes/pageLoaders.ts` — registered BEFORE the component mounts, so a key can never render
 * raw.
 *
 * `i18next-browser-languagedetector` was removed with it. There is exactly one locale and no
 * language switching anywhere in the app, so detection could only ever resolve to `en` — it was
 * shipping a dependency to compute a constant. `lng` is now set explicitly, which is also more
 * predictable: detection previously read localStorage and could be influenced by another app on
 * the same origin.
 */
void i18n.use(initReactI18next).init({
  resources: { en: { common: core } },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
