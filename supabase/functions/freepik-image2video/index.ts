import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// Provider: KIE.ai  |  Models per generation type
// ============================================================
const KIE_API_KEY = Deno.env.get("KIE_API_KEY") || "";
const KIE_IMAGE2VIDEO_MODEL = "grok-imagine/image-to-video";
const KIE_TEXT2VIDEO_MODEL = "grok-imagine/text-to-video";
const KIE_2IMAGES_MODEL = "bytedance/seedance-1.5-pro";
const KIE_CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";

// Poll interval and max attempts
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 72; // 6 minutes max (KIE can take a bit longer)

// KIE.ai response types
interface KieCreateResponse {
  code: number;
  msg?: string;
  message?: string;
  data?: {
    taskId: string;
  };
}

interface KieStatusResponse {
  code: number;
  msg?: string;
  message?: string;
  data?: {
    taskId: string;
    model: string;
    state: string; // waiting, queuing, generating, success, fail
    param?: string;
    resultJson?: string; // JSON string: {"resultUrls":["https://..."]}
    failCode?: string;
    failMsg?: string;
    costTime?: number;
    completeTime?: number;
    createTime?: number;
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
  createSignedUrl: (
    path: string,
    expiresIn: number
  ) => Promise<{ data?: { signedUrl?: string } | null; error?: { message?: string } | null }>;
};

type StorageClient = {
  storage: {
    from: (bucket: string) => StorageBucketClient;
  };
};

function sanitizeImageUrl(url: string): string {
  let cleaned = url.trim();
  if (cleaned.startsWith("%20")) {
    cleaned = cleaned.replace(/^%20+/, "");
  }
  return cleaned.trim();
}

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

  const { data, error } = await supabase.storage
    .from("message_attachments")
    .createSignedUrl(path, 60 * 60 * 6);
  if (error) throw new Error(error.message || "Failed to create signed URL");
  if (!data?.signedUrl) throw new Error("Failed to get signed URL");
  return data.signedUrl;
}

async function createTextToVideoTask(
  prompt: string,
  duration?: string,
  aspectRatio?: string,
): Promise<{ task_id: string; status: string }> {
  const validDuration = ["6", "10", "15"].includes(duration || "") ? duration! : "6";
  const validResolution = validDuration === "15" ? "480p" : "720p";
  const validAspectRatio = ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"].includes(aspectRatio || "") ? aspectRatio! : "9:16";
  const input: Record<string, unknown> = {
    prompt: prompt.slice(0, 2500),
    aspect_ratio: validAspectRatio,
    duration: validDuration,
    resolution: validResolution,
  };

  const requestBody = {
    model: KIE_TEXT2VIDEO_MODEL,
    input,
  };

  console.log("[kie-text2video] Creating task, model:", KIE_TEXT2VIDEO_MODEL);

  const response = await fetch(KIE_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KIE_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[kie-text2video] Create task failed:", response.status, errorText);
    throw new Error(`KIE API error: ${response.status} - ${errorText}`);
  }

  const result: KieCreateResponse = await response.json();
  console.log("[kie-text2video] Create response:", JSON.stringify(result));

  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`KIE API error: ${result.msg || result.message || "Failed to create task"}`);
  }

  console.log("[kie-text2video] Task created, taskId:", result.data.taskId);
  return { task_id: result.data.taskId, status: "waiting" };
}

