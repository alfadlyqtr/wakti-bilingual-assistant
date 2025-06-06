
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🧹 Starting AI conversation cleanup process...')

    // Call the cleanup function
    const { error: cleanupError } = await supabase.rpc('cleanup_expired_ai_data')
    
    if (cleanupError) {
      console.error('❌ Cleanup error:', cleanupError)
      throw cleanupError
    }

    // Maintain conversation limit (5 per user)
    const { error: limitError } = await supabase.rpc('maintain_conversation_limit')
    
    if (limitError) {
      console.error('❌ Conversation limit maintenance error:', limitError)
      throw limitError
    }

    console.log('✅ AI conversation cleanup completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'AI conversations cleaned up successfully',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Cleanup function error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
