
import { TranslationKey } from "./translationTypes";

const translations: Record<TranslationKey, { en: string; ar: string }> = {
  dashboard: {
    en: "Dashboard",
    ar: "لوحة التحكم",
  },
  calendar: {
    en: "Calendar",
    ar: "التقويم",
  },
  tasks: {
    en: "Tasks",
    ar: "المهام",
  },
  events: {
    en: "Events",
    ar: "الفعاليات",
  },
  messages: {
    en: "Messages",
    ar: "الرسائل",
  },
  contacts: {
    en: "Contacts",
    ar: "جهات الاتصال",
  },
  settings: {
    en: "Settings",
    ar: "الإعدادات",
  },
  logout: {
    en: "Logout",
    ar: "تسجيل الخروج",
  },
  login: {
    en: "Login",
    ar: "تسجيل الدخول",
  },
  signup: {
    en: "Sign Up",
    ar: "إنشاء حساب",
  },
  forgotPassword: {
    en: "Forgot Password",
    ar: "نسيت كلمة المرور",
  },
  email: {
    en: "Email",
    ar: "البريد الإلكتروني",
  },
  password: {
    en: "Password",
    ar: "كلمة المرور",
  },
  name: {
    en: "Name",
    ar: "الاسم",
  },
  username: {
    en: "Username",
    ar: "اسم المستخدم",
  },
  confirmPassword: {
    en: "Confirm Password",
    ar: "تأكيد كلمة المرور",
  },
  submit: {
    en: "Submit",
    ar: "إرسال",
  },
  resetPassword: {
    en: "Reset Password",
    ar: "إعادة تعيين كلمة المرور",
  },
  back: {
    en: "Back",
    ar: "رجوع",
  },
  home: {
    en: "Home",
    ar: "الرئيسية",
  },
  profile: {
    en: "Profile",
    ar: "الملف الشخصي",
  },
  notifications: {
    en: "Notifications",
    ar: "الإشعارات",
  },
  darkMode: {
    en: "Dark Mode",
    ar: "الوضع الداكن",
  },
  lightMode: {
    en: "Light Mode",
    ar: "الوضع الفاتح",
  },
  english: {
    en: "English",
    ar: "الإنجليزية",
  },
  arabic: {
    en: "Arabic",
    ar: "العربية",
  },
  today: {
    en: "Today",
    ar: "اليوم",
  },
  tomorrow: {
    en: "Tomorrow",
    ar: "غداً",
  },
  freeTrialDays: {
    en: "Free Trial Days",
    ar: "أيام النسخة التجريبية",
  },
  dailyQuote: {
    en: "Daily Quote",
    ar: "اقتباس اليوم",
  },
  reminders: {
    en: "Reminders",
    ar: "التذكيرات",
  },
  tasks_view_all: {
    en: "View All Tasks",
    ar: "عرض جميع المهام",
  },
  calendar_open: {
    en: "Open Calendar",
    ar: "فتح التقويم",
  },
  events_today: {
    en: "Today's Events",
    ar: "فعاليات اليوم",
  },
  events_view_all: {
    en: "View All Events",
    ar: "عرض جميع الفعاليات",
  },
  reminders_view_all: {
    en: "View All Reminders",
    ar: "عرض جميع التذكيرات",
  },
  event: {
    en: "Event",
    ar: "فعالية",
  },
  task: {
    en: "Task",
    ar: "مهمة",
  },
  voice: {
    en: "Voice",
    ar: "صوت",
  },
  summary: {
    en: "Summary",
    ar: "ملخص",
  },
  ai: {
    en: "AI",
    ar: "الذكاء الاصطناعي",
  },
};

export const t = (key: TranslationKey, language: "en" | "ar"): string => {
  return translations[key]?.[language] || key;
};
