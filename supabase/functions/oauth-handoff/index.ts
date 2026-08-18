import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HANDOFF_TTL_MS = 10 * 60 * 1000 // 10 minutes
// Placeholder owner for handoff rows — the depositing window may or may not
// hold a session, so the one-time ticket itself is the secret.
const NO_USER = '00000000-0000-0000-0000-000000000000'

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isString(v: unknown, max = 4096): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const { action, ticket, access_token, refresh_token, code } = await req.json()

    if (!isString(ticket, 64)) {
      return json({ error: 'Invalid ticket' }, 400)
    }

    const cutoff = new Date(Date.now() - HANDOFF_TTL_MS).toISOString()

    // A secondary window (Safari / temp WebView) deposits for the main app window.
    // Payload is either a session token pair (implicit flow) or a PKCE code.
    if (action === 'deposit') {
      const hasPair = isString(access_token) && isString(refresh_token)
      const hasCode = isString(code, 2048)
      if (!hasPair && !hasCode) {
        return json({ error: 'Missing payload' }, 400)
      }

      await admin.from('oauth_handoffs').delete().eq('id', ticket)
      const { error: insertError } = await admin.from('oauth_handoffs').insert({
        id: ticket,
        access_token: hasPair ? access_token : null,
        refresh_token: hasPair ? refresh_token : code,
        user_id: NO_USER,
      })
      if (insertError) return json({ error: insertError.message }, 500)
      return json({ ok: true })
    }

    // The main app window collects the payload. Single-use: read once, then gone.
    if (action === 'claim') {
      const { data } = await admin
        .from('oauth_handoffs')
        .select('access_token, refresh_token')
        .eq('id', ticket)
        .gt('created_at', cutoff)
        .maybeSingle()
      if (!data) return json({ status: 'pending' })
      await admin.from('oauth_handoffs').delete().eq('id', ticket)
      return json({ status: 'ready', access_token: data.access_token, refresh_token: data.refresh_token })
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
