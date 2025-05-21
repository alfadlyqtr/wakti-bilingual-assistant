
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log('Edge Function: quick-summary initializing');

serve(async (req) => {
  // Log every single request with details
  console.log(`[${new Date().toISOString()}] Quick summary request received`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables first
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      const error = 'Missing OpenAI API key';
      console.error(error);
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error', 
          details: error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body - should contain audio data
    const formData = await req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      console.error('No audio file provided');
      return new Response(
        JSON.stringify({ error: 'Audio file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing audio file:', audioFile.name, 'Size:', audioFile.size);

    // Send the audio to OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'audio.mp3');
    whisperFormData.append('model', 'whisper-1');

    console.log('Sending to OpenAI Whisper API');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: whisperFormData,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Transcription failed', 
          details: `Status: ${openaiResponse.status}, Message: ${errorText}`
        }),
        { status: openaiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcription = await openaiResponse.json();
    console.log('Transcription received');

    // Now use the transcription to create a summary using OpenAI
    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides concise summaries. Summarize the following text in a few sentences. Also generate a short, descriptive title for this content.'
          },
          {
            role: 'user',
            content: transcription.text
          }
        ],
        max_tokens: 500
      }),
    });

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      console.error('OpenAI API error (summarization):', summaryResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Summarization failed', 
          details: `Status: ${summaryResponse.status}, Message: ${errorText}`
        }),
        { status: summaryResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const summaryResult = await summaryResponse.json();
    const summaryText = summaryResult.choices[0].message.content;
    
    console.log('Summary generated');

    // Extract title from summary using a simple heuristic:
    // Assume the first line or sentence that ends with a period is the title
    let title = "";
    let summary = summaryText;

    // Look for "Title:" pattern
    const titleMatch = summaryText.match(/Title:(.+?)(\n|$)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      summary = summaryText.replace(/Title:.+?(\n|$)/, '').trim();
    } else {
      // If no explicit title pattern, use the first sentence as the title
      const firstSentenceMatch = summaryText.match(/^(.+?[.!?])\s/);
      if (firstSentenceMatch) {
        title = firstSentenceMatch[1].trim();
        if (title.length > 50) {
          title = title.substring(0, 47) + '...';
        }
        // No need to modify summary
      } else {
        // If can't determine a title, create one
        title = "Audio Summary - " + new Date().toLocaleDateString();
      }
    }

    console.log('Title extracted:', title);
    
    return new Response(
      JSON.stringify({ 
        title: title, 
        summary: summary,
        transcript: transcription.text
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unhandled error in quick-summary function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Processing failed', 
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
