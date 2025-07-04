
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[DEBUG] Starting expired subscriptions processing...')

    // Call the database function to process expired subscriptions
    const { data, error } = await supabase.rpc('process_expired_subscriptions')

    if (error) {
      console.error('[ERROR] Failed to process expired subscriptions:', error)
      return new Response(
        JSON.stringify({ 
          error: error.message,
          details: 'Failed to process expired subscriptions'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('[SUCCESS] Expired subscriptions processed:', data)

    return new Response(
      JSON.stringify({ 
        success: true,
        result: data,
        message: `Processed ${data?.expired_count || 0} expired subscriptions`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('[ERROR] Exception in process-expired-subscriptions:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
