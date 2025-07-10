
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const VIDU_API_KEY = Deno.env.get('VIDU_API_KEY')
const VIDU_BASE_URL = 'https://api.vidu.com/ent/v2'

interface VideoGenerationRequest {
  template?: string
  images: string[]
  prompt?: string
  resolution?: string
  movement_amplitude?: string
  bgm?: boolean
  aspect_ratio?: string
  duration?: number
  seed?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!VIDU_API_KEY) {
      throw new Error('VIDU_API_KEY environment variable is not set')
    }

    const {
      template,
      images,
      prompt,
      resolution = '360p',
      movement_amplitude = 'auto',
      bgm = false,
      aspect_ratio = '16:9',
      duration = 4,
      seed
    }: VideoGenerationRequest = await req.json()

    console.log('Video generation request:', {
      template,
      imageCount: images.length,
      prompt: prompt?.substring(0, 50) + '...',
      resolution,
      movement_amplitude,
      bgm
    })

    // Validate inputs
    if (!images || images.length === 0) {
      throw new Error('At least one image is required')
    }

    if (!template && !prompt) {
      throw new Error('Either template or prompt is required')
    }

    // Prepare API request based on whether using template or free-form
    let apiEndpoint: string
    let requestBody: any

    if (template) {
      // Use Template2Video API
      apiEndpoint = `${VIDU_BASE_URL}/template2video`
      requestBody = {
        template,
        images,
        prompt,
        seed: seed || Math.floor(Math.random() * 1000000),
        aspect_ratio,
        bgm
      }
    } else {
      // Use Image2Video API
      apiEndpoint = `${VIDU_BASE_URL}/img2video`
      requestBody = {
        model: 'vidu2.0',
        images: [images[0]], // Image2Video only accepts 1 image
        prompt,
        duration,
        seed: seed || Math.floor(Math.random() * 1000000),
        resolution,
        movement_amplitude,
        bgm
      }
    }

    console.log('Calling Vidu API:', apiEndpoint)

    // Call Vidu API
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${VIDU_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Vidu API error:', response.status, errorText)
      throw new Error(`Vidu API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('Vidu API response:', result)

    // Get current user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Store task in database
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Extract user ID from JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Insert task record
    const { data: taskRecord, error: insertError } = await supabase
      .from('video_generation_tasks')
      .insert({
        user_id: user.id,
        task_id: result.task_id,
        template: template || null,
        images,
        prompt: prompt || null,
        seed: requestBody.seed,
        aspect_ratio,
        resolution,
        duration,
        movement_amplitude,
        bgm,
        status: result.state || 'created'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw new Error('Failed to store task in database')
    }

    console.log('Task stored in database:', taskRecord.id)

    return new Response(
      JSON.stringify({
        success: true,
        task_id: result.task_id,
        status: result.state,
        database_id: taskRecord.id,
        message: 'Video generation started successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in video generation:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
