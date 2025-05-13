export interface GeneralText {
  home: string;
  dashboard: string;
  tasks: string;
  reminders: string;
  events: string;
  calendar: string;
  messages: string;
  voiceSummary: string;
  settings: string;
  login: string;
  signup: string;
  logout: string;
  account: string;
  contacts: string;
  notFound: string;
  pageNotFound: string;
  goHome: string;
  search: string;
  create: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  confirm: string;
  today: string;
  all: string;
  overdue: string;
  done: string;
  undone: string;
  view: string;
  details: string;
  share: string;
  submit: string;
}

export interface TaskText {
  taskTitle: string;
  taskDescription: string;
  taskDueDate: string;
  taskPriority: string;
  taskStatus: string;
  taskSubtasks: string;
  taskCreateSubtask: string;
  taskSubtaskTitle: string;
  taskSubtaskCompleted: string;
  taskPriorityHigh: string;
  taskPriorityMedium: string;
  taskPriorityLow: string;
  taskStatusOpen: string;
  taskStatusInProgress: string;
  taskStatusCompleted: string;
  taskAndReminders: string;
  searchTasks: string;
  allTasks: string;
  pendingTasks: string;
  completedTasks: string;
  noTasks: string;
  createYourFirst: string;
  createTask: string;
  overdueItems: string;
}

export interface ReminderText {
  reminderTitle: string;
  reminderDueDate: string;
  searchReminders: string;
  noReminders: string;
  createReminder: string;
}

export interface EventText {
  eventTitle: string;
  eventDescription: string;
  eventStartTime: string;
  eventEndTime: string;
  eventLocation: string;
  eventLocationLink: string;
  eventIsPublic: string;
  eventAllDay: string;
  eventBackgroundColor: string;
  eventBackgroundGradient: string;
  eventTextColor: string;
  eventFontSize: string;
  eventButtonStyle: string;
  eventCoverImage: string;
  events: string;
  eventCreate: string;
  eventDetail: string;
}

export interface VoiceSummaryText {
  voiceSummaryTitle: string;
  voiceSummaryDescription: string;
  voiceSummaryAttendees: string;
  voiceSummaryLocation: string;
  voiceSummaryType: string;
  voiceSummaryDate: string;
  voiceSummaryHost: string;
  voiceSummaryCleanAudio: string;
  voiceSummaryHighlightedTimestamps: string;
  voiceSummarySummary: string;
  voiceSummaryTranscript: string;
  voiceSummaryAudioUrl: string;
  voiceSummarySummaryAudioUrl: string;
  voiceSummarySummaryLanguage: string;
  voiceSummarySummaryVoice: string;
}

export interface SettingsText {
  settingsTheme: string;
  settingsLanguage: string;
  settingsAccount: string;
  settingsNotifications: string;
  settingsPrivacy: string;
  settingsAbout: string;
  settingsLogout: string;
  settingsThemeLight: string;
  settingsThemeDark: string;
}

export interface CalendarText {
  month: string;
  week: string;
  year: string;
  monthView: string;
  weekView: string;
  yearView: string;
  agenda: string;
}

export interface ContactText {
  contacts: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactCompany: string;
  contactWebsite: string;
}

export interface MessageText {
  messages: string;
  messageTitle: string;
  messageContent: string;
  messageSender: string;
  messageReceiver: string;
  messageDate: string;
}

