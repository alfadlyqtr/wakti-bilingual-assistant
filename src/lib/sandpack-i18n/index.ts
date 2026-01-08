// Pre-bundled i18n setup for Sandpack
// This file will be bundled and injected into Sandpack's node_modules

import i18n from 'i18next';
import { initReactI18next, useTranslation, Trans, I18nextProvider } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Export everything needed for i18n
export {
  i18n,
  initReactI18next,
  useTranslation,
  Trans,
  I18nextProvider,
  LanguageDetector
};

// Default export
export default i18n;
