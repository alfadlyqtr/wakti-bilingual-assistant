import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { summary, voice, recordId } = await req.json();

    if (!summary) {
      return new Response(
        JSON.stringify({ error: 'Summary text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto-detect predominant language for basic code-switching groundwork
    const isArabicChar = (c: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(c);
    const arabicRatio = (() => {
      const chars = summary.split('');
      const ar = chars.reduce((acc, ch) => acc + (isArabicChar(ch) ? 1 : 0), 0);
      return chars.length ? ar / chars.length : 0;
    })();

    // Voice selection policy:
    // - If caller explicitly passes 'male' or 'female', honor it (backward compatible)
    // - If caller passes 'auto' or omits voice, pick by predominant language
    //   Note: This does not do per-sentence routing; it's a safe initial improvement with no API/UI change
    let voiceOption: string;
    if (voice === 'male') {
      voiceOption = 'onyx';
    } else if (voice === 'female') {
      voiceOption = 'nova';
    } else {
      // auto
      voiceOption = arabicRatio >= 0.40 ? 'nova' : 'onyx';
    }

    console.log(`Generating speech for text length: ${summary.length}, voice: ${voiceOption}, recordId: ${recordId || 'none'}`);

    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate speech using OpenAI TTS
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: summary,
        voice: voiceOption,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI TTS error:', error);
      return new Response(
        JSON.stringify({ error: error.error?.message || 'Failed to generate speech' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert audio buffer to base64 without spread (avoid call stack overflow)
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000; // 32KB chunks
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
    }
    const base64Audio = btoa(binary);

    return new Response(
      JSON.stringify({ audioContent: base64Audio, voice: voiceOption }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-speech function:', error && (error as any).message);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
