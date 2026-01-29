import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// Provider: Fal.ai  |  Model: Kling 2.5 Turbo Pro (Image→Video)
// ============================================================
const FAL_KEY = Deno.env.get("FAL_KEY") || "";
const FAL_MODEL = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const FAL_SUBMIT_URL = `https://queue.fal.run/${FAL_MODEL}`;
// Status: GET https://queue.fal.run/fal-ai/kling-video/requests/{request_id}/status
// Result: GET https://queue.fal.run/fal-ai/kling-video/requests/{request_id}

// Poll interval and max attempts
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

interface FalSubmitResponse {
  request_id: string;
  status?: string;
}

interface FalStatusResponse {
  status: string; // IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED
  error?: string;
}

interface FalResultResponse {
  video?: {
    url: string;
  };
}

// Unified status shape expected by frontend
interface TaskStatusData {
  task_id: string;
  status: string;
  generated?: string[];
  video?: { url: string };
  error?: string;
}

type StorageBucketClient = {
  upload: (
    path: string,
    body: Blob,
    options: { contentType: string; cacheControl?: string; upsert?: boolean }
  ) => Promise<{ error?: { message?: string } | null }>;
  getPublicUrl: (path: string) => { data?: { publicUrl?: string } };
};

type StorageClient = {
  storage: {
    from: (bucket: string) => StorageBucketClient;
  };
};

function parseDataUriImage(dataUri: string): { contentType: string; bytes: Uint8Array } {
  const match = dataUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data URI");
  const contentType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes: Uint8Array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { contentType, bytes };
}

async function uploadImageDataUriToPublicUrl(
  supabase: StorageClient,
  userId: string,
  dataUri: string
): Promise<string> {
  const { contentType, bytes } = parseDataUriImage(dataUri);
  const ext = contentType.split("/")[1] || "png";
  const path = `${userId}/ai-video-input/${crypto.randomUUID()}.${ext}`;
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: contentType });

  const { error: uploadError } = await supabase.storage
    .from("message_attachments")
    .upload(path, blob, { contentType, cacheControl: "3600", upsert: true });

  if (uploadError) throw new Error(uploadError.message || "Failed to upload image");

  const { data } = supabase.storage.from("message_attachments").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Failed to get public URL");
  return data.publicUrl;
}

