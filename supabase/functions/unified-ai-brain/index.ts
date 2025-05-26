
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing unified WAKTI AI brain request");
    const { message, userId, language, context } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Enhanced intent detection and command parsing
    const intent = detectUnifiedIntent(message, language);
    console.log("Detected intent:", intent);

    // Create contextual system prompt
    const systemPrompt = createUnifiedSystemPrompt(intent, language, context);

    // Process with AI
    const aiResponse = await callAIService(systemPrompt, message, intent);
    
    // Generate actions based on intent
    const actions = generateActions(intent, aiResponse, language);
    
    // Generate auto-actions for immediate execution
    const autoActions = generateAutoActions(intent, aiResponse);

    const response = {
      response: aiResponse,
      intent: intent.type,
      actions: actions,
      autoActions: autoActions,
      confidence: intent.confidence,
      type: 'text',
      provider: 'deepseek'
    };

    console.log("Unified WAKTI AI response:", response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in unified-ai-brain function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Enhanced unified intent detection system
function detectUnifiedIntent(message: string, language: string) {
  const lowerMessage = message.toLowerCase();
  
  // Task creation patterns (enhanced)
  const taskPatterns = [
    'create task', 'add task', 'new task', 'make task', 'todo', 'task for',
    'أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'اصنع مهمة', 'مهمة لـ'
  ];
  
  // Event/Calendar patterns (enhanced)
  const eventPatterns = [
    'schedule', 'create event', 'add event', 'appointment', 'meeting', 'calendar',
    'event for', 'plan event', 'organize event',
    'جدول', 'أنشئ حدث', 'أضف حدث', 'موعد', 'اجتماع', 'تقويم', 'حدث لـ'
  ];
  
  // Reminder patterns (enhanced)
  const reminderPatterns = [
    'remind me', 'reminder', 'don\'t forget', 'set reminder', 'remember to',
    'ذكرني', 'تذكير', 'لا تنس', 'ضع تذكير', 'تذكر أن'
  ];
  
  // Contact patterns (enhanced)
  const contactPatterns = [
    'add contact', 'new contact', 'save contact', 'contact info', 'add person',
    'أضف جهة اتصال', 'جهة اتصال جديدة', 'احفظ جهة اتصال', 'معلومات الاتصال'
  ];
  
  // Image generation patterns (enhanced)
  const imagePatterns = [
    'generate image', 'create image', 'draw', 'picture', 'visualize', 'make image',
    'paint', 'illustration', 'artwork', 'design',
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'تصور', 'لوحة'
  ];
  
  // Writing patterns (enhanced)
  const writingPatterns = [
    'write', 'compose', 'draft', 'email', 'letter', 'text', 'document',
    'اكتب', 'أنشئ', 'مسودة', 'بريد إلكتروني', 'رسالة', 'نص', 'وثيقة'
  ];

  // Data analysis patterns
  const analysisPatterns = [
    'analyze', 'chart', 'graph', 'statistics', 'data', 'report',
    'حلل', 'رسم بياني', 'إحصائيات', 'بيانات', 'تقرير'
  ];

  // Check patterns and return enhanced intent
  if (taskPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'task_creation', 
      confidence: 0.9,
      data: extractTaskData(message)
    };
  }
  
  if (eventPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'event_creation', 
      confidence: 0.9,
      data: extractEventData(message)
    };
  }
  
  if (reminderPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'reminder_creation', 
      confidence: 0.85,
      data: extractReminderData(message)
    };
  }
  
  if (contactPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'contact_management', 
      confidence: 0.8,
      data: extractContactData(message)
    };
  }
  
  if (imagePatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'image_generation', 
      confidence: 0.95,
      data: { prompt: extractImagePrompt(message) }
    };
  }
  
  if (writingPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'writing_assistance', 
      confidence: 0.8,
      data: { content: message }
    };
  }

  if (analysisPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return { 
      type: 'data_analysis', 
      confidence: 0.85,
      data: { query: message }
    };
  }
  
  // Default to general chat
  return { 
    type: 'general_chat', 
    confidence: 0.7,
    data: null
  };
}

