
// English and Arabic translations for the WAKTI app

type TranslationKey = 
  // General
  | "appName"
  | "loading"
  // Auth
  | "login"
  | "signup"
  | "email"
  | "password"
  | "forgotPassword"
  | "createAccount"
  | "name"
  | "username"
  | "submit"
  | "alreadyHaveAccount"
  // Marketing Home
  | "tagline"
  | "startFreeTrial"
  | "features"
  | "pricing"
  // Feature titles
  | "taskManagement"
  | "calendar"
  | "reminders"
  | "messaging"
  | "voiceAssistant"
  | "aiSummaries"
  | "contacts"
  | "dashboard"
  | "settings"
  // Feature descriptions
  | "taskDesc"
  | "calendarDesc"
  | "remindersDesc"
  | "messagingDesc"
  | "voiceDesc"
  | "aiSummariesDesc"
  | "contactsDesc"
  // Pricing
  | "pricingTitle"
  | "freeTrialDays"
  | "monthly"
  | "yearly"
  | "qar"
  | "usd"
  // User menu
  | "logout"
  | "profile"
  | "darkMode"
  | "lightMode"
  | "language";

type Translations = {
  [key in TranslationKey]: {
    en: string;
    ar: string;
  };
};

export const translations: Translations = {
  // General
  appName: {
    en: "WAKTI",
    ar: "وقتي",
  },
  loading: {
    en: "Loading...",
    ar: "جاري التحميل...",
  },
  // Auth
  login: {
    en: "Login",
    ar: "تسجيل الدخول",
  },
  signup: {
    en: "Sign Up",
    ar: "إنشاء حساب",
  },
  email: {
    en: "Email",
    ar: "البريد الإلكتروني",
  },
  password: {
    en: "Password",
    ar: "كلمة المرور",
  },
  forgotPassword: {
    en: "Forgot Password?",
    ar: "نسيت كلمة المرور؟",
  },
  createAccount: {
    en: "Create Account",
    ar: "إنشاء حساب",
  },
  name: {
    en: "Name",
    ar: "الاسم",
  },
  username: {
    en: "Username",
    ar: "اسم المستخدم",
  },
  submit: {
    en: "Submit",
    ar: "إرسال",
  },
  alreadyHaveAccount: {
    en: "Already have an account?",
    ar: "لديك حساب بالفعل؟",
  },
  // Marketing Home
  tagline: {
    en: "Your bilingual productivity assistant",
    ar: "مساعدك الشخصي ثنائي اللغة للإنتاجية",
  },
  startFreeTrial: {
    en: "Start Free Trial",
    ar: "ابدأ النسخة التجريبية المجانية",
  },
  features: {
    en: "Features",
    ar: "المميزات",
  },
  pricing: {
    en: "Pricing",
    ar: "الأسعار",
  },
  // Feature titles
  taskManagement: {
    en: "Task Management",
    ar: "إدارة المهام",
  },
  calendar: {
    en: "Calendar",
    ar: "التقويم",
  },
  reminders: {
    en: "Reminders",
    ar: "التذكيرات",
  },
  messaging: {
    en: "Messaging",
    ar: "الرسائل",
  },
  voiceAssistant: {
    en: "Voice Assistant",
    ar: "المساعد الصوتي",
  },
  aiSummaries: {
    en: "AI Summaries",
    ar: "ملخصات الذكاء الاصطناعي",
  },
  contacts: {
    en: "Contacts",
    ar: "جهات الاتصال",
  },
  dashboard: {
    en: "Dashboard",
    ar: "لوحة التحكم",
  },
  settings: {
    en: "Settings",
    ar: "الإعدادات",
  },
  // Feature descriptions
  taskDesc: {
    en: "Create, edit, and manage tasks with priorities and subtasks",
    ar: "إنشاء وتعديل وإدارة المهام مع الأولويات والمهام الفرعية",
  },
  calendarDesc: {
    en: "Unified view of all your events, tasks, and reminders",
    ar: "عرض موحد لجميع الأحداث والمهام والتذكيرات",
  },
  remindersDesc: {
    en: "Set one-time or recurring reminders with push notifications",
    ar: "تعيين تذكيرات لمرة واحدة أو متكررة مع إشعارات",
  },
  messagingDesc: {
    en: "Send text, images, and voice notes to your contacts",
    ar: "أرسل النص والصور والملاحظات الصوتية إلى جهات الاتصال",
  },
  voiceDesc: {
    en: "Transcribe and summarize voice recordings",
    ar: "نسخ وتلخيص التسجيلات الصوتية",
  },
  aiSummariesDesc: {
    en: "Get AI-powered summaries of your meetings and notes",
    ar: "احصل على ملخصات مدعومة بالذكاء الاصطناعي لاجتماعاتك وملاحظاتك",
  },
  contactsDesc: {
    en: "Manage your contacts with privacy settings",
    ar: "إدارة جهات الاتصال الخاصة بك مع إعدادات الخصوصية",
  },
  // Pricing
  pricingTitle: {
    en: "Choose your plan",
    ar: "اختر خطتك",
  },
  freeTrialDays: {
    en: "3-Day Free Trial",
    ar: "تجربة مجانية لمدة 3 أيام",
  },
  monthly: {
    en: "Monthly",
    ar: "شهري",
  },
  yearly: {
    en: "Yearly",
    ar: "سنوي",
  },
  qar: {
    en: "QAR",
    ar: "ر.ق",
  },
  usd: {
    en: "USD",
    ar: "دولار",
  },
  // User menu
  logout: {
    en: "Logout",
    ar: "تسجيل الخروج",
  },
  profile: {
    en: "Profile",
    ar: "الملف الشخصي",
  },
  darkMode: {
    en: "Dark Mode",
    ar: "الوضع المظلم",
  },
  lightMode: {
    en: "Light Mode",
    ar: "الوضع المضيء",
  },
  language: {
    en: "العربية",
    ar: "English",
  },
};

export function t(key: TranslationKey, lang: "en" | "ar"): string {
  return translations[key][lang];
}
