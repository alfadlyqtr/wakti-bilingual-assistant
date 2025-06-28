
/**
 * Task and reminder extraction for Wakti Edge Function
 */
import { DEEPSEEK_API_KEY, OPENAI_API_KEY } from "./utils.ts";

export async function analyzeTaskIntent(message: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();

  // ENHANCED: More flexible task keywords with partial matching
  const taskKeywordPatterns = [
    // Direct task creation phrases
    /\b(create|make|add|new)\s+(a\s+)?task/i,
    /\btask\s+(for|to|about)/i,
    /\b(help\s+me\s+)?(create|make|add)\s+(a\s+)?task/i,
    /\b(i\s+)?(want|need|have)\s+to\s+(create|make|add)\s+(a\s+)?task/i,
    /\b(can\s+you\s+)?(create|make|add)\s+(a\s+)?task/i,
    /\b(please\s+)?(create|make|add)\s+(a\s+)?task/i,
    // Arabic patterns
    /\b(أنشئ|اصنع|أضف)\s+(مهمة|مهام)/i,
    /\bمهمة\s+(ل|عن|في)/i,
    /\b(ساعدني\s+في\s+)?(إنشاء|صنع|إضافة)\s+مهمة/i,
    /\b(أريد|أحتاج)\s+(إنشاء|صنع|إضافة)\s+مهمة/i
  ];

  // ENHANCED: More flexible reminder keywords with partial matching
  const reminderKeywordPatterns = [
    // Direct reminder creation phrases
    /\b(create|make|add|set|new)\s+(a\s+)?reminder/i,
    /\breminder\s+(for|to|about)/i,
    /\bremind\s+me\s+(to|about|of)/i,
    /\b(help\s+me\s+)?(create|make|add|set)\s+(a\s+)?reminder/i,
    /\b(i\s+)?(want|need|have)\s+to\s+(create|make|add|set)\s+(a\s+)?reminder/i,
    /\b(can\s+you\s+)?(create|make|add|set)\s+(a\s+)?reminder/i,
    /\b(please\s+)?(create|make|add|set)\s+(a\s+)?reminder/i,
    // Arabic patterns
    /\b(أنشئ|اصنع|أضف)\s+(تذكير|تذكيرات)/i,
    /\bتذكير\s+(ل|عن|في)/i,
    /\b(ذكرني|ذكريني)\s+(أن|ب)/i,
    /\b(ساعدني\s+في\s+)?(إنشاء|صنع|إضافة)\s+تذكير/i
  ];

  // Check for task creation patterns
  const isTaskMatch = taskKeywordPatterns.some(pattern => pattern.test(message));
  const isReminderMatch = reminderKeywordPatterns.some(pattern => pattern.test(message));

  let isTask = false;
  let isReminder = false;

  // ENHANCED: Better pattern matching logic
  if (isTaskMatch && !isReminderMatch) {
    isTask = true;
  } else if (isReminderMatch && !isTaskMatch) {
    isReminder = true;
  } else if (isTaskMatch && isReminderMatch) {
    // If both patterns match, prefer task creation
    isTask = true;
  }

  // FALLBACK: Check for action-oriented phrases that could be tasks
  if (!isTask && !isReminder) {
    const actionPatterns = [
      /\b(i\s+need\s+to|i\s+have\s+to|i\s+should|i\s+must)\s+.+\s+(tomorrow|today|next\s+week|at\s+\d)/i,
      /\b(buy|get|pick\s+up|purchase|shop\s+for)\s+.+\s+(tomorrow|today|at\s+\d)/i,
      /\b(call|contact|email|text|message)\s+.+\s+(tomorrow|today|at\s+\d)/i,
      /\b(go\s+to|visit|attend)\s+.+\s+(tomorrow|today|at\s+\d)/i,
      // Arabic action patterns
      /\b(يجب\s+أن|أحتاج\s+إلى|علي\s+أن)\s+.+\s+(غداً|اليوم|في\s+الساعة)/i,
      /\b(اشتري|احضر|اذهب\s+إلى)\s+.+\s+(غداً|اليوم|في\s+الساعة)/i
    ];

    // Only consider these as tasks if they have time/date context
    const hasTimeContext = actionPatterns.some(pattern => pattern.test(message));
    if (hasTimeContext) {
      isTask = true;
    }
  }

  if (!isTask && !isReminder) {
    return { isTask: false, isReminder: false };
  }

  // --- AI-powered extraction using DeepSeek preferred, fallback to OpenAI ---
  let extractionOk = false;
  let aiExtracted: any = {};

  const todayISO = new Date().toISOString().split('T')[0];
  const systemPrompt = language === 'ar'
    ? "ساعدني في استخراج الحقول المنظمة من نص عبارة عن طلب مهمة أو تذكير."
    : "Help me extract structured fields from a user's to-do or reminder request.";
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
- title (short task intent/action),
- description (only if present; otherwise empty),
- due_date (YYYY-MM-DD),
- due_time (24hr format HH:MM, if present),
- subtasks (as an array, extracted from shopping lists, comma/and/bullet separated, etc.),
- priority ("normal" or "high")

Return ONLY this JSON, with no comments:
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
        } catch (e) {
          // Try cleaning up code blocks
          const jsonStr = reply.replace(/^```(json)?/,'').replace(/```$/,'').trim();
          try {
            aiExtracted = JSON.parse(jsonStr);
            extractionOk = true;
          } catch (e2) {
            extractionOk = false;
          }
        }
      }
    } catch (e) {
      extractionOk = false;
    }
  }

  // Fallback to OpenAI if DeepSeek not available or failed
  if (!extractionOk && OPENAI_API_KEY) {
    try {
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
        } catch (e) {
          // Try to cleanup codeblocks or extra output:
          const jsonStr = reply.replace(/^```(json)?/,'').replace(/```$/,'').trim();
          try {
            aiExtracted = JSON.parse(jsonStr);
            extractionOk = true;
          } catch (e2) {
            extractionOk = false;
          }
        }
      }
    } catch (err) {
      extractionOk = false;
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

  // --- FALLBACK LEGACY REGEX LOGIC ---
  
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
  // 4. ENHANCED: Extract from natural language patterns
  if (!title) {
    // Try to extract from "create a task for X" patterns
    const naturalTitlePatterns = [
      /(?:create|make|add)\s+(?:a\s+)?task\s+(?:for|to|about)\s+([^,\n]*)/i,
      /(?:أنشئ|اصنع|أضف)\s+مهمة\s+(?:ل|عن|في)\s+([^,\n]*)/i,
    ];
    
    for (const pattern of naturalTitlePatterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim()) {
        title = match[1].trim();
        break;
      }
    }
  }
  // 5. Fallback, if still empty, remove all keywords and subtasks, try picking a main phrase.
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

  return {
    isTask,
    isReminder,
    taskData: isTask ? taskData : null,
    reminderData: isReminder ? reminderData : null
  };
}
