import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function logAIFromRequest(_req: Request, params: { functionName: string; provider: string; model: string; status: "success" | "error"; errorMessage?: string; metadata?: Record<string, unknown> }) {
  try {
    console.log("[music-generate] log", params);
  } catch {
    // no-op
  }
}

function parseBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=("?)([^;\"]+)\1/i);
  return match?.[2] ?? null;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, start = 0): number {
  for (let i = start; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function trimCrlf(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d)) {
    end -= 1;
  }
  return bytes.slice(0, end);
}

function parseMultipart(contentType: string, body: Uint8Array) {
  const boundary = parseBoundary(contentType);
  if (!boundary) {
    throw new Error("Missing multipart boundary");
  }

  const boundaryBytes = new TextEncoder().encode(`--${boundary}`);
  const headerSep = new TextEncoder().encode("\r\n\r\n");

  const parts: Uint8Array[] = [];
  let cursor = indexOfBytes(body, boundaryBytes, 0);
  while (cursor !== -1) {
    const next = indexOfBytes(body, boundaryBytes, cursor + boundaryBytes.length);
    if (next === -1) break;
    const start = cursor + boundaryBytes.length;
    const chunk = body.slice(start, next);
    parts.push(chunk);
    cursor = next;
  }

  let jsonPart: Record<string, unknown> | null = null;
  let audioPart: Uint8Array | null = null;
  let audioMime: string | null = null;

  for (const rawPart of parts) {
    const part = trimCrlf(rawPart);
    if (part.length === 0) continue;
    const headerIdx = indexOfBytes(part, headerSep, 0);
    if (headerIdx === -1) continue;
    const headerBytes = part.slice(0, headerIdx);
    const bodyBytes = trimCrlf(part.slice(headerIdx + headerSep.length));
    const headerText = new TextDecoder().decode(headerBytes);
    const contentTypeLine = headerText
      .split(/\r?\n/)
      .find((line) => line.toLowerCase().startsWith("content-type"));
    const partContentType = contentTypeLine?.split(":")[1]?.trim()?.toLowerCase() || "";

    if (partContentType.includes("application/json")) {
      const text = new TextDecoder().decode(bodyBytes);
      jsonPart = JSON.parse(text) as Record<string, unknown>;
    } else if (
      partContentType.includes("audio") ||
      partContentType.includes("application/octet-stream")
    ) {
      audioPart = bodyBytes;
      audioMime = partContentType || "audio/mpeg";
    }
  }

  return { jsonPart, audioPart, audioMime };
}

function normalizeLengthMs(value?: number | null): number | null {
  if (!value) return null;
  const clamped = Math.min(600_000, Math.max(3_000, Math.round(value)));
  return clamped;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Authentication failed");
    }

    if (req.method !== "POST") {
      throw new Error("Method not allowed");
    }

    const body = await req.json();
    const prompt = (body?.prompt || "").toString().trim();
    const outputFormat = (body?.output_format || "mp3_44100_128").toString();
    const modelId = (body?.model_id || "music_v1").toString();
    const forceInstrumental = Boolean(body?.force_instrumental);
    const lengthMs = normalizeLengthMs(body?.music_length_ms || (body?.duration_seconds ? body.duration_seconds * 1000 : null));

    if (!prompt) {
      throw new Error("Missing prompt");
    }

    const query = new URLSearchParams({ output_format: outputFormat });
    const apiResp = await fetch(`https://api.elevenlabs.io/v1/music/detailed?${query.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        prompt,
        ...(lengthMs ? { music_length_ms: lengthMs } : {}),
        model_id: modelId,
        force_instrumental: forceInstrumental,
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      throw new Error(`ElevenLabs error: ${apiResp.status} ${errText}`);
    }

    const contentType = apiResp.headers.get("content-type") || "";
    const buffer = new Uint8Array(await apiResp.arrayBuffer());

    let audioBytes: Uint8Array | null = null;
    let audioMime: string | null = null;
    let jsonMeta: Record<string, unknown> | null = null;

    if (contentType.toLowerCase().includes("multipart/")) {
      const parsed = parseMultipart(contentType, buffer);
      audioBytes = parsed.audioPart;
      audioMime = parsed.audioMime;
      jsonMeta = parsed.jsonPart;
    } else if (contentType.toLowerCase().includes("application/json")) {
      const text = new TextDecoder().decode(buffer);
      jsonMeta = JSON.parse(text) as Record<string, unknown>;
    } else {
      audioBytes = buffer;
      audioMime = contentType || "audio/mpeg";
    }

    if (!audioBytes) {
      throw new Error("No audio returned from ElevenLabs");
    }

    const ext = outputFormat.startsWith("wav") || audioMime?.includes("wav")
      ? "wav"
      : outputFormat.startsWith("ogg") || audioMime?.includes("ogg")
        ? "ogg"
        : "mp3";

    const fileName = `${user.id}/${Date.now()}.${ext}`;
    const audioArray = new Uint8Array(audioBytes);
    const uploadBlob = new Blob([audioArray.buffer], { type: audioMime || "audio/mpeg" });
    const upload = await supabaseService.storage.from("music").upload(fileName, uploadBlob, {
      contentType: audioMime || "audio/mpeg",
      upsert: false,
    });

    if (upload.error) throw upload.error;

    const { data: urlData } = supabaseService.storage.from("music").getPublicUrl(fileName);

    await logAIFromRequest(req, {
      functionName: "music-generate",
      provider: "elevenlabs",
      model: modelId,
      status: "success",
      metadata: {
        outputFormat,
        durationMs: lengthMs,
        hasCompositionPlan: Boolean(jsonMeta?.composition_plan),
      },
    });

    return new Response(JSON.stringify({
      publicUrl: urlData.publicUrl,
      storagePath: fileName,
      mime: audioMime || "audio/mpeg",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    await logAIFromRequest(req, {
      functionName: "music-generate",
      provider: "elevenlabs",
      model: "music_v1",
      status: "error",
      errorMessage: (error as Error).message,
    });

    return new Response(JSON.stringify({
      error: (error as Error).message || "Music generation failed",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
