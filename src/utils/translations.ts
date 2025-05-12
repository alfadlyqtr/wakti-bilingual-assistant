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
  account: {
    en: "Account",
    ar: "الحساب",
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
  },
  
  // Account page translations
  personalInformation: {
    en: "Personal Information",
    ar: "المعلومات الشخصية",
  },
  accountControls: {
    en: "Account Controls",
    ar: "ضوابط الحساب",
  },
  appearance: {
    en: "Appearance",
    ar: "المظهر",
  },
  theme: {
    en: "Theme",
    ar: "السمة",
  },
  pushNotifications: {
    en: "Push Notifications",
    ar: "الإشعارات المنبثقة",
  },
  taskDue: {
    en: "Task Due",
    ar: "موعد المهمة",
  },
  reminder: {
    en: "Reminder",
    ar: "تذكير",
  },
  newMessage: {
    en: "New Message",
    ar: "رسالة جديدة",
  },
  trialReminder: {
    en: "Trial Reminder",
    ar: "تذكير الفترة التجريبية",
  },
  emailNotifications: {
    en: "Email Notifications",
    ar: "إشعارات البريد الإلكتروني",
  },
  tasksWidget: {
    en: "Tasks Widget",
    ar: "ويدجت المهام",
  },
  calendarWidget: {
    en: "Calendar Widget",
    ar: "ويدجت التقويم",
  },
  remindersWidget: {
    en: "Reminders Widget",
    ar: "ويدجت التذكيرات",
  },
  dailyQuoteWidget: {
    en: "Daily Quote Widget",
    ar: "ويدجت الاقتباس اليومي",
  },
  quoteCategory: {
    en: "Quote Category",
    ar: "فئة الاقتباس",
  },
  inspirational: {
    en: "Inspirational",
    ar: "ملهم",
  },
  motivational: {
    en: "Motivational",
    ar: "تحفيزي",
  },
  islamic: {
    en: "Islamic",
    ar: "إسلامي",
  },
  sports: {
    en: "Sports",
    ar: "رياضة",
  },
  generalInfo: {
    en: "General Info",
    ar: "معلومات عامة",
  },
  mixed: {
    en: "Mixed",
    ar: "مختلط",
  },
  profileVisibility: {
    en: "Profile Visibility",
    ar: "ظهور الملف الشخصي",
  },
  searchable: {
    en: "Searchable",
    ar: "قابل للبحث",
  },
  hidden: {
    en: "Hidden",
    ar: "مخفي",
  },
  activityStatus: {
    en: "Activity Status",
    ar: "حالة النشاط",
  },
  manageBlockedUsers: {
    en: "Manage Blocked Users",
    ar: "إدارة المستخدمين المحظورين",
  },
  reportAbuse: {
    en: "Report Abuse",
    ar: "الإبلاغ عن إساءة",
  },
  submitFeedback: {
    en: "Submit Feedback",
    ar: "إرسال التعليقات",
  },
  subscriptionBilling: {
    en: "Subscription & Billing",
    ar: "الاشتراك والفواتير",
  },
  currentPlan: {
    en: "Current Plan",
    ar: "الخطة الحالية",
  },
  trialEndsIn: {
    en: "Trial ends in",
    ar: "تنتهي الفترة التجريبية في",
  },
  days: {
    en: "days",
    ar: "أيام",
  },
  billingManagedThrough: {
    en: "Billing managed through Apple/Google IAP",
    ar: "تتم إدارة الفواتير من خلال Apple/Google IAP",
  },
  manageBilling: {
    en: "Manage Billing",
    ar: "إدارة الفواتير",
  },
  cancelPlan: {
    en: "Cancel Plan",
    ar: "إلغاء الخطة",
  },
  changePassword: {
    en: "Change Password",
    ar: "تغيير كلمة المرور",
  },
  currentPassword: {
    en: "Current Password",
    ar: "كلمة المرور الحالية",
  },
  newPassword: {
    en: "New Password",
    ar: "كلمة المرور الجديدة",
  },
  confirmPassword: {
    en: "Confirm Password",
    ar: "تأكيد كلمة المرور",
  },
  cancel: {
    en: "Cancel",
    ar: "إلغاء",
  },
  deleteAccountWarning: {
    en: "This will permanently delete your account and all associated data. This action cannot be undone.",
    ar: "سيؤدي هذا إلى حذف حسابك وجميع البيانات المرتبطة به بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
  },
  thisActionIrreversible: {
    en: "This action is irreversible!",
    ar: "هذا الإجراء لا رجعة فيه!",
  },
  feedbackDescription: {
    en: "We value your input. Please share your thoughts and suggestions.",
    ar: "نحن نقدر مدخلاتك. يرجى مشاركة أفكارك واقتراحاتك.",
  },
  feedback: {
    en: "Feedback",
    ar: "التعليقات",
  },
  feedbackPlaceholder: {
    en: "Tell us what you think...",
    ar: "أخبرنا برأيك...",
  },
  submit: {
    en: "Submit",
    ar: "إرسال",
  },
  requestChange: {
    en: "Request Change",
    ar: "طلب تغيير",
  },
  trialPlan: {
    en: "Free Trial",
    ar: "الفترة التجريبية المجانية",
  },
  monthlyPlan: {
    en: "Monthly Plan",
    ar: "الخطة الشهرية",
  },
  yearlyPlan: {
    en: "Yearly Plan",
    ar: "الخطة السنوية",
  },
  freePlan: {
    en: "Free Plan",
    ar: "الخطة المجانية",
  },
  daysLeft: {
    en: "days left",
    ar: "أيام متبقية",
  },
  
  // New notification keys
  systemNotifications: {
    en: "System Notifications",
    ar: "إشعارات النظام",
  },
  newEvent: {
    en: "New Event",
    ar: "حدث جديد",
  },
  
  // Contact request keys
  contactRequestSettings: {
    en: "Contact Request Settings",
    ar: "إعدادات طلبات الاتصال",
  },
  autoApproveRequests: {
    en: "Auto-approve contact requests",
    ar: "الموافقة التلقائية على طلبات الاتصال",
  },
  
  // Messaging system keys
  searchContacts: {
    en: "Search",
    ar: "بحث",
  },
  noContactsFound: {
    en: "No contacts found",
    ar: "لم يتم العثور على جهات اتصال",
  },
  selectConversation: {
    en: "Select a conversation",
    ar: "اختر محادثة",
  },
  typeMessage: {
    en: "Text Message • SMS",
    ar: "رسالة نصية • رسالة قصيرة",
  },
  recordVoice: {
    en: "Record Voice",
    ar: "تسجيل صوتي",
  },
  stopRecording: {
    en: "Stop Recording",
    ar: "إيقاف التسجيل",
  },
  uploadImage: {
    en: "Upload Image",
    ar: "تحميل صورة",
  },
  sendMessage: {
    en: "Send Message",
    ar: "إرسال رسالة",
  },
  imageTooLarge: {
    en: "Image is too large (max 5MB)",
    ar: "الصورة كبيرة جدًا (الحد الأقصى 5 ميجابايت)",
  },
  transcript: {
    en: "Transcript",
    ar: "نص",
  },
  expiresIn: {
    en: "Expires in",
    ar: "تنتهي في",
  },
  onlineNow: {
    en: "Online now",
    ar: "متصل الآن",
  },
  contactBlocked: {
    en: "You have blocked this contact",
    ar: "لقد قمت بحظر جهة الاتصال هذه",
  },
  unblockContact: {
    en: "Unblock Contact",
    ar: "إلغاء حظر جهة الاتصال",
  },
  noConversations: {
    en: "No conversations yet",
    ar: "لا توجد محادثات حتى الآن",
  },
  filters: {
    en: "Filters",
    ar: "تصفية",
  },
  today: {
    en: "Today",
    ar: "اليوم",
  }
};

export const t = (key: TranslationKey, language: "en" | "ar"): string => {
  return translations[key][language] || key;
};
