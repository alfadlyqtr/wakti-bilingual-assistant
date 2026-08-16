import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HANDOFF_TTL_MS = 10 * 60 * 1000 // 10 minutes

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const { action, ticket, refresh_token } = await req.json()

    if (!ticket || typeof ticket !== 'string' || ticket.length > 64) {
      return json({ error: 'Invalid ticket' }, 400)
    }

    const cutoff = new Date(Date.now() - HANDOFF_TTL_MS).toISOString()

    // A secondary window (Safari / temp WebView) deposits the session for the main app window.
    // Caller must prove who they are — the deposited session must belong to them.
    if (action === 'deposit') {
      if (!refresh_token || typeof refresh_token !== 'string') {
        return json({ error: 'Missing refresh token' }, 400)
      }
      const authHeader = req.headers.get('Authorization') || ''
      const { data: { user }, error } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
      if (error || !user) return json({ error: 'Unauthorized' }, 401)

      await admin.from('oauth_handoffs').delete().eq('id', ticket)
      const { error: insertError } = await admin.from('oauth_handoffs').insert({
        id: ticket,
        refresh_token,
        user_id: user.id,
      })
      if (insertError) return json({ error: insertError.message }, 500)
      return json({ ok: true })
    }

    // The main app window collects the session. Single-use: read once, then gone.
    if (action === 'claim') {
      const { data } = await admin
        .from('oauth_handoffs')
        .select('refresh_token')
        .eq('id', ticket)
        .gt('created_at', cutoff)
        .maybeSingle()
      if (!data) return json({ status: 'pending' })
      await admin.from('oauth_handoffs').delete().eq('id', ticket)
      return json({ status: 'ready', refresh_token: data.refresh_token })
    }

    // The depositing window checks whether the main window collected it (non-destructive).
    if (action === 'peek') {
      const { data } = await admin
        .from('oauth_handoffs')
        .select('id')
        .eq('id', ticket)
        .gt('created_at', cutoff)
        .maybeSingle()
      return json({ status: data ? 'pending' : 'gone' })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