// Enhanced system prompt creation
function createUnifiedSystemPrompt(intent: any, language: string, context: any) {
  const basePrompt = language === 'ar' 
    ? `أنت WAKTI AI، الدماغ الذكي المتطور لتطبيق وكتي. أنت مساعد قوي وودود يساعد في إدارة المهام والأحداث وجهات الاتصال والتذكيرات وإنشاء الصور والمحتوى والمزيد. كن مفيدًا ومباشرًا وقم بتنفيذ الطلبات بفعالية.`
    : `You are WAKTI AI, the advanced intelligent brain of the Wakti app. You are a powerful and friendly assistant that helps manage tasks, events, contacts, reminders, image generation, content creation, and much more. Be helpful, direct, and execute requests efficiently.`;

  const intentSpecificPrompt = getEnhancedIntentPrompt(intent.type, language);
  
  return `${basePrompt}\n\n${intentSpecificPrompt}\n\nUser Context: ${JSON.stringify(context)}\n\nDetected Intent: ${intent.type} (confidence: ${intent.confidence})`;
}

// Enhanced intent-specific prompts
function getEnhancedIntentPrompt(intentType: string, language: string) {
  const prompts = {
    en: {
      task_creation: "The user wants to create a task. Extract task details like title, description, priority, due date, and subtasks. Be helpful and confirm what you understand.",
      event_creation: "The user wants to create an event or appointment. Extract event details like title, date, time, location, description, and attendees.",
      reminder_creation: "The user wants to set a reminder. Extract the reminder text, date, time, and recurrence pattern if specified.",
      contact_management: "The user wants to manage contacts. Help them add, update, organize, or search contact information.",
      image_generation: "The user wants to generate an image. Extract and enhance the image description to create a detailed, creative prompt.",
      writing_assistance: "The user needs help with writing. Assist with composition, editing, content creation, or document formatting.",
      data_analysis: "The user wants to analyze data or create visualizations. Help with charts, graphs, statistics, or data interpretation.",
      general_chat: "Provide helpful, conversational responses. If the user's request could be better served by a specific app feature, guide them appropriately and offer actionable suggestions."
    },
    ar: {
      task_creation: "يريد المستخدم إنشاء مهمة. استخرج تفاصيل المهمة مثل العنوان والوصف والأولوية وتاريخ الاستحقاق والمهام الفرعية. كن مفيدًا وأكد ما تفهمه.",
      event_creation: "يريد المستخدم إنشاء حدث أو موعد. استخرج تفاصيل الحدث مثل العنوان والتاريخ والوقت والموقع والوصف والحضور.",
      reminder_creation: "يريد المستخدم وضع تذكير. استخرج نص التذكير والتاريخ والوقت ونمط التكرار إذا تم تحديده.",
      contact_management: "يريد المستخدم إدارة جهات الاتصال. ساعده في إضافة أو تحديث أو تنظيم أو البحث في معلومات الاتصال.",
      image_generation: "يريد المستخدم إنشاء صورة. استخرج وحسن وصف الصورة لإنشاء موجه مفصل وإبداعي.",
      writing_assistance: "يحتاج المستخدم مساعدة في الكتابة. ساعده في التأليف أو التحرير أو إنشاء المحتوى أو تنسيق الوثائق.",
      data_analysis: "يريد المستخدم تحليل البيانات أو إنشاء مرئيات. ساعد في الرسوم البيانية أو الإحصائيات أو تفسير البيانات.",
      general_chat: "قدم ردود مفيدة ومحادثة. إذا كان بإمكان خدمة طلب المستخدم بشكل أفضل من خلال ميزة تطبيق معينة، اقده بشكل مناسب واقترح إجراءات قابلة للتنفيذ."
    }
  };
  
  return prompts[language][intentType] || prompts[language].general_chat;
}

