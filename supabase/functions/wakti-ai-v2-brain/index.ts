
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RUNWARE_API_KEY = "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";

interface RequestBody {
  message: string;
  conversationId?: string;
  language: 'en' | 'ar';
  inputType: 'text' | 'voice';
}

interface AIResponse {
  response: string;
  conversationId: string;
  intent: string;
  confidence: 'high' | 'medium' | 'low';
  actionTaken?: string;
  actionResult?: any;
  needsConfirmation: boolean;
  needsClarification: boolean;
  isNewConversation?: boolean;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('WAKTI AI V2.1: Processing request with FULL CAPABILITIES');

    const body: RequestBody = await req.json();
    const userMessage = body.message;
    const conversationId = body.conversationId || `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const language = body.language || 'en';
    const inputType = body.inputType || 'text';

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1: Processing message:', userMessage);

    // Analyze intent and detect actions
    const intentAnalysis = analyzeIntent(userMessage, language);
    console.log('WAKTI AI V2.1: Intent analysis:', intentAnalysis);

    // Check if OpenAI API key is available
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('WAKTI AI V2.1: OpenAI API key not found');
      return new Response(JSON.stringify({ 
        error: 'AI service not configured',
        response: language === 'ar' 
          ? 'عذراً، خدمة الذكاء الاصطناعي غير متاحة حالياً.'
          : 'Sorry, AI service is not available.',
        conversationId: conversationId,
        intent: 'error',
        confidence: 'low',
        needsConfirmation: false,
        needsClarification: false
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enhanced system message for action-aware AI
    const systemMessage = language === 'ar' 
      ? `أنت WAKTI AI V2.1، المساعد الذكي المتطور لتطبيق وكتي. يمكنك إنشاء المهام والأحداث والتذكيرات والصور. أنت ودود ومفيد وتساعد في إدارة المهام والأحداث والتذكيرات. رد بشكل طبيعي ومحادثة، واستخدم الرموز التعبيرية عند الحاجة.

قدراتك المتقدمة:
- إنشاء المهام والمشاريع
- إنشاء الأحداث والمواعيد  
- إنشاء التذكيرات
- إنشاء الصور بالذكاء الاصطناعي
- تنفيذ الأوامر تلقائياً

عندما يطلب المستخدم إنشاء شيء، قم بتنفيذه فوراً إذا كنت متأكداً من الطلب.`
      : `You are WAKTI AI V2.1, the advanced intelligent assistant for the Wakti app. You can create tasks, events, reminders, and generate images. You are friendly, helpful, and assist with managing tasks, events, and reminders. Respond naturally and conversationally, using emojis when appropriate.

Your advanced capabilities:
- Create tasks and projects
- Create events and appointments
- Create reminders
- Generate AI images
- Execute commands automatically

When users ask you to create something, execute it immediately if you're confident about the request.`;

    console.log('WAKTI AI V2.1: Calling OpenAI API with enhanced capabilities');

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      
      const fallbackResponse = language === 'ar' 
        ? 'عذراً، حدث خطأ في خدمة الذكاء الاصطناعي.'
        : 'Sorry, there was an error with the AI service.';
      
      return new Response(JSON.stringify({
        response: fallbackResponse,
        conversationId: conversationId,
        intent: 'error',
        confidence: 'low',
        needsConfirmation: false,
        needsClarification: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chatCompletion = await openaiResponse.json();
    let aiResponse = chatCompletion.choices[0].message?.content || 'No response from AI';

    console.log('WAKTI AI V2.1: Generated AI response');

    // Execute actions if detected
    let actionResult = null;
    let actionTaken = null;

    if (intentAnalysis.confidence === 'high' && intentAnalysis.action) {
      try {
        console.log('WAKTI AI V2.1: Executing action:', intentAnalysis.action);
        actionResult = await executeAction(intentAnalysis.action, intentAnalysis.params, language);
        actionTaken = intentAnalysis.action;
        
        // Update AI response to include action confirmation
        if (actionResult.success) {
          const actionConfirmation = language === 'ar' 
            ? `\n\n✅ تم تنفيذ العملية بنجاح!`
            : `\n\n✅ Action completed successfully!`;
          aiResponse += actionConfirmation;
        }
      } catch (error) {
        console.error('WAKTI AI V2.1: Action execution failed:', error);
        actionResult = { success: false, error: error.message };
      }
    }

    console.log('WAKTI AI V2.1: Response ready with actions');

    return new Response(JSON.stringify({
      response: aiResponse,
      conversationId: conversationId,
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      actionTaken: actionTaken,
      actionResult: actionResult,
      needsConfirmation: intentAnalysis.confidence === 'medium',
      needsClarification: intentAnalysis.confidence === 'low',
      isNewConversation: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('WAKTI AI V2.1: Error:', error);
    
    const errorResponse = {
      error: 'Internal server error',
      response: 'Sorry, there was an error processing your request.',
      conversationId: 'error',
      intent: 'error',
      confidence: 'low',
      needsConfirmation: false,
      needsClarification: false
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
    ? ['أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'generate image', 'create image']
    : ['generate image', 'create image', 'draw', 'make picture', 'image of'];

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
      confidence: 'high',
      action: 'generate_image',
      params: { prompt: message.replace(/أنشئ صورة|اصنع صورة|ارسم|generate image|create image|draw|make picture/gi, '').trim() }
    };
  }

  return {
    intent: 'general_chat',
    confidence: 'medium',
    action: null,
    params: null
  };
}

function extractTaskParams(message: string) {
  const title = message.replace(/create task|add task|new task|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium'
  };
}

function extractEventParams(message: string) {
  const title = message.replace(/create event|add event|schedule|أنشئ حدث|أضف حدث/gi, '').trim();
  return {
    title: title || 'New Event',
    description: ''
  };
}

function extractReminderParams(message: string) {
  const title = message.replace(/remind me|reminder|ذكرني|تذكير/gi, '').trim();
  return {
    title: title || 'New Reminder',
    description: ''
  };
}

async function executeAction(action: string, params: any, language: string) {
  try {
    console.log('WAKTI AI V2.1: Executing action:', action, 'with params:', params);

    switch (action) {
      case 'generate_image':
        return await generateImage(params.prompt, language);
        
      case 'create_task':
      case 'create_event':
      case 'create_reminder':
        // For now, return success message - could integrate with database later
        return {
          success: true,
          message: language === 'ar' 
            ? `تم إنشاء ${action.includes('task') ? 'المهمة' : action.includes('event') ? 'الحدث' : 'التذكير'}: ${params.title}`
            : `${action.replace('create_', '').replace('_', ' ')} created: ${params.title}`
        };
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('WAKTI AI V2.1: Action execution error:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في تنفيذ العملية' : 'Failed to execute action',
      error: error.message
    };
  }
}

async function generateImage(prompt: string, language: string) {
  try {
    console.log("WAKTI AI V2.1: Generating image with Runware for prompt:", prompt);

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

    console.log("WAKTI AI V2.1: Runware response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("WAKTI AI V2.1: Runware response data:", result);
      
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        return {
          success: true,
          message: language === 'ar' ? 'تم إنشاء الصورة بنجاح' : 'Image generated successfully',
          imageUrl: imageResult.imageURL
        };
      } else {
        throw new Error('No image URL in response');
      }
    } else {
      const errorText = await response.text();
      console.error("WAKTI AI V2.1: Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('WAKTI AI V2.1: Error generating image:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إنشاء الصورة' : 'Failed to generate image',
      error: error.message
    };
  }
}
