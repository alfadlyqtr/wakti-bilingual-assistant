
// Enhanced Task Creation Service with Arabic/English Detection
interface TaskCreationTrigger {
  patterns: string[];
  language: 'en' | 'ar';
  confidence: number;
}

interface ParsedTaskData {
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high';
  dueDate?: Date;
  subtasks?: string[];
  language: 'en' | 'ar';
  confidence: number;
}

class EnhancedTaskCreationServiceClass {
  private readonly englishTriggers: string[] = [
    'create task', 'create a task', 'new task', 'add task', 'make task',
    'create reminder', 'add reminder', 'remind me', 'set reminder',
    'create todo', 'add todo', 'todo', 'to do',
    'schedule', 'plan', 'organize', 'manage'
  ];

  private readonly arabicTriggers: string[] = [
    'أنشئ مهمة', 'إنشاء مهمة', 'مهمة جديدة', 'أضف مهمة', 'اعمل مهمة',
    'أنشئ تذكير', 'أضف تذكير', 'ذكرني', 'اضبط تذكير', 'تذكير',
    'أنشئ تودو', 'أضف تودو', 'تودو', 'قائمة مهام',
    'جدول', 'خطط', 'نظم', 'إدارة', 'اجدولة'
  ];

  private readonly priorityKeywords = {
    high: {
      en: ['urgent', 'important', 'critical', 'asap', 'high priority', 'emergency'],
      ar: ['عاجل', 'مهم', 'حرج', 'فوري', 'أولوية عالية', 'طارئ']
    },
    low: {
      en: ['low priority', 'when possible', 'sometime', 'eventually', 'not urgent'],
      ar: ['أولوية منخفضة', 'عند الإمكان', 'في وقت ما', 'في النهاية', 'غير عاجل']
    }
  };

  // Check if message contains task creation triggers
  detectTaskCreationIntent(message: string): TaskCreationTrigger | null {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Check English triggers
    for (const trigger of this.englishTriggers) {
      if (normalizedMessage.includes(trigger.toLowerCase())) {
        return {
          patterns: [trigger],
          language: 'en',
          confidence: this.calculateConfidence(normalizedMessage, trigger, 'en')
        };
      }
    }
    
    // Check Arabic triggers
    for (const trigger of this.arabicTriggers) {
      if (normalizedMessage.includes(trigger)) {
        return {
          patterns: [trigger],
          language: 'ar',
          confidence: this.calculateConfidence(normalizedMessage, trigger, 'ar')
        };
      }
    }
    
    return null;
  }

  // Parse task data from message
  parseTaskFromMessage(message: string, language: 'en' | 'ar'): ParsedTaskData {
    const normalizedMessage = message.trim();
    
    // Extract title (remove trigger words)
    let title = this.extractTitle(normalizedMessage, language);
    
    // Extract priority
    const priority = this.extractPriority(normalizedMessage, language);
    
    // Extract due date
    const dueDate = this.extractDueDate(normalizedMessage, language);
    
    // Extract subtasks
    const subtasks = this.extractSubtasks(normalizedMessage, language);
    
    // Generate description
    const description = this.generateDescription(normalizedMessage, title, language);
    
    return {
      title,
      description,
      priority,
      dueDate,
      subtasks,
      language,
      confidence: 0.8 // Base confidence for parsed tasks
    };
  }

  private calculateConfidence(message: string, trigger: string, language: 'en' | 'ar'): number {
    let confidence = 0.6; // Base confidence
    
    // Boost confidence if trigger is at start of message
    if (message.startsWith(trigger.toLowerCase())) {
      confidence += 0.2;
    }
    
    // Boost confidence if message contains task-related keywords
    const taskKeywords = language === 'en' 
      ? ['deadline', 'due', 'complete', 'finish', 'priority']
      : ['موعد', 'انتهاء', 'إكمال', 'إنهاء', 'أولوية'];
    
    for (const keyword of taskKeywords) {
      if (message.includes(keyword)) {
        confidence += 0.1;
      }
    }
    
    // Cap at 0.95
    return Math.min(confidence, 0.95);
  }

