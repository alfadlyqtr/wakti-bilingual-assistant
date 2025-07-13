
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
    console.log('🎬 REPLICATE VIDEO GENERATOR: Starting video generation request')
    
    const { images, template, prompt: customPrompt, user_id } = await req.json()
    
    if (!images || images.length === 0) {
      throw new Error('No images provided')
    }
    
    // Use first image for Replicate model
    const imageUrl = images[0]
    console.log('🎬 Using image URL:', imageUrl)
    console.log('🎬 Template:', template)
    
    // Get template prompt
    const prompt = getTemplatePrompt(template, customPrompt)
    console.log('🎬 Generated prompt:', prompt)
    
    // Call Replicate API using Zeroscope v2 xl
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "9f747673945c62801b13b84701c6718b292b0bf7239c31b8b1f93c9d1b3df7b1",
        input: {
          init_image: imageUrl,
          prompt: prompt,
          num_frames: 24,
          num_inference_steps: 20
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('🎬 Replicate API error:', errorData)
      throw new Error(`Replicate API error: ${response.status} ${errorData}`)
    }

    const prediction = await response.json()
    console.log('🎬 Replicate prediction created:', prediction.id)
    
    // Store in existing database table (reuse structure)
    const { data: dbData, error: dbError } = await supabase
      .from('video_generation_tasks')
      .insert({
        user_id: user_id,
        task_id: prediction.id, // Using task_id to store prediction_id
        status: prediction.status,
        template: template,
        prompt: prompt,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (dbError) {
      console.error('🎬 Database error:', dbError)
      throw new Error(`Database error: ${dbError.message}`)
    }
    
    console.log('🎬 Database record created:', dbData)
    
    return new Response(JSON.stringify({ 
      success: true, 
      job_id: prediction.id,
      prediction_id: prediction.id,
      status: prediction.status,
      message: 'Video generation started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('🎬 REPLICATE VIDEO GENERATOR ERROR:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function getTemplatePrompt(template: string, customPrompt?: string): string {
  if (template === 'image2video' && customPrompt) {
    return customPrompt
  }

  const prompts: Record<string, string> = {
    // Custom
    image2video: "A person moving naturally",
    
    // FUN & INTERACTIVE (13 templates) - Simplified for Zeroscope
    make_face: "A person making a playful facial expression",
    blow_kiss: "A person blowing a kiss",
    hair_swap: "A person with changing hairstyles",
    flying: "A person flying through the air",
    nap_me: "A person lying down to sleep",
    pilot: "A person as an airplane pilot",
    interaction: "Two people making heart shapes with hands",
    hugging_pro: "Two people hugging",
    carry_me: "One person carrying another",
    emotionlab: "A person smiling warmly",
    wild_laugh: "A person laughing joyfully",
    surprised: "A person looking surprised",
    send_roses: "A person giving roses",

    // TRANSFORM & STYLE (15 templates) - Simplified for Zeroscope
    cartoon_doll: "A person transforming into cartoon style",
    style_me: "A person in elegant clothing",
    toy_me: "A person as a toy figurine",
    muscling: "A muscular person flexing",
    muscling_360p: "A person showing strength",
    fairy_me: "A person with magical fairy wings",
    yayoi_kusama_style: "A person with polka dot patterns",
    irasutoya: "A person in Japanese art style",
    american_comic: "A person in comic book style",
    simpsons_comic: "A person in cartoon animation style",
    child_memory: "A person with childhood memories",
    outfit_show: "A person modeling clothing",
    spin360: "A person rotating to show all angles",
    live_memory: "A person with natural movements",
    sakura_season: "A person with falling cherry blossoms",

    // CAMERA & MOTION (4 templates) - Simplified for Zeroscope
    zoom_in_fast: "Camera zooming in on a person",
    zoom_out_image: "Camera pulling back from a person",
    zoom_out_startend: "Camera transitioning from close-up to wide shot",
    walk_forward: "A person walking toward camera"
  }

  return prompts[template] || "A person moving naturally"
}
