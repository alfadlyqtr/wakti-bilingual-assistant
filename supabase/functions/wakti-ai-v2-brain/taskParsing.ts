
/**
 * SIMPLIFIED: Task detection with proper JSON parsing
 */

export async function analyzeTaskIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();

  // Simple keyword matching - no AI needed for basic detection
  const taskKeywords = {
    en: ['create task', 'make task', 'add task', 'new task'],
    ar: ['أنشئ مهمة', 'اضف مهمة', 'مهمة جديدة']
  };

  const reminderKeywords = {
    en: ['create reminder', 'make reminder', 'add reminder', 'remind me'],
    ar: ['أنشئ تذكير', 'اضف تذكير', 'ذكرني']
  };

  const isTask = taskKeywords[language as 'en' | 'ar']?.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  ) || taskKeywords.en.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );

  const isReminder = reminderKeywords[language as 'en' | 'ar']?.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  ) || reminderKeywords.en.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );

  if (!isTask && !isReminder) {
    return { isTask: false, isReminder: false };
  }

  // Simple data extraction
  const taskData = {
    title: message.replace(/^(create task|make task|add task|new task|أنشئ مهمة|اضف مهمة|مهمة جديدة):\s*/i, '').trim() || 
           (language === 'ar' ? 'مهمة بدون عنوان' : 'Untitled Task'),
    description: "",
    due_date: null,
    due_time: null,
    subtasks: [],
    priority: "normal"
  };

  return {
    isTask,
    isReminder,
    taskData: isTask ? taskData : null,
    reminderData: isReminder ? taskData : null
  };
}
