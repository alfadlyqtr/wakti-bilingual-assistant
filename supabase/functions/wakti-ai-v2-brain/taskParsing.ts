
/**
 * RESTORED TASK PARSING: Proper task creation flow with existing UI
 * This file provides task parsing functions that work with the existing task confirmation UI
 */

export async function analyzeTaskIntent(message: string, language: string = 'en') {
  console.log('🎯 TASK ANALYSIS: Checking for explicit task commands');
  console.log('📝 MESSAGE:', message.substring(0, 100) + '...');

  // Check for explicit task creation commands
  const isExplicitTask = isExplicitTaskCommand(message, language);
  
  if (isExplicitTask) {
    console.log('✅ EXPLICIT TASK COMMAND DETECTED');
    
    // Extract task details from the message
    const taskData = extractTaskDetails(message, language);
    
    return { 
      isTask: true, 
      isReminder: false, 
      taskData: taskData, 
      reminderData: null 
    };
  }
  
  // Check for reminder commands
  const isExplicitReminder = isExplicitReminderCommand(message, language);
  
  if (isExplicitReminder) {
    console.log('✅ EXPLICIT REMINDER COMMAND DETECTED');
    
    const reminderData = extractReminderDetails(message, language);
    
    return { 
      isTask: false, 
      isReminder: true, 
      taskData: null, 
      reminderData: reminderData 
    };
  }
  
  console.log('❌ NO TASK OR REMINDER COMMAND DETECTED');
  return { 
    isTask: false, 
    isReminder: false, 
    taskData: null, 
    reminderData: null 
  };
}

// Enhanced explicit task command detection as specified
export function isExplicitTaskCommand(message: string, language: string = 'en'): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  // More precise English explicit task patterns
  const englishTaskPatterns = [
    /^(please\s+)?(create|make|add|new)\s+(a\s+)?task\s*:?\s*(.{5,})/i,
    /^(can\s+you\s+)?(create|make|add)\s+(a\s+)?task\s+(for|about|to|that)\s+(.{5,})/i,
    /^(i\s+need\s+)?(a\s+)?(new\s+)?task\s+(for|about|to|that)\s+(.{5,})/i,
    /^task\s*:\s*(.{5,})/i,
    /^add\s+task\s*:?\s*(.{5,})/i,
    /^create\s+task\s*:?\s*(.{5,})/i,
    /^make\s+task\s*:?\s*(.{5,})/i
  ];
  
  // More precise Arabic explicit task patterns
  const arabicTaskPatterns = [
    /^(من\s+فضلك\s+)?(أنشئ|اعمل|أضف|مهمة\s+جديدة)\s*(مهمة)?\s*:?\s*(.{5,})/i,
    /^(هل\s+يمكنك\s+)?(إنشاء|عمل|إضافة)\s+(مهمة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{5,})/i,
    /^(أحتاج\s+)?(إلى\s+)?(مهمة\s+جديدة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{5,})/i,
    /^مهمة\s*:\s*(.{5,})/i,
    /^أضف\s+مهمة\s*:?\s*(.{5,})/i,
    /^أنشئ\s+مهمة\s*:?\s*(.{5,})/i,
    /^اعمل\s+مهمة\s*:?\s*(.{5,})/i
  ];

  const allPatterns = [...englishTaskPatterns, ...arabicTaskPatterns];
  return allPatterns.some(pattern => pattern.test(message));
}

// Enhanced explicit reminder command detection
export function isExplicitReminderCommand(message: string, language: string = 'en'): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const englishReminderPatterns = [
    /^(please\s+)?(remind|reminder)\s+me\s+(to|about|that)\s+(.{5,})/i,
    /^(can\s+you\s+)?remind\s+me\s+(to|about|that)\s+(.{5,})/i,
    /^(create|make|add|new)\s+(a\s+)?reminder\s*:?\s*(.{5,})/i,
    /^reminder\s*:\s*(.{5,})/i,
    /^set\s+reminder\s*:?\s*(.{5,})/i
  ];
  
  const arabicReminderPatterns = [
    /^(من\s+فضلك\s+)?(ذكرني|تذكير)\s+(بـ|أن|عن)\s+(.{5,})/i,
    /^(هل\s+يمكنك\s+)?تذكيري\s+(بـ|أن|عن)\s+(.{5,})/i,
    /^(أنشئ|اعمل|أضف)\s+(تذكير)\s*:?\s*(.{5,})/i,
    /^تذكير\s*:\s*(.{5,})/i,
    /^اضبط\s+تذكير\s*:?\s*(.{5,})/i
  ];

  const allPatterns = [...englishReminderPatterns, ...arabicReminderPatterns];
  return allPatterns.some(pattern => pattern.test(message));
}

