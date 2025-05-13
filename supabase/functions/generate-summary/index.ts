
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transcript, recordingId, metadata } = await req.json()
    
    if (!transcript || !recordingId) {
      throw new Error('Transcript and recording ID are required')
    }

    // Get API keys from environment
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key not found')
    }
    
    // Construct the prompt for the AI
    const metadataText = [
      metadata?.title ? `Title: ${metadata.title}` : '',
      metadata?.type ? `Type: ${metadata.type}` : '',
      metadata?.host ? `Host: ${metadata.host}` : '',
      metadata?.attendees ? `Attendees: ${metadata.attendees}` : '',
      metadata?.location ? `Location: ${metadata.location}` : '',
    ].filter(Boolean).join('\n');
    
    const systemPrompt = `
    You are an expert summarization AI that creates high-quality formatted summaries from transcripts.
    
    Instructions:
    1. Analyze the transcript and identify key topics, themes, and insights.
    2. Detect any action items, decisions, or important information.
    3. Create a well-structured summary with clear headers and bullet points.
    4. Format your response in an easy-to-read format.
    5. Intelligently handle any language in the transcript (Arabic, English, or mixed).
    6. If the text is in Arabic, output the summary in Arabic.
    7. If the text is in English, output the summary in English.
    8. If the text is mixed, preserve the original language mix.
    
    Use the following metadata to help structure your summary:
    ${metadataText}
    `;
    
    // Call DeepSeek API for summarization
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('DeepSeek API error:', error);
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const summaryData = await response.json();
    const summary = summaryData.choices[0].message.content;
    
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Update recording in database
    const { error: updateError } = await supabase
      .from('voice_recordings')
      .update({ 
        summary: summary,
        transcript: transcript, // Save any edits made to the transcript
      })
      .eq('id', recordingId);
    
    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        summary: summary, 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-summary function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
