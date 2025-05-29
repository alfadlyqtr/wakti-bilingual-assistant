
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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

    const formData = await req.formData();
    const audioFile = formData.get('audioBlob') as File;
    const targetLanguage = (formData.get('targetLanguage') as string) || 'en';
    
    console.log('🎤 Voice Translator: Audio file size:', audioFile?.size, 'Target language:', targetLanguage);
    
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

    // Step 2: Translate using GPT-4 Turbo
    console.log('🎤 Voice Translator: Translating to', targetLanguage);

    const languageNames = {
      'en': 'English',
      'ar': 'Arabic',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'hi': 'Hindi',
      'tr': 'Turkish',
      'nl': 'Dutch',
      'sv': 'Swedish'
    };

    const targetLanguageName = languageNames[targetLanguage as keyof typeof languageNames] || 'English';

    const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text accurately to ${targetLanguageName}. Only return the translated text, nothing else. Preserve the meaning and tone of the original text.`
          },
          {
            role: 'user',
            content: `Translate this text to ${targetLanguageName}: "${originalText}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
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

    return new Response(
      JSON.stringify({ 
        originalText,
        translatedText,
        sourceLanguage: 'auto-detected',
        targetLanguage: targetLanguageName,
        quotaUsed: true // Indicates this translation counts against quota
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("🎤 Voice Translator: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