async function createVideoTask(
  imageUrl: string,
  prompt?: string,
  negativePrompt?: string
): Promise<{ task_id: string; status: string }> {
  const body: Record<string, unknown> = {
    image_url: imageUrl, // Fal uses image_url (accepts base64 data URI too)
    duration: "5",
  };

  if (prompt) {
    body.prompt = prompt.slice(0, 2500);
  }
  if (negativePrompt) {
    body.negative_prompt = negativePrompt.slice(0, 2500);
  } else {
    body.negative_prompt = "blur, distort, and low quality"; // Fal default
  }

  console.log("[fal-image2video] Creating task, model:", FAL_MODEL);

  const response = await fetch(FAL_SUBMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${FAL_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[fal-image2video] Create task failed:", response.status, errorText);
    throw new Error(`Fal API error: ${response.status} - ${errorText}`);
  }

  const result: FalSubmitResponse = await response.json();
  console.log("[fal-image2video] Task created, request_id:", result.request_id);
  return { task_id: result.request_id, status: result.status || "IN_QUEUE" };
}

async function getTaskStatus(taskId: string): Promise<TaskStatusData> {
  // First check status
  const statusUrl = `https://queue.fal.run/fal-ai/kling-video/requests/${encodeURIComponent(taskId)}/status`;
  console.log("[fal-image2video] Checking status for task:", taskId);
  console.log("[fal-image2video] Status URL:", statusUrl);
  console.log("[fal-image2video] FAL_KEY present:", !!FAL_KEY, "length:", FAL_KEY?.length || 0);

  const statusRes = await fetch(statusUrl, {
    method: "GET",
    headers: { "Authorization": `Key ${FAL_KEY}` },
  });

  if (!statusRes.ok) {
    const errorText = await statusRes.text();
    console.error("[fal-image2video] Get status failed:", statusRes.status, errorText);
    throw new Error(`Fal API error: ${statusRes.status} - ${errorText}`);
  }

  const statusData: FalStatusResponse = await statusRes.json();
  const normalizedStatus = statusData.status?.toUpperCase() || "IN_PROGRESS";

  // If completed, fetch result to get video URL
  if (normalizedStatus === "COMPLETED") {
    const resultUrl = `https://queue.fal.run/fal-ai/kling-video/requests/${taskId}`;
    const resultRes = await fetch(resultUrl, {
      method: "GET",
      headers: { "Authorization": `Key ${FAL_KEY}` },
    });

    if (!resultRes.ok) {
      const errorText = await resultRes.text();
      console.error("[fal-image2video] Get result failed:", resultRes.status, errorText);
      throw new Error(`Fal API error: ${resultRes.status} - ${errorText}`);
    }

    const resultData: FalResultResponse = await resultRes.json();
    const videoUrl = resultData.video?.url;

    return {
      task_id: taskId,
      status: "COMPLETED",
      generated: videoUrl ? [videoUrl] : undefined,
      video: videoUrl ? { url: videoUrl } : undefined,
    };
  }

  if (normalizedStatus === "FAILED") {
    return {
      task_id: taskId,
      status: "FAILED",
      error: statusData.error || "Video generation failed",
    };
  }

  // Still processing
  return {
    task_id: taskId,
    status: normalizedStatus, // IN_QUEUE or IN_PROGRESS
  };
}

async function pollUntilComplete(taskId: string): Promise<{ videoUrl: string } | { error: string }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    console.log(`[fal-image2video] Poll attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS} for task ${taskId}`);

    const status = await getTaskStatus(taskId);
    console.log(`[fal-image2video] Status: ${status.status}`);

    if (status.status === "COMPLETED") {
      const videoUrl = status.generated?.[0] || status.video?.url;
      if (videoUrl) {
        console.log("[fal-image2video] Video ready:", videoUrl);
        return { videoUrl };
      }
      console.error("[fal-image2video] No video URL in response:", JSON.stringify(status));
      return { error: "Video completed but no URL returned" };
    }

    if (status.status === "FAILED" || status.error) {
      console.error("[fal-image2video] Task failed:", status.error);
      return { error: status.error || "Video generation failed" };
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { error: "Timeout: Video generation took too long" };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[fal-image2video] User:", user.id);

    // Parse request body
    const body = await req.json();
    const { image, prompt, negative_prompt, mode } = body;

    // Mode: 'create' to start task, 'status' to check status
    if (mode === "status") {
      const { task_id, increment_usage } = body;
      if (!task_id) {
        return new Response(JSON.stringify({ error: "Missing task_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = await getTaskStatus(task_id);
      if (
        increment_usage &&
        (status.status === "COMPLETED" ||
          status.status === "completed" ||
          status.status === "SUCCEEDED" ||
          status.status === "succeeded")
      ) {
        const { error: usageError } = await supabase.rpc("increment_ai_video_usage", {
          p_user_id: user.id,
        });
        if (usageError) {
          console.error("[fal-image2video] Usage increment error (status):", usageError);
        }
      }

      return new Response(JSON.stringify({ ok: true, data: status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default mode: create and poll
    if (!image) {
      return new Response(JSON.stringify({ error: "Missing image (URL or base64)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check quota before proceeding
    const { data: quotaCheck, error: quotaError } = await supabase.rpc("can_generate_ai_video", {
      p_user_id: user.id,
    });

    if (quotaError) {
      console.error("[fal-image2video] Quota check error:", quotaError);
      return new Response(JSON.stringify({ error: "Failed to check quota" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quota = quotaCheck?.[0] || quotaCheck;
    if (!quota?.can_generate) {
      return new Response(
        JSON.stringify({
          error: "Monthly AI video limit reached",
          quota: {
            used: quota?.videos_generated || 0,
            limit: quota?.videos_limit || 10,
            extra: quota?.extra_videos || 0,
          },
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let imageForFal: string = image;
    if (typeof image === "string" && image.startsWith("data:image/")) {
      try {
        imageForFal = await uploadImageDataUriToPublicUrl(supabase, user.id, image);
        console.log("[fal-image2video] Uploaded data URI to public URL for Fal");
      } catch (e) {
        console.error("[fal-image2video] Failed to upload image for Fal:", e);
        return new Response(
          JSON.stringify({ error: e instanceof Error ? e.message : "Failed to prepare image" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create the task
    const task = await createVideoTask(imageForFal, prompt, negative_prompt);

    // If mode is 'async', return task_id immediately for frontend polling
    if (mode === "async") {
      return new Response(
        JSON.stringify({
          ok: true,
          task_id: task.task_id,
          status: task.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: poll until complete (synchronous)
    const result = await pollUntilComplete(task.task_id);

    if ("error" in result) {
      return new Response(JSON.stringify({ ok: false, error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment usage on success
    const { error: usageError } = await supabase.rpc("increment_ai_video_usage", {
      p_user_id: user.id,
    });

    if (usageError) {
      console.error("[fal-image2video] Usage increment error:", usageError);
      // Don't fail the request, video was generated
    }

    return new Response(
      JSON.stringify({
        ok: true,
        videoUrl: result.videoUrl,
        task_id: task.task_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fal-image2video] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
