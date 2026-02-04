
# Fix: wakti-co-draw Edge Function - Deprecated Model Error

## Problem

The `wakti-co-draw` edge function is failing with a **404 Not Found** error because the model `gemini-2.0-flash-exp` has been removed from Google's API.

**Error message:**
```
[GoogleGenerativeAI Error]: Error fetching from 
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent: 
[404 Not Found] models/gemini-2.0-flash-exp is not found for API version v1beta
```

---

## Solution

Switch from the direct Google Generative AI SDK to the **Lovable AI Gateway**, which provides access to `google/gemini-2.5-flash-image` (also called "Nano banana") for image generation and editing.

---

## Technical Changes

### File: `supabase/functions/wakti-co-draw/index.ts`

**Current approach (broken):**
- Uses `npm:@google/generative-ai` SDK directly
- Calls deprecated model `gemini-2.0-flash-exp`
- Requires `GEMINI_API_KEY`

**New approach (fixed):**
- Uses Lovable AI Gateway at `https://ai.gateway.lovable.dev/v1/chat/completions`
- Calls supported model `google/gemini-2.5-flash-image`
- Uses `LOVABLE_API_KEY` (already auto-provisioned)

**Key code changes:**

```typescript
// REMOVE: Direct Google SDK import
// import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

// ADD: Use Lovable AI Gateway
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

// Call the gateway with image editing request
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
          { type: "text", text: prompt },
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

// Extract generated image from response
const data = await response.json();
const editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
```

---

## Complete Rewritten Edge Function

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Lovable AI response received');

    // Extract generated image
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
```

---

## Build Error Fix

The build error about `npm:openai@^4.52.5` in `deno.lock` is unrelated to this function - it's a transient issue from JSR type definitions. Removing or regenerating `deno.lock` will resolve it.

---

## Summary

| Change | Before | After |
|--------|--------|-------|
| API | Direct Google SDK | Lovable AI Gateway |
| Model | `gemini-2.0-flash-exp` (deprecated) | `google/gemini-2.5-flash-image` |
| Auth | `GEMINI_API_KEY` | `LOVABLE_API_KEY` (auto-provisioned) |
| SDK Import | `npm:@google/generative-ai` | Native fetch |

---

## Testing

After implementation:
1. Open WAKTI AI → Image Mode → Draw
2. Draw something on the canvas
3. Type a prompt like "enhance" or "add colors"
4. Click generate - should return an AI-enhanced image