  private extractTitle(message: string, language: 'en' | 'ar'): string {
    let title = message;
    
    // Remove trigger phrases
    const triggers = language === 'en' ? this.englishTriggers : this.arabicTriggers;
    
    for (const trigger of triggers) {
      const regex = new RegExp(trigger, 'gi');
      title = title.replace(regex, '').trim();
    }
    
    // Remove common connecting words
    const connectingWords = language === 'en' 
      ? ['to', 'for', 'about', 'regarding', ':']
      : ['إلى', 'لـ', 'حول', 'بخصوص', ':'];
    
    for (const word of connectingWords) {
      if (title.startsWith(word + ' ')) {
        title = title.substring(word.length + 1).trim();
      }
    }
    
    // Take first sentence or up to 100 characters
    const sentences = title.split(/[.!?]/);
    title = sentences[0].trim();
    
    if (title.length > 100) {
      title = title.substring(0, 100) + '...';
    }
    
    return title || (language === 'en' ? 'New Task' : 'مهمة جديدة');
  }

  private extractPriority(message: string, language: 'en' | 'ar'): 'low' | 'normal' | 'high' {
    const lowerMessage = message.toLowerCase();
    
    // Check for high priority keywords
    for (const keyword of this.priorityKeywords.high[language]) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return 'high';
      }
    }
    
    // Check for low priority keywords
    for (const keyword of this.priorityKeywords.low[language]) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return 'low';
      }
    }
    
    return 'normal';
  }

  private extractDueDate(message: string, language: 'en' | 'ar'): Date | undefined {
    const now = new Date();
    const lowerMessage = message.toLowerCase();
    
    // Today patterns
    const todayPatterns = language === 'en' 
      ? ['today', 'by today', 'end of today']
      : ['اليوم', 'بحلول اليوم', 'نهاية اليوم'];
    
    for (const pattern of todayPatterns) {
      if (lowerMessage.includes(pattern)) {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay;
      }
    }
    
    // Tomorrow patterns
    const tomorrowPatterns = language === 'en' 
      ? ['tomorrow', 'by tomorrow', 'next day']
      : ['غداً', 'غدا', 'بحلول غد', 'اليوم التالي'];
    
    for (const pattern of tomorrowPatterns) {
      if (lowerMessage.includes(pattern)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);
        return tomorrow;
      }
    }
    
    // Week patterns
    const weekPatterns = language === 'en' 
      ? ['this week', 'by week', 'end of week']
      : ['هذا الأسبوع', 'بحلول الأسبوع', 'نهاية الأسبوع'];
    
    for (const pattern of weekPatterns) {
      if (lowerMessage.includes(pattern)) {
        const endOfWeek = new Date(now);
        const daysUntilSunday = 7 - endOfWeek.getDay();
        endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
        endOfWeek.setHours(23, 59, 59, 999);
        return endOfWeek;
      }
    }
    
    return undefined;
  }

  private extractSubtasks(message: string, language: 'en' | 'ar'): string[] {
    const subtasks: string[] = [];
    
    // Look for numbered lists or bullet points
    const listPatterns = [
      /(?:^|\n)\s*[-*•]\s*(.+)/gm,  // Bullet points
      /(?:^|\n)\s*\d+[.)]\s*(.+)/gm, // Numbered lists
    ];
    
    for (const pattern of listPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const subtask = match[1].trim();
        if (subtask.length > 0 && subtask.length < 200) {
          subtasks.push(subtask);
        }
      }
    }
    
    return subtasks.slice(0, 5); // Limit to 5 subtasks
  }

  private generateDescription(message: string, title: string, language: 'en' | 'ar'): string {
    // If message is much longer than title, use remaining content as description
    const cleanMessage = message.replace(title, '').trim();
    
    if (cleanMessage.length > 50) {
      return cleanMessage.substring(0, 500); // Limit description length
    }
    
    return language === 'en' ? 'Created from AI conversation' : 'تم إنشاؤها من محادثة الذكي الاصطناعي';
  }

  // Check if AI response should trigger task creation
  shouldCreateTaskFromResponse(aiResponse: string, userMessage: string, language: 'en' | 'ar'): boolean {
    const lowerResponse = aiResponse.toLowerCase();
    
    const taskCreationPhrases = language === 'en' 
      ? ['i\'ll create a task', 'creating a task', 'task created', 'i\'ve created', 'adding to your tasks']
      : ['سأنشئ مهمة', 'أنشئ مهمة', 'تم إنشاء المهمة', 'أضفت إلى مهامك'];
    
    return taskCreationPhrases.some(phrase => lowerResponse.includes(phrase));
  }
}

export const EnhancedTaskCreationService = new EnhancedTaskCreationServiceClass();
