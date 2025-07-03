import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { ElevenLabsClient } from "https://esm.sh/@elevenlabs/elevenlabs-js@2.4.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 VOICE CLEANUP: Starting expired voice clones cleanup...');
    
    if (!ELEVENLABS_API_KEY) {
      console.error('🧹 VOICE CLEANUP: ElevenLabs API key not configured');
      throw new Error('ElevenLabs API key not configured');
    }

    // Get expired voice clones before deletion
    const { data: expiredVoices, error: fetchError } = await supabaseService
      .from('user_voice_clones')
      .select('*')
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('🧹 VOICE CLEANUP: Error fetching expired voices:', fetchError);
      throw fetchError;
    }

    console.log(`🧹 VOICE CLEANUP: Found ${expiredVoices?.length || 0} expired voices`);

    if (!expiredVoices || expiredVoices.length === 0) {
      console.log('🧹 VOICE CLEANUP: No expired voices to clean up');
      return new Response(JSON.stringify({
        success: true,
        message: 'No expired voices to clean up',
        deletedCount: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Initialize ElevenLabs client
    const elevenlabs = new ElevenLabsClient({
      apiKey: ELEVENLABS_API_KEY,
    });

    let deletedCount = 0;
    let errors: string[] = [];

    // Delete each expired voice from ElevenLabs first
    for (const voice of expiredVoices) {
      try {
        console.log(`🧹 VOICE CLEANUP: Deleting voice ${voice.voice_name} (${voice.voice_id}) from ElevenLabs...`);
        await elevenlabs.voices.delete(voice.voice_id);
        console.log(`🧹 VOICE CLEANUP: Successfully deleted voice ${voice.voice_id} from ElevenLabs`);
      } catch (elevenLabsError) {
        console.error(`🧹 VOICE CLEANUP: Error deleting voice ${voice.voice_id} from ElevenLabs:`, elevenLabsError);
        errors.push(`ElevenLabs deletion failed for ${voice.voice_name}: ${elevenLabsError.message}`);
        // Continue with database cleanup even if ElevenLabs deletion fails
      }
    }

    // Run the database cleanup function
    const { error: cleanupError } = await supabaseService
      .rpc('cleanup_expired_voice_clones');

    if (cleanupError) {
      console.error('🧹 VOICE CLEANUP: Database cleanup error:', cleanupError);
      throw cleanupError;
    }

    deletedCount = expiredVoices.length;
    console.log(`🧹 VOICE CLEANUP: Successfully cleaned up ${deletedCount} expired voice clones`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully cleaned up ${deletedCount} expired voice clones`,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('🧹 VOICE CLEANUP: Error during cleanup:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Voice cleanup failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});