async function createVideoTask(
  imageUrls: string[],
  prompt?: string,
  duration?: string,
  aspectRatio?: string,
  fixedLens?: boolean,
  generateAudio?: boolean,
  resolution?: string,
): Promise<{ task_id: string; status: string }> {
  const sanitizedImageUrls = imageUrls.map(url => sanitizeImageUrl(url));
  const isTwoImages = sanitizedImageUrls.length === 2;
  // Seedance (2images): 4/8/12s, user-selected resolution
  // Grok Imagine (single image): 6/10/15s — 15s forces 480p, others use 720p
  const validDuration = isTwoImages
    ? (["4", "8", "12"].includes(duration || "") ? duration! : "8")
    : (["6", "10", "15"].includes(duration || "") ? duration! : "6");
  const validAspectRatio = ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"].includes(aspectRatio || "")
    ? aspectRatio!
    : "9:16";
  const validResolution = isTwoImages
    ? (["480p", "720p"].includes(resolution || "") ? resolution! : "480p")
    : (validDuration === "15" ? "480p" : "720p"); // 15s forces 480p for grok-imagine

  const model = isTwoImages ? KIE_2IMAGES_MODEL : KIE_IMAGE2VIDEO_MODEL;

  const input: Record<string, unknown> = isTwoImages
    ? {
        // Seedance API: uses input_urls, supports resolution/fixed_lens/generate_audio
        input_urls: sanitizedImageUrls,
        aspect_ratio: validAspectRatio,
        resolution: validResolution,
        duration: validDuration,
        fixed_lens: fixedLens || false,
        generate_audio: generateAudio || false,
      }
    : {
        // Grok Imagine API: uses image_urls, 720p hardcoded
        image_urls: sanitizedImageUrls,
        duration: validDuration,
        resolution: validResolution,
        mode: "normal",
      };

  if (prompt) {
    input.prompt = prompt.slice(0, 2500);
  }

  const requestBody = {
    model,
    input,
  };

  console.log("[kie-image2video] Creating task, model:", model);

  const response = await fetch(KIE_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KIE_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[kie-image2video] Create task failed:", response.status, errorText);
    throw new Error(`KIE API error: ${response.status} - ${errorText}`);
  }

  const result: KieCreateResponse = await response.json();
  console.log("[kie-image2video] Create response:", JSON.stringify(result));

  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`KIE API error: ${result.msg || result.message || "Failed to create task"}`);
  }

  console.log("[kie-image2video] Task created, taskId:", result.data.taskId);
  return { task_id: result.data.taskId, status: "waiting" };
}

// Map KIE state to frontend-expected status
function mapKieState(state: string): string {
  switch (state?.toLowerCase()) {
    case "success":
      return "COMPLETED";
    case "fail":
      return "FAILED";
    case "waiting":
    case "queuing":
      return "IN_QUEUE";
    case "generating":
      return "IN_PROGRESS";
    default:
      return "IN_PROGRESS";
  }
}

async function getTaskStatus(taskId: string): Promise<TaskStatusData> {
  const statusUrl = `${KIE_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`;
  console.log("[kie-image2video] Checking status for task:", taskId);

  const statusRes = await fetch(statusUrl, {
    method: "GET",
    headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
  });

  if (!statusRes.ok) {
    const errorText = await statusRes.text();
    console.error("[kie-image2video] Get status failed:", statusRes.status, errorText);
    throw new Error(`KIE API error: ${statusRes.status} - ${errorText}`);
  }

  const statusData: KieStatusResponse = await statusRes.json();
  console.log("[kie-image2video] Status response state:", statusData.data?.state);

  if (statusData.code !== 200 || !statusData.data) {
    throw new Error(`KIE API error: ${statusData.msg || statusData.message || "Failed to get status"}`);
  }

  const kieState = statusData.data.state?.toLowerCase() || "generating";
  const mappedStatus = mapKieState(kieState);

  // If completed, parse resultJson to get video URLs
  if (mappedStatus === "COMPLETED" && statusData.data.resultJson) {
    try {
      const resultData = JSON.parse(statusData.data.resultJson);
      const urls: string[] = resultData.resultUrls || [];
      const videoUrl = urls[0];

      if (videoUrl) {
        return {
          task_id: taskId,
          status: "COMPLETED",
          generated: [videoUrl],
          video: { url: videoUrl },
        };
      }
    } catch (e) {
      console.error("[kie-image2video] Failed to parse resultJson:", e, statusData.data.resultJson);
    }

    // Completed but no URL found
    return {
      task_id: taskId,
      status: "COMPLETED",
      error: "Video completed but no URL returned",
    };
  }

  if (mappedStatus === "FAILED") {
    return {
      task_id: taskId,
      status: "FAILED",
      error: statusData.data.failMsg || "Video generation failed",
    };
  }

  // Still processing
  return {
    task_id: taskId,
    status: mappedStatus,
  };
}

