
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  message: string;
  conversationId?: string;
  language: 'en' | 'ar';
  inputType: 'text' | 'voice';
}

interface AIActionResults {
  imageUrl?: string;
  error?: string;
}

interface AIResponse {
  response: string;
  conversationId: string;
  intent: string;
  confidence: 'high' | 'medium' | 'low';
  actionTaken?: string;
  actionResult?: AIActionResults;
  needsConfirmation: boolean;
  needsClarification: boolean;
  isNewConversation?: boolean;
}

interface UserProfile {
  display_name?: string;
  username?: string;
}

interface UserKnowledge {
  interests: string[];
  role?: string;
  main_use?: string;
  personal_note?: string;
}

interface ConversationContext {
  recentTopics: string[];
  userPreferences: any;
  conversationSummary: string;
}

// Enhanced system messages with personalization
const createPersonalizedSystemMessage = (
  language: 'en' | 'ar',
  userProfile: UserProfile | null,
  userKnowledge: UserKnowledge | null,
  conversationContext: ConversationContext | null
): string => {
  const userName = userProfile?.display_name || userProfile?.username || (language === 'ar' ? 'صديقي' : 'friend');
  const interests = userKnowledge?.interests?.join(', ') || '';
  const role = userKnowledge?.role || '';
  const mainUse = userKnowledge?.main_use || '';
  const personalNote = userKnowledge?.personal_note || '';
  const recentTopics = conversationContext?.recentTopics?.join(', ') || '';

  if (language === 'ar') {
    return `أنت WAKTI AI V2.1، المساعد الذكي المتطور المطور من قبل شركة TMW القطرية (tmw.qa).

مرحباً ${userName}! أنا هنا لمساعدتك بطريقة شخصية ومتطورة.

معلوماتك الشخصية:
${role ? `- دورك: ${role}` : ''}
${mainUse ? `- الاستخدام الرئيسي: ${mainUse}` : ''}
${interests ? `- اهتماماتك: ${interests}` : ''}
${personalNote ? `- ملاحظة شخصية: ${personalNote}` : ''}
${recentTopics ? `- المواضيع الأخيرة: ${recentTopics}` : ''}

قدراتي المتطورة:
• إدارة المحادثات الطبيعية والذكية 💬
• تذكر سياق محادثاتك السابقة 🧠
• إنشاء المهام والأحداث والتذكيرات ✅
• إنشاء الصور بالذكاء الاصطناعي 🎨
• الترجمة والمساعدة اللغوية 🌐
• التكامل مع أنظمة WAKTI 🔗

أسلوبي في المحادثة:
- أخاطبك دائماً باسمك ${userName}
- أتذكر محادثاتنا السابقة وأستخدم السياق
- أتكيف مع اهتماماتك ودورك
- أقدم اقتراحات استباقية مفيدة
- أحافظ على طابع ودود ومحترف

جاهز لمساعدتك ${userName}! كيف يمكنني خدمتك اليوم؟`;
  }

  return `You are WAKTI AI V2.1, an advanced intelligent assistant developed by TMW, a Qatari company (tmw.qa).

Hello ${userName}! I'm here to assist you in a personalized and advanced way.

Your Personal Profile:
${role ? `- Role: ${role}` : ''}
${mainUse ? `- Main Use: ${mainUse}` : ''}
${interests ? `- Interests: ${interests}` : ''}
${personalNote ? `- Personal Note: ${personalNote}` : ''}
${recentTopics ? `- Recent Topics: ${recentTopics}` : ''}

My Advanced Capabilities:
• Natural and intelligent conversation management 💬
• Remember context from your previous conversations 🧠
• Create tasks, events, and reminders ✅
• AI image generation 🎨
• Translation and language assistance 🌐
• Integration with WAKTI systems 🔗

My Conversation Style:
- Always address you by your name ${userName}
- Remember our previous conversations and use context
- Adapt to your interests and role
- Provide proactive helpful suggestions
- Maintain a friendly and professional tone

Ready to help you ${userName}! How can I assist you today?`;
};

