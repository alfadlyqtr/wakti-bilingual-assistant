
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
  // New translations for UserMenu
  messaging: {
    en: "Messages",
    ar: "الرسائل",
  },
  account: {
    en: "Account",
    ar: "الحساب",
  },
  billing: {
    en: "Billing",
    ar: "الفواتير",
  },
  // New translations for RightPanel 
  switchLanguage: {
    en: "Switch Language",
    ar: "تغيير اللغة",
  },
  commonQuestions: {
    en: "Common Questions",
    ar: "الأسئلة الشائعة",
  },
  whatCanYouDo: {
    en: "What can you do?",
    ar: "ماذا يمكنك أن تفعل؟",
  },
  howToCreateTask: {
    en: "How do I create a task?",
    ar: "كيف أنشئ مهمة؟",
  },
  explainWAKTIFeatures: {
    en: "Explain WAKTI features",
    ar: "اشرح ميزات واكتي",
  },
  tonePresets: {
    en: "Tone Presets",
    ar: "إعدادات النبرة",
  },
  professional: {
    en: "Professional",
    ar: "مهني",
  },
  casual: {
    en: "Casual",
    ar: "غير رسمي",
  },
  friendly: {
    en: "Friendly",
    ar: "ودي",
  },
  academic: {
    en: "Academic",
    ar: "أكاديمي",
  },
  lengthOptions: {
    en: "Length Options",
    ar: "خيارات الطول",
  },
  short: {
    en: "Short",
    ar: "قصير",
  },
  medium: {
    en: "Medium",
    ar: "متوسط",
  },
  long: {
    en: "Long",
    ar: "طويل",
  },
  grammarCheck: {
    en: "Grammar Check",
    ar: "تدقيق نحوي",
  },
  imageTools: {
    en: "Image Tools",
    ar: "أدوات الصور",
  },
  textToImage: {
    en: "Text to Image",
    ar: "نص إلى صورة",
  },
  imageToImage: {
    en: "Image to Image",
    ar: "صورة إلى صورة",
  },
  removeBg: {
    en: "Remove Background",
    ar: "إزالة الخلفية",
  },
  enhanceImage: {
    en: "Enhance Image",
    ar: "تحسين الصورة",
  },
  chartTypes: {
    en: "Chart Types",
    ar: "أنواع الرسوم البيانية",
  },
  barChart: {
    en: "Bar Chart",
    ar: "مخطط شريطي",
  },
  lineChart: {
    en: "Line Chart",
    ar: "مخطط خطي",
  },
  pieChart: {
    en: "Pie Chart",
    ar: "مخطط دائري",
  },
  shortcuts: {
    en: "Shortcuts",
    ar: "اختصارات",
  },
  createTask: {
    en: "Create Task",
    ar: "إنشاء مهمة",
  },
  createReminder: {
    en: "Create Reminder",
    ar: "إنشاء تذكير",
  },
  createEvent: {
    en: "Create Event",
    ar: "إنشاء فعالية",
  },
  viewCalendar: {
    en: "View Calendar",
    ar: "عرض التقويم",
  },
  generalSettings: {
    en: "General Settings",
    ar: "الإعدادات العامة",
  },
  writerSettings: {
    en: "Writer Settings",
    ar: "إعدادات الكاتب",
  },
  creativeSettings: {
    en: "Creative Settings",
    ar: "إعدادات الإبداع",
  },
  assistantSettings: {
    en: "Assistant Settings",
    ar: "إعدادات المساعد",
  },
  // Calendar translations
  noEvents: {
    en: "No events for this day",
    ar: "لا توجد أحداث لهذا اليوم",
  },
  notesLabel: {
    en: "Notes",
    ar: "ملاحظات",
  },
  titleRequired: {
    en: "Title is required",
    ar: "العنوان مطلوب",
  },
  dateRequired: {
    en: "Date is required",
    ar: "التاريخ مطلوب",
  },
  editNote: {
    en: "Edit Note",
    ar: "تعديل الملاحظة",
  },
  createNote: {
    en: "Create Note",
    ar: "إنشاء ملاحظة",
  },
  title: {
    en: "Title",
    ar: "العنوان",
  },
  date: {
    en: "Date",
    ar: "التاريخ",
  },
  description: {
    en: "Description",
    ar: "الوصف",
  },
  titlePlaceholder: {
    en: "Enter title...",
    ar: "أدخل العنوان...",
  },
  descriptionPlaceholder: {
    en: "Enter description...",
    ar: "أدخل الوصف...",
  },
  delete: {
    en: "Delete",
    ar: "حذف",
  },
  cancel: {
    en: "Cancel",
    ar: "إلغاء",
  },
  save: {
    en: "Save",
    ar: "حفظ",
  },
  monthView: {
    en: "Month View",
    ar: "عرض الشهر",
  },
  month: {
    en: "Month",
    ar: "شهر",
  },
  weekView: {
    en: "Week View",
    ar: "عرض الأسبوع",
  },
  week: {
    en: "Week",
    ar: "أسبوع",
  },
  yearView: {
    en: "Year View",
    ar: "عرض السنة",
  },
  year: {
    en: "Year",
    ar: "سنة",
  },
  assistant: {
    en: "Assistant",
    ar: "المساعد",
  }
};

export const t = (key: TranslationKey, language: "en" | "ar"): string => {
  return translations[key]?.[language] || key;
};
