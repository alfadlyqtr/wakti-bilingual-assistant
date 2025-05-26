
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
    console.log("Processing unified AI brain request");
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

    // Advanced intent detection and command parsing
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
      confidence: intent.confidence
    };

    console.log("Unified AI response:", response);

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

// Unified intent detection system
function detectUnifiedIntent(message: string, language: string) {
  const lowerMessage = message.toLowerCase();
  
  // Task creation patterns
  const taskPatterns = [
    'create task', 'add task', 'new task', 'make task', 'todo',
    'أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'اصنع مهمة'
  ];
  
  // Event/Calendar patterns
  const eventPatterns = [
    'schedule', 'create event', 'add event', 'appointment', 'meeting', 'calendar',
    'جدول', 'أنشئ حدث', 'أضف حدث', 'موعد', 'اجتماع', 'تقويم'
  ];
  
  // Reminder patterns
  const reminderPatterns = [
    'remind me', 'reminder', 'don\'t forget', 'set reminder',
    'ذكرني', 'تذكير', 'لا تنس', 'ضع تذكير'
  ];
  
  // Contact patterns
  const contactPatterns = [
    'add contact', 'new contact', 'save contact', 'contact info',
    'أضف جهة اتصال', 'جهة اتصال جديدة', 'احفظ جهة اتصال', 'معلومات الاتصال'
  ];
  
  // Image generation patterns
  const imagePatterns = [
    'generate image', 'create image', 'draw', 'picture', 'visualize',
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'تصور'
  ];
  
  // Writing patterns
  const writingPatterns = [
    'write', 'compose', 'draft', 'email', 'letter', 'text',
    'اكتب', 'أنشئ', 'مسودة', 'بريد إلكتروني', 'رسالة', 'نص'
  ];

  // Check patterns and return intent
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
  
  // Default to general chat
  return { 
    type: 'general_chat', 
    confidence: 0.7,
    data: null
  };
}

// Create unified system prompt
function createUnifiedSystemPrompt(intent: any, language: string, context: any) {
  const basePrompt = language === 'ar' 
    ? `أنت WAKTI AI، الدماغ الذكي لتطبيق وكتي. أنت مساعد قوي وودود يساعد في إدارة المهام والأحداث وجهات الاتصال والتذكيرات والمزيد.`
    : `You are WAKTI AI, the intelligent brain of the Wakti app. You are a powerful and friendly assistant that helps manage tasks, events, contacts, reminders, and much more.`;

  const intentSpecificPrompt = getIntentSpecificPrompt(intent.type, language);
  
  return `${basePrompt}\n\n${intentSpecificPrompt}\n\nUser Context: ${JSON.stringify(context)}\n\nDetected Intent: ${intent.type} (confidence: ${intent.confidence})`;
}

// Get intent-specific prompts
function getIntentSpecificPrompt(intentType: string, language: string) {
  const prompts = {
    en: {
      task_creation: "The user wants to create a task. Extract task details like title, description, priority, and due date. Be helpful and confirm what you understand.",
      event_creation: "The user wants to create an event or appointment. Extract event details like title, date, time, location, and description.",
      reminder_creation: "The user wants to set a reminder. Extract the reminder text and when they want to be reminded.",
      contact_management: "The user wants to manage contacts. Help them add, update, or organize contact information.",
      image_generation: "The user wants to generate an image. Extract the image description and create a detailed prompt.",
      writing_assistance: "The user needs help with writing. Assist with composition, editing, or content creation.",
      general_chat: "Provide helpful, conversational responses. If the user's request could be better served by a specific app feature, guide them appropriately."
    },
    ar: {
      task_creation: "يريد المستخدم إنشاء مهمة. استخرج تفاصيل المهمة مثل العنوان والوصف والأولوية وتاريخ الاستحقاق. كن مفيدًا وأكد ما تفهمه.",
      event_creation: "يريد المستخدم إنشاء حدث أو موعد. استخرج تفاصيل الحدث مثل العنوان والتاريخ والوقت والموقع والوصف.",
      reminder_creation: "يريد المستخدم وضع تذكير. استخرج نص التذكير ومتى يريد أن يتم تذكيره.",
      contact_management: "يريد المستخدم إدارة جهات الاتصال. ساعده في إضافة أو تحديث أو تنظيم معلومات الاتصال.",
      image_generation: "يريد المستخدم إنشاء صورة. استخرج وصف الصورة وأنشئ موجه مفصل.",
      writing_assistance: "يحتاج المستخدم مساعدة في الكتابة. ساعده في التأليف أو التحرير أو إنشاء المحتوى.",
      general_chat: "قدم ردود مفيدة ومحادثة. إذا كان بإمكان خدمة طلب المستخدم بشكل أفضل من خلال ميزة تطبيق معينة، اقده بشكل مناسب."
    }
  };
  
  return prompts[language][intentType] || prompts[language].general_chat;
}

// Call AI service with fallback
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

// Generate action buttons
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
  }
  
  return actions;
}

// Generate automatic actions
function generateAutoActions(intent: any, aiResponse: string) {
  const autoActions = [];
  
  // For high-confidence intents, auto-execute certain actions
  if (intent.confidence > 0.8) {
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

// Data extraction functions
function extractTaskData(message: string) {
  // Simple extraction - in production, this would be more sophisticated
  const title = message.replace(/create task|add task|new task|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium',
    dueDate: null
  };
}

function extractEventData(message: string) {
  const title = message.replace(/schedule|create event|add event|جدول|أنشئ حدث/gi, '').trim();
  return {
    title: title || 'New Event',
    description: '',
    startTime: null,
    endTime: null,
    location: ''
  };
}

function extractReminderData(message: string) {
  const title = message.replace(/remind me|reminder|ذكرني|تذكير/gi, '').trim();
  return {
    title: title || 'New Reminder',
    dueDate: null
  };
}

function extractContactData(message: string) {
  const name = message.replace(/add contact|new contact|أضف جهة اتصال/gi, '').trim();
  return {
    name: name || 'New Contact',
    email: '',
    phone: ''
  };
}

function extractImagePrompt(message: string) {
  return message.replace(/generate image|create image|draw|أنشئ صورة|ارسم/gi, '').trim() || 'beautiful artwork';
}