// Enhanced AI tools detection patterns
const detectAIToolsQuestion = (message: string, language: 'en' | 'ar'): boolean => {
  const lowerMessage = message.toLowerCase();
  
  const aiToolsPatterns = [
    // English patterns - comprehensive
    /(?:which|what)\s+(?:ai\s+)?tools?\s+(?:are\s+you\s+using|do\s+you\s+use|power\s+you)/i,
    /(?:what\s+)?(?:ai\s+)?(?:models?|technology|tools?|system)\s+(?:are\s+you\s+using|do\s+you\s+use|power\s+you|drive\s+you)/i,
    /(?:what\s+)?(?:kind\s+of\s+)?(?:ai|artificial\s+intelligence|technology)\s+(?:are\s+you|do\s+you\s+use|powers?\s+you)/i,
    /(?:how\s+)?(?:are\s+you\s+)?(?:built|made|created|developed|designed)/i,
    /(?:what\s+)?(?:technology|tech|software)\s+(?:do\s+you\s+use|are\s+you\s+using|powers?\s+you)/i,
    /(?:what\s+)?(?:language\s+)?models?\s+(?:do\s+you\s+use|are\s+you\s+using|power\s+you)/i,
    /(?:what\s+)?(?:ai\s+)?(?:system|platform|engine)\s+(?:are\s+you|do\s+you\s+use|runs?\s+you)/i,
    /(?:which\s+)?(?:company|organization)\s+(?:made|built|created|developed)\s+you/i,
    /(?:who\s+)?(?:built|made|created|developed)\s+you/i,
    /what\s+are\s+your\s+(?:capabilities|features|functions)/i,
    
    // Arabic patterns - comprehensive  
    /(?:ما\s+)?(?:هي\s+)?(?:أدوات|تقنيات|نماذج)\s+(?:الذكاء\s+الاصطناعي|الذكاء)\s+(?:التي\s+تستخدم|المستخدمة)/i,
    /(?:أي\s+)?(?:نوع\s+من\s+)?(?:الذكاء\s+الاصطناعي|التقنية|النظام)\s+(?:تستخدم|أنت)/i,
    /(?:كيف\s+)?(?:تم\s+)?(?:بناؤك|إنشاؤك|تطويرك|صنعك)/i,
    /(?:ما\s+)?(?:التقنية|النظام|المنصة)\s+(?:المستخدم|الذي\s+تستخدم)/i,
    /(?:من\s+)?(?:بناك|صنعك|طورك)/i,
    /(?:ما\s+)?(?:قدراتك|وظائفك|مميزاتك)/i
  ];
  
  return aiToolsPatterns.some(pattern => pattern.test(lowerMessage));
};

// Extract conversation context from recent conversations
const extractConversationContext = async (
  supabaseAdmin: any,
  userId: string
): Promise<ConversationContext> => {
  try {
    // Get last 7 conversations
    const { data: conversations } = await supabaseAdmin
      .from('ai_conversations')
      .select('id, title, last_message_at')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(7);

    if (!conversations || conversations.length === 0) {
      return { recentTopics: [], userPreferences: {}, conversationSummary: '' };
    }

    // Get recent messages from these conversations
    const conversationIds = conversations.map(c => c.id);
    const { data: recentMessages } = await supabaseAdmin
      .from('ai_chat_history')
      .select('content, role, intent, created_at')
      .in('conversation_id', conversationIds)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Extract topics and patterns
    const recentTopics: string[] = [];
    const userMessages = recentMessages?.filter(m => m.role === 'user') || [];
    
    // Simple topic extraction from user messages
    userMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      if (content.includes('task') || content.includes('مهمة')) recentTopics.push('tasks');
      if (content.includes('event') || content.includes('حدث')) recentTopics.push('events');
      if (content.includes('reminder') || content.includes('تذكير')) recentTopics.push('reminders');
      if (content.includes('image') || content.includes('صورة')) recentTopics.push('images');
      if (content.includes('translate') || content.includes('ترجم')) recentTopics.push('translation');
    });

    // Remove duplicates
    const uniqueTopics = [...new Set(recentTopics)];

    // Create conversation summary
    const conversationTitles = conversations.map(c => c.title).join(', ');
    const conversationSummary = `Recent conversations: ${conversationTitles}`;

    return {
      recentTopics: uniqueTopics,
      userPreferences: {},
      conversationSummary
    };
  } catch (error) {
    console.error('Error extracting conversation context:', error);
    return { recentTopics: [], userPreferences: {}, conversationSummary: '' };
  }
};

