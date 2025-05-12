
import { TranslationKey } from "./translationTypes";

const translations: Record<TranslationKey, { en: string; ar: string }> = {
  // Navigation & Menu Items
  dashboard: {
    en: "Dashboard",
    ar: "لوحة التحكم",
  },
  taskManagement: {
    en: "Tasks",
    ar: "المهام",
  },
  calendar: {
    en: "Calendar",
    ar: "التقويم",
  },
  messaging: {
    en: "Messages",
    ar: "الرسائل",
  },
  profile: {
    en: "Profile",
    ar: "الملف الشخصي",
  },
  settings: {
    en: "Settings",
    ar: "الإعدادات",
  },
  contacts: {
    en: "Contacts",
    ar: "جهات الاتصال",
  },
  billing: {
    en: "Billing",
    ar: "الفواتير",
  },
  logout: {
    en: "Logout",
    ar: "تسجيل خروج",
  },
  waktiAssistant: {
    en: "WAKTI Assistant",
    ar: "مساعد وقتي",
  },
  voiceSummary: {
    en: "Voice Summary",
    ar: "ملخص صوتي",
  },
  
  // Theme & Language
  lightMode: {
    en: "Light Mode",
    ar: "الوضع الفاتح",
  },
  darkMode: {
    en: "Dark Mode",
    ar: "الوضع المظلم",
  },
  language: {
    en: "العربية",
    ar: "English",
  },
  
  // Widget Labels
  tasks: {
    en: "Tasks",
    ar: "المهام",
  },
  events: {
    en: "Events",
    ar: "الأحداث",
  },
  reminders: {
    en: "Reminders",
    ar: "التذكيرات",
  },
  
  // Marketing
  startFreeTrial: {
    en: "Start Free Trial",
    ar: "بدء الفترة التجريبية المجانية",
  },
  login: {
    en: "Login",
    ar: "تسجيل الدخول",
  },
  createAccount: {
    en: "Create Account",
    ar: "إنشاء حساب",
  },
  forgotPassword: {
    en: "Forgot Password?",
    ar: "نسيت كلمة المرور؟",
  },
  
  // Auth
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
  
  // Settings Categories
  notificationPreferences: {
    en: "Notification Preferences",
    ar: "تفضيلات الإشعارات",
  },
  widgetVisibility: {
    en: "Widget Visibility",
    ar: "ظهور الويدجت",
  },
  privacyControls: {
    en: "Privacy Controls",
    ar: "ضوابط الخصوصية",
  },
  deleteAccount: {
    en: "Delete Account",
    ar: "حذف الحساب",
  },
  freeTrialDays: {
    en: "Free Trial",
    ar: "الفترة التجريبية المجانية",
  },
  
  // New added translations
  appName: {
    en: "WAKTI",
    ar: "وقتي",
  },
  tagline: {
    en: "Your Personal Productivity Assistant",
    ar: "مساعدك الشخصي للإنتاجية",
  },
  features: {
    en: "Features",
    ar: "الميزات",
  },
  taskDesc: {
    en: "Create, manage, and organize your tasks with ease",
    ar: "إنشاء وإدارة وتنظيم المهام الخاصة بك بسهولة",
  },
  calendarDesc: {
    en: "Keep track of your events and appointments",
    ar: "تتبع الأحداث والمواعيد الخاصة بك",
  },
  remindersDesc: {
    en: "Never forget important dates and deadlines",
    ar: "لا تنسى أبدًا التواريخ المهمة والمواعيد النهائية",
  },
  messagingDesc: {
    en: "Connect and collaborate with your contacts",
    ar: "تواصل وتعاون مع جهات الاتصال الخاصة بك",
  },
  pricing: {
    en: "Pricing",
    ar: "الأسعار",
  },
  monthly: {
    en: "Monthly",
    ar: "شهري",
  },
  yearly: {
    en: "Yearly",
    ar: "سنوي",
  },
  aiSummaries: {
    en: "AI Summaries",
    ar: "ملخصات الذكاء الاصطناعي",
  },
  qar: {
    en: "QAR",
    ar: "ر.ق",
  },
  usd: {
    en: "USD",
    ar: "دولار",
  },
  loading: {
    en: "Loading...",
    ar: "جار التحميل...",
  },
  signup: {
    en: "Sign Up",
    ar: "تسجيل",
  },
  alreadyHaveAccount: {
    en: "Already have an account?",
    ar: "هل لديك حساب بالفعل؟",
  }
};

export const t = (key: TranslationKey, language: "en" | "ar"): string => {
  return translations[key][language] || key;
};
