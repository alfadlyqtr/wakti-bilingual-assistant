
/**
 * PHASE 2 FIX: Simplified task parsing - main logic moved to process-ai-intent
 * This file now only provides utility functions for the main AI brain
 */

export async function analyzeTaskIntent(message: string, language: string = 'en') {
  console.log('🎯 TASK ANALYSIS: Checking for explicit commands (SIMPLIFIED)');
  console.log('📝 MESSAGE:', message.substring(0, 100) + '...');

  // PHASE 2 FIX: Main AI brain should NOT detect tasks automatically
  // Task creation is handled by process-ai-intent function only
  console.log('❌ NO TASK DETECTION: Task creation handled by separate function');
  
  return { 
    isTask: false, 
    isReminder: false, 
    taskData: null, 
    reminderData: null 
  };
}

// Utility function for explicit task command detection (for reference)
export function isExplicitTaskCommand(message: string, language: string = 'en'): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const explicitTaskPatterns = {
    en: [
      /^(please\s+)?(create|make|add|new)\s+(a\s+)?task\s*:?\s*(.{10,})/i,
      /^(can\s+you\s+)?(create|make|add)\s+(a\s+)?task\s+(for|about|to|that)\s+(.{10,})/i,
      /^(i\s+need\s+)?(a\s+)?(new\s+)?task\s+(for|about|to|that)\s+(.{10,})/i,
      /^task\s*:\s*(.{10,})/i,
      /^add\s+task\s*:?\s*(.{10,})/i,
    ],
    ar: [
      /^(من\s+فضلك\s+)?(أنشئ|اعمل|أضف|مهمة\s+جديدة)\s*(مهمة)?\s*:?\s*(.{10,})/i,
      /^(هل\s+يمكنك\s+)?(إنشاء|عمل|إضافة)\s+(مهمة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{10,})/i,
      /^(أحتاج\s+)?(إلى\s+)?(مهمة\s+جديدة)\s+(لـ|حول|من\s+أجل|بخصوص)\s+(.{10,})/i,
      /^مهمة\s*:\s*(.{10,})/i,
      /^أضف\s+مهمة\s*:?\s*(.{10,})/i,
    ]
  };

  const taskPatterns = explicitTaskPatterns[language as 'en' | 'ar'] || explicitTaskPatterns.en;
  
  return taskPatterns.some(pattern => pattern.test(message));
}