export interface AIAssistantText {
  welcomeToWaktiAI: string;
  askWAKTI: string;
  generalMode: string;
  writerMode: string;
  creativeMode: string;
  assistantMode: string;
  openHistory: string;
  openSettings: string;
  send: string;
  searchChats: string;
  clearHistory: string;
  noChatsYet: string;
  switchLanguage: string;
  generalSettings: string;
  writerSettings: string;
  creativeSettings: string;
  assistantSettings: string;
  tonePresets: string;
  professional: string;
  casual: string;
  friendly: string;
  academic: string;
  lengthOptions: string;
  short: string;
  medium: string;
  long: string;
  grammarCheck: string;
  imageTools: string;
  chartTypes: string;
  textToImage: string;
  imageToImage: string;
  removeBg: string;
  enhanceImage: string;
  barChart: string;
  lineChart: string;
  pieChart: string;
  shortcuts: string;
  commonQuestions: string;
  whatCanYouDo: string;
  howToCreateTask: string;
  explainWAKTIFeatures: string;
  toCompleteThisAction: string;
  switchTo: string;
  hereIsWhatIUnderstood: string;
  switchMode: string;
  cancel: string;
  confirm: string;
  startVoiceInput: string;
  stopListening: string;
  iCanCreateThisTask: string;
  howCanIAssistYouWithWAKTI: string;
  generatingVisualContent: string;
  writingContent: string;
  helpingYouWith: string;
  errorProcessingRequest: string;
  taskCreatedSuccessfully: string;
  due: string;
  viewCalendar: string;
}

