
// supabase/functions/auto-delete-recordings/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {}
    );

    console.log('Starting automated deletion of old recordings...');
    
    // Find recordings older than 10 days
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
    // Get recordings to delete
    const { data: recordingsToDelete, error: fetchError } = await supabaseClient
      .from('tasjeel_records')
      .select('id, original_recording_path, summary_audio_path')
      .lt('created_at', tenDaysAgo.toISOString());
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`Found ${recordingsToDelete?.length || 0} recordings to delete`);
    
    if (!recordingsToDelete || recordingsToDelete.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recordings to delete' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractStoragePath = (value: string | null): string | null => {
      if (!value) return null;
      try {
        const rawValue = value.trim();
        const publicMarker = '/storage/v1/object/public/tasjeel_recordings/';
        const signedMarker = '/storage/v1/object/sign/tasjeel_recordings/';
        if (rawValue.includes(publicMarker)) return rawValue.split(publicMarker)[1]?.split('?')[0] || null;
        if (rawValue.includes(signedMarker)) return rawValue.split(signedMarker)[1]?.split('?')[0] || null;
        if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) return null;
        return rawValue;
      } catch {
        return null;
      }
    };

    const storagePathsToDelete: string[] = [];
    for (const rec of recordingsToDelete) {
      const original = extractStoragePath(rec.original_recording_path);
      const summary = extractStoragePath(rec.summary_audio_path);
      if (original && original !== 'placeholder_for_quick_summary') storagePathsToDelete.push(original);
      if (summary) storagePathsToDelete.push(summary);
    }

    if (storagePathsToDelete.length > 0) {
      console.log(`Deleting ${storagePathsToDelete.length} storage file(s)...`);
      const { error: storageError } = await supabaseClient
        .storage
        .from('tasjeel_recordings')
        .remove(storagePathsToDelete);
      if (storageError) {
        console.warn('Storage deletion error (non-fatal):', storageError.message);
      } else {
        console.log('Storage files deleted successfully.');
      }
    }

    // Delete the DB records
    const recordingIds = recordingsToDelete.map(rec => rec.id);
    
    const { error: deleteError } = await supabaseClient
      .from('tasjeel_records')
      .delete()
      .in('id', recordingIds);
    
    if (deleteError) {
      throw deleteError;
    }
    
    return new Response(
      JSON.stringify({ 
        message: `Successfully deleted ${recordingIds.length} old recordings`,
        deleted_count: recordingIds.length,
        storage_files_deleted: storagePathsToDelete.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-delete function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Auto-delete failed';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
