
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
    
    // Simplified status mapping - only use valid database status values
    let dbStatus = 'processing' // Default fallback
    if (state === 'success' || state === 'completed' || state === 'finished') {
      dbStatus = 'completed'
    } else if (state === 'failed' || state === 'error') {
      dbStatus = 'failed'
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

    // Simplified update - just update status and video_url if provided
    const updateData: any = {
      status: dbStatus,
      updated_at: new Date().toISOString()
    }

    // Only set video_url if we have one from the callback
    if (callback_video_url) {
      updateData.video_url = callback_video_url
      console.log('🎬 CALLBACK: Setting video URL from callback:', callback_video_url)
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
        task_id: task_id,
        constraint_error: error.code === '23514' ? 'Invalid status value for database constraint' : null
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log('✅ CALLBACK: Task updated successfully:', {
      task_id,
      newStatus: dbStatus,
      videoUrl: callback_video_url || 'not provided',
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
          video_url: callback_video_url,
          callback_body: body,
          success: true,
          simplified_update: true
        }
      })
      .then(({ error }) => {
        if (error) console.warn('⚠️ CALLBACK: Failed to log audit:', error)
      })
    
    return new Response(JSON.stringify({ 
      success: true,
      task_id: task_id,
      status: dbStatus,
      video_url: callback_video_url || null,
      message: 'Callback processed successfully'
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
              callback_body: errorBody,
              simplified_version: true
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
