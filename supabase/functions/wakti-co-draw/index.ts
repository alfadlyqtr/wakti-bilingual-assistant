import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";
import { logAI } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

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

    console.log(`🎨 Gemini Co-Drawing: ${prompt}`);

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Use Gemini 2.0 Flash with native image generation
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: ['Text', 'Image']
      },
    });

    // Strip data URL prefix if present
    let base64Data = imageBase64;
    if (imageBase64.includes(',')) {
      base64Data = imageBase64.split(',')[1];
    }

    // Create multipart content with drawing + prompt
    const generationContent = [
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/png"
        }
      },
      { 
        text: `You are a collaborative drawing assistant. The user has drawn something and wants you to enhance it.

IMPORTANT RULES:
- PRESERVE the user's original drawing lines and structure
- Only ADD or ENHANCE based on their request: "${prompt}"
- DO NOT completely redraw or replace their sketch UNLESS the user explicitly asks to "redraw", "replace", or "completely change" it
- Keep the same composition, layout, and concept
- Maintain the original drawing style (simple line art/doodle style)
- Add details, colors, or elements AROUND and ON TOP of the existing drawing
- Think of it as collaborative drawing, not image replacement

User's request: ${prompt}` 
      }
    ];

    console.log('🚀 Calling Gemini API...');
    const response = await model.generateContent(generationContent);
    console.log('✅ Gemini API response received');

    // Extract image from response
    for (const part of response.response.candidates[0].content.parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        console.log('✅ Image generated, length:', imageData.length);
        
        // Return base64 image as data URL
        const imageUrl = `data:image/png;base64,${imageData}`;
        
        // Log successful AI usage
        await logAI({
          functionName: "wakti-co-draw",
          provider: "gemini",
          model: "gemini-2.0-flash-exp",
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
      }
    }

    throw new Error('No image in response');

  } catch (err: unknown) {
    const error = err as Error;
    console.error('❌ Error:', error);
    
    // Log failed AI usage
    await logAI({
      functionName: "wakti-co-draw",
      provider: "gemini",
      model: "gemini-2.0-flash-exp",
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
