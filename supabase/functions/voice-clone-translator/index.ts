
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')!;
const ELEVENLABS_API_KEY = "sk_7b19e76d94655f74d81063f3dd7b39cf9460ea743d40a532";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("VOICE CLONE TRANSLATOR: Function loaded");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { original_text, target_language, voice_id, auto_speak } = await req.json();

    if (!original_text || !target_language || !voice_id) {
      throw new Error('Missing required parameters');
    }

    console.log('TRANSLATOR: Processing request', {
      text_length: original_text.length,
      target_language,
      voice_id,
      user_id: user.id
    });

    // Check voice quota first
    const { data: voiceQuota, error: quotaError } = await supabase
      .from('user_voice_usage')
      .select('characters_used, characters_limit, extra_characters')
      .eq('user_id', user.id)
      .single();

    if (quotaError && quotaError.code !== 'PGRST116') {
      throw new Error('Failed to check voice quota');
    }

    const totalAvailable = (voiceQuota?.characters_limit || 5000) + (voiceQuota?.extra_characters || 0);
    const charactersUsed = voiceQuota?.characters_used || 0;
    const remainingCharacters = totalAvailable - charactersUsed;

    if (original_text.length > remainingCharacters) {
      throw new Error(`Insufficient voice credits. Need ${original_text.length} characters, have ${remainingCharacters}`);
    }

    // Step 1: Translate with DeepSeek
    console.log('TRANSLATOR: Calling DeepSeek API for translation');
    
    const translateResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text to ${target_language}. Return only the translation, nothing else. Maintain the tone and meaning of the original text.`
          },
          {
            role: 'user',
            content: original_text
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }),
    });

    if (!translateResponse.ok) {
      const errorText = await translateResponse.text();
      console.error('DeepSeek API error:', translateResponse.status, errorText);
      throw new Error(`Translation failed: ${translateResponse.status}`);
    }

    const translateResult = await translateResponse.json();
    const translatedText = translateResult.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('No translation received from DeepSeek');
    }

    console.log('TRANSLATOR: Translation successful', {
      original_length: original_text.length,
      translated_length: translatedText.length
    });

    // Step 2: Generate TTS with ElevenLabs using user's cloned voice
    console.log('TRANSLATOR: Generating TTS with ElevenLabs');
    
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: translatedText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true
        }
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs TTS error:', ttsResponse.status, errorText);
      throw new Error(`TTS generation failed: ${ttsResponse.status}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioContent = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    console.log('TRANSLATOR: TTS generated successfully', {
      audio_size: audioBuffer.byteLength,
      base64_length: audioContent.length
    });

    // Step 3: Update voice usage quota
    if (voiceQuota) {
      await supabase
        .from('user_voice_usage')
        .update({
          characters_used: charactersUsed + original_text.length,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_voice_usage')
        .insert({
          user_id: user.id,
          characters_used: original_text.length,
          characters_limit: 5000,
          extra_characters: 0
        });
    }

    console.log('TRANSLATOR: Voice quota updated successfully');

    return new Response(JSON.stringify({
      success: true,
      original_text,
      translated_text: translatedText,
      target_language,
      voice_id,
      auto_speak,
      audio_content: audioContent,
      audio_size: audioBuffer.byteLength,
      characters_used: original_text.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('TRANSLATOR ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Translation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
