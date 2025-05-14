
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");

  try {
    const { recordingId, language = "en" } = await req.json();

    if (!recordingId) {
      return new Response(JSON.stringify({ error: 'Missing recordingId' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get recording details from database
    const { data: recording, error: recordingError } = await supabase
      .from('voice_summaries')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording) {
      return new Response(JSON.stringify({ error: 'Recording not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!recording.transcription_text || recording.transcription_status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Transcription not ready' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let prompt = '';
    if (language === 'en') {
      prompt = `Please provide a clear, concise summary of the following transcription. 
      Organize the main points, highlight key information, and provide insights where relevant. 
      Keep the summary professional and maintain the same language as the transcription:
      
      ${recording.transcription_text}`;
    } else if (language === 'ar') {
      prompt = `يرجى تقديم ملخص واضح وموجز للنص المنسوخ التالي.
      قم بتنظيم النقاط الرئيسية، وإبراز المعلومات المهمة، وتقديم رؤى حيثما كان ذلك مناسبًا.
      حافظ على احترافية الملخص والحفاظ على نفس لغة النص المنسوخ:
      
      ${recording.transcription_text}`;
    }

    // Generate summary using DeepSeek
    let summary = '';
    if (deepseekApiKey) {
      const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!deepseekResponse.ok) {
        throw new Error(`DeepSeek API error: ${await deepseekResponse.text()}`);
      }

      const deepseekData = await deepseekResponse.json();
      summary = deepseekData.choices[0].message.content;
    } else {
      // Fallback to OpenAI if DeepSeek key isn't available
      const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiApiKey) {
        throw new Error("No AI service API key available");
      }

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${await openaiResponse.text()}`);
      }

      const openaiData = await openaiResponse.json();
      summary = openaiData.choices[0].message.content;
    }

    // Update the database with the summary
    const { error: updateError } = await supabase
      .from('voice_summaries')
      .update({ 
        summary_text: summary,
        language: language
      })
      .eq('id', recordingId);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update summary in database' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: summary 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
