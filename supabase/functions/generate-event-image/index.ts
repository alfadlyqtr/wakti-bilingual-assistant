
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ENHANCED CORS CONFIGURATION FOR PRODUCTION
const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa',
  'https://lovable.dev',
  'https://5332ebb7-6fae-483f-a0cc-4262a2a445a1.lovableproject.com',
  // Dev/local
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:60477',
  'http://127.0.0.1:60477'
];

const getCorsHeaders = (origin: string | null) => {
  const corsOrigin: string = allowedOrigins.includes(origin ?? '')
    ? (origin ?? 'https://wakti.qa')
    : 'https://wakti.qa';
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
};

interface RequestBody {
  prompt: string
  width?: number
  height?: number
  style?: string
  no_text?: boolean
  negative_prompt?: string
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { prompt, width = 1024, height = 1024, style: _style = "photographic", no_text = false, negative_prompt = '' }: RequestBody = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Generating event image with prompt:', prompt)

    // Normalize prompts
    const noTextClause = 'No text on image. No words, no typography, no watermarks, no captions, no logos.'
    const positivePrompt = no_text
      ? `${prompt} ${noTextClause}`
      : `${prompt}`
    const negativePrompt = [
      'text', 'words', 'typography', 'watermark', 'logo', 'caption', 'subtitles', 'lettering',
      'arabic text', 'english text'
    ]
      .concat(negative_prompt ? [negative_prompt] : [])
      .join(', ')

    // Map OpenAI supported sizes
    const mapOpenAISize = (w: number, h: number) => {
      // DALL·E 3 supports only 1024x1024, 1024x1792 (portrait), 1792x1024 (landscape)
      if (w >= h) return '1792x1024'
      if (h > w) return '1024x1792'
      return '1024x1024'
    }

    // Get API key from environment
    const runwareApiKey = Deno.env.get('RUNWARE_API_KEY')
    // Env-driven image settings
    const RW_PREFERRED_MODEL = Deno.env.get('RUNWARE_PREFERRED_MODEL') || 'runware:97@2'
    const RW_FALLBACK_MODEL = Deno.env.get('RUNWARE_FALLBACK_MODEL') || 'runware:100@1'
    const RW_STEPS = (() => {
      const v = parseInt(Deno.env.get('RUNWARE_STEPS') ?? '28', 10)
      if (Number.isNaN(v)) return 28
      return Math.min(60, Math.max(4, v))
    })()
    const RW_CFG = (() => {
      const v = parseFloat(Deno.env.get('RUNWARE_CFG') ?? '5.5')
      if (Number.isNaN(v)) return 5.5
      return Math.min(20, Math.max(1, v))
    })()
    
