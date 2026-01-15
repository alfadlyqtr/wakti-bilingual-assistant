import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FREEPIK_API_KEY = Deno.env.get("FREEPIK_API_KEY") || "";
const FREEPIK_BASE_URL = "https://api.freepik.com/v1/ai/image-to-video/kling-v2";

// Poll interval and max attempts
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

interface CreateTaskResponse {
  data: {
    task_id: string;
    status: string;
  };
}

interface TaskStatusResponse {
  data: {
    task_id: string;
    status: string;
    generated?: string[]; // Video URLs are in this array!
    video?: {
      url: string;
    };
    error?: string;
  };
}

async function createVideoTask(
  imageUrl: string,
  prompt?: string,
  negativePrompt?: string
): Promise<{ task_id: string; status: string }> {
  const body: Record<string, unknown> = {
    image: imageUrl,
    duration: "5", // Always 5 seconds as per requirement
  };

  if (prompt) {
    body.prompt = prompt.slice(0, 2500); // Max 2500 chars
  }
  if (negativePrompt) {
    body.negative_prompt = negativePrompt.slice(0, 2500);
  }

  console.log("[freepik-image2video] Creating task with body:", JSON.stringify(body));

  const response = await fetch(FREEPIK_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-freepik-api-key": FREEPIK_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[freepik-image2video] Create task failed:", response.status, errorText);
    throw new Error(`Freepik API error: ${response.status} - ${errorText}`);
  }

  const result: CreateTaskResponse = await response.json();
  console.log("[freepik-image2video] Task created:", result.data);
  return result.data;
}

async function getTaskStatus(taskId: string): Promise<TaskStatusResponse["data"]> {
  const response = await fetch(`${FREEPIK_BASE_URL}/${taskId}`, {
    method: "GET",
    headers: {
      "x-freepik-api-key": FREEPIK_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[freepik-image2video] Get status failed:", response.status, errorText);
    throw new Error(`Freepik API error: ${response.status} - ${errorText}`);
  }

  const result: TaskStatusResponse = await response.json();
  return result.data;
}

async function pollUntilComplete(taskId: string): Promise<{ videoUrl: string } | { error: string }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    console.log(`[freepik-image2video] Poll attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS} for task ${taskId}`);
    
    const status = await getTaskStatus(taskId);
    console.log(`[freepik-image2video] Status: ${status.status}`);

    if (status.status === "COMPLETED" || status.status === "completed") {
      // Video URL is in generated array, NOT video.url!
      const videoUrl = status.generated?.[0] || status.video?.url;
      if (videoUrl) {
        console.log("[freepik-image2video] Video ready:", videoUrl);
        return { videoUrl };
      }
      console.error("[freepik-image2video] No video URL in response:", JSON.stringify(status));
      return { error: "Video completed but no URL returned" };
    }

    if (status.status === "FAILED" || status.status === "failed" || status.error) {
      console.error("[freepik-image2video] Task failed:", status.error);
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

    console.log("[freepik-image2video] User:", user.id);

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
      if (increment_usage && (status.status === "COMPLETED" || status.status === "completed")) {
        const { error: usageError } = await supabase.rpc("increment_ai_video_usage", {
          p_user_id: user.id,
        });
        if (usageError) {
          console.error("[freepik-image2video] Usage increment error (status):", usageError);
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
      console.error("[freepik-image2video] Quota check error:", quotaError);
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

    // Create the task
    const task = await createVideoTask(image, prompt, negative_prompt);

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
      console.error("[freepik-image2video] Usage increment error:", usageError);
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
    console.error("[freepik-image2video] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
