import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all user folders in the generated-files bucket under /diagrams
    const { data: topLevel } = await supabase.storage
      .from('generated-files')
      .list('', { limit: 1000 });

    const userFolders = (topLevel || []).filter(f => f.id === null); // folders have null id

    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const folder of userFolders) {
      const userId = folder.name;

      // List diagrams for this user
      const { data: files } = await supabase.storage
        .from('generated-files')
        .list(`${userId}/diagrams`, { limit: 1000 });

      const diagrams = (files || []).filter(
        f => f.name && f.name !== '.emptyFolderPlaceholder'
      );

      if (diagrams.length === 0) continue;

      for (const file of diagrams) {
        const storagePath = `${userId}/diagrams/${file.name}`;

        // Create a long-lived signed URL (1 year)
        const { data: signedData } = await supabase.storage
          .from('generated-files')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

        if (!signedData?.signedUrl) {
          errors.push(`Failed to sign: ${storagePath}`);
          continue;
        }

        // Check if already in DB (by matching storage_url path pattern)
        const { count } = await supabase
          .from('user_diagrams')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('name', file.name);

        if (count && count > 0) {
          totalSkipped++;
          continue;
        }

        // Insert into user_diagrams
        const { error: insertError } = await supabase
          .from('user_diagrams')
          .insert({
            user_id: userId,
            storage_url: signedData.signedUrl,
            name: file.name,
            created_at: file.created_at || new Date().toISOString(),
          });

        if (insertError) {
          errors.push(`Insert failed for ${storagePath}: ${insertError.message}`);
        } else {
          totalInserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalInserted,
        totalSkipped,
        errors,
        userFoldersScanned: userFolders.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
