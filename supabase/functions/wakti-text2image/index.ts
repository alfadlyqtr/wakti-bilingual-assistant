// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ─── AI Logger (inlined) ───
interface AILogParams {
  functionName: string;
  userId?: string;
  model: string;
  inputText?: string;
  outputText?: string;
  durationMs?: number;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function calculateCost(model: string): number {
  // Runware image gen ~$0.002-0.003 per call
  if (model.includes('111')) return 0.003;
  return 0.002;
}

async function logAI(params: AILogParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log("[aiLogger] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const inputTokens = estimateTokens(params.inputText);
    const cost = calculateCost(params.model);

    // Call RPC with CORRECT parameter names matching the function signature
    const { error } = await supabase.rpc("log_ai_usage", {
      p_user_id: params.userId || null,
      p_function_name: params.functionName,
      p_model: params.model,
      p_status: params.status,
      p_error_message: params.errorMessage || null,
      p_prompt: params.inputText ? params.inputText.substring(0, 2000) : null,
      p_response: params.outputText ? params.outputText.substring(0, 2000) : null,
      p_metadata: params.metadata || {},
      p_input_tokens: inputTokens,
      p_output_tokens: 0,
      p_duration_ms: params.durationMs || 0,
      p_cost_credits: cost,
    });

    if (error) {
      console.error("[aiLogger] RPC error:", error);
    } else {
      console.log(`[aiLogger] ✅ Logged: ${params.functionName} | ${params.model}`);
    }
  } catch (err) {
    console.error("[aiLogger] Error:", err);
  }
}
// ─── End AI Logger ───

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

const MODEL_FAST = Deno.env.get("RUNWARE_FAST_MODEL") || "runware:111@1";
const MODEL_BEST = Deno.env.get("RUNWARE_BEST_FAST_MODEL") || "runware:400@1";
const DEFAULT_WIDTH = parseInt(Deno.env.get("WAKTI_T2I_WIDTH") ?? "1024", 10);
const DEFAULT_HEIGHT = parseInt(Deno.env.get("WAKTI_T2I_HEIGHT") ?? "1024", 10);
const STEPS = parseInt(Deno.env.get("WAKTI_T2I_STEPS") ?? "28", 10);
const CFG = parseFloat(Deno.env.get("WAKTI_T2I_CFG") ?? "5.5");
const TIMEOUT_MS = parseInt(Deno.env.get("WAKTI_T2I_TIMEOUT_MS") ?? "180000", 10);

const isArabic = (s: string)=>/[\u0600-\u06FF]/.test(s || "");

async function translateIfArabic(prompt: string) {
  try {
    if (!isArabic(prompt)) return prompt;
    if (!DEEPSEEK_API_KEY) return prompt;
    const controller = new AbortController();
    const tid = setTimeout(()=>controller.abort(), 10000);
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Translate Arabic image prompts to English. Return ONLY the English translation." },
          { role: "user", content: `Translate this to English: ${prompt}` }
        ],
        max_tokens: 300,
        temperature: 0.1
      }),
      signal: controller.signal
    });
    clearTimeout(tid);
    if (!resp.ok) return prompt;
    const json = await resp.json().catch(()=>null);
    const txt = json?.choices?.[0]?.message?.content?.trim();
    return txt || prompt;
  } catch  {
    return prompt;
  }
}

function snap64(n: number) {
  return Math.max(64, Math.round(n / 64) * 64);
}

const IMAGE_URL_KEYS = ["imageURL","URL","url","outputUrl","outputURL"] as const;
const IMAGE_DATAURI_KEYS = ["imageDataURI","dataURI","dataUrl","data_uri"] as const;

function findFirstImage(node: unknown): { url?: string; dataURI?: string } | null {
  const visited = new Set<object>();
  function dfs(obj: any): { url?: string; dataURI?: string } | null {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
    visited.add(obj);
    for (const k of IMAGE_URL_KEYS) if (typeof obj[k] === 'string' && obj[k]) return { url: obj[k] };
    for (const k of IMAGE_DATAURI_KEYS) if (typeof obj[k] === 'string' && obj[k]) return { dataURI: obj[k] };
    if (Array.isArray(obj)) { for (const it of obj) { const got = dfs(it); if (got) return got; } }
    else { for (const key in obj) { const got = dfs(obj[key]); if (got) return got; } }
    return null;
  }
  return dfs(node);
}

async function runwareGenerate(positivePrompt: string, model: string, signal?: AbortSignal) {
  const width = snap64(DEFAULT_WIDTH);
  const height = snap64(DEFAULT_HEIGHT);
  const payload = [
    { taskType: "authentication", apiKey: RUNWARE_API_KEY },
    {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      positivePrompt,
      width,
      height,
      model,
      numberResults: 1,
      outputFormat: "WEBP",
      outputType: ["URL","dataURI"],
      includeCost: true,
      CFGScale: CFG,
      steps: STEPS
    }
  ];
  const controller = new AbortController();
  const tid = setTimeout(()=>controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", ()=>controller.abort());
  try {
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Runware error ${res.status}: ${text?.slice(0, 200)}`);
    if (!text) throw new Error("Empty response from Runware");
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON from Runware"); }
    const found = findFirstImage(data);
    const url = found?.url || found?.dataURI || null;
    return { url };
  } finally { clearTimeout(tid); }
}

Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...cors } });
  const startTime = Date.now();
  let usedModel = MODEL_FAST;
  let promptText = "";

  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
    if (!RUNWARE_API_KEY) return new Response(JSON.stringify({ success: false, error: "RUNWARE_API_KEY not configured" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json().catch(()=>({}));
    const prompt = (body?.prompt || "").toString();
    const quality = (body?.quality || "fast").toString();
    const userId = body?.user_id || null;
    promptText = prompt;

    if (!prompt.trim()) return new Response(JSON.stringify({ success: false, error: "Missing prompt" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

    const translated = await translateIfArabic(prompt);
    usedModel = quality === "best_fast" ? MODEL_BEST : MODEL_FAST;

    const { url } = await runwareGenerate(translated, usedModel, req.signal);
    if (!url) {
      await logAI({
        functionName: "text2image",
        userId,
        model: usedModel,
        inputText: prompt,
        durationMs: Date.now() - startTime,
        status: "error",
        errorMessage: "No image returned",
        metadata: { provider: "runware", quality }
      });
      return new Response(JSON.stringify({ success: false, error: "No image returned" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Log successful AI usage
    await logAI({
      functionName: "text2image",
      userId,
      model: usedModel,
      inputText: prompt,
      durationMs: Date.now() - startTime,
      status: "success",
      metadata: { provider: "runware", quality, translated: translated !== prompt }
    });

    return new Response(JSON.stringify({ success: true, url, model: usedModel, quality }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = String((err as any)?.message || err);
    const normalized = /abort/i.test(msg) ? "Generation timed out. Please try again with a shorter prompt or try Fast quality." : msg;

    await logAI({
      functionName: "text2image",
      model: usedModel,
      inputText: promptText,
      durationMs: Date.now() - startTime,
      status: "error",
      errorMessage: normalized,
      metadata: { provider: "runware" }
    });

    return new Response(JSON.stringify({ success: false, error: normalized }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
