
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('🎬 Vidu callback received:', body)
    
    const { task_id, state, video_url } = body
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Update video task in database
    const { error } = await supabase
      .from('video_generation_tasks')
      .update({ 
        status: state,
        video_url: video_url,
        updated_at: new Date().toISOString()
      })
      .eq('task_id', task_id)
    
    if (error) {
      console.error('Database update error:', error)
      return new Response(JSON.stringify({ error: 'Database update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log('✅ Video task updated successfully:', task_id)
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Callback processing error:', error)
    return new Response(JSON.stringify({ error: 'Callback processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
