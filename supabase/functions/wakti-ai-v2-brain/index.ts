
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
  userContext?: any;
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
    console.log('WAKTI AI V2.1: Starting enhanced brain processing');

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

    // Get authenticated user
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1: User authenticated:', user.id);

    const body: RequestBody = await req.json();
    const userMessage = body.message;
    const conversationId = body.conversationId || `conv-${Date.now()}-${user.id}`;
    const language = body.language || 'en';
    const inputType = body.inputType || 'text';

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1: Processing message from user:', user.id);

    // Get user profile for personalization
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, username, settings')
      .eq('id', user.id)
      .single();

    const userName = userProfile?.display_name || userProfile?.username || 'there';
    console.log('WAKTI AI V2.1: User name resolved:', userName);

    // Get or create user knowledge for personalization
    let { data: userKnowledge } = await supabaseAdmin
      .from('ai_user_knowledge')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!userKnowledge) {
      console.log('WAKTI AI V2.1: Creating new user knowledge record');
      const { data: newKnowledge } = await supabaseAdmin
        .from('ai_user_knowledge')
        .insert({
          user_id: user.id,
          interests: [],
          main_use: 'general',
          role: 'user',
          personal_note: ''
        })
        .select('*')
        .single();
      userKnowledge = newKnowledge;
    }

    // Check for conversation history and get last 7 conversations for context
    let isNewConversation = false;
    let conversationHistory: Message[] = [];

    // Get recent conversations for context (last 7)
    const { data: recentConversations } = await supabaseAdmin
      .from('ai_conversations')
      .select('id, title, last_message_at')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(7);

    // Get current conversation history
    if (conversationId.startsWith('conv-')) {
      isNewConversation = true;
      console.log('WAKTI AI V2.1: Starting new conversation');
    } else {
      const { data: chatHistory } = await supabaseAdmin
        .from('ai_chat_history')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20); // Get last 20 messages for context

      if (chatHistory && chatHistory.length > 0) {
        conversationHistory = chatHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
      }
    }

    // Enhanced AI tools detection with comprehensive patterns
    const lowerMessage = userMessage.toLowerCase();
    console.log('WAKTI AI V2.1: Analyzing message for AI tools patterns');
    
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
      /tell\s+me\s+about\s+(?:yourself|your\s+technology|your\s+ai)/i,
      
      // Arabic patterns - comprehensive
      /(?:ما\s+)?(?:هي\s+)?(?:أدوات|تقنيات|نماذج)\s+(?:الذكاء\s+الاصطناعي|الذكاء)\s+(?:التي\s+تستخدم|المستخدمة)/i,
      /(?:أي\s+)?(?:نوع\s+من\s+)?(?:الذكاء\s+الاصطناعي|التقنية|النظام)\s+(?:تستخدم|أنت)/i,
      /(?:كيف\s+)?(?:تم\s+)?(?:بناؤك|إنشاؤك|تطويرك|صنعك)/i,
      /(?:ما\s+)?(?:التقنية|النظام|المنصة)\s+(?:المستخدم|الذي\s+تستخدم)/i,
      /(?:من\s+)?(?:بناك|صنعك|طورك)/i,
      /(?:ما\s+)?(?:قدراتك|وظائفك|مميزاتك)/i,
      /(?:أخبرني\s+عن\s+)?(?:نفسك|تقنيتك|ذكائك)/i
    ];
    
    const isAiToolsQuestion = aiToolsPatterns.some(pattern => {
      const matches = pattern.test(lowerMessage);
      if (matches) {
        console.log('WAKTI AI V2.1: AI tools pattern matched:', pattern.source);
      }
      return matches;
    });
    
    if (isAiToolsQuestion) {
      console.log('WAKTI AI V2.1: Returning custom TMW response for', userName);
      
      const toolsResponse = language === 'ar' 
        ? `مرحباً ${userName}! 👋

أنا مساعد ذكي متقدم تم تطويره من قبل شركة TMW، شركة قطرية مقرها في الدوحة. موقعهم الإلكتروني tmw.qa

يمكنني مساعدتك في:
• الدردشة والإجابة على الأسئلة 💬
• إدارة المهام والمشاريع ✅
• إنشاء التذكيرات والمواعيد 📅
• الجدولة والتخطيط 🗓️
• الترجمة بين اللغات 🌐
• إنشاء الصور بالذكاء الاصطناعي 🎨

أتذكر محادثاتنا السابقة وأتعلم من تفضيلاتك لأقدم لك تجربة شخصية أفضل. 

هل تحتاج مساعدة في شيء محدد اليوم؟ 😊`
        : `Hello ${userName}! 👋

I'm an advanced AI assistant developed by TMW, a Qatari company based in Doha. Their website is tmw.qa

I can help you with:
• Chat and answer questions 💬
• Task management and projects ✅
• Creating reminders and appointments 📅
• Scheduling and planning 🗓️
• Translations between languages 🌐
• AI image generation 🎨

I remember our previous conversations and learn from your preferences to provide you with a more personalized experience.

What can I help you with today? 😊`;

      // Save the interaction
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

      await supabaseAdmin
        .from('ai_chat_history')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: toolsResponse,
          intent: 'ai_tools_info',
          confidence_level: 'high'
        });

      return new Response(JSON.stringify({
        response: toolsResponse,
        conversationId: conversationId,
        intent: 'ai_tools_info',
        confidence: 'high',
        needsConfirmation: false,
        needsClarification: false,
        isNewConversation: isNewConversation,
        userContext: {
          userName: userName,
          interests: userKnowledge?.interests || [],
          conversationCount: recentConversations?.length || 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build enhanced system message with user context
    const contextualInfo = recentConversations && recentConversations.length > 0 
      ? `You have ${recentConversations.length} recent conversation(s) with ${userName}.` 
      : `This is your first conversation with ${userName}.`;

    const interestsContext = userKnowledge?.interests && userKnowledge.interests.length > 0
      ? ` Their interests include: ${userKnowledge.interests.join(', ')}.`
      : '';

    const personalContext = userKnowledge?.personal_note 
      ? ` Personal note: ${userKnowledge.personal_note}.`
      : '';

    const roleContext = userKnowledge?.role && userKnowledge.role !== 'user'
      ? ` They work as: ${userKnowledge.role}.`
      : '';

    const systemMessageEn = `You are WAKTI AI V2.1, an advanced personal assistant developed by TMW, a Qatari company based in Doha (tmw.qa). 

You are talking to ${userName}. ${contextualInfo}${interestsContext}${personalContext}${roleContext}

You should:
- Always address the user by their name (${userName})
- Be conversational, warm, and helpful
- Remember context from this conversation
- Be smart and provide detailed, useful responses
- Use appropriate emojis to make conversations engaging
- If asked about AI tools, models, or how you were built, always mention that you're developed by TMW (tmw.qa)
- Integrate seamlessly with WAKTI's task management, calendar, and reminder systems
- Learn from user preferences and adapt your responses accordingly

Keep responses natural, conversational, and personalized to ${userName}'s needs.`;

    const systemMessageAr = `أنت WAKTI AI V2.1، مساعد شخصي متقدم تم تطويره من قبل شركة TMW، شركة قطرية مقرها في الدوحة (tmw.qa).

أنت تتحدث مع ${userName}. ${contextualInfo}${interestsContext}${personalContext}${roleContext}

يجب أن تقوم بما يلي:
- مناداة المستخدم باسمه دائماً (${userName})
- كن ودوداً ومحادثاً ومفيداً
- تذكر السياق من هذه المحادثة
- كن ذكياً وقدم إجابات مفصلة ومفيدة
- استخدم الرموز التعبيرية المناسبة لجعل المحادثات جذابة
- إذا سُئلت عن أدوات الذكاء الاصطناعي أو النماذج أو كيف تم بناؤك، اذكر دائماً أنك مطور من قبل TMW (tmw.qa)
- تكامل بسلاسة مع أنظمة إدارة المهام والتقويم والتذكيرات في WAKTI
- تعلم من تفضيلات المستخدم وتكيف إجاباتك وفقاً لذلك

حافظ على الردود طبيعية ومحادثة وشخصية لاحتياجات ${userName}.`;

    // Build conversation context with history
    const messages: Message[] = [
      { 
        role: 'system', 
        content: language === 'ar' ? systemMessageAr : systemMessageEn 
      },
      ...conversationHistory.slice(-10), // Last 10 messages for context
      { role: 'user', content: userMessage }
    ];

    console.log('WAKTI AI V2.1: Calling AI with enhanced context for', userName);

    // Try DeepSeek first, then OpenAI
    let aiResponse = '';
    let usedModel = '';

    try {
      // Try DeepSeek first
      if (Deno.env.get('DEEPSEEK_API_KEY')) {
        console.log('WAKTI AI V2.1: Trying DeepSeek API');
        const deepSeekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (deepSeekResponse.ok) {
          const deepSeekResult = await deepSeekResponse.json();
          aiResponse = deepSeekResult.choices[0].message?.content || '';
          usedModel = 'deepseek-chat';
          console.log('WAKTI AI V2.1: DeepSeek response successful');
        } else {
          throw new Error(`DeepSeek API error: ${deepSeekResponse.status}`);
        }
      }
    } catch (error) {
      console.log('WAKTI AI V2.1: DeepSeek failed, trying OpenAI:', error);
      
      // Fallback to OpenAI
      if (Deno.env.get('OPENAI_API_KEY')) {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messages,
            model: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!openaiResponse.ok) {
          throw new Error(`OpenAI API error: ${openaiResponse.status}`);
        }

        const chatCompletion = await openaiResponse.json();
        aiResponse = chatCompletion.choices[0].message?.content || 'No response from AI';
        usedModel = 'gpt-4o-mini';
        console.log('WAKTI AI V2.1: OpenAI response successful');
      } else {
        throw new Error('No AI service available');
      }
    }

    // Handle image generation requests
    let actionTaken: string | undefined = undefined;
    let actionResult: AIActionResults | undefined = undefined;

    if (userMessage.toLowerCase().includes('generate an image') || 
        userMessage.toLowerCase().includes('create an image') || 
        userMessage.toLowerCase().includes('صورة')) {
      actionTaken = 'generate_image';
      
      try {
        let imagePrompt = userMessage;
        
        // Translate Arabic to English for DALL-E if needed
        if (language === 'ar') {
          const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [{ 
                role: 'user', 
                content: `Translate this Arabic image request to English for DALL-E: ${userMessage}` 
              }],
              model: 'gpt-4o-mini',
            }),
          });
          
          if (translationResponse.ok) {
            const translationResult = await translationResponse.json();
            imagePrompt = translationResult.choices[0].message?.content || userMessage;
          }
        }

        const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: imagePrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
          }),
        });

        if (imageResponse.ok) {
          const imageResult = await imageResponse.json();
          const imageUrl = imageResult.data[0].url;
          actionResult = { imageUrl };
          
          // Append image success message
          aiResponse += language === 'ar' 
            ? `\n\n🎨 تم إنشاء الصورة بنجاح!`
            : `\n\n🎨 Image generated successfully!`;
        } else {
          throw new Error(`Image generation failed: ${imageResponse.status}`);
        }
      } catch (imageError) {
        console.error('WAKTI AI V2.1: Image generation error:', imageError);
        actionResult = { error: (imageError as any).message || 'Failed to generate image' };
      }
    }

    // Save conversation to database
    const { error: saveUserError } = await supabaseAdmin
      .from('ai_chat_history')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: userMessage,
        input_type: inputType,
        language: language
      });

    const { error: saveAssistantError } = await supabaseAdmin
      .from('ai_chat_history')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: aiResponse,
        intent: 'enhanced_chat',
        confidence_level: 'high',
        action_taken: actionTaken,
        action_result: actionResult,
        metadata: {
          model_used: usedModel,
          user_name: userName,
          conversation_context: true
        }
      });

    if (saveUserError || saveAssistantError) {
      console.error('WAKTI AI V2.1: Error saving chat history:', saveUserError || saveAssistantError);
    }

    // Create or update conversation record
    if (isNewConversation) {
      const conversationTitle = userMessage.length > 50 
        ? userMessage.substring(0, 50) + '...' 
        : userMessage;
        
      await supabaseAdmin
        .from('ai_conversations')
        .insert({
          id: conversationId,
          user_id: user.id,
          title: conversationTitle,
          last_message_at: new Date().toISOString()
        });
    } else {
      await supabaseAdmin
        .from('ai_conversations')
        .update({
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    }

    console.log('WAKTI AI V2.1: Enhanced response generated successfully for', userName);

    return new Response(JSON.stringify({
      response: aiResponse,
      conversationId: conversationId,
      intent: 'enhanced_chat',
      confidence: 'high',
      actionTaken: actionTaken,
      actionResult: actionResult,
      needsConfirmation: false,
      needsClarification: false,
      isNewConversation: isNewConversation,
      userContext: {
        userName: userName,
        interests: userKnowledge?.interests || [],
        conversationCount: recentConversations?.length || 0,
        modelUsed: usedModel
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('WAKTI AI V2.1: Enhanced brain error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallback: true 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
