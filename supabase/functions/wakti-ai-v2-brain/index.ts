
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { message, conversationId, language = 'en' } = await req.json();

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

    // Get user profile for personalization
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single();

    const userName = profile?.display_name || profile?.username || 'there';

    // Analyze intent and confidence
    const analysis = analyzeMessage(message, language);
    console.log("Intent analysis:", analysis);

    // Handle conversation
    let conversation = null;
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
          title: generateTitle(message, language),
        })
        .select('*')
        .single();
      conversation = newConversation;
    }

    // Get recent context (last 5 messages)
    const { data: recentMessages } = await supabaseClient
      .from('ai_chat_history')
      .select('role, content, intent')
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
        input_type: 'text',
        language: language,
        intent: analysis.intent,
        confidence_level: analysis.confidence,
      });

    // Generate AI response
    const aiResponse = await generateResponse(
      message,
      analysis,
      language,
      userName,
      recentMessages || []
    );

    // Execute actions based on confidence
    let actionResult = null;
    let actionTaken = null;
    
    if (analysis.confidence === 'high' && analysis.actionData) {
      try {
        actionResult = await executeAction(analysis.actionData, supabaseClient, user.id, language);
        actionTaken = analysis.actionData.type;
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
        intent: analysis.intent,
        confidence_level: analysis.confidence,
        action_taken: actionTaken,
        action_result: actionResult,
      });

    // Update conversation timestamp
    await supabaseClient
      .from('ai_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);

    return new Response(
      JSON.stringify({
        response: aiResponse,
        conversationId: conversation.id,
        intent: analysis.intent,
        confidence: analysis.confidence,
        actionTaken: actionTaken,
        actionResult: actionResult,
        needsConfirmation: analysis.confidence === 'medium',
        needsClarification: analysis.confidence === 'low',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("WAKTI AI V2 Brain error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function analyzeMessage(message: string, language: string) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced intent patterns for both languages
  const patterns = {
    task: language === 'ar' 
      ? ['أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'اصنع مهمة', 'أريد مهمة', 'اعمل مهمة']
      : ['create task', 'add task', 'new task', 'make task', 'todo', 'need to do', 'task for', 'remind me to'],
    
    event: language === 'ar'
      ? ['أنشئ حدث', 'أضف حدث', 'موعد جديد', 'اجتماع', 'حفلة', 'مناسبة', 'احجز موعد']
      : ['create event', 'add event', 'schedule', 'meeting', 'appointment', 'plan event', 'book appointment'],
    
    reminder: language === 'ar'
      ? ['ذكرني', 'تذكير', 'لا تنس', 'نبهني', 'أذكرني', 'انبهني']
      : ['remind me', 'reminder', 'don\'t forget', 'alert me', 'notification', 'set reminder'],
      
    image: language === 'ar'
      ? ['أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة جديدة', 'توليد صورة', 'اعمل صورة']
      : ['generate image', 'create image', 'draw', 'make picture', 'image of', 'picture of']
  };

  // Check for high confidence matches
  for (const [intent, intentPatterns] of Object.entries(patterns)) {
    for (const pattern of intentPatterns) {
      if (lowerMessage.includes(pattern)) {
        return {
          intent,
          confidence: 'high' as const,
          actionData: extractActionData(message, intent, language)
        };
      }
    }
  }

  // Medium confidence - partial matches
  const createWords = language === 'ar' ? ['أنشئ', 'أضف', 'اصنع'] : ['create', 'add', 'make'];
  if (createWords.some(word => lowerMessage.includes(word))) {
    return {
      intent: 'general_create',
      confidence: 'medium' as const,
      actionData: null
    };
  }

  return {
    intent: 'general_chat',
    confidence: 'low' as const,
    actionData: null
  };
}

function extractActionData(message: string, intent: string, language: string) {
  // Remove command words to get the actual content
  const removePatterns = language === 'ar' 
    ? ['أنشئ مهمة', 'أضف مهمة', 'أنشئ حدث', 'أضف حدث', 'ذكرني', 'أنشئ صورة']
    : ['create task', 'add task', 'new task', 'create event', 'add event', 'remind me', 'generate image'];
  
  let title = message;
  for (const pattern of removePatterns) {
    title = title.replace(new RegExp(pattern, 'gi'), '').trim();
  }

  switch (intent) {
    case 'task':
      return {
        type: 'create_task',
        title: title || (language === 'ar' ? 'مهمة جديدة' : 'New Task'),
        description: '',
        priority: 'medium'
      };
    case 'event':
      return {
        type: 'create_event',
        title: title || (language === 'ar' ? 'حدث جديد' : 'New Event'),
        description: '',
        is_all_day: false
      };
    case 'reminder':
      return {
        type: 'create_reminder',
        title: title || (language === 'ar' ? 'تذكير جديد' : 'New Reminder')
      };
    case 'image':
      return {
        type: 'generate_image',
        prompt: title
      };
    default:
      return null;
  }
}

async function generateResponse(message: string, analysis: any, language: string, userName: string, context: any[]) {
  const systemPrompt = language === 'ar' 
    ? `أنت WAKTI AI V2.1، المساعد الذكي المتطور لتطبيق وكتي. اسم المستخدم هو ${userName}. أنت ودود ومفيد وذكي، تساعد في إدارة المهام والأحداث والتذكيرات بطريقة طبيعية ومحادثة. استخدم الرموز التعبيرية بشكل مناسب. كن مختصراً ومفيداً.`
    : `You are WAKTI AI V2.1, the advanced smart assistant for the Wakti app. The user's name is ${userName}. You are friendly, helpful, and intelligent, assisting with managing tasks, events, and reminders in a natural, conversational way. Use emojis appropriately. Be concise and helpful.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.reverse().map(msg => ({
      role: msg.role,
      content: msg.content
    })),
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
          max_tokens: 800,
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
        max_tokens: 800,
      }),
    });

    const result = await response.json();
    return result.choices[0].message?.content || "";
  }

  throw new Error("No AI service available");
}

async function executeAction(actionData: any, supabaseClient: any, userId: string, language: string) {
  switch (actionData.type) {
    case 'create_task':
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          user_id: userId,
          title: actionData.title,
          description: actionData.description,
          priority: actionData.priority,
          type: 'task',
          status: 'pending'
        })
        .select('*')
        .single();
      return { task, success: true };

    case 'create_event':
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 1);
      
      const { data: event } = await supabaseClient
        .from('maw3d_events')
        .insert({
          created_by: userId,
          title: actionData.title,
          description: actionData.description,
          event_date: eventDate.toISOString().split('T')[0],
          is_all_day: actionData.is_all_day,
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
          title: actionData.title,
          type: 'reminder',
          status: 'pending',
          priority: 'medium'
        })
        .select('*')
        .single();
      return { reminder, success: true };

    default:
      throw new Error(`Unknown action: ${actionData.type}`);
  }
}

function generateTitle(message: string, language: string) {
  const words = message.split(' ').slice(0, 4).join(' ');
  return words.length > 30 ? words.substring(0, 30) + '...' : words;
}