export function t(key: keyof (GeneralText & TaskText & ReminderText & EventText & VoiceSummaryText & SettingsText & CalendarText & ContactText & MessageText & AIAssistantText), lang: string): string {
  const translations = {
    en: {
      // General Translations
      home: "Home",
      dashboard: "Dashboard",
      tasks: "Tasks",
      reminders: "Reminders",
      events: "Events",
      calendar: "Calendar",
      messages: "Messages",
      voiceSummary: "Voice Summary",
      settings: "Settings",
      login: "Login",
      signup: "Sign Up",
      logout: "Logout",
      account: "Account",
      contacts: "Contacts",
      notFound: "Not Found",
      pageNotFound: "Page Not Found",
      goHome: "Go Home",
      search: "Search",
      create: "Create",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      today: "Today",
      all: "All",
      overdue: "Overdue",
      done: "Done",
      undone: "Undone",
      view: "View",
      details: "Details",
      share: "Share",
      submit: "Submit",

      // Task Translations
      taskTitle: "Title",
      taskDescription: "Description",
      taskDueDate: "Due Date",
      taskPriority: "Priority",
      taskStatus: "Status",
      taskSubtasks: "Subtasks",
      taskCreateSubtask: "Create Subtask",
      taskSubtaskTitle: "Subtask Title",
      taskSubtaskCompleted: "Completed",
      taskPriorityHigh: "High",
      taskPriorityMedium: "Medium",
      taskPriorityLow: "Low",
      taskStatusOpen: "Open",
      taskStatusInProgress: "In Progress",
      taskStatusCompleted: "Completed",
      taskAndReminders: "Tasks & Reminders",
      searchTasks: "Search tasks...",
      allTasks: "All Tasks",
      pendingTasks: "Pending Tasks",
      completedTasks: "Completed Tasks",
      noTasks: "No tasks yet",
      createYourFirst: "Create your first",
      createTask: "Create Task",
      overdueItems: "Overdue Items",

      // Reminder Translations
      reminderTitle: "Title",
      reminderDueDate: "Due Date",
      searchReminders: "Search reminders...",
      noReminders: "No reminders yet",
      createReminder: "Create Reminder",

      // Event Translations
      eventTitle: "Title",
      eventDescription: "Description",
      eventStartTime: "Start Time",
      eventEndTime: "End Time",
      eventLocation: "Location",
      eventLocationLink: "Location Link",
      eventIsPublic: "Public Event",
      eventAllDay: "All Day",
      eventBackgroundColor: "Background Color",
      eventBackgroundGradient: "Background Gradient",
      eventTextColor: "Text Color",
      eventFontSize: "Font Size",
      eventButtonStyle: "Button Style",
      eventCoverImage: "Cover Image",
      events: "Events",
      eventCreate: "Create Event",
      eventDetail: "Event Detail",

      // Voice Summary Translations
      voiceSummaryTitle: "Title",
      voiceSummaryDescription: "Description",
      voiceSummaryAttendees: "Attendees",
      voiceSummaryLocation: "Location",
      voiceSummaryType: "Type",
      voiceSummaryDate: "Date",
      voiceSummaryHost: "Host",
      voiceSummaryCleanAudio: "Clean Audio",
      voiceSummaryHighlightedTimestamps: "Highlighted Timestamps",
      voiceSummarySummary: "Summary",
      voiceSummaryTranscript: "Transcript",
      voiceSummaryAudioUrl: "Audio URL",
      voiceSummarySummaryAudioUrl: "Summary Audio URL",
      voiceSummarySummaryLanguage: "Summary Language",
      voiceSummarySummaryVoice: "Summary Voice",

      // Settings Translations
      settingsTheme: "Theme",
      settingsLanguage: "Language",
      settingsAccount: "Account",
      settingsNotifications: "Notifications",
      settingsPrivacy: "Privacy",
      settingsAbout: "About",
      settingsLogout: "Logout",
      settingsThemeLight: "Light",
      settingsThemeDark: "Dark",

      // Calendar Translations
      month: "Month",
      week: "Week",
      year: "Year",
      monthView: "Month View",
      weekView: "Week View",
      yearView: "Year View",
      agenda: "Agenda",

      // Contact Translations
      contacts: "Contacts",
      contactName: "Name",
      contactEmail: "Email",
      contactPhone: "Phone",
      contactAddress: "Address",
      contactCompany: "Company",
      contactWebsite: "Website",

      // Message Translations
      messages: "Messages",
      messageTitle: "Title",
      messageContent: "Content",
      messageSender: "Sender",
      messageReceiver: "Receiver",
      messageDate: "Date",

      // AI Assistant Translations
      welcomeToWaktiAI: "Welcome to WAKTI AI. How can I assist you today?",
      askWAKTI: "Ask WAKTI...",
      generalMode: "General",
      writerMode: "Writer",
      creativeMode: "Creative",
      assistantMode: "Assistant",
      openHistory: "Open History",
      openSettings: "Open Settings",
      send: "Send",
      searchChats: "Search chats",
      clearHistory: "Clear History",
      noChatsYet: "No chats yet",
      switchLanguage: "Switch Language",
      generalSettings: "General Settings",
      writerSettings: "Writer Settings",
      creativeSettings: "Creative Settings",
      assistantSettings: "Assistant Settings",
      tonePresets: "Tone Presets",
      professional: "Professional",
      casual: "Casual",
      friendly: "Friendly",
      academic: "Academic",
      lengthOptions: "Length Options",
      short: "Short",
      medium: "Medium",
      long: "Long",
      grammarCheck: "Grammar Check",
      imageTools: "Image Tools",
      chartTypes: "Chart Types",
      textToImage: "Text to Image",
      imageToImage: "Image to Image",
      removeBg: "Remove Background",
      enhanceImage: "Enhance Image",
      barChart: "Bar Chart",
      lineChart: "Line Chart",
      pieChart: "Pie Chart",
      shortcuts: "Shortcuts",
      commonQuestions: "Common Questions",
      whatCanYouDo: "What can you do?",
      howToCreateTask: "How do I create a task?",
      explainWAKTIFeatures: "Explain WAKTI features",
      toCompleteThisAction: "To complete this action,",
      switchTo: "switch to",
      hereIsWhatIUnderstood: "Here's what I understood",
      switchMode: "Switch Mode",
      cancel: "Cancel",
      confirm: "Confirm",
      startVoiceInput: "Start voice input",
      stopListening: "Stop listening",
      iCanCreateThisTask: "I can create this task for you",
      howCanIAssistYouWithWAKTI: "How can I assist you with WAKTI?",
      generatingVisualContent: "Generating your visual content...",
      writingContent: "Writing your content...",
      helpingYouWith: "Helping you with",
      errorProcessingRequest: "Sorry, there was an error processing your request. Please try again.",
      taskCreatedSuccessfully: "Task created successfully!",
      due: "Due",
      viewCalendar: "View Calendar",
    },
    ar: {
      // General Translations
      home: "الرئيسية",
      dashboard: "لوحة التحكم",
      tasks: "المهام",
      reminders: "التذكيرات",
      events: "الأحداث",
      calendar: "التقويم",
      messages: "الرسائل",
      voiceSummary: "ملخص صوتي",
      settings: "الإعدادات",
      login: "تسجيل الدخول",
      signup: "اشتراك",
      logout: "تسجيل الخروج",
      account: "الحساب",
      contacts: "جهات الاتصال",
      notFound: "غير موجود",
      pageNotFound: "الصفحة غير موجودة",
      goHome: "العودة إلى الرئيسية",
      search: "بحث",
      create: "إنشاء",
      edit: "تعديل",
      delete: "حذف",
      save: "حفظ",
      cancel: "إلغاء",
      confirm: "تأكيد",
      today: "اليوم",
      all: "الكل",
      overdue: "متأخر",
      done: "منجز",
      undone: "غير منجز",
      view: "عرض",
      details: "تفاصيل",
      share: "شارك",
      submit: "إرسال",

      // Task Translations
      taskTitle: "العنوان",
      taskDescription: "الوصف",
      taskDueDate: "تاريخ الاستحقاق",
      taskPriority: "الأولوية",
      taskStatus: "الحالة",
      taskSubtasks: "المهام الفرعية",
      taskCreateSubtask: "إنشاء مهمة فرعية",
      taskSubtaskTitle: "عنوان المهمة الفرعية",
      taskSubtaskCompleted: "مكتملة",
      taskPriorityHigh: "عالية",
      taskPriorityMedium: "متوسطة",
      taskPriorityLow: "منخفضة",
      taskStatusOpen: "مفتوحة",
      taskStatusInProgress: "قيد التقدم",
      taskStatusCompleted: "مكتملة",
      taskAndReminders: "المهام والتذكيرات",
      searchTasks: "البحث في المهام...",
      allTasks: "جميع المهام",
      pendingTasks: "المهام المعلقة",
      completedTasks: "المهام المكتملة",
      noTasks: "لا توجد مهام بعد",
      createYourFirst: "أنشئ أول",
      createTask: "إنشاء مهمة",
      overdueItems: "العناصر المتأخرة",

      // Reminder Translations
      reminderTitle: "العنوان",
      reminderDueDate: "تاريخ الاستحقاق",
      searchReminders: "البحث في التذكيرات...",
      noReminders: "لا توجد تذكيرات بعد",
      createReminder: "إنشاء تذكير",

      // Event Translations
      eventTitle: "العنوان",
      eventDescription: "الوصف",
      eventStartTime: "وقت البدء",
      eventEndTime: "وقت الانتهاء",
      eventLocation: "الموقع",
      eventLocationLink: "رابط الموقع",
      eventIsPublic: "حدث عام",
      eventAllDay: "طوال اليوم",
      eventBackgroundColor: "لون الخلفية",
      eventBackgroundGradient: "تدرج الخلفية",
      eventTextColor: "لون النص",
      eventFontSize: "حجم الخط",
      eventButtonStyle: "نمط الزر",
      eventCoverImage: "صورة الغلاف",
      events: "الأحداث",
      eventCreate: "إنشاء حدث",
      eventDetail: "تفاصيل الحدث",

      // Voice Summary Translations
      voiceSummaryTitle: "العنوان",
      voiceSummaryDescription: "الوصف",
      voiceSummaryAttendees: "الحضور",
      voiceSummaryLocation: "الموقع",
      voiceSummaryType: "النوع",
      voiceSummaryDate: "التاريخ",
      voiceSummaryHost: "المضيف",
      voiceSummaryCleanAudio: "صوت نظيف",
      voiceSummaryHighlightedTimestamps: "الطوابع الزمنية المميزة",
      voiceSummarySummary: "الملخص",
      voiceSummaryTranscript: "النص",
      voiceSummaryAudioUrl: "رابط الصوت",
      voiceSummarySummaryAudioUrl: "رابط ملخص الصوت",
      voiceSummarySummaryLanguage: "لغة الملخص",
      voiceSummarySummaryVoice: "صوت الملخص",

      // Settings Translations
      settingsTheme: "المظهر",
      settingsLanguage: "اللغة",
      settingsAccount: "الحساب",
      settingsNotifications: "الإشعارات",
      settingsPrivacy: "الخصوصية",
      settingsAbout: "حول",
      settingsLogout: "تسجيل الخروج",
      settingsThemeLight: "فاتح",
      settingsThemeDark: "داكن",

      // Calendar Translations
      month: "شهر",
      week: "أسبوع",
      year: "سنة",
      monthView: "عرض الشهر",
      weekView: "عرض الأسبوع",
      yearView: "عرض السنة",
      agenda: "جدول الأعمال",

      // Contact Translations
      contacts: "جهات الاتصال",
      contactName: "الاسم",
      contactEmail: "البريد الإلكتروني",
      contactPhone: "الهاتف",
      contactAddress: "العنوان",
      contactCompany: "الشركة",
      contactWebsite: "الموقع الإلكتروني",

      // Message Translations
      messages: "الرسائل",
      messageTitle: "العنوان",
      messageContent: "المحتوى",
      messageSender: "المرسل",
      messageReceiver: "المتلقي",
      messageDate: "التاريخ",

      // AI Assistant Translations
      welcomeToWaktiAI: "مرحبًا بك في WAKTI AI. كيف يمكنني مساعدتك اليوم؟",
      askWAKTI: "اسأل WAKTI...",
      generalMode: "عام",
      writerMode: "كاتب",
      creativeMode: "إبداعي",
      assistantMode: "مساعد",
      openHistory: "فتح السجل",
      openSettings: "فتح الإعدادات",
      send: "إرسال",
      searchChats: "البحث في المحادثات",
      clearHistory: "مسح المحفوظات",
      noChatsYet: "لا توجد محادثات حتى الآن",
      switchLanguage: "تغيير اللغة",
      generalSettings: "الإعدادات العامة",
      writerSettings: "إعدادات الكاتب",
      creativeSettings: "الإعدادات الإبداعية",
      assistantSettings: "إعدادات المساعد",
      tonePresets: "إعدادات النبرة",
      professional: "احترافي",
      casual: "عادي",
      friendly: "ودي",
      academic: "أكاديمي",
      lengthOptions: "خيارات الطول",
      short: "قصير",
      medium: "متوسط",
      long: "طويل",
      grammarCheck: "تدقيق نحوي",
      imageTools: "أدوات الصور",
      chartTypes: "أنواع الرسوم البيانية",
      textToImage: "نص إلى صورة",
      imageToImage: "صورة إلى صورة",
      removeBg: "إزالة الخلفية",
      enhanceImage: "تحسين الصورة",
      barChart: "رسم بياني شريطي",
      lineChart: "رسم بياني خطي",
      pieChart: "رسم بياني دائري",
      shortcuts: "اختصارات",
      commonQuestions: "أسئلة شائعة",
      whatCanYouDo: "ما الذي يمكنك فعله؟",
      howToCreateTask: "كيف يمكنني إنشاء مهمة؟",
      explainWAKTIFeatures: "اشرح ميزات WAKTI",
      toCompleteThisAction: "لإكمال هذا الإجراء،",
      switchTo: "انتقل إلى",
      hereIsWhatIUnderstood: "إليك ما فهمته",
      switchMode: "تبديل الوضع",
      cancel: "إلغاء",
      confirm: "تأكيد",
      startVoiceInput: "بدء الإدخال الصوتي",
      stopListening: "إيقاف الاستماع",
      iCanCreateThisTask: "يمكنني إنشاء هذه المهمة لك",
      howCanIAssistYouWithWAKTI: "كيف يمكنني مساعدتك مع WAKTI؟",
      generatingVisualContent: "جاري إنشاء المحتوى المرئي الخاص بك...",
      writingContent: "جاري كتابة المحتوى الخاص بك...",
      helpingYouWith: "أساعدك في",
      errorProcessingRequest: "عذرًا، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.",
      taskCreatedSuccessfully: "تم إنشاء المهمة بنجاح!",
      due: "تاريخ الاستحقاق",
      viewCalendar: "عرض التقويم",
    }
  };

  return translations[lang][key] || key;
}