// Extract task details from message
function extractTaskDetails(message: string, language: string) {
  console.log('📋 EXTRACTING TASK DETAILS from:', message);
  
  // Remove task command prefixes to get the actual task content
  let taskContent = message
    .replace(/^(please\s+)?(create|make|add|new)\s+(a\s+)?task\s*:?\s*/i, '')
    .replace(/^(can\s+you\s+)?(create|make|add)\s+(a\s+)?task\s+(for|about|to|that)\s+/i, '')
    .replace(/^(i\s+need\s+)?(a\s+)?(new\s+)?task\s+(for|about|to|that)\s+/i, '')
    .replace(/^task\s*:\s*/i, '')
    .replace(/^add\s+task\s*:?\s*/i, '')
    .replace(/^create\s+task\s*:?\s*/i, '')
    .replace(/^make\s+task\s*:?\s*/i, '')
    // Arabic patterns
    .replace(/^(من\s+فضلك\s+)?(أنشئ|اعمل|أضف|مهمة\s+جديدة)\s*(مهمة)?\s*:?\s*/i, '')
    .replace(/^(هل\s+يمكنك\s+)?(إنشاء|عمل|إضافة)\s+(مهمة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+/i, '')
    .replace(/^(أحتاج\s+)?(إلى\s+)?(مهمة\s+جديدة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+/i, '')
    .replace(/^مهمة\s*:\s*/i, '')
    .replace(/^أضف\s+مهمة\s*:?\s*/i, '')
    .replace(/^أنشئ\s+مهمة\s*:?\s*/i, '')
    .replace(/^اعمل\s+مهمة\s*:?\s*/i, '')
    .trim();

  // Extract title (first part before any time/date mentions)
  let title = taskContent;
  let description = '';
  let dueDate = null;
  let dueTime = null;
  let priority = 'normal';
  let subtasks: string[] = [];

  // Look for time patterns to extract due date/time
  const timePatterns = [
    // English patterns
    /\b(tomorrow|today|next week|next month)\b/gi,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    /\b(\d{1,2}:\d{2}\s?(am|pm|AM|PM))\b/g,
    /\b(at\s+\d{1,2}(:\d{2})?\s?(am|pm|AM|PM)?)\b/gi,
    /\b(by\s+\d{1,2}(:\d{2})?\s?(am|pm|AM|PM)?)\b/gi,
    // Arabic patterns
    /\b(غداً|اليوم|الأسبوع القادم|الشهر القادم)\b/gi,
    /\b(الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)\b/gi,
    /\b(في\s+الساعة\s+\d{1,2}(:\d{2})?)\b/gi,
    /\b(قبل\s+الساعة\s+\d{1,2}(:\d{2})?)\b/gi
  ];

  // Extract time information
  timePatterns.forEach(pattern => {
    const matches = taskContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (match.toLowerCase().includes('tomorrow') || match.includes('غداً')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dueDate = tomorrow.toISOString().split('T')[0];
        }
        
        if (match.toLowerCase().includes('today') || match.includes('اليوم')) {
          dueDate = new Date().toISOString().split('T')[0];
        }
        
        // Extract time
        const timeMatch = match.match(/\d{1,2}:\d{2}|\d{1,2}\s?(am|pm|AM|PM)/);
        if (timeMatch) {
          dueTime = timeMatch[0];
        }
      });
      
      // Remove time information from title
      title = title.replace(pattern, '').trim();
    }
  });

  // Look for subtask indicators
  const subtaskPatterns = [
    /\b(and|also|then|plus|including)\s+(.+)/gi,
    /\b(و|أيضاً|ثم|بالإضافة إلى|يشمل)\s+(.+)/gi
  ];

  subtaskPatterns.forEach(pattern => {
    const matches = taskContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const subtaskContent = match.replace(/^(and|also|then|plus|including|و|أيضاً|ثم|بالإضافة إلى|يشمل)\s+/i, '').trim();
        if (subtaskContent.length > 3) {
          subtasks.push(subtaskContent);
        }
      });
      
      title = title.replace(pattern, '').trim();
    }
  });

  // Clean up title
  title = title.replace(/\s+/g, ' ').trim();
  
  // Set default title if empty
  if (!title) {
    title = language === 'ar' ? 'مهمة جديدة' : 'New Task';
  }

  const taskData = {
    title,
    description: description || title,
    due_date: dueDate,
    due_time: dueTime,
    priority,
    subtasks: subtasks.length > 0 ? subtasks : undefined
  };

  console.log('✅ EXTRACTED TASK DATA:', taskData);
  
  return taskData;
}

// Extract reminder details from message
function extractReminderDetails(message: string, language: string) {
  console.log('📋 EXTRACTING REMINDER DETAILS from:', message);
  
  // Remove reminder command prefixes
  let reminderContent = message
    .replace(/^(please\s+)?(remind|reminder)\s+me\s+(to|about|that)\s+/i, '')
    .replace(/^(can\s+you\s+)?remind\s+me\s+(to|about|that)\s+/i, '')
    .replace(/^(create|make|add|new)\s+(a\s+)?reminder\s*:?\s*/i, '')
    .replace(/^reminder\s*:\s*/i, '')
    .replace(/^set\s+reminder\s*:?\s*/i, '')
    // Arabic patterns
    .replace(/^(من\s+فضلك\s+)?(ذكرني|تذكير)\s+(بـ|أن|عن)\s+/i, '')
    .replace(/^(هل\s+يمكنك\s+)?تذكيري\s+(بـ|أن|عن)\s+/i, '')
    .replace(/^(أنشئ|اعمل|أضف)\s+(تذكير)\s*:?\s*/i, '')
    .replace(/^تذكير\s*:\s*/i, '')
    .replace(/^اضبط\s+تذكير\s*:?\s*/i, '')
    .trim();

  const reminderData = {
    title: reminderContent || (language === 'ar' ? 'تذكير جديد' : 'New Reminder'),
    description: reminderContent,
    reminder_time: null,
    recurring: false
  };

  console.log('✅ EXTRACTED REMINDER DATA:', reminderData);
  
  return reminderData;
}
