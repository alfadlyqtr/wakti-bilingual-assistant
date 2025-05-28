
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

    // Basic system message
    const systemMessage = language === 'ar' 
      ? 'أنت WAKTI AI V2.1، المساعد الذكي المتطور لتطبيق وكتي. أنت ودود ومفيد وتساعد في إدارة المهام والأحداث والتذكيرات.'
      : 'You are WAKTI AI V2.1, the advanced intelligent assistant for the Wakti app. You are friendly, helpful, and assist with managing tasks, events, and reminders.';

    let isNewConversation = false;
    let initialMessages = [];

    if (conversationId.startsWith('temp-')) {
      isNewConversation = true;
      initialMessages = [{ role: 'system', content: systemMessage }];
    } else {
      const { data: chatHistory } = await supabaseClient
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      initialMessages = [
        { role: 'system', content: systemMessage },
        ...(chatHistory || []).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];
    }

    console.log('WAKTI AI V2.1: Calling OpenAI API');

    // Call OpenAI API
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
    if (isNewConversation && !conversationId.startsWith('temp-')) {
      const conversationTitle = `Chat - ${userMessage.substring(0, 30)}`;
      
      await supabaseClient
        .from('ai_conversations')
        .insert({
          id: conversationId,
          user_id: user.id,
          title: conversationTitle,
          last_message_at: new Date().toISOString()
        });
    } else if (!conversationId.startsWith('temp-')) {
      await supabaseClient
        .from('ai_conversations')
        .update({
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
