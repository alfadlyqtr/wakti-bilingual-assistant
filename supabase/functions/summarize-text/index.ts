
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
    console.log('summarize-text function called');
    
    const { transcript, language, recordId, model } = await req.json();
    console.log('Request payload:', { 
      hasTranscript: !!transcript, 
      language, 
      transcriptLength: transcript?.length,
      hasRecordId: !!recordId,
      model
    });

    if (!transcript) {
      console.error('Error: Missing transcript');
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the language for the prompt
    const isArabic = language === 'ar';
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('Error: OPENAI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default to gpt-4o for meeting/lecture quality; allow optional override via payload
    const chosenModel = typeof model === 'string' && model.trim() ? model : 'gpt-4o';

    const systemPrompt = isArabic
      ? 'أنت مساعد تلخيص محترف لاجتماعات ومحاضرات. اكتب ملخصاً منظماً ومهنياً باللغة المناسبة للمحتوى، مع الأقسام: العنوان، النقاط الرئيسية، عناصر العمل (إن وجدت). كن واضحاً ومباشراً.'
      : 'You are a professional meeting/lecture summarizer. Produce a structured, professional summary in the appropriate language of the content, with sections: Title, Main Points, Action Items (if any). Be clear and succinct.';

    const userPrompt = `${transcript}`;

    console.log('Calling OpenAI Chat Completions with model:', chosenModel);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error (summarize-text):', errorText);
      return new Response(
        JSON.stringify({ error: 'Summarization failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('OpenAI API response received successfully');
    
    const summary = data.choices[0].message.content;

    // If recordId is provided, update the record with summary
    if (recordId) {
      try {
        // Import Supabase client for Edge Function
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.7.1');
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        const { error: updateError } = await supabase
          .from('tasjeel_records')
          .update({ summary })
          .eq('id', recordId);
        
        if (updateError) {
          console.error('Error updating record with summary:', updateError);
        } else {
          console.log('Record updated with summary');
        }
      } catch (storageError) {
        console.error('Error updating record:', storageError);
        // Continue execution to return the summary to the client even if storage fails
      }
    }

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Summarization error:', error);
    return new Response(
      JSON.stringify({ error: 'Summarization failed', details: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
