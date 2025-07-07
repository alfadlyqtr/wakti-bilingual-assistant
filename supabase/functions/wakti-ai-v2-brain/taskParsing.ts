
/**
 * FIXED: Task and reminder extraction with proper JSON parsing
 */

export async function analyzeTaskIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();

  // Enhanced task keyword patterns
  const taskKeywordPatterns = [
    /\b(create|make|add|new)\s+(a\s+)?task/i,
    /\btask\s+(for|to|about)/i,
    /\b(أنشئ|اصنع|أضف|أعمل)\s+(مهمة|مهام)/i,
    /\bمهمة\s+(ل|عن|في|حول)/i
  ];

  // Enhanced reminder keyword patterns
  const reminderKeywordPatterns = [
    /\b(create|make|add|set|new)\s+(a\s+)?reminder/i,
    /\breminder\s+(for|to|about)/i,
    /\bremind\s+me\s+(to|about|of)/i,
    /\b(أنشئ|اصنع|أضف|اعمل)\s+(تذكير|تذكيرات)/i,
    /\b(ذكرني|ذكريني|فكرني)\s+(أن|ب|في)/i
  ];

  // Check for task creation patterns
  const isTaskMatch = taskKeywordPatterns.some(pattern => pattern.test(message));
  const isReminderMatch = reminderKeywordPatterns.some(pattern => pattern.test(message));

  let isTask = false;
  let isReminder = false;

  if (isTaskMatch && !isReminderMatch) {
    isTask = true;
  } else if (isReminderMatch && !isTaskMatch) {
    isReminder = true;
  } else if (isTaskMatch && isReminderMatch) {
    isTask = true;
  }

  if (!isTask && !isReminder) {
    return { isTask: false, isReminder: false };
  }

  // AI-powered extraction using DeepSeek with proper error handling
  let extractionOk = false;
  let aiExtracted: any = {};

  const todayISO = new Date().toISOString().split('T')[0];
  
  const systemPrompt = language === 'ar'
    ? `أنت خبير في استخراج المهام والتذكيرات من النصوص. استخرج المعلومات وأعد JSON فقط بهذا التنسيق:
{
  "title": "العنوان الرئيسي",
  "description": "الوصف إذا وجد",
  "due_date": "YYYY-MM-DD",
  "due_time": "HH:MM",
  "subtasks": ["مهمة فرعية 1"],
  "priority": "normal"
}`
    : `You are an expert at extracting tasks and reminders from text. Return only JSON in this format:
{
  "title": "Main task title",
  "description": "Description if present",
  "due_date": "YYYY-MM-DD",
  "due_time": "HH:MM",
  "subtasks": ["subtask 1"],
  "priority": "normal"
}`;

  const userPrompt = `Today: ${todayISO}\n\nAnalyze: "${message}"\n\nReturn only JSON:`;

  // Get API keys
  const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

  // Try DeepSeek with proper JSON parsing
  if (DEEPSEEK_API_KEY) {
    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 512
        })
      });
      
      if (resp.ok) {
        // Safe JSON parsing
        const responseText = await resp.text();
        if (responseText && responseText.trim() !== '') {
          try {
            const dsData = JSON.parse(responseText);
            const reply = dsData.choices?.[0]?.message?.content || "";
            
            if (reply && reply.trim() !== '') {
              const cleanedReply = reply.replace(/^```(json)?/,'').replace(/```$/,'').trim();
              aiExtracted = JSON.parse(cleanedReply);
              extractionOk = true;
            }
          } catch (parseError) {
            console.warn('⚠️ DeepSeek JSON parsing failed:', parseError);
            extractionOk = false;
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ DeepSeek API error:', e);
      extractionOk = false;
    }
  }

  if (extractionOk && typeof aiExtracted === 'object' && aiExtracted.title) {
    const resultData = {
      title: aiExtracted.title || "",
      description: aiExtracted.description || "",
      due_date: aiExtracted.due_date || null,
      due_time: aiExtracted.due_time || null,
      subtasks: Array.isArray(aiExtracted.subtasks) ? aiExtracted.subtasks : [],
      priority: aiExtracted.priority || "normal"
    };

    if (isTask) {
      return {
        isTask,
        isReminder,
        taskData: resultData,
        reminderData: null
      };
    }
    if (isReminder) {
      return {
        isTask,
        isReminder,
        taskData: null,
        reminderData: resultData
      };
    }
  }

  // Fallback regex logic
  const taskData = {
    title: language === 'ar' ? 'مهمة بدون عنوان' : 'Untitled Task',
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
