
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🎬 REPLICATE STATUS CHECKER: Starting status check')
    
    const { taskId, userId } = await req.json()
    
    if (!taskId) {
      throw new Error('No task ID provided')
    }
    
    console.log('🎬 Checking status for prediction:', taskId)
    
    // Get status from Replicate
    const response = await fetch(`https://api.replicate.com/v1/predictions/${taskId}`, {
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('🎬 Replicate API error:', errorData)
      throw new Error(`Replicate API error: ${response.status}`)
    }

    const prediction = await response.json()
    console.log('🎬 Prediction status:', prediction.status)
    console.log('🎬 Prediction output:', prediction.output)
    
    // Update database with current status
    const { error: updateError } = await supabase
      .from('video_generation_tasks')
      .update({
        status: prediction.status,
        output_url: prediction.output ? (Array.isArray(prediction.output) ? prediction.output[0] : prediction.output) : null,
        error_message: prediction.error?.detail || null,
        updated_at: new Date().toISOString()
      })
      .eq('task_id', taskId)
      .eq('user_id', userId)
    
    if (updateError) {
      console.error('🎬 Database update error:', updateError)
    }
    
    // Check if video is ready
    if (prediction.status === 'succeeded' && prediction.output) {
      const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      console.log('🎬 Video ready! URL:', videoUrl)
      
      return new Response(JSON.stringify({
        success: true,
        videoUrl: videoUrl,
        status: 'completed',
        message: 'Video generation completed successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else if (prediction.status === 'failed') {
      console.log('🎬 Video generation failed:', prediction.error)
      
      return new Response(JSON.stringify({
        success: false,
        error: prediction.error?.detail || 'Video generation failed',
        status: 'failed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      // Still processing
      console.log('🎬 Video still processing, status:', prediction.status)
      
      return new Response(JSON.stringify({
        stillProcessing: true,
        status: prediction.status,
        message: 'Video is still being generated...'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    console.error('🎬 REPLICATE STATUS CHECKER ERROR:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
