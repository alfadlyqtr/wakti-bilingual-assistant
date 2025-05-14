
import { TranslationKey } from "./translationTypes";

type Language = "en" | "ar";

type TranslationMap = {
  [K in TranslationKey]: {
    en: string;
    ar: string;
  };
};

const translations: TranslationMap = {
  dashboard: {
    en: "Dashboard",
    ar: "لوحة التحكم"
  },
  tasks: {
    en: "Tasks",
    ar: "المهام"
  },
  reminders: {
    en: "Reminders",
    ar: "التذكيرات"
  },
  taskAndReminders: {
    en: "Tasks & Reminders",
    ar: "المهام والتذكيرات"
  },
  events: {
    en: "Events",
    ar: "الفعاليات"
  },
  calendar: {
    en: "Calendar",
    ar: "التقويم"
  },
  voiceSummary: {
    en: "Voice Summary",
    ar: "ملخص صوتي"
  },
  voiceSummaryDetail: {
    en: "Voice Summary Detail",
    ar: "تفاصيل الملخص الصوتي"
  },
  assistant: {
    en: "Assistant",
    ar: "المساعد"
  },
  messages: {
    en: "Messages",
    ar: "الرسائل"
  },
  contacts: {
    en: "Contacts",
    ar: "جهات الاتصال"
  },
  settings: {
    en: "Settings",
    ar: "الإعدادات"
  },
  today: {
    en: "Today",
    ar: "اليوم"
  },
  tomorrow: {
    en: "Tomorrow",
    ar: "غدا"
  },
  yesterday: {
    en: "Yesterday",
    ar: "أمس"
  },
  upcoming: {
    en: "Upcoming",
    ar: "قادم"
  },
  completed: {
    en: "Completed",
    ar: "مكتمل"
  },
  addNew: {
    en: "Add New",
    ar: "إضافة جديد"
  },
  addTask: {
    en: "Add Task",
    ar: "إضافة مهمة"
  },
  addReminder: {
    en: "Add Reminder",
    ar: "إضافة تذكير"
  },
  name: {
    en: "Name",
    ar: "الاسم"
  },
  date: {
    en: "Date",
    ar: "التاريخ"
  },
  time: {
    en: "Time",
    ar: "الوقت"
  },
  description: {
    en: "Description",
    ar: "الوصف"
  },
  priority: {
    en: "Priority",
    ar: "الأولوية"
  },
  high: {
    en: "High",
    ar: "عالي"
  },
  medium: {
    en: "Medium",
    ar: "متوسط"
  },
  low: {
    en: "Low",
    ar: "منخفض"
  },
  status: {
    en: "Status",
    ar: "الحالة"
  },
  pending: {
    en: "Pending",
    ar: "قيد الانتظار"
  },
  inProgress: {
    en: "In Progress",
    ar: "قيد التنفيذ"
  },
  save: {
    en: "Save",
    ar: "حفظ"
  },
  cancel: {
    en: "Cancel",
    ar: "إلغاء"
  },
  delete: {
    en: "Delete",
    ar: "حذف"
  },
  edit: {
    en: "Edit",
    ar: "تعديل"
  },
  view: {
    en: "View",
    ar: "عرض"
  },
  back: {
    en: "Back",
    ar: "رجوع"
  },
  next: {
    en: "Next",
    ar: "التالي"
  },
  previous: {
    en: "Previous",
    ar: "السابق"
  },
  submit: {
    en: "Submit",
    ar: "إرسال"
  },
  search: {
    en: "Search",
    ar: "بحث"
  },
  filter: {
    en: "Filter",
    ar: "تصفية"
  },
  sort: {
    en: "Sort",
    ar: "ترتيب"
  },
  ascending: {
    en: "Ascending",
    ar: "تصاعدي"
  },
  descending: {
    en: "Descending",
    ar: "تنازلي"
  },
  light: {
    en: "Light",
    ar: "فاتح"
  },
  dark: {
    en: "Dark",
    ar: "داكن"
  },
  system: {
    en: "System",
    ar: "النظام"
  },
  english: {
    en: "English",
    ar: "الإنجليزية"
  },
  arabic: {
    en: "Arabic",
    ar: "العربية"
  },
  theme: {
    en: "Theme",
    ar: "المظهر"
  },
  language: {
    en: "Language",
    ar: "اللغة"
  },
  logout: {
    en: "Logout",
    ar: "تسجيل الخروج"
  },
  login: {
    en: "Login",
    ar: "تسجيل الدخول"
  },
  signup: {
    en: "Sign Up",
    ar: "إنشاء حساب"
  },
  email: {
    en: "Email",
    ar: "البريد الإلكتروني"
  },
  password: {
    en: "Password",
    ar: "كلمة المرور"
  },
  confirmPassword: {
    en: "Confirm Password",
    ar: "تأكيد كلمة المرور"
  },
  forgotPassword: {
    en: "Forgot Password",
    ar: "نسيت كلمة المرور"
  },
  resetPassword: {
    en: "Reset Password",
    ar: "إعادة تعيين كلمة المرور"
  },
  user: {
    en: "User",
    ar: "مستخدم"
  },
  summary: {
    en: "Summary",
    ar: "ملخص"
  },
  transcript: {
    en: "Transcript",
    ar: "نص منسوخ"
  },
  recording: {
    en: "Recording",
    ar: "تسجيل"
  },
  play: {
    en: "Play",
    ar: "تشغيل"
  },
  pause: {
    en: "Pause",
    ar: "إيقاف مؤقت"
  },
  download: {
    en: "Download",
    ar: "تنزيل"
  },
  upload: {
    en: "Upload",
    ar: "رفع"
  },
  share: {
    en: "Share",
    ar: "مشاركة"
  },
  create: {
    en: "Create",
    ar: "إنشاء"
  },
  update: {
    en: "Update",
    ar: "تحديث"
  },
  messaging: {
    en: "Messaging",
    ar: "المراسلة"
  },
  searchContacts: {
    en: "Search Contacts",
    ar: "البحث في جهات الاتصال"
  },
  selectConversation: {
    en: "Select a conversation",
    ar: "اختر محادثة"
  },
  createFirstEvent: {
    en: "Create your first event",
    ar: "قم بإنشاء أول فعالية لك"
  },
  decline: {
    en: "Decline",
    ar: "رفض"
  },
  accept: {
    en: "Accept",
    ar: "قبول"
  },
  noLocation: {
    en: "No Location",
    ar: "لا يوجد موقع"
  },
  attendee: {
    en: "Attendee",
    ar: "حاضر"
  },
  attendees: {
    en: "Attendees",
    ar: "الحاضرين"
  },
  readyToCreateTask: {
    en: "Ready to create your first task?",
    ar: "هل أنت مستعد لإنشاء مهمتك الأولى؟"
  },
  noTasksYet: {
    en: "No tasks yet",
    ar: "لا توجد مهام بعد"
  },
  nothingScheduled: {
    en: "Nothing scheduled",
    ar: "لا يوجد شيء مجدول"
  },
  noEventsYet: {
    en: "No events yet",
    ar: "لا توجد فعاليات بعد"
  },
  noRemindersYet: {
    en: "No reminders yet",
    ar: "لا توجد تذكيرات بعد"
  },
  writer: {
    en: "Writer",
    ar: "كاتب"
  },
  creative: {
    en: "Creative",
    ar: "إبداعي"
  },
  general: {
    en: "General",
    ar: "عام"
  },
  startVoiceInput: {
    en: "Start Voice Input",
    ar: "بدء الإدخال الصوتي"
  }
};

export const t = (key: TranslationKey, language: Language): string => {
  return translations[key]?.[language] || key;
};
