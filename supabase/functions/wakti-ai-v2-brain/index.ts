
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log('WAKTI AI V2.1: Processing request');

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('WAKTI AI V2.1: User verification failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('WAKTI AI V2.1: User authenticated successfully:', user.id);

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

    // Check if OpenAI API key is available
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('WAKTI AI V2.1: OpenAI API key not found');
      return new Response(JSON.stringify({ 
        error: 'AI service not configured',
        response: language === 'ar' 
          ? 'عذراً، خدمة الذكاء الاصطناعي غير متاحة حالياً. يرجى التواصل مع المطور لإعداد مفاتيح API.'
          : 'Sorry, AI service is not available. Please contact the developer to configure API keys.',
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

    // Get user profile for personalized greeting
    let userName = 'there';
    try {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single();
      
      userName = profile?.display_name || profile?.username || 'there';
    } catch (error) {
      console.log('Could not fetch user profile, using default name');
    }

    // System message
    const systemMessage = language === 'ar' 
      ? `أنت WAKTI AI V2.1، المساعد الذكي المتطور لتطبيق وكتي. اسم المستخدم هو ${userName}. أنت ودود ومفيد وتساعد في إدارة المهام والأحداث والتذكيرات. رد بشكل طبيعي ومحادثة، واستخدم الرموز التعبيرية عند الحاجة. كن مفيداً ومساعداً.`
      : `You are WAKTI AI V2.1, the advanced intelligent assistant for the Wakti app. The user's name is ${userName}. You are friendly, helpful, and assist with managing tasks, events, and reminders. Respond naturally and conversationally, using emojis when appropriate. Be helpful and supportive.`;

    let isNewConversation = false;
    let initialMessages = [];

    // Check if this is a new conversation or load existing history
    if (conversationId.startsWith('conv-')) {
      isNewConversation = true;
      initialMessages = [{ role: 'system', content: systemMessage }];
    } else {
      // Try to load conversation history
      try {
        const { data: chatHistory } = await supabaseClient
          .from('ai_chat_history')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(10); // Limit to last 10 messages for context

        initialMessages = [
          { role: 'system', content: systemMessage },
          ...(chatHistory || []).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          }))
        ];
      } catch (error) {
        console.error('Error loading chat history:', error);
        initialMessages = [{ role: 'system', content: systemMessage }];
      }
    }

    console.log('WAKTI AI V2.1: Calling OpenAI API');

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
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
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      
      const fallbackResponse = language === 'ar' 
        ? 'عذراً، حدث خطأ في خدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.'
        : 'Sorry, there was an error with the AI service. Please try again.';
      
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
    const aiResponse = chatCompletion.choices[0].message?.content || 'No response from AI';

    console.log('WAKTI AI V2.1: Generated AI response');

    // Save chat history
    try {
      // Save user message
      await supabaseClient
        .from('ai_chat_history')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: userMessage,
          input_type: inputType,
          language: language
        });

      // Save assistant response
      await supabaseClient
        .from('ai_chat_history')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: aiResponse,
          language: language
        });

      // Handle conversation creation/updates
      if (isNewConversation) {
        const conversationTitle = userMessage.length > 30 
          ? userMessage.substring(0, 30) + '...' 
          : userMessage;
        
        try {
          await supabaseClient
            .from('ai_conversations')
            .insert({
              id: conversationId,
              user_id: user.id,
              title: conversationTitle,
              last_message_at: new Date().toISOString()
            });
        } catch (error) {
          console.error('Error creating conversation:', error);
          // Continue even if conversation creation fails
        }
      } else {
        try {
          await supabaseClient
            .from('ai_conversations')
            .update({
              last_message_at: new Date().toISOString()
            })
            .eq('id', conversationId);
        } catch (error) {
          console.error('Error updating conversation:', error);
          // Continue even if update fails
        }
      }
    } catch (error) {
      console.error('Error saving chat history:', error);
      // Continue even if saving fails - don't block the response
    }

    console.log('WAKTI AI V2.1: Response generated successfully');

    return new Response(JSON.stringify({
      response: aiResponse,
      conversationId: conversationId,
      intent: 'general_chat',
      confidence: 'medium',
      needsConfirmation: false,
      needsClarification: false,
      isNewConversation: isNewConversation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('WAKTI AI V2.1: Error:', error);
    
    const errorResponse = {
      error: 'Internal server error',
      response: 'Sorry, there was an error processing your request. Please try again.',
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
