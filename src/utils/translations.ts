
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

// Helper function for quota-specific messages
export const getQuotaMessage = (language: SupportedLanguage, remaining: number, hasExtras: number): string => {
  if (language === 'ar') {
    if (remaining > 0) {
      return `${remaining} ترجمات مجانية متبقية اليوم${hasExtras > 0 ? ` + ${hasExtras} إضافية` : ''}`;
    } else if (hasExtras > 0) {
      return `${hasExtras} ترجمات إضافية متبقية`;
    } else {
      return 'تم الوصول للحد الأقصى - اشتري 150 ترجمة إضافية';
    }
  } else {
    if (remaining > 0) {
      return `${remaining} free translations remaining today${hasExtras > 0 ? ` + ${hasExtras} extra` : ''}`;
    } else if (hasExtras > 0) {
      return `${hasExtras} extra translations remaining`;
    } else {
      return 'Limit reached - Buy 150 extra translations';
    }
  }
};
