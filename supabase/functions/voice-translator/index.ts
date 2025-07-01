
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const LANGUAGE_MAPPING = {
  'en': { name: 'English', code: 'en' },
  'ar': { name: 'Arabic', code: 'ar' },
  'es': { name: 'Spanish', code: 'es' },
  'fr': { name: 'French', code: 'fr' },
  'de': { name: 'German', code: 'de' },
  'it': { name: 'Italian', code: 'it' },
  'pt': { name: 'Portuguese', code: 'pt' },
  'ru': { name: 'Russian', code: 'ru' },
  'ja': { name: 'Japanese', code: 'ja' },
  'ko': { name: 'Korean', code: 'ko' },
  'zh': { name: 'Chinese', code: 'zh' },
  'hi': { name: 'Hindi', code: 'hi' },
  'tr': { name: 'Turkish', code: 'tr' },
  'nl': { name: 'Dutch', code: 'nl' },
  'sv': { name: 'Swedish', code: 'sv' }
};

function validateLanguageCode(langCode: string): boolean {
  return langCode in LANGUAGE_MAPPING;
}

function getLanguageName(langCode: string): string {
  return LANGUAGE_MAPPING[langCode as keyof typeof LANGUAGE_MAPPING]?.name || 'Unknown';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎤 Voice Translator: Processing request...');
    
    if (!OPENAI_API_KEY) {
      console.error('🎤 Voice Translator: OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SIMPLIFIED: Get user ID from auth header (minimal auth, no complex validation)
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });

        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      } catch (error) {
        console.log('🎤 Voice Translator: Auth failed, continuing without user ID:', error);
      }
    }

    console.log('🎤 Voice Translator: User ID:', userId || 'anonymous');

    const formData = await req.formData();
    const audioFile = formData.get('audioBlob') as File;
    const targetLanguage = (formData.get('targetLanguage') as string) || 'en';
    
    console.log('🎤 Voice Translator: Audio file size:', audioFile?.size, 'Target language:', targetLanguage);
    
    // Validate target language
    if (!validateLanguageCode(targetLanguage)) {
      console.error('🎤 Voice Translator: Invalid target language:', targetLanguage);
      return new Response(
        JSON.stringify({ error: `Invalid target language code: ${targetLanguage}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!audioFile) {
      console.error('🎤 Voice Translator: No audio file found');
      return new Response(
        JSON.stringify({ error: "Audio file is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Transcribe audio using Whisper
    console.log('🎤 Voice Translator: Transcribing audio...');
    
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'audio.webm');
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('response_format', 'json');

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('🎤 Voice Translator: Whisper transcription error:', errorText);
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const originalText = transcriptionResult.text;

    console.log('🎤 Voice Translator: Transcribed text:', originalText);

    if (!originalText || originalText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No speech detected in audio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Translate using GPT
    const targetLanguageName = getLanguageName(targetLanguage);
    console.log('🎤 Voice Translator: Translating to', targetLanguageName, `(${targetLanguage})`);

    const systemPrompt = `You are a professional translator. Your ONLY task is to translate the given text accurately into ${targetLanguageName}.

CRITICAL REQUIREMENTS:
1. ONLY return the translated text in ${targetLanguageName}
2. Do NOT include any explanations, comments, or additional text
3. Do NOT translate into any other language except ${targetLanguageName}
4. Preserve the meaning, tone, and context of the original text
5. If the original text is already in ${targetLanguageName}, return it as-is

The target language is: ${targetLanguageName} (code: ${targetLanguage})`;

    const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Translate this text to ${targetLanguageName}: "${originalText}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!translationResponse.ok) {
      const errorText = await translationResponse.text();
      console.error('🎤 Voice Translator: Translation error:', errorText);
      throw new Error(`Translation failed: ${errorText}`);
    }

    const translationResult = await translationResponse.json();
    const translatedText = translationResult.choices[0].message.content.trim();

    console.log('🎤 Voice Translator: Translation successful');
    console.log('🎤 Voice Translator: Original:', originalText);
    console.log('🎤 Voice Translator: Translated to', targetLanguageName + ':', translatedText);

    if (!translatedText || translatedText.length === 0) {
      throw new Error("Translation returned empty result");
    }

    // SIMPLIFIED: Just track basic usage if we have a user ID
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Simple usage tracking - just log the usage
        await supabase.from('ai_usage_logs').insert({
          user_id: userId,
          model_used: 'voice-translator',
          has_browsing: false,
          month_year: new Date().toISOString().substring(0, 7)
        });
        
        console.log('🎤 Voice Translator: Usage logged for user:', userId);
      } catch (error) {
        console.log('🎤 Voice Translator: Usage logging failed (non-critical):', error);
      }
    }

    // Return successful translation
    return new Response(
      JSON.stringify({ 
        originalText,
        translatedText,
        sourceLanguage: 'auto-detected',
        targetLanguage: targetLanguageName,
        targetLanguageCode: targetLanguage,
        success: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("🎤 Voice Translator: Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Translation service encountered an error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
