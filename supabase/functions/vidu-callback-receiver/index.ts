
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

  console.log('🎬 CALLBACK: Received request method:', req.method)
  console.log('🎬 CALLBACK: Headers:', Object.fromEntries(req.headers.entries()))

  try {
    const body = await req.json()
    console.log('🎬 CALLBACK: Raw body received:', JSON.stringify(body, null, 2))
    
    // Extract data from callback - handle both possible formats
    const task_id = body.task_id || body.id || body.taskId
    const state = body.state || body.status
    const callback_video_url = body.video_url || body.videoUrl || body.url
    
    console.log('🎬 CALLBACK: Extracted data:', {
      task_id,
      state,
      callback_video_url,
      hasCallbackVideoUrl: !!callback_video_url
    })
    
    // Validation
    if (!task_id) {
      console.error('❌ CALLBACK: Missing task_id in callback')
      return new Response(JSON.stringify({ error: 'Missing task_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!state) {
      console.error('❌ CALLBACK: Missing state in callback')
      return new Response(JSON.stringify({ error: 'Missing state' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Map Vidu states to our database states
    let dbStatus = state
    if (state === 'success' || state === 'completed' || state === 'finished') {
      dbStatus = 'completed'
    } else if (state === 'failed' || state === 'error') {
      dbStatus = 'failed'
    } else if (state === 'processing' || state === 'pending' || state === 'running') {
      dbStatus = 'processing'
    }
    
    console.log('🎬 CALLBACK: Status mapping:', {
      originalState: state,
      mappedStatus: dbStatus
    })

    // First, check if the task exists
    const { data: existingTask, error: fetchError } = await supabase
      .from('video_generation_tasks')
      .select('*')
      .eq('task_id', task_id)
      .single()

    if (fetchError) {
      console.error('❌ CALLBACK: Task not found:', task_id, fetchError)
      return new Response(JSON.stringify({ 
        error: 'Task not found',
        task_id: task_id,
        details: fetchError.message 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('🎬 CALLBACK: Found existing task:', {
      id: existingTask.id,
      current_status: existingTask.status,
      current_video_url: existingTask.video_url
    })

    let finalVideoUrl = callback_video_url

    // If status is completed but we don't have a video URL from callback, fetch it from Vidu API
    if (dbStatus === 'completed' && !finalVideoUrl) {
      console.log('🎬 CALLBACK: Status is completed but no video URL in callback. Fetching from Vidu API...')
      
      const viduApiKey = Deno.env.get('VIDU_API_KEY')
      if (!viduApiKey) {
        console.error('❌ CALLBACK: VIDU_API_KEY not configured')
        return new Response(JSON.stringify({ 
          error: 'VIDU_API_KEY not configured' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      try {
        console.log('🎬 CALLBACK: Making GET request to Vidu API for task:', task_id)
        
        const viduResponse = await fetch(`https://api.vidu.com/ent/v2/generation/${task_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${viduApiKey}`,
            'Content-Type': 'application/json'
          }
        })

        console.log('🎬 CALLBACK: Vidu API response status:', viduResponse.status)

        if (!viduResponse.ok) {
          const errorText = await viduResponse.text()
          console.error('❌ CALLBACK: Vidu API error:', errorText)
          throw new Error(`Vidu API error: ${viduResponse.status} - ${errorText}`)
        }

        const viduData = await viduResponse.json()
        console.log('🎬 CALLBACK: Vidu API response data:', JSON.stringify(viduData, null, 2))

        // Extract video URL from Vidu API response
        finalVideoUrl = viduData.video_url || viduData.videoUrl || viduData.url
        
        if (finalVideoUrl) {
          console.log('✅ CALLBACK: Successfully fetched video URL from Vidu API:', finalVideoUrl)
        } else {
          console.warn('⚠️ CALLBACK: No video URL found in Vidu API response')
        }

      } catch (viduError) {
        console.error('❌ CALLBACK: Error fetching video from Vidu API:', viduError)
        
        // Log the error but don't fail the callback - update status anyway
        await supabase
          .from('audit_logs')
          .insert({
            action: 'vidu_fetch_error',
            table_name: 'video_generation_tasks',
            record_id: task_id,
            user_id: existingTask.user_id,
            details: {
              error: viduError.message,
              task_id: task_id,
              callback_received: true,
              vidu_fetch_failed: true
            }
          })
      }
    }

    // Prepare update data
    const updateData: any = {
      status: dbStatus,
      updated_at: new Date().toISOString()
    }

    // Only set video_url if we have one and status is completed
    if (finalVideoUrl && dbStatus === 'completed') {
      updateData.video_url = finalVideoUrl
      console.log('🎬 CALLBACK: Setting video URL in update:', finalVideoUrl)
    }

    // If failed, clear any existing video URL
    if (dbStatus === 'failed') {
      updateData.video_url = null
      updateData.error_message = body.error_message || body.errorMessage || 'Video generation failed'
    }

    console.log('🎬 CALLBACK: Update data:', updateData)
    
    // Update video task in database
    const { data: updatedData, error } = await supabase
      .from('video_generation_tasks')
      .update(updateData)
      .eq('task_id', task_id)
      .select()
    
    if (error) {
      console.error('❌ CALLBACK: Database update error:', error)
      return new Response(JSON.stringify({ 
        error: 'Database update failed',
        details: error.message,
        task_id: task_id
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log('✅ CALLBACK: Task updated successfully:', {
      task_id,
      newStatus: dbStatus,
      videoUrl: finalVideoUrl,
      updatedRecord: updatedData
    })

    // Log callback attempt for debugging
    await supabase
      .from('audit_logs')
      .insert({
        action: 'vidu_callback_received',
        table_name: 'video_generation_tasks',
        record_id: task_id,
        user_id: existingTask.user_id,
        details: {
          original_state: state,
          mapped_status: dbStatus,
          video_url: finalVideoUrl,
          callback_body: body,
          success: true,
          video_fetched_from_api: !callback_video_url && !!finalVideoUrl
        }
      })
      .then(({ error }) => {
        if (error) console.warn('⚠️ CALLBACK: Failed to log audit:', error)
      })
    
    return new Response(JSON.stringify({ 
      success: true,
      task_id: task_id,
      status: dbStatus,
      video_url: finalVideoUrl || null
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('❌ CALLBACK: Processing error:', error)
    
    // Try to log the error if we can extract user info
    try {
      const errorBody = await req.clone().json().catch(() => ({}))
      const task_id = errorBody.task_id || errorBody.id
      
      if (task_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        await supabase
          .from('audit_logs')
          .insert({
            action: 'vidu_callback_error',
            table_name: 'video_generation_tasks', 
            record_id: task_id,
            user_id: 'system',
            details: {
              error: error.message,
              stack: error.stack,
              callback_body: errorBody
            }
          })
      }
    } catch (logError) {
      console.error('❌ CALLBACK: Failed to log error:', logError)
    }
    
    return new Response(JSON.stringify({ 
      error: 'Callback processing failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
