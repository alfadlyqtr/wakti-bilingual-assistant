import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isStillAnonymousUser(user: any): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  if (user.app_metadata?.provider === 'anonymous') return true;
  if (user.app_metadata?.is_anonymous === true) return true;
  if (user.user_metadata?.is_anonymous === true) return true;

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];

  return providers.some((provider: unknown) => {
    return typeof provider === 'string' && provider.toLowerCase() === 'anonymous';
  });
}

function hasLinkedRealIdentity(user: any): boolean {
  if (!user) return true;

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const hasRealIdentity = identities.some((identity: any) => {
    const provider = typeof identity?.provider === 'string'
      ? identity.provider.toLowerCase()
      : '';
    return provider !== '' && provider !== 'anonymous';
  });

  if (hasRealIdentity) return true;

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  const hasRealProvider = providers.some((provider: unknown) => {
    return typeof provider === 'string' && provider.toLowerCase() !== 'anonymous';
  });

  if (hasRealProvider) return true;

  const primaryProvider = typeof user.app_metadata?.provider === 'string'
    ? user.app_metadata.provider.toLowerCase()
    : '';

  return primaryProvider !== '' && primaryProvider !== 'anonymous';
}

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

    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const dryRun = payload?.dry_run === true;

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

    const safeUserIds: string[] = [];
    const skippedIds: string[] = [];

    for (const row of userIds) {
      const userId = row.id;
      const { data: userResult, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (getUserError || !userResult?.user) {
        console.error(`Failed to verify user ${userId} before delete:`, getUserError?.message ?? 'User not found');
        skippedIds.push(userId);
        continue;
      }

      const user = userResult.user;
      const stillAnonymous = isStillAnonymousUser(user);
      const linkedRealIdentity = hasLinkedRealIdentity(user);

      if (!stillAnonymous || linkedRealIdentity) {
        console.warn(`Skipping unsafe delete candidate ${userId} (stillAnonymous=${stillAnonymous}, linkedRealIdentity=${linkedRealIdentity})`);
        skippedIds.push(userId);
        continue;
      }

      safeUserIds.push(userId);
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          total_candidates: userIds.length,
          safe_delete_count: safeUserIds.length,
          skipped_unsafe_count: skippedIds.length,
          skipped_unsafe_ids: skippedIds,
          message: `Dry run complete. ${safeUserIds.length} user(s) are safe to delete, ${skippedIds.length} skipped as unsafe.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let deletedCount = 0;
    let failedCount = 0;
    const failedIds: string[] = [];

    for (const userId of safeUserIds) {
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
        total_candidates: userIds.length,
        safe_delete_count: safeUserIds.length,
        skipped_unsafe_count: skippedIds.length,
        skipped_unsafe_ids: skippedIds,
        failed_ids: failedIds,
        message: `Deleted ${deletedCount} anonymous user(s), ${failedCount} failed, ${skippedIds.length} skipped as unsafe.`,
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
