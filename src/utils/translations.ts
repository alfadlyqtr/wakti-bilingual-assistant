import { en } from "./translations/en";
import { ar } from "./translations/ar";

export type Translation = {
  en: string;
  ar: string;
};

export type SupportedLanguage = 'en' | 'ar';

// Define the TranslationKey here directly
export type TranslationKey =
  | "dashboard"
  | "tasks"
  | "reminders"
  | "taskAndReminders"
  | "events"
  | "calendar"
  | "assistant"
  | "messages"
  | "contacts"
  | "settings"
  | "today"
  | "tomorrow"
  | "yesterday"
  | "upcoming"
  | "completed"
  | "addNew"
  | "addTask"
  | "addReminder"
  | "name"
  | "date"
  | "time"
  | "description"
  | "priority"
  | "high"
  | "medium"
  | "low"
  | "status"
  | "pending"
  | "inProgress"
  | "save"
  | "cancel"
  | "delete"
  | "edit"
  | "view"
  | "back"
  | "next"
  | "previous"
  | "submit"
  | "search"
  | "enterAtLeastThreeCharacters"
  | "filter"
  | "sort"
  | "ascending"
  | "descending"
  | "light"
  | "dark"
  | "system"
  | "english"
  | "arabic"
  | "theme"
  | "language"
  | "logout"
  | "login"
  | "signup"
  | "email"
  | "password"
  | "confirmPassword"
  | "forgotPassword"
  | "resetPassword"
  | "user"
  | "summary"
  | "transcript"
  | "download"
  | "upload"
  | "share"
  | "create"
  | "update"
  | "messaging"
  | "searchContacts"
  | "selectConversation"
  | "createFirstEvent"
  | "decline"
  | "accept"
  | "noLocation"
  | "attendee"
  | "attendees"
  | "readyToCreateTask"
  | "noTasksYet"
  | "nothingScheduled"
  | "noEventsYet"
  | "noRemindersYet"
  | "writer"
  | "creative"
  | "general"
  | "ai"
  | "account"
  | "switchLanguage"
  | "commonQuestions"
  | "whatCanYouDo"
  | "howToCreateTask"
  | "explainWAKTIFeatures"
  | "tonePresets"
  | "professional"
  | "casual"
  | "friendly"
  | "academic"
  | "lengthOptions"
  | "short"
  | "long"
  | "grammarCheck"
  | "imageTools"
  | "textToImage"
  | "imageToImage"
  | "removeBg"
  | "enhanceImage"
  | "chartTypes"
  | "barChart"
  | "lineChart"
  | "pieChart"
  | "shortcuts"
  | "createTask"
  | "createReminder"
  | "createEvent"
  | "viewCalendar"
  | "instructions"
  | "knowledge"
  | "month"
  | "week"
  | "year"
  | "monthView"
  | "weekView"
  | "yearView"
  | "noEvents"
  | "notesLabel"
  | "titleRequired"
  | "dateRequired"
  | "editNote"
  | "createNote"
  | "title"
  | "titlePlaceholder"
  | "descriptionPlaceholder"
  | "requestAccepted"
  | "contactRejectedDescription"
  | "noContactRequests"
  | "messageStarted"
  | "chattingWithUser"
  | "removedFromFavorites"
  | "addedToFavorites"
  | "contactBlocked"
  | "userBlockedDescription"
  | "contactAddedDescription"
  | "requestRejected"
  | "blockedUserDescription"
  | "sendMessage"
  | "dailyQuote"
  | "error"
  | "pleaseCompleteAllRequiredFields"
  | "success"
  | "eventCreatedSuccessfully"
  | "errorCreatingEvent"
  | "eventTitle" 
  | "enterEventTitle"
  | "descriptionField"
  | "enterEventDescription"
  | "location"
  | "enterLocation"
  | "selectDate"
  | "creating"
  | "generalSettings"
  | "writerSettings"
  | "creativeSettings"
  | "assistantSettings"
  | "contactRequestSettings"
  | "manageBlockedUsers"
  | "unblockContact"
  | "noConversations"
  | "imageTooLarge"
  | "typeMessage"
  | "newMessage"
  | "noContactsFound"
  | "reminderTitle"
  | "dueDate"
  | "dueTime"
  | "recurring"
  | "recurrencePattern"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "shareWith"
  | "selectContact"
  | "taskTitle"
  | "urgent"
  | "highPriority"
  | "mediumPriority"
  | "lowPriority"
  | "subtaskGroupTitle"
  | "subtasks"
  | "addSubtask"
  | "dailyRecurrence"
  | "weeklyRecurrence"
  | "monthlyRecurrence"
  | "yearlyRecurrence"
  | "sharedTask"
  | "searchTasks"
  | "searchReminders"
  | "allTasks"
  | "pendingTasks"
  | "completedTasks"
  | "overdueItems"
  | "noTasks"
  | "noReminders"
  | "createYourFirst"
  | "taskCreatedSuccessfully"
  | "taskUpdatedSuccessfully"
  | "taskDeletedSuccessfully"
  | "reminderCreatedSuccessfully"
  | "reminderUpdatedSuccessfully"
  | "reminderDeletedSuccessfully"
  | "taskSharedSuccessfully"
  | "username"
  | "tasks_view_all"
  | "event"
  | "task"
  | "calendar_open"
  | "events_today"
  | "events_view_all"
  | "reminders_view_all"
  | "freeTrialDays"
  | "eventDetail"
  | "lightMode"
  | "darkMode"
  | "notificationPreferences"
  | "widgetVisibility"
  | "privacyControls"
  | "deleteAccount"
  | "aiSectionTitle"
  | "aiFeature1Title"
  | "aiFeature1Desc"
  | "aiFeature2Title"
  | "aiFeature2Desc"
  | "aiFeature3Title"
  | "aiFeature3Desc"
  | "aiFeature4Title"
  | "aiFeature4Desc"
  | "errorOccurred"
  | "errorProcessingRequest"
  | "generatingImage"
  | "imageGenerated"
  | "generatedImage"
  | "errorGeneratingImage"
  | "contactUnblocked"
  | "userUnblockedDescription"
  | "errorUnblockingContact"
  | "errorLoadingBlockedUsers"
  | "noBlockedUsers"
  | "noBlockedUsersDescription"  
  | "unblock"
  | "errorCreatingConversation"
  | "errorBlockingContact"
  | "errorLoadingContacts"
  | "noContacts"
  | "searchToAddContacts"
  | "errorAcceptingRequest"
  | "errorRejectingRequest"
  | "errorBlockingUser"
  | "errorLoadingRequests"
  | "requestSent"
  | "contactRequestSent"
  | "errorSendingRequest"
  | "searchResults"
  | "sendRequest"
  | "noUsersFound"
  | "errorSendingMessage"
  | "loadingMessages"
  | "startConversation"
  | "errorLoadingConversations"
  | "noConversationsFound"
  | "noMessages"
  | "uploading"
  | "creatingConversation"
  | "searchMessages"
  | "welcomeToMessages"
  | "tapNewMessageToStart"
  | "sayHelloPrompt"
  | "addContactsPrompt"
  | "goToContactsPage"
  | "messagesSent"
  | "messagesDelivered"
  | "policiesUpdated"
  | "appearance"
  | "appearanceSettings"
  | "contactsSettings"
  | "contactsSettingsDescription"
  | "autoApproveRequests"
  | "autoApproveExplanation"
  | "settingsUpdated"
  | "contactSettingsUpdated"
  | "errorUpdatingSettings"
  | "requests"
  | "blocked"
  | "waitingForRequests"
  | "dailyQuoteSettings"
  | "quoteCategory"
  | "quoteChangeFrequency"
  | "manageCustomQuotes"
  | "twiceDaily"
  | "fourTimesDaily"
  | "sixTimesDaily"
  | "everyAppStart"
  | "saveAllSettingsQuestion"
  | "saveAllSettingsConfirmation"
  | "allSettingsSaved"
  | "saveAllSettings"
  | "pushNotifications"
  | "emailNotifications"
  | "tasksWidget"
  | "calendarWidget"
  | "remindersWidget"
  | "dailyQuoteWidget"
  | "profileVisibility"
  | "activityStatus"
  | "deleteMyAccount"
  | "deleteAccountDescription"
  | "quotePreferencesUpdated"
  | "motivational"
  | "islamic"
  | "positive"
  | "health"
  | "mixed"
  | "custom"
  | "productivity"
  | "discipline"
  | "gratitude"
  | "leadership"
  | "profileManagement"
  | "usernameHelpText"
  | "updating"
  | "updateName"
  | "updateEmail"
  | "updatePassword"
  | "passwordsDoNotMatch"
  | "profileUpdated"
  | "emailUpdated"
  | "passwordUpdated"
  | "errorUpdatingName"
  | "errorUpdatingProfile"
  | "errorUpdatingEmail"
  | "errorUpdatingPassword"
  | "errorSigningOut"
  | "accountOptions"
  | "profile"
  | "profileImage"
  | "changeImage"
  | "profileImageUpdated"
  | "currentPassword"
  | "newPassword"
  | "currentPasswordRequired"
  | "tasjeel"
  | "uploadDescription"
  | "home"
  | "register"
  | "displayName"
  | "invalidEmail"
  | "passwordMismatch"
  | "usernameRequired"
  | "emailRequired"
  | "passwordRequired"
  | "confirmPasswordRequired"
  | "registrationSuccess"
  | "loginSuccess"
  | "logoutSuccess"
  | "editProfile"
  | "saveChanges"
  | "tasjeelTitle"
  | "tasjeelDescription"
  | "transcribe"
  | "generateSpeech"
  | "loading"
  | "noAudio"
  | "transcription" 
  | "speech"
  | "saved"
  | "noRecordsFound"
  | "deleteConfirmation"
  | "deleteTasjeel"
  | "tasjeelDeleted"
  | "tasjeelSaved"
  | "tasjeelUnsaved"
  | "recordTitle"
  | "updateTitle"
  | "titleUpdated";