// Enhanced AI service calling with fallback
async function callAIService(systemPrompt: string, message: string, intent: any) {
  try {
    // Try DeepSeek first
    if (DEEPSEEK_API_KEY) {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.choices[0].message?.content || "";
      }
    }
    
    // Fallback to OpenAI
    if (OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const result = await response.json();
      return result.choices[0].message?.content || "";
    }
    
    throw new Error("No AI service available");
    
  } catch (error) {
    console.error("AI service error:", error);
    throw error;
  }
}

// Enhanced action generation
function generateActions(intent: any, aiResponse: string, language: string) {
  const actions = [];
  
  switch (intent.type) {
    case 'task_creation':
      actions.push({
        text: language === 'ar' ? 'إنشاء المهمة' : 'Create Task',
        id: 'create_task',
        variant: 'default',
        data: intent.data
      });
      break;
      
    case 'event_creation':
      actions.push({
        text: language === 'ar' ? 'إنشاء الحدث' : 'Create Event',
        id: 'create_event',
        variant: 'default',
        data: intent.data
      });
      break;
      
    case 'reminder_creation':
      actions.push({
        text: language === 'ar' ? 'إنشاء التذكير' : 'Create Reminder',
        id: 'create_reminder',
        variant: 'default',
        data: intent.data
      });
      break;
      
    case 'contact_management':
      actions.push({
        text: language === 'ar' ? 'إضافة جهة الاتصال' : 'Add Contact',
        id: 'add_contact',
        variant: 'default',
        data: intent.data
      });
      break;
      
    case 'image_generation':
      actions.push({
        text: language === 'ar' ? 'إنشاء الصورة' : 'Generate Image',
        id: 'generate_image',
        variant: 'default',
        data: intent.data
      });
      break;

    case 'writing_assistance':
      actions.push({
        text: language === 'ar' ? 'مساعدة في الكتابة' : 'Writing Help',
        id: 'writing_help',
        variant: 'secondary',
        data: intent.data
      });
      break;

    case 'data_analysis':
      actions.push({
        text: language === 'ar' ? 'تحليل البيانات' : 'Analyze Data',
        id: 'analyze_data',
        variant: 'secondary',
        data: intent.data
      });
      break;
  }
  
  return actions;
}

// Enhanced automatic action generation
function generateAutoActions(intent: any, aiResponse: string) {
  const autoActions = [];
  
  // For high-confidence intents, auto-execute certain actions
  if (intent.confidence > 0.9) {
    switch (intent.type) {
      case 'image_generation':
        autoActions.push({
          type: 'generate_image',
          prompt: intent.data.prompt
        });
        break;
    }
  }
  
  return autoActions;
}

// Enhanced data extraction functions
function extractTaskData(message: string) {
  const title = message.replace(/create task|add task|new task|make task|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium',
    dueDate: null,
    subtasks: []
  };
}

function extractEventData(message: string) {
  const title = message.replace(/schedule|create event|add event|جدول|أنشئ حدث/gi, '').trim();
  return {
    title: title || 'New Event',
    description: '',
    startTime: null,
    endTime: null,
    location: '',
    attendees: []
  };
}

function extractReminderData(message: string) {
  const title = message.replace(/remind me|reminder|ذكرني|تذكير/gi, '').trim();
  return {
    title: title || 'New Reminder',
    dueDate: null,
    isRecurring: false
  };
}

function extractContactData(message: string) {
  const name = message.replace(/add contact|new contact|أضف جهة اتصال/gi, '').trim();
  return {
    name: name || 'New Contact',
    email: '',
    phone: '',
    notes: ''
  };
}

function extractImagePrompt(message: string) {
  const prompt = message.replace(/generate image|create image|draw|make image|أنشئ صورة|ارسم/gi, '').trim();
  return prompt || 'beautiful artwork';
}
