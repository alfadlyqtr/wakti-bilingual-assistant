
import { serve } from '@supabase/functions-js';
import OpenAI from 'openai';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { Database } from './supabase/database.types';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface запросы {
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

const SYSTEM_MESSAGE_EN = `You are WAKTI AI V2.1, a personal assistant designed to help users manage their time and tasks effectively. You are an advanced AI assistant developed by TMW, a Qatari company based in Doha (tmw.qa). You can create tasks, events, and reminders. You can also answer questions and provide information. You are integrated with WAKTI's systems to help the user stay organized. You should always respond in a clear, concise, and friendly manner. If you are unsure about something, ask for clarification. If you cannot fulfill a request, explain why. You should always be polite and respectful. You should never be rude or offensive. You should never ask for personal information. You should never ask for sensitive information. You should never ask for passwords or credit card numbers. You should never ask for anything that could be used to harm the user. You should always be helpful and friendly.`;

const SYSTEM_MESSAGE_AR = `أنت WAKTI AI V2.1، مساعد شخصي مصمم لمساعدة المستخدمين على إدارة وقتهم ومهامهم بفعالية. أنت مساعد ذكي متقدم تم تطويره من قبل شركة TMW، شركة قطرية مقرها في الدوحة (tmw.qa). يمكنك إنشاء مهام وأحداث وتذكيرات. يمكنك أيضًا الإجابة على الأسئلة وتقديم المعلومات. أنت متكامل مع أنظمة WAKTI لمساعدة المستخدم على البقاء منظمًا. يجب أن تستجيب دائمًا بطريقة واضحة وموجزة وودية. إذا لم تكن متأكدًا من شيء ما، فاطلب توضيحًا. إذا لم تتمكن من تلبية طلب، فاشرح السبب. يجب أن تكون دائمًا مهذبًا ومحترمًا. يجب ألا تكون وقحًا أو مسيئًا أبدًا. يجب ألا تطلب معلومات شخصية أبدًا. يجب ألا تطلب معلومات حساسة أبدًا. يجب ألا تطلب كلمات مرور أو أرقام بطاقات ائتمان أبدًا. يجب ألا تطلب أي شيء يمكن استخدامه لإيذاء المستخدم. يجب أن تكون دائمًا متعاونًا وودودًا.`;

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

    const supabaseAdmin = createClient<Database>(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_ANON_KEY ?? '',
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

    const body: запросы = await req.json();
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

    console.log('WAKTI AI V2.1: Processing message:', userMessage);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let isNewConversation = false;
    let initialMessages: Message[] = [];

    if (conversationId.startsWith('temp-')) {
      isNewConversation = true;
      initialMessages = [{ role: 'system', content: language === 'ar' ? SYSTEM_MESSAGE_AR : SYSTEM_MESSAGE_EN }];
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

      initialMessages.unshift({ role: 'system', content: language === 'ar' ? SYSTEM_MESSAGE_AR : SYSTEM_MESSAGE_EN });
    }

    // Enhanced pattern detection for AI tools question - MORE COMPREHENSIVE
    const lowerMessage = userMessage.toLowerCase();
    console.log('WAKTI AI V2.1: Checking message for AI tools patterns:', lowerMessage);
    
    // Expanded patterns for AI tools questions
    const aiToolsPatterns = [
      // English patterns
      /(?:which|what)\s+(?:ai\s+)?tools?\s+(?:are\s+you\s+using|do\s+you\s+use)/i,
      /(?:what\s+)?(?:ai\s+)?(?:models?|technology|tools?)\s+(?:are\s+you\s+using|do\s+you\s+use|power\s+you)/i,
      /(?:what\s+)?(?:kind\s+of\s+)?(?:ai|artificial\s+intelligence)\s+(?:are\s+you|do\s+you\s+use)/i,
      /(?:how\s+)?(?:are\s+you\s+)?(?:built|made|created|developed)/i,
      /(?:what\s+)?(?:technology|tech)\s+(?:do\s+you\s+use|are\s+you\s+using|powers?\s+you)/i,
      /(?:what\s+)?(?:language\s+)?models?\s+(?:do\s+you\s+use|are\s+you\s+using)/i,
      /(?:what\s+)?(?:ai\s+)?(?:system|platform)\s+(?:are\s+you|do\s+you\s+use)/i,
      
      // Arabic patterns
      /(?:ما\s+)?(?:هي\s+)?(?:أدوات|تقنيات)\s+(?:الذكاء\s+الاصطناعي|الذكاء)\s+(?:التي\s+تستخدم|المستخدمة)/i,
      /(?:أي\s+)?(?:نوع\s+من\s+)?(?:الذكاء\s+الاصطناعي|التقنية)\s+(?:تستخدم|أنت)/i,
      /(?:كيف\s+)?(?:تم\s+)?(?:بناؤك|إنشاؤك|تطويرك)/i,
      /(?:ما\s+)?(?:التقنية|النظام)\s+(?:المستخدم|الذي\s+تستخدم)/i
    ];
    
    const aiCapabilitiesPatterns = [
      /(?:what\s+can\s+you\s+do|your\s+capabilities|what\s+are\s+you|who\s+are\s+you)/i,
      /(?:ما\s+)?(?:يمكنك\s+فعل|قدراتك|من\s+أنت)/i
    ];
    
    // Check if any pattern matches
    const isAiToolsQuestion = aiToolsPatterns.some(pattern => pattern.test(lowerMessage)) || 
                             aiCapabilitiesPatterns.some(pattern => pattern.test(lowerMessage));
    
    console.log('WAKTI AI V2.1: AI tools question detected:', isAiToolsQuestion);
    
    if (isAiToolsQuestion) {
      console.log('WAKTI AI V2.1: Returning custom TMW response');
      
      const toolsResponse = language === 'ar' 
        ? `أنا مساعد ذكي متقدم تم تطويره من قبل شركة قطرية مقرها في الدوحة. شركة TMW، موقعهم الإلكتروني tmw.qa

يمكنني القيام بما يلي:
• الدردشة والإجابة على الأسئلة 💬
• إدارة المهام والمشاريع ✅
• إنشاء التذكيرات والمواعيد 📅
• الجدولة والتخطيط 🗓️
• الترجمة بين اللغات 🌐
• إنشاء الصور بالذكاء الاصطناعي 🎨

أتكامل مع أنظمة WAKTI لأبقيك منظماً ومنتجاً. هل تحتاج مساعدة في شيء محدد؟ 😊`
        : `I'm an advanced AI assistant developed by a Qatari company based in Doha - TMW. Their website is tmw.qa

I can help you with:
• Chat and answer questions 💬
• Task management and projects ✅
• Creating reminders and appointments 📅
• Scheduling and planning 🗓️
• Translations between languages 🌐
• AI image generation 🎨

I integrate with WAKTI's own systems to keep you organized and productive. Need help with something specific? Just ask! 😊`;

      const { error: saveError } = await supabaseAdmin
        .from('ai_chat_history')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: userMessage,
          input_type: inputType
        });

      if (saveError) {
        console.error('Error saving user message:', saveError);
      }

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

    console.log('WAKTI AI V2.1: Processing with general AI model');

    const chatCompletion = await openai.chat.completions.create({
      messages: [...initialMessages, { role: 'user', content: userMessage }],
      model: 'gpt-4-turbo-preview',
    });

    const aiResponse = chatCompletion.choices[0].message?.content || 'No response from AI';
    const intent = 'unknown';
    const confidence = 'medium';
    let actionTaken: string | undefined = undefined;
    let actionResult: AIActionResults | undefined = undefined;
    let needsConfirmation = false;
    let needsClarification = false;

    // Image Generation Request
    if (userMessage.toLowerCase().includes('generate an image') || userMessage.toLowerCase().includes('create an image') || userMessage.toLowerCase().includes('draw an image') || userMessage.toLowerCase().includes('make an image') || userMessage.toLowerCase().includes('صورة')) {
      actionTaken = 'generate_image';
      
      // Translate the prompt to English for DALL-E
      let translatedPrompt = userMessage;
      if (language === 'ar') {
        actionTaken = 'translate_for_image';
        
        const translationResult = await openai.chat.completions.create({
          messages: [{ role: 'user', content: `Translate the following Arabic text to English, and only give me the translated text: ${userMessage}` }],
          model: 'gpt-4-turbo-preview',
        });
        
        translatedPrompt = translationResult.choices[0].message?.content || userMessage;
        aiResponse = `**${language === 'ar' ? 'تم تحويل النص إلى الإنجليزية لإنشاء الصورة' : 'Translated to English for image generation'}**\n${translatedPrompt}\n\n**${language === 'ar' ? 'النص المترجم:' : 'Translated Text:'}**\n${translatedPrompt}`;
      }
      
      try {
        const imageResult = await openai.images.generate({
          prompt: translatedPrompt,
          n: 1,
          size: "512x512",
        });

        const imageUrl = imageResult.data[0].url;
        actionResult = { imageUrl };
      } catch (imageError) {
        console.error('DALL-E error:', imageError);
        actionResult = { error: (imageError as any).message || 'Failed to generate image' };
      }
    }

    const { error: saveError } = await supabaseAdmin
      .from('ai_chat_history')
      .insert([
        {
          conversation_id: conversationId,
          role: 'user',
          content: userMessage,
          input_type: inputType
        },
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          intent: intent,
          confidence_level: confidence,
          action_taken: actionTaken
        }
      ]);

    if (saveError) {
      console.error('Error saving chat history:', saveError);
    }

    if (isNewConversation && !conversationId.startsWith('temp-')) {
      const { error: conversationError } = await supabaseAdmin
        .from('ai_conversations')
        .insert({
          id: conversationId,
          title: userMessage.substring(0, 50),
          last_message_at: new Date().toISOString()
        });

      if (conversationError) {
        console.error('Error saving conversation:', conversationError);
      }
    } else {
      if (!conversationId.startsWith('temp-')) {
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
    }

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
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
