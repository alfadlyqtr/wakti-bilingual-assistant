import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userIds, error: rpcError } = await supabaseAdmin.rpc('get_old_anonymous_user_ids');

    if (rpcError) {
      console.error('RPC error fetching old anonymous users:', rpcError);
      throw rpcError;
    }

    if (!userIds || userIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          deleted_count: 0,
          message: 'No anonymous users older than 7 days found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let deletedCount = 0;
    let failedCount = 0;
    const failedIds: string[] = [];

    for (const row of userIds) {
      const userId = row.id;
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error(`Failed to delete user ${userId}:`, deleteError.message);
        failedCount++;
        failedIds.push(userId);
      } else {
        deletedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        failed_count: failedCount,
        total_found: userIds.length,
        failed_ids: failedIds,
        message: `Deleted ${deletedCount} anonymous user(s), ${failedCount} failed`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Anonymous user cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
