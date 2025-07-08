
/**
 * PHASE 1 FIX: Enhanced task detection with explicit command requirement
 * Only triggers on clear, explicit task creation commands with sufficient detail
 */

export async function analyzeTaskIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase().trim();
  
  console.log('🎯 ENHANCED TASK ANALYSIS: Checking for explicit commands');
  console.log('📝 MESSAGE:', lowerMessage.substring(0, 100) + '...');

  // PHASE 1 FIX: Require explicit task creation commands
  // Must be clear intent + sufficient detail (10+ characters after command)
  const explicitTaskPatterns = {
    en: [
      // Direct commands with colon or clear structure
      /^(please\s+)?(create|make|add|new)\s+(a\s+)?task\s*:?\s*(.{10,})/i,
      /^(can\s+you\s+)?(create|make|add)\s+(a\s+)?task\s+(for|about|to|that)\s+(.{10,})/i,
      /^(i\s+need\s+)?(a\s+)?(new\s+)?task\s+(for|about|to|that)\s+(.{10,})/i,
      /^task\s*:\s*(.{10,})/i, // "Task: [details]"
      /^add\s+task\s*:?\s*(.{10,})/i, // "Add task: [details]"
    ],
    ar: [
      // Arabic explicit commands
      /^(من\s+فضلك\s+)?(أنشئ|اعمل|أضف|مهمة\s+جديدة)\s*(مهمة)?\s*:?\s*(.{10,})/i,
      /^(هل\s+يمكنك\s+)?(إنشاء|عمل|إضافة)\s+(مهمة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{10,})/i,
      /^(أحتاج\s+)?(إلى\s+)?(مهمة\s+جديدة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{10,})/i,
      /^مهمة\s*:\s*(.{10,})/i, // "مهمة: [تفاصيل]"
      /^أضف\s+مهمة\s*:?\s*(.{10,})/i, // "أضف مهمة: [تفاصيل]"
    ]
  };

  const explicitReminderPatterns = {
    en: [
      // Direct reminder commands
      /^(please\s+)?(create|make|add|set)\s+(a\s+)?reminder\s*:?\s*(.{10,})/i,
      /^(remind\s+me\s+)(to\s+|about\s+|that\s+)(.{10,})/i,
      /^(can\s+you\s+)?(remind\s+me|set\s+a\s+reminder)\s+(to\s+|about\s+|that\s+)(.{10,})/i,
      /^reminder\s*:\s*(.{10,})/i, // "Reminder: [details]"
      /^set\s+reminder\s*:?\s*(.{10,})/i, // "Set reminder: [details]"
    ],
    ar: [
      // Arabic reminder commands
      /^(من\s+فضلك\s+)?(أنشئ|اعمل|أضف|اضبط)\s+(تذكير)\s*:?\s*(.{10,})/i,
      /^(ذكرني\s+)(أن\s+|بـ\s*|أنني\s+)(.{10,})/i,
      /^(هل\s+يمكنك\s+)?(تذكيري|ضبط\s+تذكير)\s+(أن\s+|بـ\s*|أنني\s+)(.{10,})/i,
      /^تذكير\s*:\s*(.{10,})/i, // "تذكير: [تفاصيل]"
      /^اضبط\s+تذكير\s*:?\s*(.{10,})/i, // "اضبط تذكير: [تفاصيل]"
    ]
  };

  // PHASE 1 FIX: Check for explicit task patterns with sufficient detail
  const taskPatterns = explicitTaskPatterns[language as 'en' | 'ar'] || explicitTaskPatterns.en;
  for (const pattern of taskPatterns) {
    const match = message.match(pattern);
    if (match) {
      const taskContent = match[match.length - 1]?.trim();
      
      // PHASE 1 FIX: Ensure sufficient detail (minimum 10 characters)
      if (taskContent && taskContent.length >= 10) {
        console.log('✅ EXPLICIT TASK COMMAND DETECTED:', {
          pattern: pattern.toString(),
          content: taskContent.substring(0, 50) + '...',
          contentLength: taskContent.length
        });
        
        return {
          isTask: true,
          isReminder: false,
          taskData: {
            title: taskContent,
            description: '',
            due_date: null,
            due_time: null,
            subtasks: [],
            priority: "normal"
          },
          reminderData: null
        };
      } else {
        console.log('❌ TASK COMMAND TOO VAGUE: Insufficient detail provided');
      }
    }
  }

  // PHASE 1 FIX: Check for explicit reminder patterns with sufficient detail
  const reminderPatterns = explicitReminderPatterns[language as 'en' | 'ar'] || explicitReminderPatterns.en;
  for (const pattern of reminderPatterns) {
    const match = message.match(pattern);
    if (match) {
      const reminderContent = match[match.length - 1]?.trim();
      
      // PHASE 1 FIX: Ensure sufficient detail (minimum 10 characters)
      if (reminderContent && reminderContent.length >= 10) {
        console.log('✅ EXPLICIT REMINDER COMMAND DETECTED:', {
          pattern: pattern.toString(),
          content: reminderContent.substring(0, 50) + '...',
          contentLength: reminderContent.length
        });
        
        return {
          isTask: false,
          isReminder: true,
          taskData: null,
          reminderData: {
            title: reminderContent,
            description: '',
            due_date: null,
            due_time: null,
            priority: "normal"
          }
        };
      } else {
        console.log('❌ REMINDER COMMAND TOO VAGUE: Insufficient detail provided');
      }
    }
  }

  // PHASE 1 FIX: Reject casual mentions
  const casualMentions = {
    en: ['task', 'todo', 'remind', 'remember'],
    ar: ['مهمة', 'تذكير', 'تذكر', 'مهام']
  };

  const mentions = casualMentions[language as 'en' | 'ar'] || casualMentions.en;
  const hasCasualMention = mentions.some(word => lowerMessage.includes(word));
  
  if (hasCasualMention) {
    console.log('ℹ️ CASUAL MENTION DETECTED: Not a direct command, ignoring');
  }

  console.log('❌ NO EXPLICIT TASK/REMINDER COMMAND DETECTED');
  return { 
    isTask: false, 
    isReminder: false, 
    taskData: null, 
    reminderData: null 
  };
}
