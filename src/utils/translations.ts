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
  },
  ai: {
    en: "AI",
    ar: "الذكاء الاصطناعي"
  },
  account: {
    en: "Account",
    ar: "الحساب"
  },
  switchLanguage: {
    en: "Switch Language",
    ar: "تغيير اللغة"
  },
  commonQuestions: {
    en: "Common Questions",
    ar: "أسئلة شائعة"
  },
  whatCanYouDo: {
    en: "What can you do?",
    ar: "ماذا يمكنك أن تفعل؟"
  },
  howToCreateTask: {
    en: "How do I create a task?",
    ar: "كيف أنشئ مهمة؟"
  },
  explainWAKTIFeatures: {
    en: "Explain WAKTI features",
    ar: "اشرح ميزات WAKTI"
  },
  tonePresets: {
    en: "Tone Presets",
    ar: "إعدادات النبرة"
  },
  professional: {
    en: "Professional",
    ar: "احترافي"
  },
  casual: {
    en: "Casual",
    ar: "غير رسمي"
  },
  friendly: {
    en: "Friendly",
    ar: "ودي"
  },
  academic: {
    en: "Academic",
    ar: "أكاديمي"
  },
  lengthOptions: {
    en: "Length Options",
    ar: "خيارات الطول"
  },
  short: {
    en: "Short",
    ar: "قصير"
  },
  long: {
    en: "Long",
    ar: "طويل"
  },
  grammarCheck: {
    en: "Grammar Check",
    ar: "فحص القواعد"
  },
  imageTools: {
    en: "Image Tools",
    ar: "أدوات الصور"
  },
  textToImage: {
    en: "Text to Image",
    ar: "نص إلى صورة"
  },
  imageToImage: {
    en: "Image to Image",
    ar: "صورة إلى صورة"
  },
  removeBg: {
    en: "Remove Background",
    ar: "إزالة الخلفية"
  },
  enhanceImage: {
    en: "Enhance Image",
    ar: "تحسين الصورة"
  },
  chartTypes: {
    en: "Chart Types",
    ar: "أنواع المخططات"
  },
  barChart: {
    en: "Bar Chart",
    ar: "مخطط شريطي"
  },
  lineChart: {
    en: "Line Chart",
    ar: "مخطط خطي"
  },
  pieChart: {
    en: "Pie Chart",
    ar: "مخطط دائري"
  },
  shortcuts: {
    en: "Shortcuts",
    ar: "اختصارات"
  },
  createTask: {
    en: "Create Task",
    ar: "إنشاء مهمة"
  },
  createReminder: {
    en: "Create Reminder",
    ar: "إنشاء تذكير"
  },
  createEvent: {
    en: "Create Event",
    ar: "إنشاء فعالية"
  },
  viewCalendar: {
    en: "View Calendar",
    ar: "عرض التقويم"
  },
  instructions: {
    en: "Instructions",
    ar: "تعليمات"
  },
  knowledge: {
    en: "Knowledge",
    ar: "معرفة"
  },
  month: {
    en: "Month",
    ar: "شهر"
  },
  week: {
    en: "Week",
    ar: "أسبوع"
  },
  year: {
    en: "Year",
    ar: "سنة"
  },
  monthView: {
    en: "Month View",
    ar: "عرض الشهر"
  },
  weekView: {
    en: "Week View",
    ar: "عرض الأسبوع"
  },
  yearView: {
    en: "Year View",
    ar: "عرض السنة"
  },
  noEvents: {
    en: "No events",
    ar: "لا توجد فعاليات"
  },
  notesLabel: {
    en: "Notes",
    ar: "ملاحظات"
  },
  titleRequired: {
    en: "Title is required",
    ar: "العنوان مطلوب"
  },
  dateRequired: {
    en: "Date is required",
    ar: "التاريخ مطلوب"
  },
  editNote: {
    en: "Edit Note",
    ar: "تعديل الملاحظة"
  },
  createNote: {
    en: "Create Note",
    ar: "إنشاء ملاحظة"
  },
  title: {
    en: "Title",
    ar: "العنوان"
  },
  titlePlaceholder: {
    en: "Enter title",
    ar: "أدخل العنوان"
  },
  descriptionPlaceholder: {
    en: "Enter description",
    ar: "أدخل الوصف"
  },
  requestAccepted: {
    en: "Request Accepted",
    ar: "تم قبول الطلب"
  },
  contactRejectedDescription: {
    en: "has been removed from your blocked list",
    ar: "تمت إزالته من قائمة المحظورين"
  },
  noContactRequests: {
    en: "No contact requests",
    ar: "لا توجد طلبات اتصال"
  },
  messageStarted: {
    en: "Message Started",
    ar: "بدأت المحادثة"
  },
  chattingWithUser: {
    en: "You are now chatting with",
    ar: "أنت الآن تتحدث مع"
  },
  removedFromFavorites: {
    en: "Removed from favorites",
    ar: "تمت إزالته من المفضلة"
  },
  addedToFavorites: {
    en: "Added to favorites",
    ar: "تمت إضافته إلى المفضلة"
  },
  contactBlocked: {
    en: "Contact Blocked",
    ar: "تم حظر جهة الاتصال"
  },
  userBlockedDescription: {
    en: "has been blocked and will not be able to contact you",
    ar: "تم حظره ولن يتمكن من الاتصال بك"
  },
  contactAddedDescription: {
    en: "has been added to your contacts",
    ar: "تمت إضافته إلى جهات الاتصال الخاصة بك"
  },
  requestRejected: {
    en: "Request Rejected",
    ar: "تم رفض الطلب"
  },
  blockedUserDescription: {
    en: "has been blocked",
    ar: "تم حظره"
  },
  sendMessage: {
    en: "Send Message",
    ar: "إرسال رسالة"
  },
  dailyQuote: {
    en: "Daily Quote",
    ar: "اقتباس يومي"
  },
  error: {
    en: "Error",
    ar: "خطأ"
  },
  pleaseCompleteAllRequiredFields: {
    en: "Please complete all required fields",
    ar: "يرجى إكمال جميع الحقول المطلوبة"
  },
  success: {
    en: "Success",
    ar: "نجاح"
  },
  eventCreatedSuccessfully: {
    en: "Event created successfully",
    ar: "تم إنشاء الفعالية بنجاح"
  },
  errorCreatingEvent: {
    en: "Error creating event",
    ar: "خطأ في إنشاء الفعالية"
  },
  eventTitle: {
    en: "Event Title",
    ar: "عنوان الفعالية"
  },
  enterEventTitle: {
    en: "Enter event title",
    ar: "أدخل عنوان الفعالية"
  },
  descriptionField: {
    en: "Description",
    ar: "الوصف"
  },
  enterEventDescription: {
    en: "Enter event description",
    ar: "أدخل وصف الفعالية"
  },
  enterLocation: {
    en: "Enter location",
    ar: "أدخل الموقع"
  },
  selectDate: {
    en: "Select Date",
    ar: "حدد التاريخ"
  },
  creating: {
    en: "Creating...",
    ar: "جاري الإنشاء..."
  },
  generalSettings: {
    en: "General Settings",
    ar: "الإعدادات العامة"
  },
  writerSettings: {
    en: "Writer Settings",
    ar: "إعدادات الكاتب"
  },
  creativeSettings: {
    en: "Creative Settings",
    ar: "الإعدادات الإبداعية"
  },
  assistantSettings: {
    en: "Assistant Settings",
    ar: "إعدادات المساعد"
  },
  contactRequestSettings: {
    en: "Contact Requests",
    ar: "طلبات الاتصال"
  },
  manageBlockedUsers: {
    en: "Blocked Users",
    ar: "المستخدمون المحظورون"
  },
  unblockContact: {
    en: "Unblock Contact",
    ar: "إلغاء حظر جهة الاتصال"
  },
  noConversations: {
    en: "No conversations yet",
    ar: "لا توجد محادثات بعد"
  },
  imageTooLarge: {
    en: "Image is too large",
    ar: "الصورة كبيرة جدًا"
  },
  typeMessage: {
    en: "Type a message",
    ar: "اكتب رسالة"
  },
  stopRecording: {
    en: "Stop Recording",
    ar: "إيقاف التسجيل"
  },
  newMessage: {
    en: "New Message",
    ar: "رسالة جديدة"
  },
  noContactsFound: {
    en: "No contacts found",
    ar: "لم يتم العثور على جهات اتصال"
  },
  reminderTitle: {
    en: "Reminder Title",
    ar: "عنوان التذكير"
  },
  dueDate: {
    en: "Due Date",
    ar: "تاريخ الاستحقاق"
  },
  dueTime: {
    en: "Due Time",
    ar: "وقت الاستحقاق"
  },
  recurring: {
    en: "Recurring",
    ar: "متكرر"
  },
  recurrencePattern: {
    en: "Recurrence Pattern",
    ar: "نمط التكرار"
  },
  daily: {
    en: "Daily",
    ar: "يومي"
  },
  weekly: {
    en: "Weekly",
    ar: "أسبوعي"
  },
  monthly: {
    en: "Monthly",
    ar: "شهري"
  },
  yearly: {
    en: "Yearly",
    ar: "سنوي"
  },
  shareWith: {
    en: "Share With",
    ar: "مشاركة مع"
  },
  selectContact: {
    en: "Select Contact",
    ar: "اختر جهة اتصال"
  },
  taskTitle: {
    en: "Task Title",
    ar: "عنوان المهمة"
  },
  urgent: {
    en: "Urgent",
    ar: "عاجل"
  },
  highPriority: {
    en: "High Priority",
    ar: "أولوية عالية"
  },
  mediumPriority: {
    en: "Medium Priority",
    ar: "أولوية متوسطة"
  },
  lowPriority: {
    en: "Low Priority",
    ar: "أولوية منخفضة"
  },
  subtaskGroupTitle: {
    en: "Subtasks",
    ar: "المهام الفرعية"
  },
  subtasks: {
    en: "Subtasks",
    ar: "المهام الفرعية"
  },
  addSubtask: {
    en: "Add Subtask",
    ar: "إضافة مهمة فرعية"
  }
};

export const t = (key: TranslationKey, language: Language): string => {
  return translations[key]?.[language] || key;
};
