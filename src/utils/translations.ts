import { TranslationKey } from "./translationTypes";

const translations: Record<TranslationKey, { en: string; ar: string }> = {
  appName: {
    en: "WAKTI",
    ar: "وقتي"
  },
  tagline: {
    en: "Your time, simplified",
    ar: "وقتك، ببساطة"
  },
  description: {
    en: "Manage tasks, events, and more with ease.",
    ar: "إدارة المهام والأحداث والمزيد بكل سهولة."
  },
  
  // Onboarding
  onboardingTitle1: {
    en: "Welcome to WAKTI",
    ar: "مرحبًا بك في وقتي"
  },
  onboardingSubtitle1: {
    en: "Your personal assistant for managing tasks, events, and more.",
    ar: "مساعدك الشخصي لإدارة المهام والأحداث والمزيد."
  },
  onboardingTitle2: {
    en: "Stay Organized",
    ar: "ابق منظمًا"
  },
  onboardingSubtitle2: {
    en: "Keep track of your schedule and never miss an important deadline.",
    ar: "تتبع جدولك الزمني ولا تفوت أي موعد نهائي مهم."
  },
  onboardingTitle3: {
    en: "Get Reminders",
    ar: "احصل على تذكيرات"
  },
  onboardingSubtitle3: {
    en: "Receive timely reminders so you're always prepared.",
    ar: "تلقي تذكيرات في الوقت المناسب حتى تكون مستعدًا دائمًا."
  },
  getStarted: {
    en: "Get Started",
    ar: "ابدأ الآن"
  },

  // General UI
  ok: {
    en: "OK",
    ar: "موافق"
  },
  cancel: {
    en: "Cancel",
    ar: "إلغاء"
  },
  confirm: {
    en: "Confirm",
    ar: "تأكيد"
  },
  switchMode: {
    en: "Switch Mode",
    ar: "تبديل الوضع"
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
    ar: "إنشاء حدث"
  },
  viewCalendar: {
    en: "View Calendar",
    ar: "عرض التقويم"
  },
  clearHistory: {
    en: "Clear History",
    ar: "مسح السجل"
  },
  searchChats: {
    en: "Search Chats",
    ar: "البحث في الدردشات"
  },
  noChatsFound: {
    en: "No chats found",
    ar: "لم يتم العثور على دردشات"
  },
  noChatsYet: {
    en: "No chats yet",
    ar: "لا توجد دردشات حتى الآن"
  },
  chatHistory: {
    en: "Chat History",
    ar: "سجل الدردشة"
  },
  instructions: {
    en: "Instructions",
    ar: "تعليمات"
  },
  knowledge: {
    en: "Knowledge",
    ar: "المعرفة"
  },
  settings: {
    en: "Settings",
    ar: "إعدادات"
  },
  
  // AI Assistant modes
  chatMode: {
    en: "Chat",
    ar: "دردشة"
  },
  typeMode: {
    en: "Type",
    ar: "كتابة"
  },
  createMode: {
    en: "Create",
    ar: "إنشاء"
  },
  planMode: {
    en: "Plan",
    ar: "تخطيط"
  },
  mode: {
    en: "Mode",
    ar: "وضع"
  },
  
  // AI Assistant mode settings
  chatSettings: {
    en: "Chat Settings",
    ar: "إعدادات الدردشة"
  },
  typeSettings: {
    en: "Type Settings",
    ar: "إعدادات الكتابة"
  },
  createSettings: {
    en: "Create Settings",
    ar: "إعدادات الإنشاء"
  },
  planSettings: {
    en: "Plan Settings",
    ar: "إعدادات التخطيط"
  },
  
  // AI Assistant mode instructions
  chatInstructions: {
    en: "Ask me anything or chat casually. I can answer questions, explain concepts, or just have a conversation.",
    ar: "اسألني أي شيء أو دردش بشكل عادي. يمكنني الإجابة على الأسئلة أو شرح المفاهيم أو مجرد إجراء محادثة."
  },
  typeInstructions: {
    en: "I can help write, edit, and format text documents. Share what you need help with.",
    ar: "يمكنني المساعدة في كتابة وتحرير وتنسيق المستندات النصية. شارك ما تحتاج المساعدة فيه."
  },
  createInstructions: {
    en: "Describe the visual content you want to create. I can help with design ideas and image concepts.",
    ar: "صف المحتوى المرئي الذي تريد إنشاءه. يمكنني المساعدة في أفكار التصميم ومفاهيم الصورة."
  },
  planInstructions: {
    en: "Let me help you organize tasks, events, and reminders. Tell me what you need scheduled.",
    ar: "دعني أساعدك في تنظيم المهام والأحداث والتذكيرات. أخبرني بما تحتاج إلى جدولته."
  },
  
  // Mode switching
  thisActionWorksBetterIn: {
    en: "This action works better in",
    ar: "هذا الإجراء يعمل بشكل أفضل في"
  },
  letsSwitchModes: {
    en: "Let's switch modes?",
    ar: "هل ننتقل إلى وضع آخر؟"
  },
  
  // Common Questions
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
    ar: "كيف يمكنني إنشاء مهمة؟"
  },
  explainWAKTIFeatures: {
    en: "Explain WAKTI's features",
    ar: "اشرح ميزات وقتي"
  },
  
  // Tone Presets
  tonePresets: {
    en: "Tone Presets",
    ar: "إعدادات مسبقة للنبرة"
  },
  professional: {
    en: "Professional",
    ar: "احترافي"
  },
  casual: {
    en: "Casual",
    ar: "عادي"
  },
  friendly: {
    en: "Friendly",
    ar: "ودود"
  },
  academic: {
    en: "Academic",
    ar: "أكاديمي"
  },
  
  // Length Options
  lengthOptions: {
    en: "Length Options",
    ar: "خيارات الطول"
  },
  short: {
    en: "Short",
    ar: "قصير"
  },
  medium: {
    en: "Medium",
    ar: "متوسط"
  },
  long: {
    en: "Long",
    ar: "طويل"
  },
  
  // Grammar Check
  grammarCheck: {
    en: "Grammar Check",
    ar: "تدقيق نحوي"
  },
  
  // Image Tools
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
  
  // Chart Types
  chartTypes: {
    en: "Chart Types",
    ar: "أنواع الرسوم البيانية"
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
  
  // Shortcuts
  shortcuts: {
    en: "Shortcuts",
    ar: "اختصارات"
  },
  
  // Language Switching
  switchLanguage: {
    en: "Switch Language",
    ar: "تبديل اللغة"
  },
  
  // Task Properties
  taskTitle: {
    en: "Task Title",
    ar: "عنوان المهمة"
  },
  dueDate: {
    en: "Due Date",
    ar: "تاريخ الاستحقاق"
  },
  priority: {
    en: "Priority",
    ar: "الأولوية"
  },
};

export const t = (key: TranslationKey, language: string): string => {
  if (!translations[key]) {
    console.warn(`Translation key "${key}" not found`);
    return key;
  }
  
  return language === "ar" ? translations[key].ar : translations[key].en;
};
