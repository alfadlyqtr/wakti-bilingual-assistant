import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';
const ELEVENLABS_VOICE_SETTINGS = {
  stability: 1.0,
  similarity_boost: 1.0,
  style: 0.5,
  use_speaker_boost: true,
};
const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  ar_male: 'G1QUjBCuRBbLbAmYlTgl',
  en_male: 'ZB6Q1KAIKj9o7p9iJEWQ',
  ar_female: 'u0TsaWvt0v8migutHM3M',
  en_female: 'gh8WokH7VR2QkmMmwWHS',
};

const isArabicText = (text: string) => {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const matches = text.match(arabicPattern) || [];
  return text.length > 0 && matches.length / text.length > 0.3;
};

const resolveElevenLabsVoiceId = (text: string, voice: string | undefined) => {
  const lang = isArabicText(text) ? 'ar' : 'en';
  const gender = voice === 'female' ? 'female' : voice === 'male' ? 'male' : lang === 'ar' ? 'female' : 'male';
  return ELEVENLABS_VOICE_MAP[`${lang}_${gender}`] || ELEVENLABS_VOICE_MAP.en_male;
};

const resolveOpenAIVoice = (text: string, voice: string | undefined) => {
  if (voice === 'male') return 'onyx';
  if (voice === 'female') return 'nova';
  return isArabicText(text) ? 'nova' : 'onyx';
};

const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
  }
  return btoa(binary);
};

const generateWithElevenLabs = async (summary: string, voice: string | undefined) => {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const voiceId = resolveElevenLabsVoiceId(summary, voice);
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: summary,
      model_id: ELEVENLABS_MODEL,
      voice_settings: ELEVENLABS_VOICE_SETTINGS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS error ${response.status}: ${errorText.slice(0, 500)}`);
  }

  return {
    audioBuffer: await response.arrayBuffer(),
    provider: 'elevenlabs',
    model: 'elevenlabs-tts',
    resolvedVoice: voiceId,
  };
};

const generateWithOpenAI = async (summary: string, voice: string | undefined, openAIKey: string) => {
  const voiceOption = resolveOpenAIVoice(summary, voice);
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
    const errorText = await response.text();
    throw new Error(`OpenAI TTS error ${response.status}: ${errorText.slice(0, 500)}`);
  }

  return {
    audioBuffer: await response.arrayBuffer(),
    provider: 'openai',
    model: 'tts-1',
    resolvedVoice: voiceOption,
  };
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

    console.log(`Generating speech for text length: ${summary.length}, requested voice: ${voice || 'auto'}, recordId: ${recordId || 'none'}`);

    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!ELEVENLABS_API_KEY && !openAIKey) {
      return new Response(
        JSON.stringify({ error: 'No TTS provider configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    let provider = 'elevenlabs';
    let model = 'elevenlabs-tts';
    let resolvedVoice = resolveElevenLabsVoiceId(summary, voice);
    let fallbackReason: string | null = null;
    let arrayBuffer: ArrayBuffer;

    try {
      const elevenLabsResult = await generateWithElevenLabs(summary, voice);
      arrayBuffer = elevenLabsResult.audioBuffer;
      provider = elevenLabsResult.provider;
      model = elevenLabsResult.model;
      resolvedVoice = elevenLabsResult.resolvedVoice;
    } catch (elevenLabsError) {
      fallbackReason = (elevenLabsError as Error).message;
      console.warn('ElevenLabs TTS failed, falling back to OpenAI:', fallbackReason);

      if (!openAIKey) {
        throw new Error(`ElevenLabs failed and OpenAI fallback is unavailable: ${fallbackReason}`);
      }

      const openAIResult = await generateWithOpenAI(summary, voice, openAIKey);
      arrayBuffer = openAIResult.audioBuffer;
      provider = openAIResult.provider;
      model = openAIResult.model;
      resolvedVoice = openAIResult.resolvedVoice;
    }

    const base64Audio = arrayBufferToBase64(arrayBuffer);

    await logAIFromRequest(req, {
      functionName: "generate-speech",
      provider,
      model,
      inputText: summary,
      durationMs: Date.now() - startTime,
      status: "success",
      metadata: { voice: resolvedVoice, textLength: summary.length, fallbackReason }
    });

    return new Response(
      JSON.stringify({ audioContent: base64Audio, voice: resolvedVoice, provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-speech function:', error && (error as Error).message);
    
    await logAIFromRequest(req, {
      functionName: "generate-speech",
      provider: "elevenlabs",
      model: "elevenlabs-tts",
      status: "error",
      errorMessage: (error as Error).message
    });

    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
