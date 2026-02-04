

# Fix: wakti-co-draw Edge Function - Restore Direct Gemini API

## Problem

The `wakti-co-draw` function was incorrectly changed to use Lovable AI Gateway, but the project has `GEMINI_API_KEY` configured and should use the direct Google Gemini API.

**Current error:** `LOVABLE_API_KEY not configured`

---

## Solution

Restore the edge function to use the **direct Gemini API** with your existing `GEMINI_API_KEY`, using the correct model `gemini-2.5-flash-image` which supports image generation.

---

## Technical Changes

### File: `supabase/functions/wakti-co-draw/index.ts`

**What changes:**

| Aspect | Current (broken) | Fixed |
|--------|------------------|-------|
| API | Lovable AI Gateway | Direct Gemini API |
| Model | `google/gemini-2.5-flash-image` | `gemini-2.5-flash-image` |
| Auth | `LOVABLE_API_KEY` (missing) | `GEMINI_API_KEY` (configured) |
| Endpoint | `ai.gateway.lovable.dev` | `generativelanguage.googleapis.com` |

**Key changes:**

1. **Use `GEMINI_API_KEY`** instead of `LOVABLE_API_KEY`
2. **Call Gemini API directly** at `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
3. **Use proper request format** with `generationConfig.responseModalities: ["TEXT", "IMAGE"]`
4. **Send image as `inlineData`** with `mimeType` and `data` (base64)
5. **Extract response image** from `candidates[0].content.parts[].inlineData`

**API request format:**
```typescript
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
```

**Response extraction:**
```typescript
const data = await response.json();
const parts = data.candidates?.[0]?.content?.parts || [];
const imagePart = parts.find(p => p.inlineData);

if (imagePart?.inlineData) {
  const { mimeType, data: imgBase64 } = imagePart.inlineData;
  const imageUrl = `data:${mimeType};base64,${imgBase64}`;
  // Return this imageUrl
}
```

---

## Summary

- Removes Lovable AI Gateway dependency
- Uses your existing `GEMINI_API_KEY` secret
- Calls `gemini-2.5-flash-image` model directly via Google's API
- Properly handles image input/output with `inlineData` format
- Maintains all existing error handling and logging

