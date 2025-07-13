
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
    
    // Call Replicate API
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "8e78b90558f7c2b6b8b5b9bf8ddc3c83fe36b9b7",
        input: {
          image: imageUrl,
          prompt: prompt,
          num_frames: 81,
          max_area: "832x480",
          frames_per_second: 16,
          fast_mode: "Balanced",
          sample_steps: 30,
          sample_guide_scale: 5,
          sample_shift: 3
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
      message: 'Video generation started with Replicate'
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
    image2video: "Generate creative video animation",
    
    // FUN & INTERACTIVE (13 templates) - Converted from Vidu to Replicate format
    make_face: "Person walks toward camera, then makes playful face with tongue out and eyes rolled up",
    blow_kiss: "Person leans forward, blows a kiss toward camera, then waves with a warm smile",
    hair_swap: "Character's hairstyle and color transforms smoothly",
    flying: "Character flies forward through the air like a superhero",
    nap_me: "Character lies down and covers themselves with a blanket for sleep",
    pilot: "Character appears in airplane cockpit as a pilot",
    interaction: "Two people face camera, each making heart shape with hands",
    hugging_pro: "Two people turn toward each other and embrace in a hug",
    carry_me: "One person carries another on their back",
    emotionlab: "Character's expression transitions from neutral to smiling",
    wild_laugh: "Character breaks into joyful wild laughter",
    surprised: "Character shows sudden surprise expression",
    send_roses: "Person picks up roses and presents them to another person",

    // TRANSFORM & STYLE (15 templates) - Converted from Vidu to Replicate format
    cartoon_doll: "Character jumps and transforms into smooth doll version",
    style_me: "Character puts on crisp suit and walks gracefully toward camera",
    toy_me: "Character slowly turns around and transforms into figurine on base",
    muscling: "Man takes off shirt revealing muscular chest",
    muscling_360p: "Lower resolution muscle reveal animation",
    fairy_me: "Character transforms into magical fairy with wings appearing",
    yayoi_kusama_style: "Character transforms with polka dot pattern covering everything",
    irasutoya: "Character transforms into Japanese illustration art style",
    american_comic: "Character transforms into Rick and Morty animation style",
    simpsons_comic: "Character transforms into Simpsons cartoon style",
    child_memory: "Child version appears and embraces the adult subject",
    outfit_show: "Model turns 180 degrees to showcase clothing details",
    spin360: "Subject rotates 360 degrees to show all angles",
    live_memory: "Subtle lifelike movements like blinking and breathing",
    sakura_season: "Cherry blossom petals fall while subject looks up smiling",

    // CAMERA & MOTION (4 templates) - Converted from Vidu to Replicate format
    zoom_in_fast: "Camera steadily zooms in isolating details of subject",
    zoom_out_image: "Camera pulls back revealing surrounding environment",
    zoom_out_startend: "Transition from close-up to wide shot",
    walk_forward: "Character walks forward toward camera naturally"
  }

  return prompts[template] || "Generate creative video animation"
}
