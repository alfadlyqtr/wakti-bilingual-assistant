
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
    console.log('WAKTI AI V2.1: Processing request (PUBLIC MODE)');

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

    // Get current date and time for accurate context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Enhanced system message with current date context
    const systemMessage = language === 'ar' 
      ? `أنت WAKTI AI V2.1، المساعد الذكي المتطور لتطبيق وكتي. أنت ودود ومفيد وتساعد في إدارة المهام والأحداث والتذكيرات. رد بشكل طبيعي ومحادثة، واستخدم الرموز التعبيرية عند الحاجة. كن مفيداً ومساعداً.

معلومات التاريخ والوقت الحالي:
- التاريخ الحالي: ${currentDate}
- الوقت الحالي: ${currentTime}
- العام الحالي: ${now.getFullYear()}

استخدم هذه المعلومات للإجابة على أي أسئلة متعلقة بالتاريخ أو الوقت أو العام الحالي.`
      : `You are WAKTI AI V2.1, the advanced intelligent assistant for the Wakti app. You are friendly, helpful, and assist with managing tasks, events, and reminders. Respond naturally and conversationally, using emojis when appropriate. Be helpful and supportive.

Current date and time information:
- Current date: ${currentDate}
- Current time: ${currentTime}
- Current year: ${now.getFullYear()}

Use this information to answer any questions about the current date, time, or year.`;

    console.log('WAKTI AI V2.1: Calling OpenAI API with current date context');

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

    console.log('WAKTI AI V2.1: Generated AI response successfully');

    return new Response(JSON.stringify({
      response: aiResponse,
      conversationId: conversationId,
      intent: 'general_chat',
      confidence: 'medium',
      needsConfirmation: false,
      needsClarification: false,
      isNewConversation: true
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
