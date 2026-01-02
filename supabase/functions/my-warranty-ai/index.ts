import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExtractRequest {
  mode: "extract" | "qa";
  imageBase64?: string;
  pdfBase64?: string;
  mimeType?: string;
  question?: string;
  warrantyContext?: string;
}

interface ExtractedWarranty {
  title: string;
  provider: string | null;
  category: "Electronics" | "Appliance" | "Vehicle" | "Insurance" | "Other" | string;
  purchase_date: string | null;
  warranty_period: string | null;
  expiry_date: string | null;
  ref_number: string | null;
  support_contact: string | null;
  notes: string | null;
}

const EXTRACTION_PROMPT = `Role:
You are the Wakti Data Extraction Engine. Your sole purpose is to analyze images of receipts, warranty cards, insurance policies, and contracts to extract structured data for a warranty tracking database.

Input:
An image or PDF document (Receipt, Invoice, Policy Document, or Warranty Card).

Processing Logic:
1. Identify the Core Asset: Scan the document for the primary high-value item (e.g., "Sony PlayStation 5", "Toyota Insurance Policy", "Samsung Fridge"). Ignore low-value consumables (groceries, cables) if they appear on the same receipt.
2. Date Normalization: Identify the purchase_date. 
Crucial: If the document contains a "Warranty Period" (e.g., "2 Years" or "24 Months"), you must calculate the expiry_date by adding that duration to the purchase_date. 
If no warranty period is found, estimate a default based on the category (e.g., Electronics = 1 year) but mark it as estimated.
Format all dates as YYYY-MM-DD.
3. Language Handling: The document may be in English, Arabic, or mixed. You must parse both, but output the values in English (e.g., if it says "تأمين سيارة", output title: "Car Insurance").
4. Category Classification: Classify the item into one of: Electronics, Appliance, Vehicle, Insurance, Furniture, Other.

Output Format:
Return ONLY a raw JSON object. Do not include Markdown formatting (\`\`\`json), conversational text, or explanations.

JSON Schema:
{
  "title": "String (Short, clear name of the product or policy)",
  "provider": "String (Name of store, brand, or insurance company)",
  "category": "String (Electronics | Appliance | Vehicle | Insurance | Other)",
  "purchase_date": "YYYY-MM-DD (or null if not found)",
  "warranty_period": "String (e.g., '2 Years', 'Lifetime', or null)",
  "expiry_date": "YYYY-MM-DD (The calculated expiration date)",
  "ref_number": "String (Serial Number, Policy Number, or Invoice Number)",
  "support_contact": "String (Phone number or email found on doc, or null)",
  "notes": "String (Any specific conditions, e.g., 'Parts only', 'Screen damage excluded')"
}

Constraints:
- If a field cannot be found, return null.
- If multiple dates exist, prioritize "Delivery Date" or "Policy Start Date" as the purchase date.
- Be strict. Do not hallucinate numbers.`;

const QA_PROMPT = `You are a helpful warranty assistant. Answer the user's question based ONLY on the warranty information provided below.

WARRANTY INFORMATION:
{context}

USER QUESTION: {question}

RULES:
1. Answer based ONLY on the warranty information above
2. If the answer is not in the warranty info, say "This information is not specified in your warranty document."
3. Be concise and direct
4. If asked about coverage, be specific about what IS and IS NOT covered
5. If asked about dates, provide the exact dates
6. Respond in the same language as the question (Arabic or English)

Answer:`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const body: ExtractRequest = await req.json();
    const { mode, imageBase64, pdfBase64, mimeType, question, warrantyContext } = body;

    let requestBody: {
      contents: Array<{
        parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>;
      }>;
      generationConfig: { temperature: number; maxOutputTokens: number };
    };

    if (mode === "extract") {
      // Extraction mode - analyze image/PDF
      if (!imageBase64 && !pdfBase64) {
        throw new Error("No document provided for extraction");
      }

      const documentData = imageBase64 || pdfBase64 || '';
      const documentMimeType = mimeType || (pdfBase64 ? "application/pdf" : "image/jpeg");

      requestBody = {
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inline_data: {
                  mime_type: documentMimeType,
                  data: documentData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      };
    } else if (mode === "qa") {
      // Q&A mode - answer questions about warranty
      if (!question) {
        throw new Error("No question provided");
      }

      const prompt = QA_PROMPT
        .replace("{context}", warrantyContext || "No warranty information available")
        .replace("{question}", question);

      requestBody = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      };
    } else {
      throw new Error("Invalid mode. Use 'extract' or 'qa'");
    }

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error("No response from Gemini");
    }

    if (mode === "extract") {
      // Parse JSON response for extraction
      try {
        // Clean up potential markdown formatting
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
        cleanJson = cleanJson.trim();

        const extracted: ExtractedWarranty = JSON.parse(cleanJson);

        return new Response(
          JSON.stringify({
            success: true,
            mode: "extract",
            data: extracted,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Raw:", textContent);
        return new Response(
          JSON.stringify({
            success: true,
            mode: "extract",
            data: {
              title: "Unknown Product",
              provider: null,
              category: "Other",
              purchase_date: null,
              warranty_period: null,
              expiry_date: null,
              ref_number: null,
              support_contact: null,
              notes: textContent,
            },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      // Return Q&A answer
      return new Response(
        JSON.stringify({
          success: true,
          mode: "qa",
          answer: textContent.trim(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
