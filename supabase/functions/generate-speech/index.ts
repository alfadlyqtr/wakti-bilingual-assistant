
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Map voice selection to actual OpenAI voice options
    const voiceOption = voice === 'male' ? 'onyx' : 'nova';

    console.log(`Generating speech for text length: ${summary.length}, voice: ${voiceOption}, recordId: ${recordId || 'none'}`);

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voiceOption,
        input: summary
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI TTS API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Text-to-speech failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get audio data as arrayBuffer
    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    
    // Always upload the audio to storage and return the URL
    try {
      // Import Supabase client for Edge Function
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.7.1');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Generate a unique filename for the summary audio
      const fileName = `summary-${recordId || 'temp-' + Date.now()}-${Date.now()}.mp3`;
      const filePath = `summary_audio/${fileName}`;
      
      // Upload the audio to storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('tasjeel_recordings')
        .upload(filePath, audioBlob, {
          contentType: 'audio/mpeg',
          cacheControl: '3600'
        });
      
      if (uploadError) {
        console.error('Error uploading summary audio:', uploadError);
        
        // Fall back to returning the audio directly if storage upload fails
        return new Response(audioBuffer, { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': 'attachment; filename="tasjeel-audio.mp3"'
          } 
        });
      }
      
      console.log('Summary audio uploaded successfully:', filePath);
      
      // Get the public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('tasjeel_recordings')
        .getPublicUrl(filePath);
      
      const audioUrl = publicUrlData.publicUrl;
      
      // If recordId is provided, update the record with the summary audio path
      if (recordId) {
        const { error: updateError } = await supabase
          .from('tasjeel_records')
          .update({ summary_audio_path: audioUrl })
          .eq('id', recordId);
        
        if (updateError) {
          console.error('Error updating record with summary audio path:', updateError);
        } else {
          console.log('Record updated with summary audio path');
        }
      }
      
      // Return success with the audio URL
      return new Response(
        JSON.stringify({ 
          success: true, 
          audioUrl: audioUrl,
          storagePath: filePath
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json'
          } 
        }
      );
    } catch (storageError) {
      console.error('Error in storage operations:', storageError);
      
      // Fall back to returning the audio directly if any storage operations fail
      return new Response(audioBuffer, { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="tasjeel-audio.mp3"'
        } 
      });
    }
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return new Response(
      JSON.stringify({ error: 'Text-to-speech failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
