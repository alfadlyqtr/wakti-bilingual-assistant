
import { en } from "./translations/en";
import { ar } from "./translations/ar";
import { TranslationKey, SupportedLanguage } from "./translationTypes";

export type Translation = {
  en: string;
  ar: string;
};

// We're using the simpler approach now, importing directly from en.ts and ar.ts
// This function gets the translation for the given key and language
export const t = (key: TranslationKey, language: SupportedLanguage | string): string => {
  if (language === 'ar') {
    return ar[key] || en[key] || key;
  }
  return en[key] || key;
};