// Enhanced intent analysis
const analyzeIntent = (message: string, language: 'en' | 'ar', context: ConversationContext): any => {
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

  // Check for specific intents
  if (taskPatterns.some(p => lowerMessage.includes(p))) {
    return { intent: 'create_task', confidence: 'high' };
  }
  
  if (eventPatterns.some(p => lowerMessage.includes(p))) {
    return { intent: 'create_event', confidence: 'high' };
  }
  
  if (reminderPatterns.some(p => lowerMessage.includes(p))) {
    return { intent: 'create_reminder', confidence: 'high' };
  }
  
  if (imagePatterns.some(p => lowerMessage.includes(p))) {
    return { intent: 'generate_image', confidence: 'high' };
  }

  return { intent: 'general_chat', confidence: 'medium' };
};

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authorizationHeader.split(' ')[1];
    if (!token) {
      return new Response(JSON.stringify({ error: 'Invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const userMessage = body.message;
    const conversationId = body.conversationId || `temp-${Date.now()}`;
    const language = body.language || 'en';
    const inputType = body.inputType || 'text';

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1: Processing enhanced message:', userMessage);

    // Fetch user profile for personalization
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single();

    // Fetch user knowledge for personalization
    const { data: userKnowledge } = await supabaseAdmin
      .from('ai_user_knowledge')
      .select('interests, role, main_use, personal_note')
      .eq('user_id', user.id)
      .single();

    // Extract conversation context from recent conversations
    const conversationContext = await extractConversationContext(supabaseAdmin, user.id);

    console.log('WAKTI AI V2.1: User context loaded:', {
      profile: userProfile,
      knowledge: userKnowledge,
      context: conversationContext
    });

    let isNewConversation = false;
    let initialMessages: Message[] = [];

    if (conversationId.startsWith('temp-')) {
      isNewConversation = true;
      // Create personalized system message
      const systemMessage = createPersonalizedSystemMessage(language, userProfile, userKnowledge, conversationContext);
      initialMessages = [{ role: 'system', content: systemMessage }];
    } else {
      const { data: chatHistory, error: dbError } = await supabaseAdmin
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (dbError) {
        console.error('Error fetching chat history:', dbError);
        return new Response(JSON.stringify({ error: 'Failed to fetch chat history' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      initialMessages = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Add enhanced system message with context
      const systemMessage = createPersonalizedSystemMessage(language, userProfile, userKnowledge, conversationContext);
      initialMessages.unshift({ role: 'system', content: systemMessage });
    }

    // Enhanced AI tools question detection
    if (detectAIToolsQuestion(userMessage, language)) {
      console.log('WAKTI AI V2.1: AI tools question detected, returning enhanced TMW response');
      
      const userName = userProfile?.display_name || userProfile?.username || (language === 'ar' ? 'صديقي' : 'friend');
      
      const toolsResponse = language === 'ar' 
        ? `مرحباً ${userName}! 👋

أنا WAKTI AI V2.1، مساعد ذكي متطور تم تطويره من قبل شركة TMW القطرية المبتكرة، مقرها في الدوحة. موقعهم الإلكتروني: tmw.qa

قدراتي المتطورة تشمل:
🧠 **المحادثات الذكية** - أفهم السياق وأتذكر محادثاتنا السابقة
✅ **إدارة المهام** - إنشاء وتنظيم المهام والمشاريع  
📅 **التقويم والمواعيد** - جدولة الأحداث والاجتماعات
⏰ **التذكيرات الذكية** - تذكيرات مخصصة ومتكررة
🎨 **إنشاء الصور** - توليد صور إبداعية بالذكاء الاصطناعي
🌐 **الترجمة المتقدمة** - ترجمة دقيقة بين اللغات
💬 **المراسلة** - تواصل آمن مع جهات الاتصال
🔗 **التكامل مع WAKTI** - ربط سلس مع جميع أنظمة التطبيق

ما يميزني ${userName}:
• أخاطبك باسمك دائماً وأتذكر تفضيلاتك
• أفهم دورك واهتماماتك الشخصية  
• أتكيف مع أسلوب محادثتك
• أقدم اقتراحات استباقية مفيدة

كيف يمكنني مساعدتك اليوم ${userName}؟ 😊`
        : `Hello ${userName}! 👋

I'm WAKTI AI V2.1, an advanced intelligent assistant developed by TMW, an innovative Qatari company based in Doha. Their website: tmw.qa

My advanced capabilities include:
🧠 **Smart Conversations** - I understand context and remember our previous conversations
✅ **Task Management** - Creating and organizing tasks and projects
📅 **Calendar & Appointments** - Scheduling events and meetings
⏰ **Smart Reminders** - Personalized and recurring reminders
🎨 **Image Generation** - Creative AI-powered image creation
🌐 **Advanced Translation** - Accurate translation between languages
💬 **Messaging** - Secure communication with contacts
🔗 **WAKTI Integration** - Seamless connection with all app systems

What makes me special ${userName}:
• I always address you by name and remember your preferences
• I understand your role and personal interests
• I adapt to your conversation style
• I provide proactive helpful suggestions

How can I help you today ${userName}? 😊`;

      // Save user message
      await supabaseAdmin
        .from('ai_chat_history')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: userMessage,
          input_type: inputType,
          language: language
        });

      return new Response(JSON.stringify({
        response: toolsResponse,
        conversationId: conversationId,
        intent: 'ai_tools_info',
        confidence: 'high',
        needsConfirmation: false,
        needsClarification: false,
        isNewConversation: isNewConversation
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1: Processing with enhanced AI model');

    // Analyze intent with context
    const intentAnalysis = analyzeIntent(userMessage, language, conversationContext);

    // Call OpenAI API with enhanced context
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [...initialMessages, { role: 'user', content: userMessage }],
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const chatCompletion = await openaiResponse.json();
    const aiResponse = chatCompletion.choices[0].message?.content || 'No response from AI';
    const intent = intentAnalysis.intent;
    const confidence = intentAnalysis.confidence;
    let actionTaken: string | undefined = undefined;
    let actionResult: AIActionResults | undefined = undefined;
    let needsConfirmation = false;
    let needsClarification = false;

    // Enhanced image generation with context
    if (userMessage.toLowerCase().includes('generate an image') || 
        userMessage.toLowerCase().includes('create an image') || 
        userMessage.toLowerCase().includes('draw an image') || 
        userMessage.toLowerCase().includes('make an image') || 
        userMessage.toLowerCase().includes('صورة')) {
      
      actionTaken = 'generate_image';
      
      // Translate prompt to English for DALL-E if needed
      let translatedPrompt = userMessage;
      if (language === 'ar') {
        const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `Translate the following Arabic text to English for image generation, only return the translated text: ${userMessage}` }],
            model: 'gpt-4o-mini',
          }),
        });
        
        if (translationResponse.ok) {
          const translationResult = await translationResponse.json();
          translatedPrompt = translationResult.choices[0].message?.content || userMessage;
        }
      }
      
      try {
        const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: translatedPrompt,
            n: 1,
            size: "512x512",
          }),
        });

        if (imageResponse.ok) {
          const imageResult = await imageResponse.json();
          const imageUrl = imageResult.data[0].url;
          actionResult = { imageUrl };
        } else {
          throw new Error(`Image generation failed: ${imageResponse.status}`);
        }
      } catch (imageError) {
        console.error('DALL-E error:', imageError);
        actionResult = { error: (imageError as any).message || 'Failed to generate image' };
      }
    }

    // Save conversation messages
    const { error: saveError } = await supabaseAdmin
      .from('ai_chat_history')
      .insert([
        {
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: userMessage,
          input_type: inputType,
          language: language,
          intent: intent,
          confidence_level: confidence
        },
        {
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: aiResponse,
          intent: intent,
          confidence_level: confidence,
          action_taken: actionTaken,
          language: language
        }
      ]);

    if (saveError) {
      console.error('Error saving chat history:', saveError);
    }

    // Handle conversation creation/updates
    if (isNewConversation && !conversationId.startsWith('temp-')) {
      const userName = userProfile?.display_name || userProfile?.username || 'User';
      const conversationTitle = `Chat with ${userName} - ${userMessage.substring(0, 30)}`;
      
      const { error: conversationError } = await supabaseAdmin
        .from('ai_conversations')
        .insert({
          id: conversationId,
          user_id: user.id,
          title: conversationTitle,
          last_message_at: new Date().toISOString()
        });

      if (conversationError) {
        console.error('Error saving conversation:', conversationError);
      }
    } else if (!conversationId.startsWith('temp-')) {
      const { error: updateError } = await supabaseAdmin
        .from('ai_conversations')
        .update({
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateError) {
        console.error('Error updating conversation:', updateError);
      }
    }

    console.log('WAKTI AI V2.1: Enhanced response generated successfully');

    return new Response(JSON.stringify({
      response: aiResponse,
      conversationId: conversationId,
      intent: intent,
      confidence: confidence,
      actionTaken: actionTaken,
      actionResult: actionResult,
      needsConfirmation: needsConfirmation,
      needsClarification: needsClarification,
      isNewConversation: isNewConversation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('WAKTI AI V2.1: Enhanced processing error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
