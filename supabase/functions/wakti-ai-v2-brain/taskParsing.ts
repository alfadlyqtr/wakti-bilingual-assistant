/**
 * Task and reminder extraction for Wakti Edge Function
 */
import { DEEPSEEK_API_KEY, OPENAI_API_KEY } from "./utils.ts";

export async function analyzeTaskIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();

  // ENHANCED: More flexible task keywords that capture natural language
  const explicitTaskKeywords = [
    'create task', 'create a task', 'add task', 'add a task', 'make task', 'make a task',
    'new task', 'create todo', 'add todo', 'make todo', 'new todo',
    'help me create task', 'help me add task', 'help me make task',
    'i want to create task', 'i want to add task', 'i want to make task',
    'need to create task', 'need to add task', 'need to make task',
    'can you create task', 'can you add task', 'can you make task',
    'please create task', 'please add task', 'please make task',
    // ADDED: More natural language patterns
    'create a task for', 'add a task for', 'make a task for',
    'i need a task', 'create task:', 'add task:', 'make task:',
    'task for tomorrow', 'task for today', 'task to',
    // Arabic equivalents
    'أنشئ مهمة', 'اصنع مهمة', 'أضف مهمة', 'مهمة جديدة',
    'ساعدني في إنشاء مهمة', 'أريد إنشاء مهمة', 'أحتاج إنشاء مهمة',
    'مهمة لـ', 'مهمة غداً', 'مهمة اليوم'
  ];

  // ENHANCED: More flexible reminder keywords
  const explicitReminderKeywords = [
    'create reminder', 'create a reminder', 'add reminder', 'add a reminder', 
    'make reminder', 'make a reminder', 'new reminder',
    'help me create reminder', 'help me add reminder', 'help me make reminder',
    'i want to create reminder', 'i want to add reminder', 'i want to make reminder',
    'need to create reminder', 'need to add reminder', 'need to make reminder',
    'can you create reminder', 'can you add reminder', 'can you make reminder',
    'please create reminder', 'please add reminder', 'please make reminder',
    'remind me to', 'set reminder', 'schedule reminder',
    // ADDED: More natural language patterns
    'create a reminder for', 'add a reminder for', 'reminder for',
    'reminder to', 'remind me at', 'set a reminder',
    // Arabic equivalents
    'أنشئ تذكير', 'اصنع تذكير', 'أضف تذكير', 'تذكير جديد',
    'ذكرني أن', 'ذكرني ب', 'اجعل تذكير', 'تذكير لـ'
  ];

  // ENHANCED: Pattern matching for common task creation structures
  const taskPatterns = [
    /create\s+(?:a\s+)?task\s+(?:for|to)\s+/i,
    /add\s+(?:a\s+)?task\s+(?:for|to)\s+/i,
    /make\s+(?:a\s+)?task\s+(?:for|to)\s+/i,
    /task\s+(?:for|to)\s+.+(?:tomorrow|today|at\s+\d)/i,
    /i\s+need\s+(?:a\s+)?task\s+/i,
    /create\s+task:\s*/i,
    /add\s+task:\s*/i
  ];

  const reminderPatterns = [
    /remind\s+me\s+(?:to|at)\s+/i,
    /set\s+(?:a\s+)?reminder\s+/i,
    /create\s+(?:a\s+)?reminder\s+(?:for|to)\s+/i,
    /reminder\s+(?:for|to)\s+/i
  ];

  // Check for explicit keywords first
  const isExplicitTaskKeyword = explicitTaskKeywords.some(keyword => lowerMessage.includes(keyword));
  const isExplicitReminderKeyword = explicitReminderKeywords.some(keyword => lowerMessage.includes(keyword));

  // Check for pattern matches
  const isTaskPattern = taskPatterns.some(pattern => pattern.test(lowerMessage));
  const isReminderPattern = reminderPatterns.some(pattern => pattern.test(lowerMessage));

  let isTask = false;
  let isReminder = false;

  // ENHANCED: More flexible detection logic
  if ((isExplicitTaskKeyword || isTaskPattern) && !isExplicitReminderKeyword && !isReminderPattern) {
    isTask = true;
    console.log('🎯 TASK DETECTED: Explicit keyword or pattern match');
  } else if ((isExplicitReminderKeyword || isReminderPattern) && !isExplicitTaskKeyword && !isTaskPattern) {
    isReminder = true;
    console.log('⏰ REMINDER DETECTED: Explicit keyword or pattern match');
  } else if ((isExplicitTaskKeyword || isTaskPattern) && (isExplicitReminderKeyword || isReminderPattern)) {
    // If both are present, prefer task
    isTask = true;
    console.log('🎯 TASK DETECTED: Both present, preferring task');
  }

  if (!isTask && !isReminder) {
    console.log('❌ NO TASK/REMINDER DETECTED: Message does not match patterns');
    return { isTask: false, isReminder: false };
  }

  // --- ENHANCED AI-powered extraction using DeepSeek preferred, fallback to OpenAI ---
  let extractionOk = false;
  let aiExtracted: any = {};
  let providerTried: string = "";

  const todayISO = new Date().toISOString().split('T')[0];
  const systemPrompt = language === 'ar'
    ? "ساعدني في استخراج الحقول المنظمة من نص عبارة عن طلب مهمة أو تذكير."
    : "Help me extract structured fields from a user's task or reminder request.";
  
  const userPrompt = language === 'ar'
    ? `
اليوم: ${todayISO}
حلل رسالة المستخدم التالية. استخرج الحقول (title, description, due_date, due_time, subtasks (قائمة), priority).
- date بصيغة YYYY-MM-DD
- time بصيغة HH:MM (24)
أعد فقط JSON منظم، مثال:
{
  "title": "اذهب إلى فيستيفال سيتي مول",
  "description": "",
  "due_date": "2025-06-16",
  "due_time": "09:00",
  "subtasks": ["قميص أسود", "بنطال أسود", "حذاء أسود", "جوارب سوداء"],
  "priority": "normal"
}
رسالة المستخدم:
"${message}"
`
    : `
Today is: ${todayISO}
Analyze the following user message and extract:
- title (short task intent/action, clean and descriptive),
- description (only if present; otherwise empty),
- due_date (YYYY-MM-DD format),
- due_time (24hr format HH:MM, if present),
- subtasks (as an array, extracted from shopping lists, comma/and/bullet separated, etc.),
- priority ("normal" or "high")

Return ONLY this JSON, with no comments or markdown:
{
  "title": "...",
  "description": "...",
  "due_date": "...",
  "due_time": "...",
  "subtasks": [...],
  "priority": "normal"
}

User message:
"${message}"
`;

  // Try DeepSeek first if key is available
  if (DEEPSEEK_API_KEY) {
    try {
      providerTried = "deepseek";
      console.log('🤖 Using DeepSeek for task extraction');
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
          temperature: 0.0,
          max_tokens: 512
        })
      });
      if (resp.ok) {
        const dsData = await resp.json();
        const reply = dsData.choices?.[0]?.message?.content || "";
        try {
          aiExtracted = JSON.parse(reply);
          extractionOk = true;
          console.log('✅ DeepSeek extraction successful');
        } catch (e) {
          // Try cleaning up code blocks
          const jsonStr = reply.replace(/^```(json)?/,'').replace(/```$/,'').trim();
          try {
            aiExtracted = JSON.parse(jsonStr);
            extractionOk = true;
            console.log('✅ DeepSeek extraction successful (after cleanup)');
          } catch (e2) {
            extractionOk = false;
            console.log('❌ DeepSeek extraction failed');
          }
        }
      }
    } catch (e) {
      extractionOk = false;
      console.log('❌ DeepSeek API call failed:', e);
    }
  }

  // Fallback to OpenAI if DeepSeek not available or failed
  if (!extractionOk && OPENAI_API_KEY) {
    try {
      providerTried = "openai";
      console.log('🤖 Using OpenAI for task extraction');
      const apiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.0,
          max_tokens: 512
        }),
      });

      if (apiResp.ok) {
        const aiData = await apiResp.json();
        const reply = aiData.choices?.[0]?.message?.content || "";
        try {
          aiExtracted = JSON.parse(reply);
          extractionOk = true;
          console.log('✅ OpenAI extraction successful');
        } catch (e) {
          // Try to cleanup codeblocks or extra output:
          const jsonStr = reply.replace(/^```(json)?/,'').replace(/```$/,'').trim();
          try {
            aiExtracted = JSON.parse(jsonStr);
            extractionOk = true;
            console.log('✅ OpenAI extraction successful (after cleanup)');
          } catch (e2) {
            extractionOk = false;
            console.log('❌ OpenAI extraction failed');
          }
        }
      }
    } catch (err) {
      extractionOk = false;
      console.log('❌ OpenAI API call failed:', err);
    }
  }

  if (extractionOk && typeof aiExtracted === 'object' && aiExtracted.title) {
    const fill = (field: string, fallback: any) =>
      (typeof aiExtracted[field] === 'string' || Array.isArray(aiExtracted[field]))
        ? aiExtracted[field]
        : fallback;

    const resultData = {
      title: fill("title", ""),
      description: fill("description", ""),
      due_date: fill("due_date", null),
      due_time: fill("due_time", null),
      subtasks: Array.isArray(aiExtracted.subtasks) ? aiExtracted.subtasks : [],
      priority: fill("priority", "normal")
    };

    console.log('🎯 TASK EXTRACTION RESULT:', resultData);

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

  console.log('⚠️ AI extraction failed, using fallback regex logic');

  // Extract subtasks after the word 'subtask' or 'subtasks'
  let subtasks: string[] = [];
  let textForSubtasks = '';
  const subtaskRegex = /(subtask[s]?:?|مهام فرعية|subtasks?|مهام?)\s*([^\n]*)/i;
  const subtaskMatch = message.match(subtaskRegex);
  if (subtaskMatch && subtaskMatch[2]) {
    // Look for comma or Arabic comma
    textForSubtasks = subtaskMatch[2];
    subtasks = textForSubtasks.split(/[,،]/).map(s => s.trim()).filter(s => s.length > 0);
  }

  // Additionally, if there is "subtask X, Y, Z" in the middle of the message
  // but also some list items, combine them
  // e.g. "- item1\n- item2" (markdown) or "* item" or "• item"
  const listItems = message.match(/[-•*]\s*([^-•*\n]+)/g);
  if (listItems) {
    listItems.forEach(item => {
      const cleaned = item.replace(/[-•*]\s*/, '').trim();
      if (cleaned) subtasks.push(cleaned);
    });
  }

  // Remove duplicates from subtasks
  subtasks = [...new Set(subtasks)];

  // --- Title extraction ---
  // Look for "title X", or after "task", trim around
  let title = '';
  // 1. Try "title: ..." or "title ..." 
  const titleRegex = /(title[:\s]*|العنوان[:\s]*)([^,؛\n]*)/i;
  const titleMatch = message.match(titleRegex);
  if (titleMatch && titleMatch[2]) {
    title = titleMatch[2].trim();
  }
  // 2. Else, try after "task", e.g. "task X" or "مهمة X"
  if (!title) {
    const afterTaskRegex = /(task|مهمة)[:,]?\s*([^\n,،]*)/i;
    const taskMatch = message.match(afterTaskRegex);
    if (taskMatch && taskMatch[2]) {
      title = taskMatch[2].trim();
    }
  }
  // 3. Else, try looking for something before "subtask" or just after keywords
  if (!title && subtaskRegex.test(message)) {
    // Anything before "subtask ..."
    title = message.split(subtaskMatch[0])[0]
      .replace(/.*title[:,]?\s*/i, '')
      .replace(/.*task[:,]?\s*/i, '')
      .replace(/.*مهمة[:,]?\s*/i, '')
      .trim()
      .replace(/[,،]+$/, '');
  }
  // 4. Fallback, if still empty, remove all keywords and subtasks, try picking a main phrase.
  if (!title) {
    let fallback = message
      .replace(subtaskRegex, '')
      .replace(/(task|todo|reminder|remind|title|subtask|subtasks|do|need to|have to|must|create|for|at|في|على|مهمة|تذكير|العنوان|مهام فرعية)/gi, '')
      .replace(/[,،]+/g, ' ')
      .replace(/\s+/, ' ')
      .trim();
    if (fallback.length > 0) {
      title = fallback;
    } else {
      // Default fallback
      title = language === 'ar' ? 'مهمة بدون عنوان' : 'Untitled Task';
    }
  }

  // 5. Remove trailing times or dates from title
  title = title.replace(/\b(at|في)\s*\d{1,2}(:\d{2})?\s*(am|pm|ص|م)?/gi, '').replace(/\s+$/, '');

  // --- Description extraction (NOT extracted from user message at this time) ---
  let description = '';

  // --- Date & Time extraction ---
  let due_date = null;
  let due_time = null;
  // Standard patterns
  const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)?\b/gi;
  const dateTimeRegex = /(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|غداً|اليوم|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)/gi;
  const dateTimeMatches = message.match(dateTimeRegex);

  // Dates
  if (dateTimeMatches) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const match of dateTimeMatches) {
      const lower = match.toLowerCase();
      if (lower === 'today' || lower === 'اليوم') {
        due_date = today.toISOString().split('T')[0];
      } else if (lower === 'tomorrow' || lower === 'غداً') {
        due_date = tomorrow.toISOString().split('T')[0];
      }
      // Else, ignore for now (other dates not handled here: future enhancement)
    }
  }
  // If no date, fallback to tomorrow
  if (!due_date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    due_date = tomorrow.toISOString().split('T')[0];
  }

  // Times
  const timeMatch = message.match(timeRegex);
  if (timeMatch && timeMatch.length > 0) {
    // Take the first recognized time in the string
    const first = timeMatch[0];
    // Parse e.g. "9 AM", "09:00", "3pm"
    const parsed = first.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)?/i);
    if (parsed) {
      let hour = parseInt(parsed[1]);
      let minute = parsed[2] ? parseInt(parsed[2]) : 0;
      const suffix = parsed[3] ? parsed[3].toLowerCase() : '';
      if (suffix === 'pm' || suffix === 'م') {
        if (hour < 12) hour += 12;
      }
      if (suffix === 'am' || suffix === 'ص') {
        if (hour === 12) hour = 0;
      }
      // Format as "HH:MM"
      due_time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  }

  // --- Priority extraction ---
  let priority = 'normal';
  const urgentWords = ['urgent', 'asap', 'important', 'priority', 'عاجل', 'مهم', 'أولوية'];
  if (urgentWords.some(word => lowerMessage.includes(word))) {
    priority = 'high';
  }

  // Remove title parts from subtasks if user wrote "subtask: ...title..."
  subtasks = subtasks.filter(st => st && st.toLowerCase() !== title.toLowerCase());

  const taskData = {
    title,
    description,
    due_date,
    due_time,
    subtasks,
    priority
  };
  const reminderData = {
    title,
    description,
    due_date,
    due_time,
    priority
  };

  console.log('🎯 FALLBACK EXTRACTION RESULT:', isTask ? taskData : reminderData);

  return {
    isTask,
    isReminder,
    taskData: isTask ? taskData : null,
    reminderData: isReminder ? reminderData : null
  };
}