export const translations: Record<TranslationKey, Translation> = {
  home: {
    en: "Home",
    ar: "الرئيسية",
  },
  tasjeel: {
    en: "Tasjeel",
    ar: "تسجيل",
  },
  settings: {
    en: "Settings",
    ar: "إعدادات",
  },
  logout: {
    en: "Logout",
    ar: "تسجيل الخروج",
  },
  login: {
    en: "Login",
    ar: "تسجيل الدخول",
  },
  register: {
    en: "Register",
    ar: "تسجيل",
  },
  email: {
    en: "Email",
    ar: "البريد الإلكتروني",
  },
  password: {
    en: "Password",
    ar: "كلمة المرور",
  },
  username: {
    en: "Username",
    ar: "اسم المستخدم",
  },
  displayName: {
    en: "Display Name",
    ar: "اسم العرض",
  },
  confirmPassword: {
    en: "Confirm Password",
    ar: "تأكيد كلمة المرور",
  },
  invalidEmail: {
    en: "Invalid email address",
    ar: "عنوان بريد إلكتروني غير صالح",
  },
  passwordMismatch: {
    en: "Passwords do not match",
    ar: "كلمات المرور غير متطابقة",
  },
  usernameRequired: {
    en: "Username is required",
    ar: "اسم المستخدم مطلوب",
  },
  emailRequired: {
    en: "Email is required",
    ar: "البريد الإلكتروني مطلوب",
  },
  passwordRequired: {
    en: "Password is required",
    ar: "كلمة المرور مطلوبة",
  },
  confirmPasswordRequired: {
    en: "Confirm password is required",
    ar: "تأكيد كلمة المرور مطلوب",
  },
  registrationSuccess: {
    en: "Registration successful!",
    ar: "تم التسجيل بنجاح!",
  },
  loginSuccess: {
    en: "Login successful!",
    ar: "تم تسجيل الدخول بنجاح!",
  },
  logoutSuccess: {
    en: "Logout successful!",
    ar: "تم تسجيل الخروج بنجاح!",
  },
  error: {
    en: "Error!",
    ar: "خطأ!",
  },
  profile: {
    en: "Profile",
    ar: "الملف الشخصي",
  },
  editProfile: {
    en: "Edit Profile",
    ar: "تعديل الملف الشخصي",
  },
  saveChanges: {
    en: "Save Changes",
    ar: "حفظ التغييرات",
  },
  profileUpdated: {
    en: "Profile updated!",
    ar: "تم تحديث الملف الشخصي!",
  },
  tasjeelTitle: {
    en: "Record, Transcribe, Summarize, Generate Speech",
    ar: "تسجيل، نسخ، تلخيص، توليد كلام",
  },
  tasjeelDescription: {
    en: "Your AI-powered audio toolkit",
    ar: "مجموعة أدوات الصوت المدعومة بالذكاء الاصطناعي",
  },
  startRecording: {
    en: "Start Recording",
    ar: "بدء التسجيل",
  },
  stopRecording: {
    en: "Stop Recording",
    ar: "إيقاف التسجيل",
  },
  uploadAudio: {
    en: "Upload Audio",
    ar: "رفع الصوت",
  },
  transcribe: {
    en: "Transcribe",
    ar: "نسخ",
  },
  summarize: {
    en: "Summarize",
    ar: "تلخيص",
  },
  generateSpeech: {
    en: "Generate Speech",
    ar: "توليد كلام",
  },
  download: {
    en: "Download",
    ar: "تنزيل",
  },
  loading: {
    en: "Loading...",
    ar: "جار التحميل...",
  },
  noAudio: {
    en: "No audio recorded",
    ar: "لم يتم تسجيل أي صوت",
  },
  transcription: {
    en: "Transcription",
    ar: "النسخ",
  },
  summary: {
    en: "Summary",
    ar: "ملخص",
  },
  speech: {
    en: "Speech",
    ar: "الكلام",
  },
  title: {
    en: "Title",
    ar: "عنوان",
  },
  date: {
    en: "Date",
    ar: "تاريخ",
  },
  saved: {
    en: "Saved",
    ar: "تم الحفظ",
  },
  save: {
    en: "Save",
    ar: "حفظ",
  },
  delete: {
    en: "Delete",
    ar: "حذف",
  },
  noRecordsFound: {
    en: "No records found",
    ar: "لا توجد سجلات",
  },
  deleteConfirmation: {
    en: "Are you sure you want to delete this?",
    ar: "هل أنت متأكد أنك تريد حذف هذا؟",
  },
  deleteTasjeel: {
    en: "Delete Tasjeel",
    ar: "حذف التسجيل",
  },
  tasjeelDeleted: {
    en: "Tasjeel deleted",
    ar: "تم حذف التسجيل",
  },
  tasjeelSaved: {
    en: "Tasjeel saved",
    ar: "تم حفظ التسجيل",
  },
  tasjeelUnsaved: {
    en: "Tasjeel unsaved",
    ar: "تم إلغاء حفظ التسجيل",
  },
  recordTitle: {
    en: "Recording Title",
    ar: "عنوان التسجيل",
  },
  update: {
    en: "Update",
    ar: "تحديث",
  },
  updateTitle: {
    en: "Update Title",
    ar: "تحديث العنوان",
  },
  titleUpdated: {
    en: "Title Updated!",
    ar: "تم تحديث العنوان!",
  },
  contacts: {
    en: "Contacts",
    ar: "جهات الاتصال",
  },
  requests: {
    en: "Requests",
    ar: "الطلبات",
  },
  blocked: {
    en: "Blocked",
    ar: "المحظورين",
  },
  searchContacts: {
    en: "Search contacts...",
    ar: "البحث عن جهات الاتصال...",
  },
  requestSent: {
    en: "Request sent!",
    ar: "تم إرسال الطلب!",
  },
  errorSendingRequest: {
    en: "Error sending request",
    ar: "خطأ في إرسال الطلب",
  },
  searchResults: {
    en: "Search Results",
    ar: "نتائج البحث",
  },
  sendRequest: {
    en: "Send Request",
    ar: "إرسال طلب",
  },
  noUsersFound: {
    en: "No users found",
    ar: "لم يتم العثور على مستخدمين",
  },
  noContacts: {
    en: "No contacts yet",
    ar: "لا توجد جهات اتصال حتى الآن",
  },
  searchToAddContacts: {
    en: "Search to add contacts",
    ar: "ابحث لإضافة جهات اتصال",
  },
  errorLoadingContacts: {
    en: "Error loading contacts",
    ar: "خطأ في تحميل جهات الاتصال",
  },
  messageStarted: {
    en: "Message started with",
    ar: "بدأت الرسالة مع",
  },
  contactBlocked: {
    en: "Contact blocked",
    ar: "تم حظر جهة الاتصال",
  },
  errorBlockingContact: {
    en: "Error blocking contact",
    ar: "خطأ في حظر جهة الاتصال",
  },
  removedFromFavorites: {
    en: "Removed from favorites",
    ar: "تمت الإزالة من المفضلة",
  },
  addedToFavorites: {
    en: "Added to favorites",
    ar: "أضيف إلى المفضلة",
  },
  dailyQuoteSettings: {
    en: "Daily Quote Settings",
    ar: "إعدادات الاقتباس اليومي",
  },
  quoteCategory: {
    en: "Quote Category",
    ar: "فئة الاقتباس",
  },
  quoteChangeFrequency: {
    en: "Quote Change Frequency",
    ar: "تكرار تغيير الاقتباس",
  },
  twiceDaily: {
    en: "Twice Daily",
    ar: "مرتين يوميًا",
  },
  fourTimesDaily: {
    en: "Four Times Daily",
    ar: "أربع مرات يوميًا",
  },
  sixTimesDaily: {
    en: "Six Times Daily",
    ar: "ست مرات يوميًا",
  },
  everyAppStart: {
    en: "Every App Start",
    ar: "في كل بداية للتطبيق",
  },
  quotePreferencesUpdated: {
    en: "Quote preferences updated",
    ar: "تم تحديث تفضيلات الاقتباس",
  },
  manageCustomQuotes: {
    en: "Manage Custom Quotes",
    ar: "إدارة الاقتباسات المخصصة",
  },
  notificationPreferences: {
    en: "Notification Preferences",
    ar: "تفضيلات الإشعارات",
  },
  pushNotifications: {
    en: "Push Notifications",
    ar: "إشعارات الدفع",
  },
  emailNotifications: {
    en: "Email Notifications",
    ar: "إشعارات البريد الإلكتروني",
  },
  widgetVisibility: {
    en: "Widget Visibility",
    ar: "رؤية الأدوات",
  },
  tasksWidget: {
    en: "Tasks Widget",
    ar: "أداة المهام",
  },
  calendarWidget: {
    en: "Calendar Widget",
    ar: "أداة التقويم",
  },
  remindersWidget: {
    en: "Reminders Widget",
    ar: "أداة التذكيرات",
  },
  dailyQuoteWidget: {
    en: "Daily Quote Widget",
    ar: "أداة الاقتباس اليومي",
  },
  privacyControls: {
    en: "Privacy Controls",
    ar: "ضوابط الخصوصية",
  },
  profileVisibility: {
    en: "Profile Visibility",
    ar: "رؤية الملف الشخصي",
  },
  activityStatus: {
    en: "Activity Status",
    ar: "حالة النشاط",
  },
  saveAllSettings: {
    en: "Save All Settings",
    ar: "حفظ جميع الإعدادات",
  },
  saveAllSettingsQuestion: {
    en: "Are you sure you want to save all settings?",
    ar: "هل أنت متأكد أنك تريد حفظ جميع الإعدادات؟",
  },
  saveAllSettingsConfirmation: {
    en: "This will save all your current settings.",
    ar: "سيؤدي هذا إلى حفظ جميع إعداداتك الحالية.",
  },
  allSettingsSaved: {
    en: "All settings saved!",
    ar: "تم حفظ جميع الإعدادات!",
  },
  arabic: {
    en: "Arabic",
    ar: "العربية",
  },
  english: {
    en: "English",
    ar: "الإنجليزية",
  },
  theme: {
    en: "Theme",
    ar: "النمط",
  },
  darkMode: {
    en: "Dark Mode",
    ar: "الوضع الداكن",
  },
  lightMode: {
    en: "Light Mode",
    ar: "الوضع الفاتح",
  },
  appearance: {
    en: "Appearance",
    ar: "المظهر",
  },
  appearanceSettings: {
    en: "Manage the look and feel of your app.",
    ar: "إدارة شكل وتصميم تطبيقك.",
  },
  contactsSettings: {
    en: "Manage your contacts settings.",
    ar: "إدارة إعدادات جهات الاتصال الخاصة بك.",
  },
  contactsSettingsDescription: {
    en: "Configure how you want to handle contact requests.",
    ar: "تكوين الطريقة التي تريد بها التعامل مع طلبات جهات الاتصال.",
  },
  autoApproveRequests: {
    en: "Auto-Approve Contact Requests",
    ar: "الموافقة التلقائية على طلبات جهات الاتصال",
  },
  autoApproveExplanation: {
    en: "Automatically approve contact requests from other users.",
    ar: "الموافقة تلقائيًا على طلبات جهات الاتصال من المستخدمين الآخرين.",
  },
  settingsUpdated: {
    en: "Settings updated",
    ar: "تم تحديث الإعدادات",
  },
  contactSettingsUpdated: {
    en: "Your contact settings have been updated.",
    ar: "تم تحديث إعدادات جهات الاتصال الخاصة بك.",
  },
  errorUpdatingSettings: {
    en: "There was an error updating your settings. Please try again.",
    ar: "حدث خطأ أثناء تحديث إعداداتك. يرجى المحاولة مرة أخرى.",
  },
  custom: {
    en: "Custom",
    ar: "مخصص",
  },
  "search": {
    en: "Search",
    ar: "بحث"
  },
  "enterAtLeastThreeCharacters": {
    en: "Enter at least 3 characters to search",
    ar: "أدخل 3 أحرف على الأقل للبحث"
  },
};

export const t = (key: TranslationKey, language: string): string => {
  return translations[key]?.[language as "en" | "ar"] || en[key] || key;
};
