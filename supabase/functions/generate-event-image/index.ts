
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface RequestBody {
  prompt: string
  width?: number
  height?: number
  style?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, width = 1024, height = 1024, style = "photographic" }: RequestBody = await req.json()

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

    // Get API key from environment
    const runwareApiKey = Deno.env.get('RUNWARE_API_KEY')
    
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
            prompt: `Create an event background image: ${prompt}. Make it suitable for event promotion with good contrast for text overlay.`,
            n: 1,
            size: "1024x1024",
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
        
        return new Response(
          JSON.stringify({ 
            imageUrl: openaiData.data[0].url,
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

    // Try Runware first
    const runwareResponse = await fetch('https://api.runware.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runwareApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `Event background: ${prompt}. High quality, professional, suitable for event promotion`,
        width,
        height,
        style,
        num_images: 1,
        model: "runware:100@1"
      }),
    })

    if (!runwareResponse.ok) {
      console.error('Runware API error:', await runwareResponse.text())
      
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
            prompt: `Create an event background image: ${prompt}. Make it suitable for event promotion with good contrast for text overlay.`,
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
    
    if (!data.data || !data.data[0] || !data.data[0].imageURL) {
      throw new Error('Invalid response from Runware API')
    }

    console.log('Successfully generated image via Runware')

    return new Response(
      JSON.stringify({ 
        imageUrl: data.data[0].imageURL,
        provider: 'runware'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in generate-event-image function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image',
        details: error.message,
        imageUrl: '/placeholder.svg' // Provide fallback
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
