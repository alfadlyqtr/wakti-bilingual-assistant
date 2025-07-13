
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

console.log('🎬 MANUAL CHECK: Function loaded')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { taskId, userId } = await req.json()
    console.log('🎬 MANUAL CHECK: Received request for task:', taskId, 'user:', userId)

    if (!taskId || !userId) {
      console.error('🎬 MANUAL CHECK: Missing taskId or userId')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing taskId or userId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const viduApiKey = Deno.env.get('VIDU_API_KEY')
    if (!viduApiKey) {
      console.error('🎬 MANUAL CHECK: VIDU_API_KEY not found')
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Call Vidu API to check task status
    console.log('🎬 MANUAL CHECK: Calling Vidu API for task:', taskId)
    
    const viduResponse = await fetch(`https://api.vidu.com/ent/v2/generation/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${viduApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('🎬 MANUAL CHECK: Vidu API response status:', viduResponse.status)
    
    if (!viduResponse.ok) {
      const errorText = await viduResponse.text()
      console.error('🎬 MANUAL CHECK: Vidu API error:', viduResponse.status, errorText)
      
      if (viduResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Video not found or expired',
            stillProcessing: false
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to check video status',
          stillProcessing: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const viduData = await viduResponse.json()
    console.log('🎬 MANUAL CHECK: Vidu response data:', JSON.stringify(viduData, null, 2))

    // Check if video is ready
    if (viduData.state === 'success' && viduData.video) {
      console.log('🎬 MANUAL CHECK: Video is ready! URL:', viduData.video)
      
      // Update database with video URL
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      
      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/video_generation_tasks?task_id=eq.${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({
          status: 'completed',
          video_url: viduData.video,
          updated_at: new Date().toISOString()
        })
      })

      if (updateResponse.ok) {
        console.log('🎬 MANUAL CHECK: Database updated successfully')
        return new Response(
          JSON.stringify({ 
            success: true, 
            videoUrl: viduData.video,
            status: 'completed'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else {
        console.error('🎬 MANUAL CHECK: Failed to update database')
      }
    } else if (viduData.state === 'processing' || viduData.state === 'queueing') {
      console.log('🎬 MANUAL CHECK: Video still processing, state:', viduData.state)
      return new Response(
        JSON.stringify({ 
          success: false, 
          stillProcessing: true,
          state: viduData.state,
          message: viduData.state === 'queueing' ? 'Video is in queue...' : 'Video is still processing...'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else if (viduData.state === 'failed') {
      console.log('🎬 MANUAL CHECK: Video generation failed')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Video generation failed',
          stillProcessing: false
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.log('🎬 MANUAL CHECK: Unknown state:', viduData.state)
      return new Response(
        JSON.stringify({ 
          success: false, 
          stillProcessing: true,
          message: 'Checking video status...'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('🎬 MANUAL CHECK: Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
