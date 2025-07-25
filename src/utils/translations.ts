
import { en } from "./translations/en";
import { ar } from "./translations/ar";
import { legal as legalEn } from "./translations/modules/legal";
import { legal as legalAr } from "./translations/modules/ar/legal";
import { reminders as remindersEn } from "./translations/modules/reminders";
import { remindersAr } from "./translations/modules/ar/reminders";
import { tasks as tasksEn } from "./translations/modules/tasks";
import { tasksAr } from "./translations/modules/ar/tasks";
import { settings as settingsEn } from "./translations/modules/settings";
import { settingsAr } from "./translations/modules/ar/settings";
import { account as accountEn } from "./translations/modules/account";
import { accountAr } from "./translations/modules/ar/account";
import { TranslationKey, SupportedLanguage } from "./translationTypes";

export type Translation = {
  en: string;
  ar: string;
};

// Combined translation objects
const enTranslations = { 
  ...en, 
  ...legalEn, 
  ...remindersEn, 
  ...tasksEn, 
  ...settingsEn, 
  ...accountEn 
};

const arTranslations = { 
  ...ar, 
  ...legalAr, 
  ...remindersAr, 
  ...tasksAr, 
  ...settingsAr, 
  ...accountAr 
};

// This function gets the translation for the given key and language
export const t = (key: TranslationKey, language: SupportedLanguage | string): string => {
  if (language === 'ar') {
    return arTranslations[key] || enTranslations[key] || key;
  }
  return enTranslations[key] || key;
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
