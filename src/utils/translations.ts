// Import the translation type
import { TranslationKey } from './translationTypes';
import { SupportedLanguage } from './translationTypes';

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

// Translation function
export function t(key: TranslationKey, language: string = DEFAULT_LANGUAGE): string {
  const lang = language as SupportedLanguage;
  if (!translations[key]) {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }
  return translations[key][lang] || translations[key][DEFAULT_LANGUAGE];
}

export const translations: Record<string, Record<SupportedLanguage, string>> = {
  // App-wide
  appName: {
    en: "Companion",
    ar: "رفيق"
  },
  loading: {
    en: "Loading...",
    ar: "جاري التحميل..."
  },
  error: {
    en: "Error",
    ar: "خطأ"
  },
  success: {
    en: "Success",
    ar: "نجاح"
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
  create: {
    en: "Create",
    ar: "إنشاء"
  },
  submit: {
    en: "Submit",
    ar: "إرسال"
  },
  search: {
    en: "Search",
    ar: "بحث"
  },
  
  // Navigation
  home: {
    en: "Home",
    ar: "الرئيسية"
  },
  chat: {
    en: "Chat",
    ar: "محادثة"
  },
  tasks: {
    en: "Tasks",
    ar: "المهام"
  },
  calendar: {
    en: "Calendar",
    ar: "التقويم"
  },
  settings: {
    en: "Settings",
    ar: "الإعدادات"
  },
  profile: {
    en: "Profile",
    ar: "الملف الشخصي"
  },
  messages: {
    en: "Messages",
    ar: "الرسائل"
  },
  
  // Settings
  appearance: {
    en: "Appearance",
    ar: "المظهر"
  },
  language: {
    en: "Language",
    ar: "اللغة"
  },
  theme: {
    en: "Theme",
    ar: "السمة"
  },
  notifications: {
    en: "Notifications",
    ar: "الإشعارات"
  },
  privacy: {
    en: "Privacy",
    ar: "الخصوصية"
  },
  account: {
    en: "Account",
    ar: "الحساب"
  },
  logout: {
    en: "Logout",
    ar: "تسجيل الخروج"
  },
  lightMode: {
    en: "Light Mode",
    ar: "الوضع الفاتح"
  },
  darkMode: {
    en: "Dark Mode",
    ar: "الوضع الداكن"
  },
  systemDefault: {
    en: "System Default",
    ar: "إعدادات النظام"
  },
  english: {
    en: "English",
    ar: "الإنجليزية"
  },
  arabic: {
    en: "Arabic",
    ar: "العربية"
  },
  appearanceSettings: {
    en: "Customize how the app looks",
    ar: "تخصيص مظهر التطبيق"
  },
  
  // Chat
  typeMessage: {
    en: "Type a message...",
    ar: "اكتب رسالة..."
  },
  sendMessage: {
    en: "Send",
    ar: "إرسال"
  },
  newChat: {
    en: "New Chat",
    ar: "محادثة جديدة"
  },
  clearChat: {
    en: "Clear Chat",
    ar: "مسح المحادثة"
  },
  thinking: {
    en: "Thinking...",
    ar: "يفكر..."
  },
  
  // Tasks
  newTask: {
    en: "New Task",
    ar: "مهمة جديدة"
  },
  taskTitle: {
    en: "Task Title",
    ar: "عنوان المهمة"
  },
  taskDescription: {
    en: "Description",
    ar: "الوصف"
  },
  dueDate: {
    en: "Due Date",
    ar: "تاريخ الاستحقاق"
  },
  priority: {
    en: "Priority",
    ar: "الأولوية"
  },
  status: {
    en: "Status",
    ar: "الحالة"
  },
  high: {
    en: "High",
    ar: "عالية"
  },
  medium: {
    en: "Medium",
    ar: "متوسطة"
  },
  low: {
    en: "Low",
    ar: "منخفضة"
  },
  completed: {
    en: "Completed",
    ar: "مكتملة"
  },
  inProgress: {
    en: "In Progress",
    ar: "قيد التنفيذ"
  },
  notStarted: {
    en: "Not Started",
    ar: "لم تبدأ"
  },
  
  // Calendar
  today: {
    en: "Today",
    ar: "اليوم"
  },
  month: {
    en: "Month",
    ar: "الشهر"
  },
  week: {
    en: "Week",
    ar: "الأسبوع"
  },
  day: {
    en: "Day",
    ar: "اليوم"
  },
  newEvent: {
    en: "New Event",
    ar: "حدث جديد"
  },
  eventTitle: {
    en: "Event Title",
    ar: "عنوان الحدث"
  },
  startTime: {
    en: "Start Time",
    ar: "وقت البدء"
  },
  endTime: {
    en: "End Time",
    ar: "وقت الانتهاء"
  },
  location: {
    en: "Location",
    ar: "الموقع"
  },
  
  // Contacts
  contactRequestSettings: {
    en: "Contact Requests",
    ar: "طلبات الاتصال"
  },
  manageBlockedUsers: {
    en: "Blocked Users",
    ar: "المستخدمون المحظورون"
  },
  searchContacts: {
    en: "Search for users by name, username, or email",
    ar: "البحث عن المستخدمين بالاسم أو اسم المستخدم أو البريد الإلكتروني"
  },
  searchResults: {
    en: "Search Results",
    ar: "نتائج البحث"
  },
  sendRequest: {
    en: "Send Request",
    ar: "إرسال طلب"
  },
  noUsersFound: {
    en: "No users found",
    ar: "لم يتم العثور على مستخدمين"
  },
  messageStarted: {
    en: "Message Started",
    ar: "بدأت المحادثة"
  },
  chattingWithUser: {
    en: "Chatting with",
    ar: "محادثة مع"
  },
  addedToFavorites: {
    en: "Added to Favorites",
    ar: "تمت الإضافة إلى المفضلة"
  },
  removedFromFavorites: {
    en: "Removed from Favorites",
    ar: "تمت الإزالة من المفضلة"
  },
  errorCreatingConversation: {
    en: "Failed to create conversation",
    ar: "فشل في إنشاء المحادثة"
  },
  unblock: {
    en: "Unblock",
    ar: "إلغاء الحظر"
  },
  
  // Contact sections
  contacts: {
    en: "Contacts",
    ar: "جهات الاتصال"
  },
  requests: {
    en: "Requests",
    ar: "الطلبات"
  },
  blocked: {
    en: "Blocked",
    ar: "المحظورين"
  },
  
  // Empty states
  noContacts: {
    en: "No contacts yet",
    ar: "لا توجد جهات اتصال بعد"
  },
  searchToAddContacts: {
    en: "Search for people to add as contacts",
    ar: "ابحث عن أشخاص لإضافتهم كجهات اتصال"
  },
  noContactRequests: {
    en: "No contact requests",
    ar: "لا توجد طلبات اتصال"
  },
  waitingForRequests: {
    en: "When someone sends you a request, it will appear here",
    ar: "عندما يرسل لك شخص ما طلباً، سيظهر هنا"
  },
  noBlockedUsers: {
    en: "No blocked users",
    ar: "لا يوجد مستخدمين محظورين"
  },
  noBlockedUsersDescription: {
    en: "You haven't blocked any users yet",
    ar: "لم تقم بحظر أي مستخدمين حتى الآن"
  },
  
  // Contact settings
  contactsSettings: {
    en: "Contact Settings",
    ar: "إعدادات جهات الاتصال"
  },
  contactsSettingsDescription: {
    en: "Manage how others connect with you",
    ar: "إدارة كيفية اتصال الآخرين بك"
  },
  autoApproveRequests: {
    en: "Auto-approve contact requests",
    ar: "الموافقة التلقائية على طلبات الاتصال"
  },
  autoApproveExplanation: {
    en: "When enabled, all contact requests will be automatically approved",
    ar: "عند التفعيل، ستتم الموافقة تلقائياً على جميع طلبات الاتصال"
  },
  contactSettingsUpdated: {
    en: "Contact settings updated successfully",
    ar: "تم تحديث إعدادات جهات الاتصال بنجاح"
  },
  
  // Success messages
  settingsUpdated: {
    en: "Settings Updated",
    ar: "تم تحديث الإعدادات"
  },
  requestSent: {
    en: "Request Sent",
    ar: "تم إرسال الطلب"
  },
  contactRequestSent: {
    en: "Contact request sent successfully",
    ar: "تم إرسال طلب الاتصال بنجاح"
  },
  requestAccepted: {
    en: "Request Accepted",
    ar: "تم قبول الطلب"
  },
  contactAddedDescription: {
    en: "Contact added to your contacts list",
    ar: "تمت إضافة جهة الاتصال إلى قائمة جهات الاتصال الخاصة بك"
  },
  requestRejected: {
    en: "Request Rejected",
    ar: "تم رفض الطلب"
  },
  contactRejectedDescription: {
    en: "Contact request has been rejected",
    ar: "تم رفض طلب الاتصال"
  },
  contactBlocked: {
    en: "Contact Blocked",
    ar: "تم حظر جهة الاتصال"
  },
  userBlockedDescription: {
    en: "User has been added to your blocked list",
    ar: "تمت إضافة المستخدم إلى قائمة المحظورين"
  },
  blockedUserDescription: {
    en: "User can no longer contact you",
    ar: "لم يعد بإمكان المستخدم الاتصال بك"
  },
  contactUnblocked: {
    en: "Contact Unblocked",
    ar: "تم إلغاء حظر جهة الاتصال"
  },
  userUnblockedDescription: {
    en: "User has been removed from your blocked list",
    ar: "تمت إزالة المستخدم من قائمة المحظورين"
  },
  
  // Error messages
  errorSendingRequest: {
    en: "Failed to send contact request",
    ar: "فشل في إرسال طلب الاتصال"
  },
  errorAcceptingRequest: {
    en: "Failed to accept contact request",
    ar: "فشل في قبول طلب الاتصال"
  },
  errorRejectingRequest: {
    en: "Failed to reject contact request",
    ar: "فشل في رفض طلب الاتصال"
  },
  errorBlockingUser: {
    en: "Failed to block user",
    ar: "فشل في حظر المستخدم"
  },
  errorBlockingContact: {
    en: "Failed to block contact",
    ar: "فشل في حظر جهة الاتصال"
  },
  errorUnblockingContact: {
    en: "Failed to unblock contact",
    ar: "فشل في إلغاء حظر جهة الاتصال"
  },
  errorLoadingContacts: {
    en: "Error loading contacts",
    ar: "خطأ في تحميل جهات الاتصال"
  },
  errorLoadingRequests: {
    en: "Error loading contact requests",
    ar: "خطأ في تحميل طلبات الاتصال"
  },
  errorLoadingBlockedUsers: {
    en: "Error loading blocked users",
    ar: "خطأ في تحميل المستخدمين المحظورين"
  },
  errorUpdatingSettings: {
    en: "Failed to update settings",
    ar: "فشل في تحديث الإعدادات"
  },
  
  // Messages
  noMessages: {
    en: "No messages yet",
    ar: "لا توجد رسائل بعد"
  },
  startConversation: {
    en: "Start a conversation",
    ar: "بدء محادثة"
  },
  newMessage: {
    en: "New Message",
    ar: "رسالة جديدة"
  },
  selectContact: {
    en: "Select a contact",
    ar: "اختر جهة اتصال"
  },
  
  // Voice notes
  recordVoiceNote: {
    en: "Record Voice Note",
    ar: "تسجيل ملاحظة صوتية"
  },
  stopRecording: {
    en: "Stop Recording",
    ar: "إيقاف التسجيل"
  },
  playVoiceNote: {
    en: "Play Voice Note",
    ar: "تشغيل الملاحظة الصوتية"
  },
  pauseVoiceNote: {
    en: "Pause Voice Note",
    ar: "إيقاف الملاحظة الصوتية مؤقتًا"
  },
  
  // Image generation
  generateImage: {
    en: "Generate Image",
    ar: "إنشاء صورة"
  },
  imagePrompt: {
    en: "Describe the image you want to generate",
    ar: "صف الصورة التي تريد إنشاءها"
  },
  generatingImage: {
    en: "Generating image...",
    ar: "جاري إنشاء الصورة..."
  },
  downloadImage: {
    en: "Download Image",
    ar: "تنزيل الصورة"
  },
  
  // Auth
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
  forgotPassword: {
    en: "Forgot Password?",
    ar: "نسيت كلمة المرور؟"
  },
  resetPassword: {
    en: "Reset Password",
    ar: "إعادة تعيين كلمة المرور"
  },
  
  // Misc
  welcomeBack: {
    en: "Welcome back!",
    ar: "مرحبًا بعودتك!"
  },
  getStarted: {
    en: "Get Started",
    ar: "البدء"
  },
  learnMore: {
    en: "Learn More",
    ar: "معرفة المزيد"
  },
  comingSoon: {
    en: "Coming Soon",
    ar: "قريبًا"
  },
  beta: {
    en: "Beta",
    ar: "تجريبي"
  },
  version: {
    en: "Version",
    ar: "الإصدار"
  }
};
