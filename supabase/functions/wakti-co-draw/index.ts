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

  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not configured');
    return new Response(JSON.stringify({ 
      success: false,
      error: 'GEMINI_API_KEY not configured' 
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

    console.log(`🎨 Co-Drawing via Gemini API: ${prompt}`);

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

    // Call Gemini API directly for image editing
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: editingPrompt },
              { inlineData: { mimeType: "image/png", data: base64Data } }
            ]
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 1.0
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 400) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid request. Please try a different prompt or drawing.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Gemini API response received');

    // Extract generated image from response parts
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData);
    
    if (!imagePart?.inlineData) {
      console.error('❌ No image in response:', JSON.stringify(data));
      throw new Error('No image returned from Gemini');
    }

    const { mimeType, data: imgBase64 } = imagePart.inlineData;
    const imageUrl = `data:${mimeType};base64,${imgBase64}`;

    console.log('✅ Image generated successfully');

    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-co-draw",
      provider: "gemini",
      model: "gemini-2.5-flash-image",
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
      provider: "gemini",
      model: "gemini-2.5-flash-image",
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
