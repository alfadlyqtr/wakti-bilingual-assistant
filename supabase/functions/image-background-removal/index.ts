import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

async function safeJson(resp: Response): Promise<unknown> {
  const text = await resp.text();
  if (!text || text.trim().length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text };
  }
}

function ensureDataUri(img: unknown): unknown {
  if (!img || typeof img !== "string") return img;
  if (img.startsWith("http") || img.startsWith("data:")) return img;
  return `data:image/jpeg;base64,${img}`;
}

const IMAGE_URL_KEYS = ["imageURL", "URL", "url", "outputUrl", "outputURL"];
const IMAGE_DATAURI_KEYS = ["imageDataURI", "dataURI", "dataUrl", "data_uri"];

function findFirstImage(node: unknown): { url?: string; dataURI?: string } | null {
  const visited = new Set<object>();

  function dfs(obj: unknown): { url?: string; dataURI?: string } | null {
    if (!obj || typeof obj !== "object") return null;
    const asObj = obj as Record<string, unknown>;
    if (visited.has(asObj)) return null;
    visited.add(asObj);

    for (const k of IMAGE_URL_KEYS) {
      const v = asObj[k];
      if (typeof v === "string" && v) return { url: v };
    }
    for (const k of IMAGE_DATAURI_KEYS) {
      const v = asObj[k];
      if (typeof v === "string" && v) return { dataURI: v };
    }

    if (Array.isArray(obj)) {
      for (const it of obj) {
        const got = dfs(it);
        if (got) return got;
      }
    } else {
      for (const key in asObj) {
        const got = dfs(asObj[key]);
        if (got) return got;
      }
    }
    return null;
  }

  return dfs(node);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    if (!RUNWARE_API_KEY) {
      return new Response(JSON.stringify({ error: "Runware API key not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST, OPTIONS" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Support both single image (backwards compat) and multiple images
    const imagesToProcess: unknown[] = [];
    if (Array.isArray(body?.referenceImages)) {
      imagesToProcess.push(...(body.referenceImages as unknown[]));
    } else if (body?.image) {
      imagesToProcess.push(body.image);
    }

    const positivePrompt = typeof body?.positivePrompt === "string" && body.positivePrompt.trim()
      ? body.positivePrompt
      : typeof body?.text === "string" && body.text.trim()
        ? body.text
        : "";

    if (!positivePrompt || positivePrompt.trim().length === 0) {
      return new Response(JSON.stringify({
        error: "positivePrompt missing",
        hint: "provide 'positivePrompt' (or 'text')",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outputFormat = (typeof body?.outputFormat === "string" && body.outputFormat) || "PNG";
    const outputType = (Array.isArray(body?.outputType) && (body.outputType as unknown[]).length > 0)
      ? body.outputType
      : ["URL", "dataURI"];
    const outputQuality = typeof body?.outputQuality === "number" ? body.outputQuality : 90;

    // PROMPT-ONLY fallback: allow using this expensive model without an input image
    if (imagesToProcess.length === 0) {
      const payload = [
        { taskType: "authentication", apiKey: RUNWARE_API_KEY },
        {
          taskType: "imageInference",
          taskUUID: uuid(),
          model: "google:4@1",
          positivePrompt,
          numberResults: 1,
          outputType,
          outputFormat,
          includeCost: true,
          outputQuality,
        },
      ];

      const rwRes = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(rwRes);
      if (!rwRes.ok || !data) {
        return new Response(JSON.stringify({
          error: "Runware API error",
          status: rwRes.status,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const found = findFirstImage(data);
      if (!found?.url && !found?.dataURI) {
        return new Response(JSON.stringify({
          error: "No image returned from Runware",
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        provider: "runware",
        model: "google:4@1",
        imageUrl: found.url,
        imageDataURI: found.dataURI,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (imagesToProcess.length > 3) {
      return new Response(JSON.stringify({ error: "Too many images (max 3)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process all images (edit/enhance)
    const results: Array<{ index: number; imageUrl?: string; imageDataURI?: string }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < imagesToProcess.length; i++) {
      try {
        const inputImage = ensureDataUri(String(imagesToProcess[i] || "")) as string;

        if (!inputImage) {
          errors.push({ index: i, error: "Invalid image data" });
          continue;
        }

        const payload = [
          { taskType: "authentication", apiKey: RUNWARE_API_KEY },
          {
            taskType: "imageInference",
            taskUUID: uuid(),
            model: "google:4@1",
            positivePrompt,
            numberResults: 1,
            outputType,
            outputFormat,
            includeCost: true,
            referenceImages: [inputImage],
            outputQuality,
          },
        ];

        const rwRes = await fetch("https://api.runware.ai/v1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await safeJson(rwRes);
        if (!rwRes.ok || !data) {
          errors.push({ index: i, error: `Runware API error: ${rwRes.status}` });
          continue;
        }

        const found = findFirstImage(data);
        if (found?.url || found?.dataURI) {
          results.push({ index: i, imageUrl: found.url, imageDataURI: found.dataURI });
        } else {
          errors.push({ index: i, error: "No image returned from Runware" });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({ index: i, error: msg });
      }
    }

    // Return results
    if (results.length > 0) {
      // Backwards compatibility: if single image, return old format
      if (imagesToProcess.length === 1 && results.length === 1) {
        return new Response(JSON.stringify({
          provider: "runware",
          model: "google:4@1",
          imageUrl: results[0].imageUrl,
          imageDataURI: results[0].imageDataURI,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Multi-image: return array format
      return new Response(JSON.stringify({
        provider: "runware",
        model: "google:4@1",
        results: results.map((r) => ({ imageUrl: r.imageUrl, imageDataURI: r.imageDataURI })),
        errors: errors.length > 0 ? errors : undefined,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: "All images failed",
      errors,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      error: "Failed to process background edit",
      details: msg,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
