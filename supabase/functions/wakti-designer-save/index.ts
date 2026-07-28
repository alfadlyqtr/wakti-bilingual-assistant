// WAKTI DESIGNER SAVE
// Copies finished Designer renders into permanent storage and records them as one saved
// project. This has to happen server-side for two reasons:
//   1. The provider's render URLs are temporary, so the bytes must be re-hosted or the
//      Saved tab would fill up with dead images within hours.
//   2. Fetching those URLs from the browser is blocked by CORS, so only the server can
//      read them.
// It also accepts browser-side `data:` URLs, which is what makes a saved project REOPENABLE:
// the uploaded blueprint and a layout drawn on the canvas only ever exist in the browser, and
// without them a saved project is just a gallery of finished pictures with no source to edit.
// Deliberately self-contained (no ../_shared imports) so it can be deployed via the
// Supabase MCP tool, which does not bundle sibling folders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Public-read bucket, so the Saved tab can render plain <img> tags with no signing.
const BUCKET = "generated-images";
// ⛔ Was 6, which a floor plan project filled exactly (1 whole-home render + up to 5 room
// close-ups). Storing the blueprint alongside them needs a 7th slot, and silently dropping it
// would leave a project that looks saved but cannot be reopened.
const MAX_IMAGES = 8;
// Generous, but bounded: a blueprint arrives inline as base64 rather than as a link.
const MAX_INLINE_BYTES = 8 * 1024 * 1024;

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i;

type IncomingImage = { key: string; url: string };
type StoredImage = { key: string; url: string; storage_path: string };

/** Decodes a browser `data:` URL into raw bytes, or null if it is not one we can use. */
function decodeDataUrl(url: string): { bytes: Uint8Array; contentType: string } | null {
  const match = DATA_URL.exec(url);
  if (!match) return null;
  try {
    const binary = atob(match[2].replace(/\s/g, ""));
    if (!binary.length || binary.length > MAX_INLINE_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes, contentType: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Keeps storage paths predictable and safe regardless of what the client sends. */
function safeSlug(raw: string, fallback: string): string {
  const cleaned = String(raw || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
  return cleaned || fallback;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Server is not configured");

    const admin = createClient(supabaseUrl, serviceKey);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ success: false, error: "Not signed in" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ success: false, error: "Not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const rawImages: unknown = body?.images;
    const images: IncomingImage[] = (Array.isArray(rawImages) ? rawImages : [])
      .slice(0, MAX_IMAGES)
      .map((item, index) => ({
        key: safeSlug(String((item as IncomingImage)?.key || ""), `image${index + 1}`),
        url: String((item as IncomingImage)?.url || "").trim(),
      }))
      .filter((item) => /^https?:\/\//i.test(item.url) || DATA_URL.test(item.url));

    if (!images.length) return json({ success: false, error: "No images to save" }, 400);

    const projectId = crypto.randomUUID();
    const stored: StoredImage[] = [];

    for (const image of images) {
      let bytes: Uint8Array;
      let contentType: string;

      // A blueprint or a drawn canvas arrives inline, so there is nothing to go and fetch.
      const inline = decodeDataUrl(image.url);
      if (inline) {
        bytes = inline.bytes;
        contentType = inline.contentType;
      } else {
        const resp = await fetch(image.url);
        if (!resp.ok) {
          console.error(`[designer-save] could not fetch ${image.key}: ${resp.status}`);
          continue;
        }
        const header = (resp.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        contentType = header.startsWith("image/") ? header : "image/jpeg";
        bytes = new Uint8Array(await resp.arrayBuffer());
      }
      if (!bytes.length) continue;

      const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";

      // First folder MUST be the user id so the existing per-user storage policies apply.
      const path = `${userId}/designer/${projectId}/${image.key}.${extension}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) {
        console.error(`[designer-save] upload failed for ${image.key}:`, uploadError.message);
        continue;
      }

      const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);
      stored.push({ key: image.key, url: publicUrl.publicUrl, storage_path: path });
    }

    if (!stored.length) throw new Error("None of the images could be saved");

    const { data: project, error: insertError } = await admin
      .from("user_designer_projects")
      .insert({
        id: projectId,
        user_id: userId,
        title: String(body?.title || "Room design").slice(0, 120),
        mode: safeSlug(String(body?.mode || "redesign"), "redesign"),
        summary: body?.summary ? String(body.summary).slice(0, 500) : null,
        choices: body?.choices && typeof body.choices === "object" ? body.choices : {},
        images: stored,
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    return json({ success: true, project, savedCount: stored.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[designer-save] error:", message);
    return json({ success: false, error: message }, 500);
  }
});