    if (!runwareApiKey) {
      console.error('RUNWARE_API_KEY is not configured')
      
      // Fallback to OpenAI DALL-E if Runware is not available
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
      
      if (openaiApiKey) {
        console.log('Falling back to OpenAI DALL-E')
        
        const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: `Create an event background image: ${positivePrompt}. This is an image to be used on an event card. ${noTextClause} High quality, suitable for event promotion with good contrast for text overlay.`,
            n: 1,
            size: mapOpenAISize(width, height),
            quality: "standard",
            response_format: "url"
          }),
        })

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          console.error('OpenAI API error:', errorText)
          throw new Error(`OpenAI API error: ${openaiResponse.status}`)
        }

        const openaiData = await openaiResponse.json()

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (!supabaseUrl || !supabaseServiceKey) {
          throw new Error('Supabase configuration missing')
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const imageResponse = await fetch(openaiData.data[0].url)
        if (!imageResponse.ok) {
          throw new Error('Failed to download generated image')
        }
        const imageBlob = await imageResponse.blob()
        const detectedType = imageResponse.headers.get('content-type') ?? 'image/webp'
        const fileExt = detectedType.includes('png') ? 'png' : detectedType.includes('jpeg') ? 'jpg' : detectedType.includes('gif') ? 'gif' : detectedType.includes('webp') ? 'webp' : 'webp'
        const fileName = `ai-generated/${crypto.randomUUID()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(fileName, imageBlob, { contentType: detectedType, upsert: false })
        if (uploadError) {
          throw new Error(`Failed to save image: ${uploadError.message}`)
        }
        const { data: urlData } = supabase.storage
          .from('event-images')
          .getPublicUrl(fileName)

        return new Response(
          JSON.stringify({ 
            imageUrl: urlData.publicUrl,
            provider: 'openai'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      // If no API keys are available, return a placeholder
      return new Response(
        JSON.stringify({ 
          error: 'Image generation service not available',
          imageUrl: '/placeholder.svg'
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Use Runware with preferred-then-fallback
    console.log('🎨 Generating image with Runware API for prompt:', prompt)
    const taskUUID = crypto.randomUUID()
    const buildPayload = (model: string) => ([
      {
        taskType: "authentication",
        apiKey: runwareApiKey
      },
      {
        taskType: "imageInference",
        taskUUID,
        positivePrompt: `Event background: ${positivePrompt}. This is an image to be used on an event card. ${noTextClause} High quality, professional, suitable for event promotion with good contrast for text overlay.`,
        negativePrompt,
        width,
        height,
        model,
        numberResults: 1,
        outputFormat: "WEBP",
        includeCost: true,
        CFGScale: RW_CFG,
        scheduler: "FlowMatchEulerDiscreteScheduler",
        steps: RW_STEPS,
      }
    ])

    let modelUsed = RW_PREFERRED_MODEL
    let runwareResponse = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(RW_PREFERRED_MODEL)),
    })

    if (!runwareResponse.ok) {
      const errText = await runwareResponse.text().catch(() => '')
      console.warn('🎨 Runware preferred failed:', runwareResponse.status, errText)
      modelUsed = RW_FALLBACK_MODEL
      runwareResponse = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(RW_FALLBACK_MODEL)),
      })
    }

    if (!runwareResponse.ok) {
      console.error('🎨 Runware API error:', await runwareResponse.text())
      
      // Fallback to OpenAI if Runware fails
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
      
      if (openaiApiKey) {
        console.log('Runware failed, falling back to OpenAI DALL-E')
        
        const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: `Create an event background image: ${prompt}. This is an image to be used on an event card. No text on image. No words, no typography, no watermarks. High quality, suitable for event promotion with good contrast for text overlay.`,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            response_format: "url"
          }),
        })

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text()
          console.error('OpenAI fallback also failed:', errorText)
          throw new Error(`Both Runware and OpenAI failed`)
        }

        const openaiData = await openaiResponse.json()
        
        return new Response(
          JSON.stringify({ 
            imageUrl: openaiData.data[0].url,
            provider: 'openai-fallback'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      throw new Error(`Runware API error and no OpenAI fallback available`)
    }

    const data = await runwareResponse.json()
    console.log('🎨 Runware response data:', data)

    // Find the image generation result in the response array
    const imageResult = data.data?.find((item: { taskType?: string; imageURL?: string }) => item.taskType === "imageInference")
    
    if (!imageResult || !imageResult.imageURL) {
      console.error('Invalid response from Runware API:', data)
      throw new Error('Invalid response from Runware API - no image URL found')
    }

    console.log('Successfully generated image via Runware')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const imageResponse = await fetch(imageResult.imageURL)
    if (!imageResponse.ok) {
      throw new Error('Failed to download generated image')
    }
    const imageBlob = await imageResponse.blob()
    const detectedType = imageResponse.headers.get('content-type') ?? 'image/webp'
    const fileExt = detectedType.includes('png') ? 'png' : detectedType.includes('jpeg') ? 'jpg' : detectedType.includes('gif') ? 'gif' : detectedType.includes('webp') ? 'webp' : 'webp'
    const fileName = `ai-generated/${crypto.randomUUID()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('event-images')
      .upload(fileName, imageBlob, { contentType: detectedType, upsert: false })
    if (uploadError) {
      throw new Error(`Failed to save image: ${uploadError.message}`)
    }
    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName)

    return new Response(
      JSON.stringify({ 
        imageUrl: urlData.publicUrl,
        provider: 'runware',
        modelUsed
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const err = error as Error
    console.error('Error in generate-event-image function:', err)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image',
        details: err.message,
        imageUrl: '/placeholder.svg' // Provide fallback
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
