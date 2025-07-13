
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
    
    // Call Replicate API using correct structure for Zeroscope v2 xl
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "9f747673945c62801b13b84701c6718b292b0bf7239c31b8b1f93c9d1b3df7b1",
        input: {
          image: imageUrl,
          prompt: prompt,
          num_frames: 24,
          num_inference_steps: 20,
          guidance_scale: 17.5,
          fps: 8
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
    image2video: "smooth natural movement, high quality",
    
    // FUN & INTERACTIVE (13 templates)
    make_face: "person making playful facial expression, tongue out, eyes rolling",
    blow_kiss: "person blowing a kiss toward camera, romantic gesture",
    hair_swap: "hair moving and changing style smoothly",
    flying: "person flying through air like superhero",
    nap_me: "person lying down peacefully, falling asleep",
    pilot: "person in airplane cockpit as pilot",
    interaction: "two people making heart shapes with hands",
    hugging_pro: "two people embracing in warm hug",
    carry_me: "one person carrying another on back",
    emotionlab: "person's expression changing from neutral to happy smile",
    wild_laugh: "person breaking into joyful wild laughter",
    surprised: "person showing sudden surprise expression",
    send_roses: "person presenting roses romantically",

    // TRANSFORM & STYLE (15 templates)
    cartoon_doll: "person transforming into cartoon doll version",
    style_me: "person putting on elegant outfit, fashion transformation",
    toy_me: "person becoming toy figurine on base",
    muscling: "person flexing and showing muscular physique",
    muscling_360p: "person demonstrating strength and muscles",
    fairy_me: "person growing magical fairy wings, transformation",
    yayoi_kusama_style: "person covered in polka dot patterns",
    irasutoya: "person in Japanese kawaii art style",
    american_comic: "person in American comic book art style",
    simpsons_comic: "person in Simpsons cartoon animation style",
    child_memory: "adult person with child version appearing",
    outfit_show: "model turning to showcase clothing details",
    spin360: "person rotating 360 degrees smoothly",
    live_memory: "subtle natural movements, breathing, blinking",
    sakura_season: "cherry blossom petals falling around person",

    // CAMERA & MOTION (4 templates)
    zoom_in_fast: "camera zooming in on person smoothly",
    zoom_out_image: "camera pulling back from person",
    zoom_out_startend: "transition from close-up to wide shot",
    walk_forward: "person walking toward camera naturally"
  }

  return prompts[template] || "smooth natural movement, high quality"
}
