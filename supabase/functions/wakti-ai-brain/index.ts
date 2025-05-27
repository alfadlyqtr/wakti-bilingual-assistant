
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("WAKTI AI Brain: Processing request");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { message, conversationId, language = 'en', inputType = 'text' } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for personalized greeting
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single();

    const userName = profile?.display_name || profile?.username || 'there';

    // Analyze intent and confidence
    const intentAnalysis = analyzeIntent(message, language);
    console.log("Intent analysis:", intentAnalysis);

    // Create conversation if needed
    let conversation;
    if (conversationId) {
      const { data } = await supabaseClient
        .from('ai_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      conversation = data;
    }

    if (!conversation) {
      const { data: newConversation } = await supabaseClient
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: generateConversationTitle(message, language),
        })
        .select('*')
        .single();
      conversation = newConversation;
    }

    // Get recent context (last 5 messages)
    const { data: recentMessages } = await supabaseClient
      .from('ai_chat_history')
      .select('role, content, intent, action_result')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Save user message
    await supabaseClient
      .from('ai_chat_history')
      .insert({
        conversation_id: conversation.id,
        user_id: user.id,
        role: 'user',
        content: message,
        input_type: inputType,
        language: language,
        intent: intentAnalysis.intent,
        confidence_level: intentAnalysis.confidence,
      });

    // Generate AI response
    const aiResponse = await generateAIResponse(
      message,
      intentAnalysis,
      language,
      userName,
      recentMessages || []
    );

    let actionResult = null;
    let actionTaken = null;

    // Execute actions based on confidence
    if (intentAnalysis.confidence === 'high' && intentAnalysis.action) {
      try {
        actionResult = await executeAction(intentAnalysis.action, intentAnalysis.params, supabaseClient, user.id);
        actionTaken = intentAnalysis.action;
      } catch (error) {
        console.error("Action execution failed:", error);
        actionResult = { error: error.message };
      }
    }

    // Save assistant response
    await supabaseClient
      .from('ai_chat_history')
      .insert({
        conversation_id: conversation.id,
        user_id: user.id,
        role: 'assistant',
        content: aiResponse,
        input_type: 'text',
        language: language,
        intent: intentAnalysis.intent,
        confidence_level: intentAnalysis.confidence,
        action_taken: actionTaken,
        action_result: actionResult,
      });

    return new Response(
      JSON.stringify({
        response: aiResponse,
        conversationId: conversation.id,
        intent: intentAnalysis.intent,
        confidence: intentAnalysis.confidence,
        actionTaken: actionTaken,
        actionResult: actionResult,
        needsConfirmation: intentAnalysis.confidence === 'medium',
        needsClarification: intentAnalysis.confidence === 'low',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("WAKTI AI Brain error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function analyzeIntent(message: string, language: string) {
  const lowerMessage = message.toLowerCase();
  
  // Task creation patterns
  const taskPatterns = language === 'ar' 
    ? ['أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'اصنع مهمة', 'مطلوب عمل']
    : ['create task', 'add task', 'new task', 'make task', 'todo', 'need to do'];
  
  // Event creation patterns
  const eventPatterns = language === 'ar'
    ? ['أنشئ حدث', 'أضف حدث', 'موعد جديد', 'اجتماع', 'حفلة']
    : ['create event', 'add event', 'schedule', 'meeting', 'appointment'];
  
  // Reminder patterns
  const reminderPatterns = language === 'ar'
    ? ['ذكرني', 'تذكير', 'لا تنس', 'نبهني']
    : ['remind me', 'reminder', 'don\'t forget', 'alert me'];
  
  // Image generation patterns
  const imagePatterns = language === 'ar'
    ? ['أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة جديدة']
    : ['generate image', 'create image', 'draw', 'make picture'];

  if (taskPatterns.some(p => lowerMessage.includes(p))) {
    return {
      intent: 'create_task',
      confidence: 'high',
      action: 'create_task',
      params: extractTaskParams(message)
    };
  }
  
  if (eventPatterns.some(p => lowerMessage.includes(p))) {
    return {
      intent: 'create_event',
      confidence: 'high',
      action: 'create_event',
      params: extractEventParams(message)
    };
  }
  
  if (reminderPatterns.some(p => lowerMessage.includes(p))) {
    return {
      intent: 'create_reminder',
      confidence: 'high',
      action: 'create_reminder',
      params: extractReminderParams(message)
    };
  }
  
  if (imagePatterns.some(p => lowerMessage.includes(p))) {
    return {
      intent: 'generate_image',
      confidence: 'medium',
      action: 'generate_image',
      params: { prompt: message.replace(/أنشئ صورة|اصنع صورة|ارسم|generate image|create image|draw|make picture/gi, '').trim() }
    };
  }

  return {
    intent: 'general_chat',
    confidence: 'low',
    action: null,
    params: null
  };
}

function extractTaskParams(message: string) {
  // Extract task title from message
  const title = message.replace(/create task|add task|new task|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium',
    type: 'task'
  };
}

function extractEventParams(message: string) {
  const title = message.replace(/create event|add event|schedule|أنشئ حدث|أضف حدث/gi, '').trim();
  return {
    title: title || 'New Event',
    description: '',
    is_all_day: false
  };
}

function extractReminderParams(message: string) {
  const title = message.replace(/remind me|reminder|ذكرني|تذكير/gi, '').trim();
  return {
    title: title || 'New Reminder',
    description: '',
    type: 'reminder'
  };
}

async function generateAIResponse(message: string, intent: any, language: string, userName: string, context: any[]) {
  const systemPrompt = language === 'ar' 
    ? `أنت WAKTI AI، المساعد الذكي لتطبيق وكتي. اسم المستخدم هو ${userName}. أنت ودود ومفيد وتساعد في إدارة المهام والأحداث والتذكيرات. رد بشكل طبيعي ومحادثة، واستخدم الرموز التعبيرية عند الحاجة.`
    : `You are WAKTI AI, the smart assistant for the Wakti app. The user's name is ${userName}. You are friendly, helpful, and assist with managing tasks, events, and reminders. Respond naturally and conversationally, using emojis when appropriate.`;

  // Build context from recent messages
  const contextMessages = context.reverse().map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...contextMessages,
    { role: 'user', content: message }
  ];

  // Try DeepSeek first
  try {
    if (DEEPSEEK_API_KEY) {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.choices[0].message?.content || "";
      }
    }
  } catch (error) {
    console.log("DeepSeek failed, trying OpenAI:", error);
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
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const result = await response.json();
    return result.choices[0].message?.content || "";
  }

  throw new Error("No AI service available");
}

async function executeAction(action: string, params: any, supabaseClient: any, userId: string) {
  switch (action) {
    case 'create_task':
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          user_id: userId,
          title: params.title,
          description: params.description,
          priority: params.priority,
          type: params.type,
          status: 'pending'
        })
        .select('*')
        .single();
      return { task, success: true };

    case 'create_event':
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 1); // Default to tomorrow
      
      const { data: event } = await supabaseClient
        .from('maw3d_events')
        .insert({
          created_by: userId,
          title: params.title,
          description: params.description,
          event_date: eventDate.toISOString().split('T')[0],
          is_all_day: params.is_all_day,
          is_public: false
        })
        .select('*')
        .single();
      return { event, success: true };

    case 'create_reminder':
      const { data: reminder } = await supabaseClient
        .from('tasks')
        .insert({
          user_id: userId,
          title: params.title,
          description: params.description,
          type: 'reminder',
          status: 'pending',
          priority: 'medium'
        })
        .select('*')
        .single();
      return { reminder, success: true };

    case 'generate_image':
      // This would call the image generation service
      return { imageUrl: 'placeholder-for-generated-image', success: true };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function generateConversationTitle(message: string, language: string) {
  const words = message.split(' ').slice(0, 4).join(' ');
  return words.length > 30 ? words.substring(0, 30) + '...' : words;
}
