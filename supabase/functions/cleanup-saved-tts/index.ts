import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const nowIso = new Date().toISOString();

    const { data: expired, error: fetchError } = await supabaseClient
      .from('saved_tts')
      .select('id, user_id, storage_path')
      .lt('expires_at', nowIso)
      .not('storage_path', 'is', null)
      .limit(1000);

    if (fetchError) throw fetchError;

    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No expired saved TTS to clean up', deleted_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paths = expired
      .map((r) => r.storage_path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);

    let storageDeletedCount = 0;
    if (paths.length > 0) {
      const { error: storageError } = await supabaseClient.storage.from('saved-tts').remove(paths);
      if (storageError) {
        throw storageError;
      }
      storageDeletedCount = paths.length;
    }

    const ids = expired.map((r) => r.id);
    const { error: deleteError } = await supabaseClient.from('saved_tts').delete().in('id', ids);
    if (deleteError) throw deleteError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Expired saved TTS cleaned up successfully',
        deleted_count: ids.length,
        storage_deleted_count: storageDeletedCount,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Cleanup failed';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
