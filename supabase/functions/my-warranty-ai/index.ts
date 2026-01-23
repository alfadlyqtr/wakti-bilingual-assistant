import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
};

interface ExtractRequest {
  mode: "extract" | "qa";
  imageBase64?: string;
  pdfBase64?: string;
  images?: string[];
  mimeType?: string;
  question?: string;
  warrantyContext?: string;
  language?: "en" | "ar";
}

const EXTRACTION_PROMPT = `You are Wakti's Document Intelligence Engine. Analyze ALL provided images/pages as a single document set and extract key information as a clean, well-formatted JSON response.

Extract these critical fields:
1. title: Clear descriptive title
2. provider: Company/store name
3. category: Specific category (Motor_Insurance, Product_Warranty, Purchase_Receipt, etc.)
4. purchase_date: Date in YYYY-MM-DD format
5. warranty_period: Duration (e.g., "1 year")
6. expiry_date: Expiry date in YYYY-MM-DD format
7. ref_number: Invoice/reference number
8. support_contact: Support phone/email

Return ONLY valid JSON in this format:
{
  "title": "Descriptive title",
  "provider": "Company name",
  "category": "Category",
  "purchase_date": "YYYY-MM-DD or null",
  "warranty_period": "Duration or null",
  "expiry_date": "YYYY-MM-DD or null",
  "ref_number": "Reference number",
  "support_contact": "Contact info",
  "notes": "Additional notes",
  "ai_summary": "2 paragraph plain text summary"
}`;

const QA_PROMPT = `Answer based on the warranty information provided.

WARRANTY INFORMATION:
{context}

USER QUESTION: {question}

Answer concisely in the same language as the question.`;

function detectMimeType(base64Data: string): string {
  const cleanData = base64Data.trim();
  if (cleanData.startsWith('/9j/') || cleanData.startsWith('/9j')) return 'image/jpeg';
  if (cleanData.startsWith('iVBORw')) return 'image/png';
  if (cleanData.startsWith('UklGR')) return 'image/webp';
  if (cleanData.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

function cleanBase64(base64Data: string): string {
  return base64Data.trim().replace(/\s/g, '');
}

function normalizeImageMimeType(mimeType: string): string {
  if (mimeType === 'image/jpg') return 'image/jpeg';
  return mimeType;
}

async function callClaudeVision(content: any[], model: string): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: "user", content: content }]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${model}): ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.content?.[0]?.text;
}

async function callOpenAIVision(content: any[], model: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: "user", content: content }]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${model}): ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content;
}

async function extractWithFallback(imageArray: string[]): Promise<string> {
  console.log(`[my-warranty-ai] Starting extraction with ${imageArray.length} images`);

  // Build content for Claude
  const claudeContent: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> = [
    { type: "text", text: EXTRACTION_PROMPT }
  ];
  
  for (let i = 0; i < imageArray.length; i++) {
    const cleanedData = cleanBase64(imageArray[i]);
    const imageMime = normalizeImageMimeType(detectMimeType(cleanedData));
    
    console.log(`[my-warranty-ai] Image ${i + 1}: MIME=${imageMime}, length=${cleanedData.length}`);
    
    claudeContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMime,
        data: cleanedData
      }
    });
  }

  // Build content for OpenAI
  const openaiContent: any[] = [
    { type: 'text', text: EXTRACTION_PROMPT }
  ];

  for (let i = 0; i < imageArray.length; i++) {
    const cleanedData = cleanBase64(imageArray[i]);
    const imageMime = normalizeImageMimeType(detectMimeType(cleanedData));
    const url = `data:${imageMime};base64,${cleanedData}`;
    openaiContent.push({ type: 'image_url', image_url: { url } });
  }

  // Fallback chain: Claude models first, then OpenAI
  const claudeModels = [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307'
  ];

  const openaiModels = [
    'gpt-4o-2024-08-06',
    'gpt-4o',
    'gpt-4o-mini'
  ];

  // Try Claude models
  for (const model of claudeModels) {
    try {
      console.log(`[my-warranty-ai] Trying Claude model: ${model}`);
      const result = await callClaudeVision(claudeContent, model);
      if (result) {
        console.log(`[my-warranty-ai] Success with ${model}`);
        return result;
      }
    } catch (error) {
      console.error(`[my-warranty-ai] ${model} failed:`, error);
    }
  }

  // Try OpenAI models
  for (const model of openaiModels) {
    try {
      console.log(`[my-warranty-ai] Trying OpenAI model: ${model}`);
      const result = await callOpenAIVision(openaiContent, model);
      if (result) {
        console.log(`[my-warranty-ai] Success with ${model}`);
        return result;
      }
    } catch (error) {
      console.error(`[my-warranty-ai] ${model} failed:`, error);
    }
  }

  throw new Error("All vision models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ExtractRequest = await req.json();
    const { mode, imageBase64, pdfBase64, images, question, warrantyContext } = body;

    console.log(`[my-warranty-ai] Mode: ${mode}, images count: ${images?.length || 0}`);

    if (mode === "extract") {
      const imageArray = images && images.length > 0 ? images : (imageBase64 ? [imageBase64] : (pdfBase64 ? [pdfBase64] : []));
      
      if (imageArray.length === 0) {
        throw new Error("No document provided for extraction");
      }

      const textContent = await extractWithFallback(imageArray);

      if (!textContent) {
        throw new Error("No response from AI models");
      }

      try {
        let cleanJson = textContent.trim();
        
        if (cleanJson.startsWith("```json")) {
          cleanJson = cleanJson.slice(7);
        }
        if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.slice(3);
        }
        if (cleanJson.endsWith("```")) {
          cleanJson = cleanJson.slice(0, -3);
        }

        const extracted = JSON.parse(cleanJson.trim());
        console.log(`[my-warranty-ai] Extraction complete: ${extracted.title}`);

        return new Response(
          JSON.stringify({
            success: true,
            mode: "extract",
            data: extracted,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (parseError) {
        console.error("[my-warranty-ai] JSON parse error:", parseError);
        return new Response(
          JSON.stringify({
            success: true,
            mode: "extract",
            data: {
              title: "Document",
              provider: null,
              category: "Other",
              purchase_date: null,
              warranty_period: null,
              expiry_date: null,
              ref_number: null,
              support_contact: null,
              notes: textContent,
              ai_summary: textContent.substring(0, 500),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (mode === "qa") {
      if (!question) {
        throw new Error("No question provided");
      }

      const prompt = QA_PROMPT
        .replace("{context}", warrantyContext || "No warranty information available")
        .replace("{question}", question);

      // Try Claude first for QA
      let textContent: string | null = null;
      
      try {
        if (ANTHROPIC_API_KEY) {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              temperature: 0.3,
              messages: [{ role: "user", content: prompt }]
            }),
          });

          if (response.ok) {
            const result = await response.json();
            textContent = result.content?.[0]?.text;
          }
        }
      } catch (error) {
        console.error("[my-warranty-ai] Claude QA failed:", error);
      }

      // Fallback to OpenAI
      if (!textContent && OPENAI_API_KEY) {
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              max_tokens: 1024,
              temperature: 0.3,
              messages: [{ role: "user", content: prompt }]
            }),
          });

          if (response.ok) {
            const result = await response.json();
            textContent = result.choices?.[0]?.message?.content;
          }
        } catch (error) {
          console.error("[my-warranty-ai] OpenAI QA failed:", error);
        }
      }

      if (!textContent) {
        throw new Error("No response from AI models");
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "qa",
          answer: textContent.trim(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error("Invalid mode. Use 'extract' or 'qa'");
    }
  } catch (error) {
    console.error("[my-warranty-ai] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
