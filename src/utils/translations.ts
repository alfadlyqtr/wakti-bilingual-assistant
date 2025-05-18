
// Translation utility for WAKTI app
// Supports English (en) and Arabic (ar)

// Import the Language type from ThemeProvider
export type Language = "en" | "ar";

// Type for translation keys
export type TranslationKey = keyof typeof translations;

// Translation function
export const t = (key: TranslationKey, language: Language = "en"): string => {
  if (!translations[key]) {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }
  
  return translations[key][language] || translations[key]["en"] || key;
};

// Translations for the app
export const translations = {
  // Common translations
  calendar: {
    en: "Calendar",
    ar: "التقويم"
  },
  tasks: {
    en: "Tasks",
    ar: "المهام"
  },
  reminders: {
    en: "Reminders",
    ar: "التذكيرات"
  },
  events: {
    en: "Events",
    ar: "الأحداث"
  },
  settings: {
    en: "Settings",
    ar: "الإعدادات"
  },
  summary: {
    en: "Summary",
    ar: "الملخص"
  },
  ai: {
    en: "AI",
    ar: "الذكاء"
  },
  
  // Login page translations
  login: {
    en: "Login",
    ar: "تسجيل الدخول"
  },
  enter_credentials: {
    en: "Enter your credentials to access your account",
    ar: "أدخل بيانات الاعتماد الخاصة بك للوصول إلى حسابك"
  },
  email: {
    en: "Email",
    ar: "البريد الإلكتروني"
  },
  email_placeholder: {
    en: "Enter your email",
    ar: "أدخل بريدك الإلكتروني"
  },
  password: {
    en: "Password",
    ar: "كلمة المرور"
  },
  password_placeholder: {
    en: "Enter your password",
    ar: "أدخل كلمة المرور"
  },
  forgot_password: {
    en: "Forgot Password?",
    ar: "نسيت كلمة المرور؟"
  },
  logging_in: {
    en: "Logging in...",
    ar: "جاري تسجيل الدخول..."
  },
  dont_have_account: {
    en: "Don't have an account?",
    ar: "ليس لديك حساب؟"
  },
  signup: {
    en: "Sign up",
    ar: "إنشاء حساب"
  },
  login_successful: {
    en: "Login Successful",
    ar: "تم تسجيل الدخول بنجاح"
  },
  welcome_back: {
    en: "Welcome back!",
    ar: "مرحبًا بعودتك!"
  },
  login_failed: {
    en: "Login Failed",
    ar: "فشل تسجيل الدخول"
  },
  logout_successful: {
    en: "Logout Successful",
    ar: "تم تسجيل الخروج بنجاح"
  },
  unexpected_error: {
    en: "An unexpected error occurred. Please try again.",
    ar: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى."
  },
  
  // Dashboard translations
  good_morning: {
    en: "Good Morning",
    ar: "صباح الخير"
  },
  good_afternoon: {
    en: "Good Afternoon",
    ar: "مساء الخير"
  },
  good_evening: {
    en: "Good Evening",
    ar: "مساء الخير"
  },
  today: {
    en: "Today",
    ar: "اليوم"
  },
  upcoming: {
    en: "Upcoming",
    ar: "القادمة"
  },
  
  // Settings translations
  account_settings: {
    en: "Account Settings",
    ar: "إعدادات الحساب"
  },
  appearance: {
    en: "Appearance",
    ar: "المظهر"
  },
  language: {
    en: "Language",
    ar: "اللغة"
  },
  notifications: {
    en: "Notifications",
    ar: "الإشعارات"
  },
  privacy: {
    en: "Privacy",
    ar: "الخصوصية"
  },
  help: {
    en: "Help & Support",
    ar: "المساعدة والدعم"
  },
  logout: {
    en: "Logout",
    ar: "تسجيل الخروج"
  },
  
  // Account page translations
  current_password: {
    en: "Current Password",
    ar: "كلمة المرور الحالية"
  },
  new_password: {
    en: "New Password",
    ar: "كلمة المرور الجديدة"
  },
  confirm_password: {
    en: "Confirm Password",
    ar: "تأكيد كلمة المرور"
  },
  update_password: {
    en: "Update Password",
    ar: "تحديث كلمة المرور"
  },
  delete_account: {
    en: "Delete Account",
    ar: "حذف الحساب"
  },
  
  // Forgot password translations
  reset_password: {
    en: "Reset Password",
    ar: "إعادة تعيين كلمة المرور"
  },
  reset_instructions: {
    en: "Enter your email to receive password reset instructions",
    ar: "أدخل بريدك الإلكتروني لتلقي تعليمات إعادة تعيين كلمة المرور"
  },
  send_instructions: {
    en: "Send Instructions",
    ar: "إرسال التعليمات"
  },
  back_to_login: {
    en: "Back to Login",
    ar: "العودة إلى تسجيل الدخول"
  }
};
