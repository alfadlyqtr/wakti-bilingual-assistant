
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// ENHANCED CORS CONFIGURATION FOR PRODUCTION
const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa',
  'https://lovable.dev',
  'https://5332ebb7-6fae-483f-a0cc-4262a2a445a1.lovableproject.com'
];

const getCorsHeaders = (origin: string | null) => {
  const corsOrigin = allowedOrigins.includes(origin || '') ? origin : 'https://wakti.qa';
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-auth-token, x-skip-auth, content-length',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("SIMPLE VOICE TRANSLATOR: Function loaded - Record > Whisper > GPT > TTS");

// Type aliases for safer request/response shapes
type TTSRequest = {
  text: string;
  voice?: string;
  language?: string;
};

type TTSResult =
  | { success: true; audioContent: string; size: number }
  | { success: false; error: string };

type WhisperTranscriptionResult =
  | { success: true; text: string; language: string }
  | { success: false; error: string };

type TranslationResult =
  | { success: true; translatedText: string }
  | { success: false; error: string };

type VoiceTranslationResponse =
  | { success: true; originalText: string; translatedText: string; sourceLanguage: string; targetLanguage: string; ttsAudio: { audioContent: string; size: number } | null; autoPlayEnabled: boolean; processingTime: number }
  | { success: false; error: string };

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain'
      }
    });
  }

  try {
    console.log("SIMPLE FLOW: Processing voice translation request");
    
    const contentType = req.headers.get('content-type') || '';
    
    // Handle voice translation with audio blob (FormData)
    if (contentType.includes('multipart/form-data')) {
      console.log("VOICE TRANSLATION: Processing audio blob");
      return await processVoiceTranslation(req, corsHeaders);
    }
    
    // Handle TTS-only requests (JSON)
    const requestBody = await req.json();
    
    if (requestBody.requestType === 'tts' || requestBody.text) {
      console.log("TTS REQUEST: Processing text-to-speech");
      return await processTTS(requestBody, corsHeaders);
    }

    return new Response(JSON.stringify({
      error: 'Invalid request type',
      success: false
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("SIMPLE FLOW ERROR:", error);
    return new Response(JSON.stringify({
      error: message || 'Processing error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// SIMPLE: Voice translation with automatic TTS
async function processVoiceTranslation(req: Request, corsHeaders: Record<string, string>) {
  try {
    console.log("STEP 1: Starting voice translation");
    
    const formData = await req.formData();
    const audioBlob = formData.get('audioBlob') as File;
    const targetLanguage = formData.get('targetLanguage') as string || 'en';
    const autoPlayEnabled = formData.get('autoPlayEnabled') === 'true';
    
    if (!audioBlob) {
      throw new Error('No audio blob provided');
    }

    console.log("STEP 2: Audio received - Size:", audioBlob.size, "bytes, Target:", targetLanguage, "Auto-play:", autoPlayEnabled);

    // Step 1: Transcribe with Whisper
    const audioBuffer = await audioBlob.arrayBuffer();
    const transcriptionResult = await transcribeWithWhisper(audioBuffer);
    
    if (!transcriptionResult.success) {
      throw new Error(transcriptionResult.error || 'Transcription failed');
    }

    const originalText = transcriptionResult.text;
    console.log("STEP 3: Transcribed:", originalText);

    // Step 2: Translate with GPT
    let translatedText = originalText;
    const sourceLanguage = transcriptionResult.language || 'auto';
    
    if (targetLanguage !== 'auto' && sourceLanguage !== targetLanguage) {
      const translationResult = await translateText(originalText, sourceLanguage, targetLanguage);
      if (translationResult.success) {
        translatedText = translationResult.translatedText;
        console.log("STEP 4: Translated:", translatedText);
      }
    }

    // Step 3: Generate TTS with OpenAI
    let ttsAudio: { audioContent: string; size: number } | null = null;
    if (translatedText) {
      console.log("STEP 5: Generating TTS audio");
      try {
        const ttsResult = await generateTTS(translatedText, targetLanguage);
        if (ttsResult.success) {
          ttsAudio = {
            audioContent: ttsResult.audioContent,
            size: ttsResult.size || 0
          };
          console.log("STEP 6: TTS generated successfully - Size:", ttsResult.size, "bytes");
        } else {
          console.error("TTS FAILED:", ttsResult.error);
        }
      } catch (ttsError) {
        console.error("TTS ERROR:", ttsError);
      }
    }

    const response = {
      success: true,
      originalText: originalText,
      translatedText: translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      ttsAudio: ttsAudio,
      autoPlayEnabled: autoPlayEnabled,
      processingTime: Date.now()
    };

    console.log("COMPLETE: Voice translation finished successfully");
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("VOICE TRANSLATION ERROR:", error);
    return new Response(JSON.stringify({
      success: false,
      error: message || 'Voice translation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// SIMPLE: TTS generation
async function processTTS(requestBody: TTSRequest, corsHeaders: Record<string, string>) {
  try {
    console.log("TTS: Processing text-to-speech request");
    
    const text = requestBody.text;
    const voice = requestBody.voice || 'alloy';
    const language = requestBody.language || 'en';
    
    if (!text) {
      throw new Error('No text provided for TTS');
    }

    console.log("TTS: Generating speech for text:", text.substring(0, 50) + "...");
    
    const ttsResult = await generateTTS(text, language, voice);
    
    if (!ttsResult.success) {
      throw new Error(ttsResult.error || 'TTS generation failed');
    }

    console.log("TTS: Generated successfully, size:", ttsResult.size || 0, "bytes");

    return new Response(JSON.stringify({
      success: true,
      audioContent: ttsResult.audioContent,
      size: ttsResult.size || 0,
      voice: voice,
      language: language
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("TTS ERROR:", error);
    return new Response(JSON.stringify({
      success: false,
      error: message || 'TTS processing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// Generate TTS with OpenAI
async function generateTTS(text: string, language: string = 'en', voice: string = 'alloy'): Promise<TTSResult> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log("TTS: Calling OpenAI API");
    
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text.substring(0, 4000),
        voice: voice,
        response_format: 'mp3'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TTS: OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI TTS API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioContent = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    
    console.log("TTS: Audio generated - Size:", audioBuffer.byteLength, "bytes, Base64 length:", audioContent.length);

    return {
      success: true,
      audioContent: audioContent,
      size: audioBuffer.byteLength
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("TTS: Generation error:", error);
    return {
      success: false,
      error: message
    };
  }
}

// Transcribe audio with Whisper
async function transcribeWithWhisper(audioBuffer: ArrayBuffer): Promise<WhisperTranscriptionResult> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log("WHISPER: Transcribing audio");

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("WHISPER: Transcription result:", result.text);
    
    return {
      success: true,
      text: result.text,
      language: result.language || 'en'
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("WHISPER ERROR:", error);
    return {
      success: false,
      error: message
    };
  }
}

// Translate text with GPT
async function translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<TranslationResult> {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log("GPT: Translating from", sourceLanguage, "to", targetLanguage);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Return only the translation, nothing else.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const result = await response.json();
    const translatedText = result.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('No translation received');
    }

    console.log("GPT: Translation result:", translatedText);

    return {
      success: true,
      translatedText: translatedText
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("TRANSLATION ERROR:", error);
    return {
      success: false,
      error: message
    };
  }
}
