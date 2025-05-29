
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

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
    console.log('Transcription received, length:', transcription.text.length);

    // Now use the transcription to create a summary using OpenAI with enhanced prompt
    console.log('Sending enhanced summary request to OpenAI');
    
    const summaryRequestOptions = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional summarization assistant. Summarize the following text in a structured, professional manner. Provide a summary that includes:\n\nTitle (concise and descriptive)\n\nMain Points (key ideas organized clearly)\n\nAction Items (if present in the original content)\n\nMake the summary feel like a professional summary of a real meeting or lecture. Ensure it captures the essence of the discussion efficiently.'
        },
        {
          role: 'user',
          content: transcription.text
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    };
    
    console.log('Summary prompt options:', {
      model: summaryRequestOptions.model,
      temperature: summaryRequestOptions.temperature,
      max_tokens: summaryRequestOptions.max_tokens,
      transcriptLength: transcription.text.length
    });

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(summaryRequestOptions),
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
    
    console.log('Summary generated, length:', summaryText.length);
    console.log('First 100 chars:', summaryText.substring(0, 100) + '...');

    // Extract title from summary using improved logic
    let title = "";
    let summary = summaryText;

    // Look for explicit title pattern first
    const titleMatch = summaryText.match(/^[\s\n]*Title:[\s\n]*(.+?)[\r\n]/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
      summary = summaryText.replace(/^[\s\n]*Title:[\s\n]*(.+?)[\r\n]/i, '').trim();
      console.log('Title extracted from explicit format:', title);
    } else {
      // If no explicit title, extract first sentence if it's reasonable length
      const firstLineMatch = summaryText.match(/^(.+?)[\.\!\?](?:\s|$)/);
      if (firstLineMatch && firstLineMatch[1] && firstLineMatch[1].length <= 80) {
        title = firstLineMatch[1].trim();
        console.log('Title extracted from first sentence:', title);
        // Don't remove the first line from summary in this case
      } else {
        // Generate a fallback title
        const date = new Date().toLocaleDateString();
        title = "Audio Summary - " + date;
        console.log('Using fallback title:', title);
      }
    }

    // Final check for empty or overly long titles
    if (!title || title.length > 100) {
      title = "Audio Summary - " + new Date().toLocaleDateString();
      console.log('Title check failed, using default:', title);
    }
    
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
