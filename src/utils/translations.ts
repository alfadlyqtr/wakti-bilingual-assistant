
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
  // User menu translations
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
  // Right panel translations
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
  },
  // Additional Calendar Translations
  create: {
    en: "Create",
    ar: "إنشاء",
  },
  // Contact List Translations
  messageStarted: {
    en: "Message started",
    ar: "تم بدء الرسالة",
  },
  chattingWithUser: {
    en: "Chatting with",
    ar: "محادثة مع",
  },
  removedFromFavorites: {
    en: "Removed from favorites",
    ar: "تمت إزالته من المفضلة",
  },
  addedToFavorites: {
    en: "Added to favorites",
    ar: "تمت إضافته إلى المفضلة",
  },
  contactBlocked: {
    en: "Contact blocked",
    ar: "تم حظر جهة الاتصال",
  },
  userBlockedDescription: {
    en: "This user has been blocked and will not be able to contact you",
    ar: "تم حظر هذا المستخدم ولن يتمكن من الاتصال بك",
  },
  // Contact Requests Translations
  requestAccepted: {
    en: "Request accepted",
    ar: "تم قبول الطلب",
  },
  contactAddedDescription: {
    en: "Contact has been added to your contacts list",
    ar: "تمت إضافة جهة الاتصال إلى قائمة جهات الاتصال الخاصة بك",
  },
  requestRejected: {
    en: "Request rejected",
    ar: "تم رفض الطلب",
  },
  contactRejectedDescription: {
    en: "Contact request has been rejected",
    ar: "تم رفض طلب جهة الاتصال",
  },
  blockedUserDescription: {
    en: "This user has been blocked",
    ar: "تم حظر هذا المستخدم",
  },
  noContactRequests: {
    en: "No contact requests",
    ar: "لا توجد طلبات جهات اتصال",
  },
  // Contact Search Translations
  searchContacts: {
    en: "Search contacts",
    ar: "البحث عن جهات الاتصال",
  },
  sendMessage: {
    en: "Send Message",
    ar: "إرسال رسالة",
  },
  // Messaging Translations
  unblockContact: {
    en: "Unblock Contact",
    ar: "إلغاء حظر جهة الاتصال",
  },
  noConversations: {
    en: "No conversations yet",
    ar: "لا توجد محادثات بعد",
  },
  transcript: {
    en: "Transcript",
    ar: "نص",
  },
  imageTooLarge: {
    en: "Image too large",
    ar: "الصورة كبيرة جدًا",
  },
  typeMessage: {
    en: "Type a message...",
    ar: "اكتب رسالة...",
  },
  stopRecording: {
    en: "Stop recording",
    ar: "إيقاف التسجيل",
  },
  newMessage: {
    en: "New Message",
    ar: "رسالة جديدة",
  },
  noContactsFound: {
    en: "No contacts found",
    ar: "لم يتم العثور على جهات اتصال",
  },
  // Task and Reminder Form Translations
  reminderTitle: {
    en: "Reminder Title",
    ar: "عنوان التذكير",
  },
  dueDate: {
    en: "Due Date",
    ar: "تاريخ الاستحقاق",
  },
  dueTime: {
    en: "Due Time",
    ar: "وقت الاستحقاق",
  },
  recurring: {
    en: "Recurring",
    ar: "متكرر",
  },
  recurrencePattern: {
    en: "Recurrence Pattern",
    ar: "نمط التكرار",
  },
  daily: {
    en: "Daily",
    ar: "يوميًا",
  },
  weekly: {
    en: "Weekly",
    ar: "أسبوعيًا",
  },
  monthly: {
    en: "Monthly",
    ar: "شهريًا",
  },
  yearly: {
    en: "Yearly",
    ar: "سنويًا",
  },
  // Share Task Dialog Translations
  shareWith: {
    en: "Share with",
    ar: "مشاركة مع",
  },
  selectContact: {
    en: "Select a contact",
    ar: "اختر جهة اتصال",
  },
  share: {
    en: "Share",
    ar: "مشاركة",
  },
  // Task Form Translations
  taskTitle: {
    en: "Task Title",
    ar: "عنوان المهمة",
  },
  priority: {
    en: "Priority",
    ar: "الأولوية",
  },
  urgent: {
    en: "Urgent",
    ar: "عاجل",
  },
  highPriority: {
    en: "High Priority",
    ar: "أولوية عالية",
  },
  mediumPriority: {
    en: "Medium Priority",
    ar: "أولوية متوسطة",
  },
  lowPriority: {
    en: "Low Priority",
    ar: "أولوية منخفضة",
  },
  subtaskGroupTitle: {
    en: "Subtask Group Title",
    ar: "عنوان مجموعة المهام الفرعية",
  },
  subtasks: {
    en: "Subtasks",
    ar: "المهام الفرعية",
  },
  addSubtask: {
    en: "Add Subtask",
    ar: "إضافة مهمة فرعية",
  },
  dailyRecurrence: {
    en: "Daily",
    ar: "يوميًا",
  },
  weeklyRecurrence: {
    en: "Weekly",
    ar: "أسبوعيًا",
  },
  monthlyRecurrence: {
    en: "Monthly",
    ar: "شهريًا",
  },
  yearlyRecurrence: {
    en: "Yearly",
    ar: "سنويًا",
  },
  // Contact Page Tabs
  contactRequestSettings: {
    en: "Requests",
    ar: "الطلبات",
  },
  manageBlockedUsers: {
    en: "Blocked",
    ar: "المحظورون",
  }
};

export const t = (key: TranslationKey, language: "en" | "ar"): string => {
  return translations[key]?.[language] || key;
};
