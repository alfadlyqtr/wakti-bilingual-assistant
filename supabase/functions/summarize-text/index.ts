
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcript, language } = await req.json();

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the language for the prompt
    const isArabic = language === 'ar';
    
    // Create the prompt based on the language
    const promptPrefix = isArabic 
      ? `أنت مساعد محترف للتلخيص. قم بتلخيص النص التالي بشكل منظم ومهني. قدم ملخصًا يتضمن العناصر التالية:
        - عنوان (إذا كان مناسبًا)
        - النقاط الرئيسية
        - عناصر العمل (إذا وجدت)
        
        اجعل التلخيص يبدو كملخص احترافي لاجتماع أو محاضرة حقيقية. النص هو:`
      : `You are a professional summarization assistant. Summarize the following text in a structured, professional manner. Provide a summary that includes:
        - Title (if appropriate)
        - Main Points
        - Action Items (if present)
        
        Make it feel like a professional summary of a real meeting or lecture. The text is:`;

    // Call DeepSeek API for summarization
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: isArabic ? 'أنت مساعد تلخيص محترف' : 'You are a professional summarization assistant'
          },
          {
            role: 'user',
            content: `${promptPrefix}\n\n${transcript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Summarization failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Summarization error:', error);
    return new Response(
      JSON.stringify({ error: 'Summarization failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
