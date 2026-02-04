import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('❌ LOVABLE_API_KEY not configured');
    return new Response(JSON.stringify({ 
      success: false,
      error: 'LOVABLE_API_KEY not configured' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { imageBase64, prompt } = await req.json();

    if (!imageBase64 || !prompt) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing imageBase64 or prompt'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🎨 Co-Drawing via Lovable AI: ${prompt}`);

    // Strip data URL prefix if present
    let base64Data = imageBase64;
    if (imageBase64.includes(',')) {
      base64Data = imageBase64.split(',')[1];
    }

    // Build the editing prompt
    const editingPrompt = `You are a collaborative drawing assistant. 
The user has drawn something and wants you to modify or enhance it.

YOUR TASK: "${prompt}"

RULES:
1. FOLLOW THE USER'S REQUEST LITERALLY
2. Keep the user's original drawing as the base/foundation
3. When the user says "add X" - actually ADD that element
4. When the user says "enhance" or "improve" - make the drawing look better
5. When the user says "add colors" - colorize the existing drawing
6. You CAN add new elements when requested
7. The result should look like a natural extension of their drawing`;

    // Call Lovable AI Gateway for image editing
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: editingPrompt },
              { 
                type: "image_url", 
                image_url: { url: `data:image/png;base64,${base64Data}` } 
              }
            ]
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'AI credits exhausted. Please add more credits.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Lovable AI response received');

    // Extract generated image from response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error('❌ No image in response:', JSON.stringify(data));
      throw new Error('No image returned from AI');
    }

    console.log('✅ Image generated successfully');

    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-co-draw",
      provider: "lovable-ai",
      model: "google/gemini-2.5-flash-image",
      inputText: prompt,
      status: "success"
    });

    return new Response(JSON.stringify({
      success: true,
      imageUrl: imageUrl
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error('❌ Error:', error);
    
    await logAIFromRequest(req, {
      functionName: "wakti-co-draw",
      provider: "lovable-ai",
      model: "google/gemini-2.5-flash-image",
      status: "error",
      errorMessage: error.message
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
