
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { audioUrl, recordingId } = await req.json()
    
    if (!audioUrl || !recordingId) {
      throw new Error('Audio URL and recording ID are required')
    }
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found')
    }

    // Fetch the audio file
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio file: ${audioResponse.statusText}`)
    }
    
    const audioBlob = await audioResponse.blob()
    
    // Prepare form data for Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'json')
    formData.append('timestamp_granularities[]', 'segment')
    
    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const error = await whisperResponse.text()
      console.error('Whisper API error:', error)
      throw new Error(`Whisper API error: ${whisperResponse.statusText}`)
    }

    const transcriptionData = await whisperResponse.json()
    
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Format transcript with timestamps
    let formattedTranscript = ''
    if (transcriptionData.segments) {
      formattedTranscript = transcriptionData.segments.map((segment: any) => {
        const startTime = formatTime(segment.start)
        return `[${startTime}] ${segment.text}`
      }).join('\n')
    } else {
      formattedTranscript = transcriptionData.text
    }
    
    // Update recording in database
    const { error: updateError } = await supabase
      .from('voice_recordings')
      .update({ transcript: formattedTranscript })
      .eq('id', recordingId)
    
    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        transcript: formattedTranscript 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in transcribe-audio function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

// Helper function to format seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
