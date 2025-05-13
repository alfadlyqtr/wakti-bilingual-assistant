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
  },
  contactBlocked: {
    en: "Contact blocked",
    ar: "تم حظر جهة الاتصال",
  },
  // Voice Summary keys
  newRecording: {
    en: "New Recording",
    ar: "تسجيل جديد",
  },
  recentRecordings: {
    en: "Recent Recordings",
    ar: "التسجيلات الحديثة",
  },
  meeting: {
    en: "Meeting",
    ar: "اجتماع",
  },
  lecture: {
    en: "Lecture",
    ar: "محاضرة",
  },
  brainstorm: {
    en: "Brainstorm",
    ar: "عصف ذهني",
  },
  other: {
    en: "Other",
    ar: "آخر",
  },
  hostName: {
    en: "Host name",
    ar: "اسم المضيف",
  },
  attendeesNames: {
    en: "Separate names with commas",
    ar: "افصل الأسماء بفواصل",
  },
  locationName: {
    en: "Where this took place",
    ar: "أين حدث هذا",
  },
  cleanAudio: {
    en: "Clean Audio",
    ar: "تنظيف الصوت",
  },
  noiseReduction: {
    en: "noise reduction",
    ar: "تقليل الضوضاء",
  },
  skip: {
    en: "Skip",
    ar: "تخطي",
  },
  next: {
    en: "Next",
    ar: "التالي",
  },
  untitledRecording: {
    en: "Untitled Recording",
    ar: "تسجيل بدون عنوان",
  },
  selectType: {
    en: "Select type",
    ar: "اختر النوع",
  },
  hostOptional: {
    en: "Host (Optional)",
    ar: "المضيف (اختياري)",
  },
  attendeesOptional: {
    en: "Attendees (Optional)",
    ar: "الحضور (اختياري)",
  },
  locationOptional: {
    en: "Location (Optional)",
    ar: "الموقع (اختياري)",
  },
  separateWithCommas: {
    en: "Separate names with commas",
    ar: "افصل الأسماء بفواصل",
  },
  whereTookPlace: {
    en: "Where this took place",
    ar: "أين حدث هذا",
  },
  minutes: {
    en: "minutes",
    ar: "دقائق",
  },
  ago: {
    en: "ago",
    ar: "مضت",
  },
  daysRemaining: {
    en: "days remaining",
    ar: "أيام متبقية",
  },
  viewDetails: {
    en: "View Details",
    ar: "عرض التفاصيل",
  },
  record: {
    en: "Record",
    ar: "تسجيل",
  },
  upload: {
    en: "Upload",
    ar: "رفع",
  },
  titleOptional: {
    en: "Title (Optional)",
    ar: "العنوان (اختياري)",
  },
  typeOptional: {
    en: "Type",
    ar: "النوع",
  },
  processingAudio: {
    en: "Processing Audio",
    ar: "معالجة الصوت",
  },
  transcribingAudio: {
    en: "Transcribing your recording using Whisper AI...",
    ar: "جاري نسخ التسجيل الخاص بك باستخدام Whisper AI...",
  },
  creatingSummary: {
    en: "Creating your summary...",
    ar: "جاري إنشاء الملخص الخاص بك...",
  },
  generateSummary: {
    en: "Generate Summary",
    ar: "إنشاء ملخص",
  },
  generateAudio: {
    en: "Generate Audio",
    ar: "إنشاء صوت",
  },
  downloadTranscript: {
    en: "Download Transcript",
    ar: "تحميل النص",
  },
  downloadSummary: {
    en: "Download Summary",
    ar: "تحميل الملخص",
  },
  downloadAudio: {
    en: "Download Audio",
    ar: "تحميل الصوت",
  },
  selectFile: {
    en: "Select File",
    ar: "اختر ملف",
  },
  mp3orWavFormat: {
    en: "MP3 or WAV format, max 2 hours",
    ar: "صيغة MP3 أو WAV، بحد أقصى ساعتين",
  },
  noRecordingsFound: {
    en: "No recordings found",
    ar: "لم يتم العثور على تسجيلات",
  },
  firstRecording: {
    en: "Create your first recording to see it here",
    ar: "أنشئ تسجيلك الأول لتراه هنا",
  },
  exportAsPDF: {
    en: "Export as PDF",
    ar: "تصدير كملف PDF",
  },
  exportAsAudio: {
    en: "Export as Audio",
    ar: "تصدير كملف صوتي",
  },
  summaryVoice: {
    en: "Summary Voice",
    ar: "صوت الملخص",
  },
  summaryLanguage: {
    en: "Summary Language",
    ar: "لغة الملخص",
  },
  male: {
    en: "Male",
    ar: "ذكر",
  },
  female: {
    en: "Female",
    ar: "أنثى",
  },
  arabic: {
    en: "Arabic",
    ar: "العربية",
  },
  english: {
    en: "English",
    ar: "الإنجليزية",
  },
  transcriptTitle: {
    en: "Transcript",
    ar: "النص",
  },
  summaryTitle: {
    en: "Summary",
    ar: "الملخص",
  },
  recordingDetails: {
    en: "Recording Details",
    ar: "تفاصيل التسجيل",
  },
  audioPlayerError: {
    en: "Error playing audio",
    ar: "خطأ في تشغيل الصوت",
  },
  
  // Contact list translations
  messageStarted: {
    en: "Message started",
    ar: "بدأت المحادثة",
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
  userBlockedDescription: {
    en: "You will no longer receive messages from this user",
    ar: "لن تتلقى رسائل من هذا المستخدم بعد الآن",
  },
  requestAccepted: {
    en: "Request accepted",
    ar: "تم قبول الطلب",
  },
  contactAddedDescription: {
    en: "Added to your contacts",
    ar: "تمت إضافته إلى جهات الاتصال الخاصة بك",
  },
  requestRejected: {
    en: "Request rejected",
    ar: "تم رفض الطلب",
  },
  contactRejectedDescription: {
    en: "Contact request rejected",
    ar: "تم رفض طلب جهة الاتصال",
  },
  blockedUserDescription: {
    en: "User has been blocked",
    ar: "تم حظر المستخدم",
  },
  noContactRequests: {
    en: "No contact requests",
    ar: "لا توجد طلبات جهات اتصال",
  },
  
  // Task + Reminder System
  taskAndReminders: {
    en: "Tasks & Reminders",
    ar: "المهام والتذكيرات",
  },
  createTask: {
    en: "Create Task",
    ar: "إنشاء مهمة",
  },
  createReminder: {
    en: "Create Reminder",
    ar: "إنشاء تذكير",
  },
  taskTitle: {
    en: "Task Title",
    ar: "عنوان المهمة",
  },
  reminderTitle: {
    en: "Reminder Title",
    ar: "عنوان التذكير",
  },
  description: {
    en: "Description",
    ar: "وصف",
  },
  dueDate: {
    en: "Due Date",
    ar: "تاريخ الاستحقاق",
  },
  dueTime: {
    en: "Due Time",
    ar: "وقت الاستحقاق",
  },
  priority: {
    en: "Priority",
    ar: "الأولوية",
  },
  urgent: {
    en: "Urgent",
    ar: "عاجل",
  },
  high: {
    en: "High",
    ar: "مرتفع",
  },
  medium: {
    en: "Medium",
    ar: "متوسط",
  },
  low: {
    en: "Low",
    ar: "منخفض",
  },
  status: {
    en: "Status",
    ar: "الحالة",
  },
  pending: {
    en: "Pending",
    ar: "قيد الانتظار",
  },
  inProgress: {
    en: "In Progress",
    ar: "قيد التنفيذ",
  },
  completed: {
    en: "Completed",
    ar: "مكتمل",
  },
  overdue: {
    en: "Overdue",
    ar: "متأخر",
  },
  subtasks: {
    en: "Subtasks",
    ar: "المهام الفرعية",
  },
  addSubtask: {
    en: "Add Subtask",
    ar: "إضافة مهمة فرعية",
  },
  subtaskGroupTitle: {
    en: "Subtask Group Title (Optional)",
    ar: "عنوان مجموعة المهام الفرعية (اختياري)",
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
    ar: "يومي",
  },
  weekly: {
    en: "Weekly",
    ar: "أسبوعي",
  },
  monthly: {
    en: "Monthly",
    ar: "شهري",
  },
  yearly: {
    en: "Yearly",
    ar: "سنوي",
  },
  save: {
    en: "Save",
    ar: "حفظ",
  },
  delete: {
    en: "Delete",
    ar: "حذف",
  },
  edit: {
    en: "Edit",
    ar: "تعديل",
  },
  share: {
    en: "Share",
    ar: "مشاركة",
  },
  shared: {
    en: "Shared",
    ar: "مشترك",
  },
  shareWith: {
    en: "Share with",
    ar: "مشاركة مع",
  },
  selectContact: {
    en: "Select Contact",
    ar: "اختر جهة اتصال",
  },
  noTasks: {
    en: "No tasks found",
    ar: "لم يتم العثور على مهام",
  },
  noReminders: {
    en: "No reminders found",
    ar: "لم يتم العثور على تذكيرات",
  },
  createYourFirst: {
    en: "Create your first",
    ar: "إنشاء أول",
  },
  markAsCompleted: {
    en: "Mark as Completed",
    ar: "وضع علامة كمكتمل",
  },
  markAsPending: {
    en: "Mark as Pending",
    ar: "وضع علامة قيد الانتظار",
  },
  allTasks: {
    en: "All Tasks",
    ar: "جميع المهام",
  },
  completedTasks: {
    en: "Completed Tasks",
    ar: "المهام المكتملة",
  },
  pendingTasks: {
    en: "Pending Tasks",
    ar: "المهام قيد الانتظار",
  },
  overdueItems: {
    en: "Overdue Items",
    ar: "العناصر المتأخرة",
  },
  smartTask: {
    en: "Smart Task",
    ar: "مهمة ذكية",
  },
  swipeToComplete: {
    en: "Swipe right to complete",
    ar: "اسحب لليمين للإكمال",
  },
  swipeToDelete: {
    en: "Swipe left to delete",
    ar: "اسحب لليسار للحذف",
  },
  taskCreatedSuccessfully: {
    en: "Task created successfully",
    ar: "تم إنشاء المهمة بنجاح",
  },
  reminderCreatedSuccessfully: {
    en: "Reminder created successfully",
    ar: "تم إنشاء التذكير بنجاح",
  },
  taskUpdatedSuccessfully: {
    en: "Task updated successfully",
    ar: "تم تحديث المهمة بنجاح",
  },
  reminderUpdatedSuccessfully: {
    en: "Reminder updated successfully",
    ar: "تم تحديث التذكير بنجاح",
  },
  taskDeletedSuccessfully: {
    en: "Task deleted successfully",
    ar: "تم حذف المهمة بنجاح",
  },
  reminderDeletedSuccessfully: {
    en: "Reminder deleted successfully",
    ar: "تم حذف التذكير بنجاح",
  },
  taskSharedSuccessfully: {
    en: "Task shared successfully",
    ar: "تمت مشاركة المهمة بنجاح",
  },
  searchTasks: {
    en: "Search tasks...",
    ar: "البحث في المهام...",
  },
  searchReminders: {
    en: "Search reminders...",
    ar: "البحث في التذكيرات...",
  },
  filterBy: {
    en: "Filter by",
    ar: "تصفية حسب",
  },
  sortBy: {
    en: "Sort by",
    ar: "ترتيب حسب",
  },
  date: {
    en: "Date",
    ar: "التاريخ",
  },
  ascending: {
    en: "Ascending",
    ar: "تصاعدي",
  },
  descending: {
    en: "Descending",
    ar: "تنازلي",
  },
  // Events system keys
  createEvent: {
    en: "Create Event",
    ar: "إنشاء حدث",
  },
  event: {
    en: "Event",
    ar: "حدث",
  },
  create: {
    en: "Create",
    ar: "إنشاء",
  }
};

export const t = (key: TranslationKey, language: "en" | "ar") => {
  if (!translations[key]) {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }
  return translations[key][language];
};

export default translations;
