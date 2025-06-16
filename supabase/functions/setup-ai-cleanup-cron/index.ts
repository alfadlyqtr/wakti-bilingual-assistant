
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

    console.log('⚙️ Setting up AI conversation cleanup cron job...')

    // Set up cron job to run cleanup daily at 2 AM
    const { data, error } = await supabase.rpc('sql', {
      query: `
        SELECT cron.schedule(
          'ai-conversation-cleanup',
          '0 2 * * *', -- Daily at 2 AM
          $$
          SELECT net.http_post(
            url := '${supabaseUrl}/functions/v1/cleanup-ai-conversations',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}"}'::jsonb,
            body := '{"automated": true}'::jsonb
          ) as request_id;
          $$
        );
      `
    })

    if (error) {
      console.error('❌ Failed to setup cron job:', error)
      throw error
    }

    console.log('✅ AI conversation cleanup cron job setup successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'AI conversation cleanup cron job setup successfully',
        schedule: 'Daily at 2 AM UTC'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Setup cron job error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
