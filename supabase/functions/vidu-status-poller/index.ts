
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { taskId, userId } = await req.json()
    
    if (!taskId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing taskId or userId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`🎬 VIDU POLLER: Starting polling for task ${taskId}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get VIDU API key
    const viduApiKey = Deno.env.get('VIDU_API_KEY')
    if (!viduApiKey) {
      throw new Error('VIDU_API_KEY not configured')
    }

    // Verify this is a valid video task for this user
    const { data: taskData, error: taskError } = await supabase
      .from('video_generation_tasks')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .eq('status', 'processing')
      .single()

    if (taskError || !taskData) {
      console.log(`🎬 VIDU POLLER: Task ${taskId} not found or not processing`)
      return new Response(
        JSON.stringify({ error: 'Task not found or not processing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log(`🎬 VIDU POLLER: Found task ${taskId}, starting polling loop`)

    // Polling loop - check every 10 seconds for up to 3 minutes
    const maxAttempts = 18 // 3 minutes / 10 seconds
    let attempts = 0
    
    while (attempts < maxAttempts) {
      try {
        // Call Vidu's GET generation API
        const viduResponse = await fetch(`https://api.vidu.com/ent/v2/generation/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${viduApiKey}`,
            'Content-Type': 'application/json',
          },
        })

        if (!viduResponse.ok) {
          console.error(`🎬 VIDU POLLER: API error ${viduResponse.status}`)
          throw new Error(`Vidu API responded with status ${viduResponse.status}`)
        }

        const viduData = await viduResponse.json()
        console.log(`🎬 VIDU POLLER: Attempt ${attempts + 1}, status: ${viduData.state}`)

        // Check if video is ready
        if (viduData.state === 'success') {
          console.log(`🎬 VIDU POLLER: Video completed! URL: ${viduData.video_url}`)
          
          // Update database with completion
          const { error: updateError } = await supabase
            .from('video_generation_tasks')
            .update({
              status: 'completed',
              video_url: viduData.video_url,
              updated_at: new Date().toISOString()
            })
            .eq('task_id', taskId)

          if (updateError) {
            console.error(`🎬 VIDU POLLER: Database update error:`, updateError)
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              status: 'completed',
              video_url: viduData.video_url,
              attempts: attempts + 1
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (viduData.state === 'failed') {
          console.log(`🎬 VIDU POLLER: Video generation failed`)
          
          // Update database with failure
          const { error: updateError } = await supabase
            .from('video_generation_tasks')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('task_id', taskId)

          if (updateError) {
            console.error(`🎬 VIDU POLLER: Database update error:`, updateError)
          }

          return new Response(
            JSON.stringify({ 
              success: false, 
              status: 'failed',
              attempts: attempts + 1
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Still processing, wait 10 seconds before next check
        attempts++
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 10000))
        }

      } catch (error) {
        console.error(`🎬 VIDU POLLER: Error during attempt ${attempts + 1}:`, error)
        attempts++
        
        // If this is the last attempt, mark as failed
        if (attempts >= maxAttempts) {
          const { error: updateError } = await supabase
            .from('video_generation_tasks')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('task_id', taskId)

          if (updateError) {
            console.error(`🎬 VIDU POLLER: Final database update error:`, updateError)
          }
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 10000))
        }
      }
    }

    // Timeout reached
    console.log(`🎬 VIDU POLLER: Timeout reached for task ${taskId}`)
    
    const { error: timeoutError } = await supabase
      .from('video_generation_tasks')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('task_id', taskId)

    if (timeoutError) {
      console.error(`🎬 VIDU POLLER: Timeout database update error:`, timeoutError)
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        status: 'timeout',
        attempts: maxAttempts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('🎬 VIDU POLLER: Fatal error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
