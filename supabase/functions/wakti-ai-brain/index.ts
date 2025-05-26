
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log("Processing WAKTI AI request:", { message, userId, language });

    // Analyze user intent
    const intent = analyzeIntent(message, language);
    console.log("Detected intent:", intent);

    // Create system prompt
    const systemPrompt = createSystemPrompt(language, intent, context);

    // Process with AI
    const aiResponse = await callAI(systemPrompt, message);
    
    // Generate response based on intent
    const response = await generateResponse(intent, aiResponse, message, userId, language);

    console.log("WAKTI AI response:", response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in wakti-ai-brain function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Analyze user intent
function analyzeIntent(message: string, language: string) {
  const lowerMessage = message.toLowerCase();
  
  // Task creation patterns
  if (lowerMessage.includes('task') || lowerMessage.includes('todo') || 
      lowerMessage.includes('مهمة') || lowerMessage.includes('عمل')) {
    return {
      type: 'task_creation',
      confidence: 0.9,
      data: extractTaskData(message)
    };
  }
  
  // Event creation patterns
  if (lowerMessage.includes('event') || lowerMessage.includes('schedule') || 
      lowerMessage.includes('meeting') || lowerMessage.includes('حدث') || 
      lowerMessage.includes('موعد') || lowerMessage.includes('اجتماع')) {
    return {
      type: 'event_creation',
      confidence: 0.9,
      data: extractEventData(message)
    };
  }
  
  // Reminder patterns
  if (lowerMessage.includes('remind') || lowerMessage.includes('reminder') ||
      lowerMessage.includes('ذكر') || lowerMessage.includes('تذكير')) {
    return {
      type: 'reminder_creation',
      confidence: 0.85,
      data: extractReminderData(message)
    };
  }
  
  // Contact patterns
  if (lowerMessage.includes('contact') || lowerMessage.includes('person') ||
      lowerMessage.includes('جهة اتصال') || lowerMessage.includes('شخص')) {
    return {
      type: 'contact_management',
      confidence: 0.8,
      data: extractContactData(message)
    };
  }
  
  // Image generation patterns
  if (lowerMessage.includes('image') || lowerMessage.includes('picture') || 
      lowerMessage.includes('draw') || lowerMessage.includes('generate') ||
      lowerMessage.includes('صورة') || lowerMessage.includes('رسم')) {
    return {
      type: 'image_generation',
      confidence: 0.95,
      data: { prompt: extractImagePrompt(message) }
    };
  }
  
  return {
    type: 'general_chat',
    confidence: 0.7,
    data: null
  };
}

// Create system prompt
function createSystemPrompt(language: string, intent: any, context: any) {
  const basePrompt = language === 'ar' 
    ? `أنت WAKTI AI، الدماغ الذكي لتطبيق وكتي. أنت مساعد قوي وودود يمكنه إنشاء المهام والأحداث وجهات الاتصال والتذكيرات والصور والمزيد. كن مفيدًا ومباشرًا وقم بتنفيذ الطلبات بفعالية.`
    : `You are WAKTI AI, the intelligent brain of the Wakti app. You are a powerful and friendly assistant that can create tasks, events, contacts, reminders, images, and much more. Be helpful, direct, and execute requests efficiently.`;

  const intentPrompt = getIntentPrompt(intent.type, language);
  
  return `${basePrompt}\n\n${intentPrompt}\n\nUser Intent: ${intent.type} (confidence: ${intent.confidence})\nContext: ${JSON.stringify(context)}`;
}

// Get intent-specific prompts
function getIntentPrompt(intentType: string, language: string) {
  const prompts = {
    en: {
      task_creation: "User wants to create a task. Extract details and prepare to create it.",
      event_creation: "User wants to create an event. Extract details and prepare to schedule it.",
      reminder_creation: "User wants to set a reminder. Extract details and prepare to create it.",
      contact_management: "User wants to manage contacts. Extract details and prepare to add/manage contacts.",
      image_generation: "User wants to generate an image. Extract description and prepare to create it.",
      general_chat: "Provide helpful conversation. If user needs specific actions, guide them."
    },
    ar: {
      task_creation: "المستخدم يريد إنشاء مهمة. استخرج التفاصيل واستعد لإنشائها.",
      event_creation: "المستخدم يريد إنشاء حدث. استخرج التفاصيل واستعد لجدولته.",
      reminder_creation: "المستخدم يريد وضع تذكير. استخرج التفاصيل واستعد لإنشائه.",
      contact_management: "المستخدم يريد إدارة جهات الاتصال. استخرج التفاصيل واستعد لإضافة/إدارة جهات الاتصال.",
      image_generation: "المستخدم يريد إنشاء صورة. استخرج الوصف واستعد لإنشائها.",
      general_chat: "قدم محادثة مفيدة. إذا احتاج المستخدم إجراءات محددة، اقده."
    }
  };
  
  return prompts[language][intentType] || prompts[language].general_chat;
}

// Call AI service
async function callAI(systemPrompt: string, message: string) {
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

// Generate response based on intent
async function generateResponse(intent: any, aiResponse: string, originalMessage: string, userId: string, language: string) {
  const response = {
    response: aiResponse,
    type: 'text',
    actions: [],
    autoExecute: []
  };

  // Add actions based on intent
  switch (intent.type) {
    case 'task_creation':
      response.actions.push({
        id: 'create_task',
        label: language === 'ar' ? 'إنشاء المهمة' : 'Create Task',
        type: 'create_task',
        data: intent.data
      });
      break;
      
    case 'event_creation':
      response.actions.push({
        id: 'create_event',
        label: language === 'ar' ? 'إنشاء الحدث' : 'Create Event',
        type: 'create_event',
        data: intent.data
      });
      break;
      
    case 'reminder_creation':
      response.actions.push({
        id: 'create_reminder',
        label: language === 'ar' ? 'إنشاء التذكير' : 'Create Reminder',
        type: 'create_reminder',
        data: intent.data
      });
      break;
      
    case 'contact_management':
      response.actions.push({
        id: 'add_contact',
        label: language === 'ar' ? 'إضافة جهة الاتصال' : 'Add Contact',
        type: 'add_contact',
        data: intent.data
      });
      break;
      
    case 'image_generation':
      // For high confidence image requests, auto-execute
      if (intent.confidence > 0.9) {
        response.autoExecute.push({
          type: 'generate_image',
          prompt: intent.data.prompt
        });
      } else {
        response.actions.push({
          id: 'generate_image',
          label: language === 'ar' ? 'إنشاء الصورة' : 'Generate Image',
          type: 'generate_image',
          data: intent.data
        });
      }
      break;
  }

  return response;
}

// Data extraction functions
function extractTaskData(message: string) {
  const title = message.replace(/create task|add task|new task|make task|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium',
    dueDate: null
  };
}

function extractEventData(message: string) {
  const title = message.replace(/schedule|create event|add event|meeting|جدول|أنشئ حدث|اجتماع/gi, '').trim();
  return {
    title: title || 'New Event',
    description: '',
    startTime: null,
    endTime: null,
    location: ''
  };
}

function extractReminderData(message: string) {
  const title = message.replace(/remind me|reminder|set reminder|ذكرني|تذكير/gi, '').trim();
  return {
    title: title || 'New Reminder',
    dueDate: null
  };
}

function extractContactData(message: string) {
  const name = message.replace(/add contact|new contact|contact|أضف جهة اتصال|جهة اتصال/gi, '').trim();
  return {
    name: name || 'New Contact',
    email: '',
    phone: ''
  };
}

function extractImagePrompt(message: string) {
  return message.replace(/generate image|create image|draw|make picture|أنشئ صورة|ارسم/gi, '').trim() || 'beautiful artwork';
}
