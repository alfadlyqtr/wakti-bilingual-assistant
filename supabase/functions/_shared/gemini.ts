import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Tiny Gemini helper used across Edge Functions (Deno)
// - Streaming and non-streaming wrappers
// - Builders for contents and vision inlineData

export type GeminiPart = { text?: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function getGeminiApiKey(): string {
  const k = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!k) throw new Error("Gemini API key not configured (GEMINI_API_KEY or GOOGLE_GENAI_API_KEY)");
  return k;
}

export function buildTextContent(role: "user" | "model", text: string): GeminiContent {
  return { role, parts: [{ text }] };
}

export function buildVisionContent(prompt: string, images: { mimeType: string; base64: string }[], languageHint?: string): GeminiContent {
  const parts: GeminiPart[] = [];
  const preface = languageHint === "ar"
    ? "يرجى الرد باللغة العربية فقط."
    : languageHint === "en" ? "Please respond in English only." : "";
  const text = preface ? `${preface} ${prompt || ""}`.trim() : (prompt || "");
  if (text) parts.push({ text });
  for (const img of images) {
    if (img?.base64 && img?.mimeType) parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }
  return { role: "user", parts };
}

export type GenerationConfig = {
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  response_mime_type?: string; // e.g. "application/json"
};

export async function generateGemini(
  model = "gemini-2.5-flash-lite",
  contents: GeminiContent[],
  systemInstruction?: string,
  generationConfig?: GenerationConfig,
  safetySettings?: any[]
): Promise<any> {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body: any = {
    contents,
  };
  if (systemInstruction) body.system_instruction = { role: "user", parts: [{ text: systemInstruction }] };
  if (generationConfig) body.generationConfig = generationConfig;
  if (safetySettings) body.safetySettings = safetySettings;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gemini generateContent error: ${resp.status} - ${t}`);
  }
  return await resp.json();
}

export async function streamGemini(
  model = "gemini-2.5-flash-lite",
  contents: GeminiContent[],
  onToken: (t: string) => void,
  systemInstruction?: string,
  generationConfig?: GenerationConfig,
  safetySettings?: any[]
): Promise<void> {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}`;
  const body: any = { contents };
  if (systemInstruction) body.system_instruction = { role: "user", parts: [{ text: systemInstruction }] };
  if (generationConfig) body.generationConfig = generationConfig;
  if (safetySettings) body.safetySettings = safetySettings;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
    body: JSON.stringify(body)
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Gemini streamGenerateContent error: ${resp.status} - ${t}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const cands = parsed?.candidates;
        if (Array.isArray(cands) && cands.length > 0) {
          const parts = cands[0]?.content?.parts || [];
          for (const p of parts) {
            const text = typeof p?.text === "string" ? p.text : undefined;
            if (text) onToken(text);
          }
        }
      } catch {
        // ignore
      }
    }
  }
}
