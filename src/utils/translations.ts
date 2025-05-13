import { TranslationKey } from './translationTypes';

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
  commonQuestions: string;
  whatCanYouDo: string;
  howToCreateTask: string;
  explainWAKTIFeatures: string;
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
  selectDate: string;
}

export function t(key: TranslationKey, lang: string): string {
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
      assistant: "Assistant",
      
      // Theme & Language
      lightMode: "Light Mode",
      darkMode: "Dark Mode",
      language: "Language",
      
      // Task Translations
      taskTitle: "Title",
      reminderTitle: "Title",
      description: "Description",
      dueDate: "Due Date",
      dueTime: "Due Time",
      priority: "Priority",
      urgent: "Urgent",
      high: "High",
      medium: "Medium",
      low: "Low",
      status: "Status",
      pending: "Pending",
      inProgress: "In Progress",
      completed: "Completed",
      subtasks: "Subtasks",
      addSubtask: "Add Subtask",
      subtaskGroupTitle: "Subtasks",
      recurring: "Recurring",
      recurrencePattern: "Recurrence Pattern",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly",
      shared: "Shared",
      shareWith: "Share with",
      selectContact: "Select Contact",
      noTasks: "No tasks yet",
      noReminders: "No reminders yet",
      createYourFirst: "Create your first",
      markAsCompleted: "Mark as completed",
      markAsPending: "Mark as pending",
      allTasks: "All Tasks",
      pendingTasks: "Pending Tasks",
      completedTasks: "Completed Tasks",
      overdueItems: "Overdue Items",
      smartTask: "Smart Task",
      swipeToComplete: "Swipe to complete",
      swipeToDelete: "Swipe to delete",
      taskCreatedSuccessfully: "Task created successfully",
      reminderCreatedSuccessfully: "Reminder created successfully",
      taskUpdatedSuccessfully: "Task updated successfully",
      reminderUpdatedSuccessfully: "Reminder updated successfully",
      taskDeletedSuccessfully: "Task deleted successfully",
      reminderDeletedSuccessfully: "Reminder deleted successfully",
      taskSharedSuccessfully: "Task shared successfully",
      searchTasks: "Search tasks...",
      searchReminders: "Search reminders...",
      filterBy: "Filter by",
      sortBy: "Sort by",
      date: "Date",
      ascending: "Ascending",
      descending: "Descending", 
      due: "Due",
      taskDescription: "Description",
      taskDueDate: "Due Date",
      reminderDueDate: "Due Date",
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
      createTask: "Create Task",
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
      event: "Event",
      createEvent: "Create Event",
      eventCreate: "Create Event",
      eventDetail: "Event Detail",
      
      // Voice Summary Translations - renamed these to avoid duplicates
      voiceSummaryTitleField: "Title",
      voiceSummaryDescriptionField: "Description",
      voiceSummaryAttendeesField: "Attendees",
      voiceSummaryLocationType: "Location",
      voiceSummaryTypeField: "Type",
      voiceSummaryDateField: "Date",
      voiceSummaryHostField: "Host",
      voiceSummaryCleanAudioOption: "Clean Audio",
      voiceSummaryHighlightedTimestampsField: "Highlighted Timestamps",
      voiceSummarySummaryField: "Summary",
      voiceSummaryTranscriptField: "Transcript",
      voiceSummaryAudioUrlField: "Audio URL",
      voiceSummarySummaryAudioUrlField: "Summary Audio URL",
      voiceSummarySummaryLanguageOption: "Summary Language",
      voiceSummarySummaryVoiceOption: "Summary Voice",
      
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
      noEvents: "No events",
      title: "Title",
      titleRequired: "Title is required",
      dateRequired: "Date is required",
      titlePlaceholder: "Enter title...",
      descriptionPlaceholder: "Enter description...",
      editNote: "Edit Note",
      createNote: "Create Note",
      notesLabel: "Notes",
      calendarNote: "Calendar Note",
      manualNote: "Manual Note",
      
      // Contact Translations
      contactName: "Name",
      contactEmail: "Email",
      contactPhone: "Phone",
      contactAddress: "Address",
      contactCompany: "Company",
      contactWebsite: "Website",
      
      // Message Translations
      messaging: "Messaging",
      messageTitle: "Title",
      messageContent: "Content",
      messageSender: "Sender",
      messageReceiver: "Receiver",
      messageDate: "Date",
      
      // Contact list translations
      messageStarted: "Message started",
      chattingWithUser: "Chatting with",
      removedFromFavorites: "Removed from favorites",
      addedToFavorites: "Added to favorites",
      userBlockedDescription: "User blocked",
      requestAccepted: "Request accepted",
      contactAddedDescription: "Contact added",
      requestRejected: "Request rejected",
      contactRejectedDescription: "Contact rejected",
      blockedUserDescription: "User blocked",
      noContactRequests: "No contact requests",
      contactBlocked: "Contact blocked",
      unblockContact: "Unblock contact",
      
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
      commonQuestions: "Common Questions",
      whatCanYouDo: "What can you do?",
      howToCreateTask: "How do I create a task?",
      explainWAKTIFeatures: "Explain WAKTI features",
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
      toCompleteThisAction: "To complete this action,",
      switchTo: "switch to",
      hereIsWhatIUnderstood: "Here's what I understood",
      switchMode: "Switch Mode",
      startVoiceInput: "Start voice input",
      stopListening: "Stop listening",
      iCanCreateThisTask: "I can create this task for you",
      howCanIAssistYouWithWAKTI: "How can I assist you with WAKTI?",
      generatingVisualContent: "Generating your visual content...",
      writingContent: "Writing your content...",
      helpingYouWith: "Helping you with",
      errorProcessingRequest: "Sorry, there was an error processing your request. Please try again.",
      viewCalendar: "View Calendar",
      selectDate: "Select date",
      
      // Marketing
      startFreeTrial: "Start Free Trial",
      createAccount: "Create Account",
      forgotPassword: "Forgot Password",
      
      // Auth
      email: "Email",
      password: "Password",
      name: "Name",
      username: "Username",
      
      // Settings Categories
      notificationPreferences: "Notification Preferences",
      widgetVisibility: "Widget Visibility",
      privacyControls: "Privacy Controls",
      deleteAccount: "Delete Account",
      freeTrialDays: "Free Trial Days",
      
      // New added translations
      appName: "WAKTI",
      tagline: "Manage your time efficiently",
      features: "Features",
      taskDesc: "Task Management",
      calendarDesc: "Calendar Integration",
      remindersDesc: "Smart Reminders",
      messagingDesc: "Secure Messaging",
      pricing: "Pricing",
      monthly: "Monthly",
      yearly: "Yearly",
      aiSummaries: "AI Summaries",
      qar: "QAR",
      usd: "USD",
      loading: "Loading",
      alreadyHaveAccount: "Already have an account?",
      
      // Account Page Keys
      personalInformation: "Personal Information",
      accountControls: "Account Controls",
      appearance: "Appearance",
      theme: "Theme",
      pushNotifications: "Push Notifications",
      taskDue: "Task Due",
      reminder: "Reminder",
      newMessage: "New Message",
      emailNotifications: "Email Notifications",
      tasksWidget: "Tasks Widget",
      calendarWidget: "Calendar Widget",
      remindersWidget: "Reminders Widget",
      dailyQuoteWidget: "Daily Quote Widget",
      quoteCategory: "Quote Category",
      inspirational: "Inspirational",
      motivational: "Motivational",
      islamic: "Islamic",
      sports: "Sports",
      generalInfo: "General Info",
      mixed: "Mixed",
      profileVisibility: "Profile Visibility",
      searchable: "Searchable",
      hidden: "Hidden",
      activityStatus: "Activity Status",
      manageBlockedUsers: "Manage Blocked Users",
      reportAbuse: "Report Abuse",
      submitFeedback: "Submit Feedback",
      subscriptionBilling: "Subscription & Billing",
      currentPlan: "Current Plan",
      trialEndsIn: "Trial ends in",
      days: "days",
      billingManagedThrough: "Billing managed through",
      manageBilling: "Manage Billing",
      cancelPlan: "Cancel Plan",
      changePassword: "Change Password",
      currentPassword: "Current Password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      deleteAccountWarning: "Delete Account Warning",
      thisActionIrreversible: "This action is irreversible",
      feedbackDescription: "Feedback Description",
      feedback: "Feedback",
      feedbackPlaceholder: "Feedback Placeholder",
      requestChange: "Request Change",
      trialPlan: "Trial Plan",
      monthlyPlan: "Monthly Plan",
      yearlyPlan: "Yearly Plan",
      freePlan: "Free Plan",
      daysLeft: "Days Left",
      trialReminder: "Trial Reminder",
      
      // Notification keys
      systemNotifications: "System Notifications",
      newEvent: "New Event",
      
      // Contact request keys
      contactRequestSettings: "Contact Request Settings",
      autoApproveRequests: "Auto-approve Requests",
      
      // Messaging system keys
      searchContacts: "Search contacts",
      noContactsFound: "No contacts found",
      selectConversation: "Select a conversation",
      typeMessage: "Type a message",
      recordVoice: "Record voice",
      stopRecording: "Stop recording",
      uploadImage: "Upload image",
      sendMessage: "Send message",
      imageTooLarge: "Image too large",
      transcript: "Transcript",
      expiresIn: "Expires in",
      onlineNow: "Online now",
      noConversations: "No conversations",
      filters: "Filters",
      
      // Voice Summary keys
      newRecording: "New Recording",
      recentRecordings: "Recent Recordings",
      meeting: "Meeting",
      lecture: "Lecture",
      brainstorm: "Brainstorm",
      other: "Other",
      hostName: "Host Name",
      attendeesNames: "Attendees Names",
      locationName: "Location Name",
      cleanAudio: "Clean Audio",
      noiseReduction: "Noise Reduction",
      skip: "Skip",
      next: "Next",
      untitledRecording: "Untitled Recording",
      selectType: "Select Type",
      hostOptional: "Host (optional)",
      attendeesOptional: "Attendees (optional)",
      locationOptional: "Location (optional)",
      separateWithCommas: "Separate with commas",
      whereTookPlace: "Where it took place",
      minutes: "minutes",
      ago: "ago",
      daysRemaining: "days remaining",
      viewDetails: "View Details",
      record: "Record",
      upload: "Upload",
      titleOptional: "Title (optional)",
      typeOptional: "Type (optional)",
      processingAudio: "Processing audio",
      transcribingAudio: "Transcribing audio",
      creatingSummary: "Creating summary",
      generateSummary: "Generate Summary",
      generateAudio: "Generate Audio",
      downloadTranscript: "Download Transcript",
      downloadSummary: "Download Summary",
      downloadAudio: "Download Audio",
      selectFile: "Select File",
      mp3orWavFormat: "MP3 or WAV format",
      noRecordingsFound: "No recordings found",
      firstRecording: "Make your first recording",
      exportAsPDF: "Export as PDF",
      exportAsAudio: "Export as Audio",
      summaryVoice: "Summary Voice",
      summaryLanguage: "Summary Language",
      male: "Male",
      female: "Female",
      arabic: "العربية",
      english: "الإنجليزية",
      transcriptTitle: "النص",
      summaryTitle: "الملخص",
      recordingDetails: "تفاصيل التسجيل",
      audioPlayerError: "خطأ في مشغل الصوت",
      waktiAssistant: "مساعد واكتي",
      taskManagement: "إدارة المهام",
      profile: "الملف الشخصي",
      billing: "الفواتير"
    }
  };

  return translations[lang]?.[key] || key;
}
