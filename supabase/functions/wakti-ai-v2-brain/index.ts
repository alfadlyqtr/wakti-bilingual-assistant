
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") || "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";

console.log("🧠 WAKTI AI V2.5 BRAIN: Enhanced with task creation restoration");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🧠 Processing request with enhanced task creation...");

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: "Invalid authentication",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const requestBody = await req.json();
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      conversationHistory = [],
      activeTrigger = 'chat'
    } = requestBody;

    if (userId !== user.id) {
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🧠 Processing message for user:", user.id);
    console.log("🧠 Active trigger mode:", activeTrigger);

    // ENHANCED: Check for task confirmation first (from previous system)
    const confirmationPatterns = [
      /\b(go\s+ahead|yes|confirm|create\s+it|do\s+it|make\s+it)\b/i,
      /\b(go\s+ahead\s+(and\s+)?create)\b/i,
      /\b(create\s+the\s+task)\b/i,
      /\b(نعم|أنشئ|اعمل|موافق)\b/i
    ];

    const isConfirmation = confirmationPatterns.some(pattern => pattern.test(message));

    if (isConfirmation && conversationHistory && conversationHistory.length > 0) {
      console.log("🎯 Detected task confirmation, looking for previous task request");
      
      // Look for the most recent task creation request in conversation history
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const historyMessage = conversationHistory[i];
        if (historyMessage.role === 'user') {
          const taskData = extractTaskDataFromMessage(historyMessage.content);
          if (taskData && (taskData.title || taskData.hasTaskKeywords)) {
            console.log("🎯 Found previous task request, creating confirmation");
            
            return new Response(
              JSON.stringify({
                response: language === 'ar' 
                  ? `سأنشئ هذه المهمة لك:\n\n**${taskData.title}**\n${taskData.subtasks.length > 0 ? `\nالمهام الفرعية:\n${taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n${taskData.due_date ? `الموعد النهائي: ${taskData.due_date}` : ''}\n${taskData.due_time ? ` في ${taskData.due_time}` : ''}\n\nيرجى التأكيد إذا كنت تريد إنشاء هذه المهمة.`
                  : `I'll create this task for you:\n\n**${taskData.title}**\n${taskData.subtasks.length > 0 ? `\nSubtasks:\n${taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n${taskData.due_date ? `Due: ${taskData.due_date}` : ''}\n${taskData.due_time ? ` at ${taskData.due_time}` : ''}\n\nPlease confirm if you'd like me to create this task.`,
                intent: "parse_task",
                needsConfirmation: true,
                pendingTaskData: taskData,
                success: true
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // ENHANCED: Sophisticated task detection patterns (from previous system)
    const taskPatterns = [
      // Your specific formats
      /\b(create|add|make|new)\s+(a\s+)?task\s+(.+)/i,
      /\btask\s+due\s+(.+)/i,
      /\b(shopping\s+list|shop\s+at|go\s+shopping)\s*(.+)?/i,
      /\bsub\s+tasks?\s+(.+)/i,
      /\bdue\s+(tomorrow|today|tonight|this\s+\w+|next\s+\w+|\d+)/i,
      // General patterns
      /\b(buy|purchase|get|pick\s+up)\s+(.+)/i,
      /\bneed\s+to\s+(go|buy|get|shop|visit|pick\s+up)/i,
      /\bhave\s+to\s+(go|buy|get|shop|visit|pick\s+up)/i,
      /\bmust\s+(go|buy|get|shop|visit|pick\s+up)/i,
      /\bto\s+do\s+list/i,
      /\btodo/i,
      // Arabic patterns
      /\b(أنشئ|اضف|اعمل|جديد)\s+(مهمة|واجب)\s+(.+)/i,
      /\b(شراء|اشتري|احضر)\s+(.+)/i,
      /\b(قائمة\s+تسوق|تسوق)/i
    ];

    // Check if this is a task creation request
    const isTaskRequest = taskPatterns.some(pattern => pattern.test(message));
    
    if (isTaskRequest && activeTrigger === 'chat') {
      console.log("🎯 Detected task creation request");
      
      // Extract task details from the current message
      const taskData = extractTaskDataFromMessage(message);
      
      // Check if we need to ask for clarification
      if (!taskData.due_date || !taskData.priority) {
        const clarificationQuestions = generateClarificationQuestions(taskData, message, language);
        
        return new Response(
          JSON.stringify({
            response: clarificationQuestions.message,
            intent: "clarify_task",
            needsClarification: true,
            partialTaskData: taskData,
            missingFields: clarificationQuestions.missingFields,
            originalText: message,
            success: true
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // If we have enough info, return parsed task for confirmation
      return new Response(
        JSON.stringify({
          response: language === 'ar' 
            ? `لقد حضرت مهمة لك للمراجعة:\n\n**${taskData.title}**\n${taskData.subtasks.length > 0 ? `\nالمهام الفرعية:\n${taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n\nيرجى التأكيد إذا كنت تريد إنشاء هذه المهمة.`
            : `I've prepared a task for you to review:\n\n**${taskData.title}**\n${taskData.subtasks.length > 0 ? `\nSubtasks:\n${taskData.subtasks.map(s => `• ${s}`).join('\n')}` : ''}\n\nPlease confirm if you'd like me to create this task.`,
          intent: "parse_task",
          needsConfirmation: true,
          pendingTaskData: taskData,
          success: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle other trigger types (search, image) and general chat
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;

    switch (activeTrigger) {
      case 'search':
        const searchResult = await executeSearch(message, language);
        if (searchResult.success) {
          browsingUsed = true;
          browsingData = searchResult.data;
          response = await processWithAI(message, searchResult.context, language);
        } else {
          response = await processWithAI(message, null, language);
        }
        break;

      case 'image':
        try {
          const imageResult = await generateImageWithRunware(message, user.id, language);
          if (imageResult.success) {
            imageUrl = imageResult.imageUrl;
            response = language === 'ar' 
              ? `🎨 تم إنشاء الصورة بنجاح!\n\n**الوصف:** ${message}`
              : `🎨 Image generated successfully!\n\n**Prompt:** ${message}`;
          } else {
            response = language === 'ar' 
              ? `❌ عذراً، حدث خطأ في إنشاء الصورة. يرجى المحاولة مرة أخرى.`
              : `❌ Sorry, there was an error generating the image. Please try again.`;
          }
        } catch (error) {
          response = language === 'ar' 
            ? `❌ عذراً، حدث خطأ في إنشاء الصورة. يرجى المحاولة مرة أخرى.`
            : `❌ Sorry, there was an error generating the image. Please try again.`;
        }
        break;

      case 'chat':
      default:
        response = await processWithAI(message, null, language);
        break;
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: "general_chat",
      confidence: "high",
      imageUrl,
      browsingUsed,
      browsingData,
      success: true
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🧠 Error in enhanced AI brain:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error occurred',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// ENHANCED: Sophisticated task data extraction (from previous system)
function extractTaskDataFromMessage(text: string) {
  const lowerText = text.toLowerCase();
  
  let title = "";
  let subtasks: string[] = [];
  let due_date = null;
  let due_time = null;
  let priority = "normal";
  let hasTaskKeywords = false;

  // Check for task keywords (both English and Arabic)
  if (lowerText.includes('task') || lowerText.includes('shopping') || lowerText.includes('buy') || 
      lowerText.includes('get') || lowerText.includes('sub tasks') || lowerText.includes('مهمة') || 
      lowerText.includes('تسوق') || lowerText.includes('شراء')) {
    hasTaskKeywords = true;
  }

  // Extract shopping list format: "shopping list lulu" or "shopping at lulu"
  const shoppingMatch = text.match(/\b(shopping\s+list|shop\s+at|shopping\s+at|قائمة\s+تسوق|تسوق\s+في)\s+([^,\.\s]+)/i);
  if (shoppingMatch) {
    const location = shoppingMatch[2].trim();
    title = `Shopping at ${location.charAt(0).toUpperCase() + location.slice(1)}`;
  }

  // Extract title from "create a task" format
  const taskMatch = text.match(/\b(create|add|make|new|أنشئ|اضف|اعمل)\s+(a\s+)?(task|مهمة)\s+(.+?)(\s+due|\s+sub\s+tasks?|$)/i);
  if (taskMatch && !title) {
    title = taskMatch[4].trim();
  }

  // Extract title from "task due" format
  const taskDueMatch = text.match(/\b(task|مهمة)\s+due\s+.+?\s+(.+?)(\s+sub\s+tasks?|$)/i);
  if (taskDueMatch && !title) {
    const fullText = text;
    const afterDue = fullText.substring(fullText.toLowerCase().indexOf('due') + 3);
    const titleMatch = afterDue.match(/\w+\s+\w+\s+(.+?)(\s+sub\s+tasks?|$)/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
  }

  // If no title found but has shopping keywords, make a generic shopping title
  if (!title && (lowerText.includes('shopping') || lowerText.includes('shop') || lowerText.includes('تسوق'))) {
    title = lowerText.includes('تسوق') ? "التسوق" : "Shopping";
  }

  // If still no title but has task keywords, make a generic title
  if (!title && hasTaskKeywords) {
    title = lowerText.includes('مهمة') ? "مهمة جديدة" : "New task";
  }

  // Extract subtasks from "sub tasks rice milk water" format
  const subtaskMatch = text.match(/\b(sub\s+tasks?|المهام\s+الفرعية)\s+(.+?)(\s+due|$)/i);
  if (subtaskMatch) {
    const itemsText = subtaskMatch[2];
    subtasks = itemsText
      .split(/\s+(?:and\s+)?|,\s*|\s*&\s*/)
      .map(item => item.trim())
      .filter(item => item && item.length > 0 && !item.match(/\b(due|at|to|in|from|for|on|when|where|why|how)\b/i))
      .slice(0, 10);
  }

  // Extract due date - enhanced patterns
  const datePatterns = [
    /\b(due|موعد)\s+(tomorrow|today|tonight|غداً|اليوم|الليلة)\b/i,
    /\b(due|موعد)\s+(tomorrow|غداً)\s+(morning|afternoon|evening|noon|night|صباحاً|ظهراً|مساءً)/i,
    /\b(due|موعد)\s+(next|this|القادم|هذا)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)/i,
    /\b(tomorrow|today|tonight|غداً|اليوم|الليلة)\b/i,
    /\b(due|موعد)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{0,4})/i
  ];

  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      due_date = dateMatch[2] || dateMatch[1];
      break;
    }
  }

  // Extract due time - enhanced patterns
  const timePatterns = [
    /\b(noon|midnight|ظهراً|منتصف\s+الليل)\b/i,
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)\b/i,
    /\b(\d{1,2}):(\d{2})\b/i,
    /\b(morning|afternoon|evening|night|صباحاً|ظهراً|مساءً|ليلاً)\b/i
  ];

  for (const pattern of timePatterns) {
    const timeMatch = text.match(pattern);
    if (timeMatch) {
      if (timeMatch[0].toLowerCase() === 'noon' || timeMatch[0].includes('ظهراً')) {
        due_time = '12:00 PM';
      } else if (timeMatch[0].toLowerCase() === 'midnight' || timeMatch[0].includes('منتصف الليل')) {
        due_time = '12:00 AM';
      } else {
        due_time = timeMatch[0];
      }
      break;
    }
  }

  // Extract priority
  const priorityRegex = /\b(high|medium|low|urgent|critical|عالي|متوسط|منخفض|عاجل)\b\s*(priority|أولوية)/i;
  const priorityMatch = text.match(priorityRegex);
  
  if (priorityMatch) {
    const priorityWord = priorityMatch[1].toLowerCase();
    if (priorityWord === 'عالي' || priorityWord === 'high') priority = "high";
    else if (priorityWord === 'عاجل' || priorityWord === 'urgent') priority = "urgent";
    else if (priorityWord === 'منخفض' || priorityWord === 'low') priority = "low";
    else priority = priorityMatch[1].toLowerCase();
  } else if (lowerText.includes("urgent") || lowerText.includes("عاجل") || lowerText.includes("asap")) {
    priority = "urgent";
  } else if (lowerText.includes("important") || lowerText.includes("مهم") || lowerText.includes("soon")) {
    priority = "high";
  }
  
  return {
    title: title || (lowerText.includes('مهمة') ? "مهمة جديدة" : "New task"),
    description: "",
    subtasks: subtasks,
    due_date: due_date,
    due_time: due_time,
    priority: priority as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as const,
    hasTaskKeywords
  };
}

// ENHANCED: Generate clarification questions (from previous system)
function generateClarificationQuestions(taskData: any, originalText: string, language: string = 'en') {
  const missingFields = [];
  let questions = [];
  
  if (!taskData.due_date) {
    missingFields.push('due_date');
    if (taskData.title.toLowerCase().includes('shopping') || taskData.title.includes('تسوق')) {
      questions.push(language === 'ar' ? "متى تريد أن تذهب للتسوق؟" : "When would you like to go shopping?");
    } else {
      questions.push(language === 'ar' ? "متى تريد إكمال هذه المهمة؟" : "When would you like to complete this task?");
    }
  }
  
  if (!taskData.priority || taskData.priority === 'normal') {
    missingFields.push('priority');
    questions.push(language === 'ar' ? "ما أولوية هذه المهمة؟ (عادي، عالي، عاجل)" : "What priority should this task have? (normal, high, urgent)");
  }
  
  const questionText = questions.length > 0 
    ? (language === 'ar' 
        ? `لقد حضرت مهمة: **${taskData.title}**${taskData.subtasks.length > 0 ? `\n\nالمهام الفرعية:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nلإكمال الإعداد، أحتاج معرفة:\n• ${questions.join('\n• ')}\n\nيرجى تقديم هذه المعلومات لأتمكن من إنشاء المهمة.`
        : `I've prepared a task: **${taskData.title}**${taskData.subtasks.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}\n\nTo complete the setup, I need to know:\n• ${questions.join('\n• ')}\n\nPlease provide this information so I can create the task for you.`)
    : (language === 'ar' 
        ? `المهمة جاهزة: **${taskData.title}**${taskData.subtasks.length > 0 ? `\n\nالمهام الفرعية:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}`
        : `Task ready: **${taskData.title}**${taskData.subtasks.length > 0 ? `\n\nSubtasks:\n${taskData.subtasks.map((s: string) => `• ${s}`).join('\n')}` : ''}`);
  
  return {
    message: questionText,
    missingFields: missingFields
  };
}

// Search execution function
async function executeSearch(query: string, language: string = 'en') {
  try {
    if (!TAVILY_API_KEY) {
      console.log("🔍 No Tavily API - using AI for search response");
      const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
      return {
        success: true,
        context: searchContext,
        data: { sources: [], enhanced: false }
      };
    }
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        include_answer: true,
        max_results: 5
      })
    });
    
    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }
    
    const data = await response.json();
    let searchContext = `Search results for: "${query}"\n\n`;
    if (data.answer) {
      searchContext += `Summary: ${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      searchContext += "Sources:\n";
      data.results.forEach((result: any, index: number) => {
        searchContext += `${index + 1}. ${result.title}\n`;
        searchContext += `   ${result.content}\n`;
        searchContext += `   Source: ${result.url}\n\n`;
      });
    }
    
    return {
      success: true,
      context: searchContext,
      data: { sources: data.results || [], enhanced: false }
    };
  } catch (error) {
    console.error("Search execution error:", error);
    const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
    return {
      success: true,
      context: searchContext,
      data: { sources: [], enhanced: false, fallback: true }
    };
  }
}

// Image generation function
async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  try {
    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: prompt,
          model: "runware:100@1",
          width: 512,
          height: 512,
          numberResults: 1,
          outputFormat: "WEBP",
          CFGScale: 1,
          scheduler: "FlowMatchEulerDiscreteScheduler",
          steps: 4,
        },
      ]),
    });

    if (response.ok) {
      const result = await response.json();
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        return { success: true, imageUrl: imageResult.imageURL };
      }
    }
    throw new Error('Image generation failed');
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// AI processing function
async function processWithAI(message: string, context: string | null, language: string = 'en') {
  try {
    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    if (!apiKey) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini';
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. كن ودوداً ومفيداً ومختصراً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. Be friendly, helpful, and concise in your responses.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];
    
    if (context) {
      messages.splice(1, 0, { role: 'assistant', content: `Context: ${context}` });
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("AI processing error:", error);
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
