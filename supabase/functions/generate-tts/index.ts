
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
    const { text, recordingId, voice = 'male', language = 'english' } = await req.json()
    
    if (!text || !recordingId) {
      throw new Error('Text and recording ID are required')
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found')
    }
    
    // Map input parameters to OpenAI voice options
    // For Whisper TTS, available voices are: alloy, echo, fable, onyx, nova, and shimmer
    const voiceMap: Record<string, string> = {
      'male_english': 'onyx',
      'male_arabic': 'onyx',
      'female_english': 'nova',
      'female_arabic': 'nova',
    }
    
    const voiceKey = `${voice}_${language}`
    const selectedVoice = voiceMap[voiceKey] || 'onyx'
    
    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: selectedVoice,
        input: text,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI TTS API error:', error)
      throw new Error(`OpenAI TTS API error: ${response.statusText}`)
    }

    // Get the audio data as an ArrayBuffer
    const audioBuffer = await response.arrayBuffer()
    
    // Get Supabase client for database and storage operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Upload the audio file to Supabase Storage
    const filePath = `summary_audio/${recordingId}_${Date.now()}.mp3`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice_recordings')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mp3',
        cacheControl: '3600',
      })
    
    if (uploadError) {
      throw uploadError
    }
    
    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from('voice_recordings')
      .getPublicUrl(filePath)
    
    // Update the database record with the TTS audio URL
    const { error: updateError } = await supabase
      .from('voice_recordings')
      .update({
        summary_audio_url: publicUrlData.publicUrl,
        summary_voice: voice,
        summary_language: language,
      })
      .eq('id', recordingId)
    
    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        audioUrl: publicUrlData.publicUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-tts function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
