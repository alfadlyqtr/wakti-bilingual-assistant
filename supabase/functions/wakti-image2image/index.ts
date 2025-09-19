import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image_base64, user_prompt, user_id } = await req.json();

    if (!image_base64 || !user_prompt || !user_id) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalPrompt = `Apply the following transformation to the uploaded image:\n"${user_prompt}"\nKeep high fidelity to the original photo while applying the requested style.`;

    // Prepare input image as data URL for OpenAI SDK (works in Deno)
    const inputDataUrl = `data:image/png;base64,${image_base64}`;

    let imageB64: string | undefined;
    let modelUsed = "gpt-image-1";
    let qualityTried: string | undefined;

    // Some deployments may not accept non-standard quality values. Try low then fallback to standard.
    try {
      qualityTried = "low";
      const result = await openai.images.generate({
        model: modelUsed,
        prompt: finalPrompt,
        size: "1024x1024",
        quality: "low" as any,
        image: [ inputDataUrl ] as any,
      } as any);
      imageB64 = result.data?.[0]?.b64_json;
    } catch (_e) {
      // Fallback to standard quality if low is not supported
      qualityTried = "standard";
      const result = await openai.images.generate({
        model: modelUsed,
        prompt: finalPrompt,
        size: "1024x1024",
        quality: "standard" as any,
        image: [ inputDataUrl ] as any,
      } as any);
      imageB64 = result.data?.[0]?.b64_json;
    }

    if (!imageB64) {
      throw new Error("Failed to generate image");
    }

    const imageBytes = decodeBase64ToUint8Array(imageB64);

    const fileName = `image2image/${user_id}-${Date.now()}.png`;

    // Upload to storage (requires bucket to exist and be public or retrievable with getPublicUrl)
    const { error: uploadError } = await supabase.storage
      .from("wakti-images")
      .upload(fileName, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message || uploadError}`);
    }

    const { data: publicUrl } = supabase.storage
      .from("wakti-images")
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ success: true, url: publicUrl.publicUrl, model: modelUsed, quality: qualityTried }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const message = err?.message || "Internal error";
    const details = typeof err === 'object' ? (err?.toString?.() || null) : null;
    return new Response(
      JSON.stringify({ error: message, details }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