async function pollUntilComplete(taskId: string): Promise<{ videoUrl: string } | { error: string }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    console.log(`[kie-image2video] Poll attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS} for task ${taskId}`);

    const status = await getTaskStatus(taskId);
    console.log(`[kie-image2video] Status: ${status.status}`);

    if (status.status === "COMPLETED") {
      const videoUrl = status.generated?.[0] || status.video?.url;
      if (videoUrl) {
        console.log("[kie-image2video] Video ready:", videoUrl);
        return { videoUrl };
      }
      console.error("[kie-image2video] No video URL in response:", JSON.stringify(status));
      return { error: status.error || "Video completed but no URL returned" };
    }

    if (status.status === "FAILED" || status.error) {
      console.error("[kie-image2video] Task failed:", status.error);
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

  const startTime = Date.now();

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

    console.log("[kie-image2video] User:", user.id);

    // Parse request body
    const body = await req.json();
    const { image, image1, image2, prompt, mode, duration: reqDuration, aspect_ratio, fixed_lens, generate_audio, generation_type, resolution } = body;

    // Mode: 'status' to check task status
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
          console.error("[kie-image2video] Usage increment error (status):", usageError);
        }
      }

      return new Response(JSON.stringify({ ok: true, data: status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse generation type
    const generationType = generation_type || "image_to_video";

    // Validation based on generation type
    if (generationType === "image_to_video" && !image) {
      return new Response(JSON.stringify({ error: "Missing image (URL or base64)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (generationType === "2images_to_video" && (!image1 || !image2)) {
      return new Response(JSON.stringify({ error: "Missing images for 2images_to_video (need both image1 and image2)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (generationType === "text_to_video" && (!prompt || !prompt.trim())) {
      return new Response(JSON.stringify({ error: "Missing prompt for text-to-video" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check quota before proceeding
    const { data: quotaCheck, error: quotaError } = await supabase.rpc("can_generate_ai_video", {
      p_user_id: user.id,
    });

    if (quotaError) {
      console.error("[kie-image2video] Quota check error:", quotaError);
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

    let task: { task_id: string; status: string };

    if (generationType === "text_to_video") {
      // Text-to-Video: no image needed
      task = await createTextToVideoTask(prompt, reqDuration, aspect_ratio);
    } else if (generationType === "2images_to_video") {
      // 2Images-to-Video: requires both image1 and image2
      let imageUrl1: string = image1;
      let imageUrl2: string = image2;
      
      // Handle data URIs for first image
      if (typeof image1 === "string" && image1.startsWith("data:image/")) {
        try {
          imageUrl1 = await uploadImageDataUriToPublicUrl(supabase, user.id, image1);
          console.log("[kie-2images2video] Uploaded first image data URI to public URL");
        } catch (e) {
          console.error("[kie-2images2video] Failed to upload first image:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Failed to prepare first image" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Handle data URIs for second image
      if (typeof image2 === "string" && image2.startsWith("data:image/")) {
        try {
          imageUrl2 = await uploadImageDataUriToPublicUrl(supabase, user.id, image2);
          console.log("[kie-2images2video] Uploaded second image data URI to public URL");
        } catch (e) {
          console.error("[kie-2images2video] Failed to upload second image:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Failed to prepare second image" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      task = await createVideoTask([imageUrl1, imageUrl2], prompt, reqDuration, aspect_ratio, fixed_lens, generate_audio, resolution);
    } else {
      // Image-to-Video: requires single image
      let imageUrl: string = image;
      if (typeof image === "string" && image.startsWith("data:image/")) {
        try {
          imageUrl = await uploadImageDataUriToPublicUrl(supabase, user.id, image);
          console.log("[kie-image2video] Uploaded data URI to public URL for KIE");
        } catch (e) {
          console.error("[kie-image2video] Failed to upload image:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Failed to prepare image" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      task = await createVideoTask([imageUrl], prompt, reqDuration, aspect_ratio, fixed_lens, generate_audio, resolution);
    }

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
      console.error("[kie-image2video] Usage increment error:", usageError);
      // Don't fail the request, video was generated
    }

    // Log AI usage
    await logAIFromRequest(req, {
      functionName: "freepik-image2video",
      provider: "kie.ai",
      model: generationType === "text_to_video" ? KIE_TEXT2VIDEO_MODEL : generationType === "2images_to_video" ? KIE_2IMAGES_MODEL : KIE_IMAGE2VIDEO_MODEL,
      inputText: prompt || image,
      outputText: result.videoUrl,
      durationMs: Date.now() - startTime,
      status: "success",
      metadata: { generation_type: generationType, task_id: task.task_id }
    });

    return new Response(
      JSON.stringify({
        ok: true,
        videoUrl: result.videoUrl,
        task_id: task.task_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[kie-image2video] Error:", error);
    
    // Log AI usage for error
    await logAIFromRequest(req, {
      functionName: "freepik-image2video",
      provider: "kie.ai",
      model: "kie-video",
      inputText: "",
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
