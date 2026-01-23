import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const body: ExtractRequest = await req.json();
    const { mode, imageBase64, pdfBase64, images, question, warrantyContext } = body;

    console.log(`[my-warranty-ai] Mode: ${mode}, images count: ${images?.length || 0}`);

    if (mode === "extract") {
      const imageArray = images && images.length > 0 ? images : (imageBase64 ? [imageBase64] : (pdfBase64 ? [pdfBase64] : []));
      
      if (imageArray.length === 0) {
        throw new Error("No document provided for extraction");
      }

      console.log(`[my-warranty-ai] Preparing Claude request with ${imageArray.length} images`);

      const content: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> = [
        { type: "text", text: EXTRACTION_PROMPT }
      ];
      
      for (let i = 0; i < imageArray.length; i++) {
        const cleanedData = cleanBase64(imageArray[i]);
        const imageMime = detectMimeType(cleanedData);
        
        console.log(`[my-warranty-ai] Image ${i + 1}: MIME=${imageMime}, length=${cleanedData.length}`);
        
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: imageMime,
            data: cleanedData
          }
        });
      }

      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          temperature: 0.1,
          messages: [{ role: "user", content: content }]
        }),
      });

      console.log(`[my-warranty-ai] Claude response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[my-warranty-ai] Claude API error:", response.status, errorText);
        throw new Error(`Claude API error: ${response.status}`);
      }

      const result = await response.json();
      const textContent = result.content?.[0]?.text;

      if (!textContent) {
        throw new Error("No response from Claude");
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

      const response = await fetch(CLAUDE_API_URL, {
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[my-warranty-ai] Claude API error:", response.status, errorText);
        throw new Error(`Claude API error: ${response.status}`);
      }

      const result = await response.json();
      const textContent = result.content?.[0]?.text;

      if (!textContent) {
        throw new Error("No response from Claude");
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
