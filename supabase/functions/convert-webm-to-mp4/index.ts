import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept either a storage path or direct blob upload
    const contentType = req.headers.get("content-type") || "";
    
    let webmData: Blob;
    let outputPath: string;
    
    if (contentType.includes("application/json")) {
      // JSON request with storage path
      const { storagePath, bucket = "videos" } = await req.json();
      
      if (!storagePath) {
        return new Response(
          JSON.stringify({ error: "storagePath is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`🔄 Converting webm to mp4: ${storagePath}`);

      const { data, error: downloadError } = await supabase
        .storage
        .from(bucket)
        .download(storagePath);

      if (downloadError || !data) {
        console.error("Error downloading webm file:", downloadError);
        return new Response(
          JSON.stringify({ error: "Failed to download webm file", details: downloadError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      webmData = data;
      outputPath = storagePath.replace(/\.webm$/i, '.mp4');
    } else {
      // Direct blob upload
      webmData = await req.blob();
      outputPath = `converted/${crypto.randomUUID()}.mp4`;
    }

    console.log(`✅ Got webm data: ${webmData.size} bytes`);

    // Convert webm to mp4 using CloudConvert API
    const CLOUDCONVERT_API_KEY = Deno.env.get("CLOUDCONVERT_API_KEY");
    
    if (!CLOUDCONVERT_API_KEY) {
      return new Response(
        JSON.stringify({ error: "CloudConvert API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a job
    const jobResponse = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDCONVERT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tasks: {
          "upload-webm": {
            operation: "import/upload",
          },
          "convert-to-mp4": {
            operation: "convert",
            input: "upload-webm",
            output_format: "mp4",
            video_codec: "x264",
            audio_codec: "aac",
            audio_bitrate: 128,
            crf: 23,
          },
          "export-mp4": {
            operation: "export/url",
            input: "convert-to-mp4",
          },
        },
      }),
    });

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();
      console.error("CloudConvert job creation failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create conversion job", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobData = await jobResponse.json();
    const uploadTask = jobData.data.tasks.find((t: any) => t.name === "upload-webm");

    if (!uploadTask || !uploadTask.result?.form) {
      return new Response(
        JSON.stringify({ error: "Upload task not found in job response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload the webm file
    const formData = new FormData();
    for (const [key, value] of Object.entries(uploadTask.result.form.parameters)) {
      formData.append(key, value as string);
    }
    formData.append("file", webmData, "input.webm");

    const uploadResponse = await fetch(uploadTask.result.form.url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("File upload failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to upload file for conversion", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ File uploaded, waiting for conversion...");

    // Poll for job completion
    const jobId = jobData.data.id;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    let exportUrl: string | null = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${CLOUDCONVERT_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      const status = statusData.data.status;

      if (status === "finished") {
        const exportTask = statusData.data.tasks.find((t: any) => t.name === "export-mp4");
        if (exportTask?.result?.files?.[0]?.url) {
          exportUrl = exportTask.result.files[0].url;
          break;
        }
      } else if (status === "error") {
        console.error("Conversion failed:", statusData);
        return new Response(
          JSON.stringify({ error: "Conversion failed", details: statusData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      attempts++;
    }

    if (!exportUrl) {
      return new Response(
        JSON.stringify({ error: "Conversion timed out" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Conversion complete, downloading MP4...");

    // Download the converted MP4
    const mp4Response = await fetch(exportUrl);
    if (!mp4Response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download converted file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mp4Data = await mp4Response.arrayBuffer();
    console.log(`✅ Downloaded MP4: ${mp4Data.byteLength} bytes`);

    // Upload to Supabase storage
    const { error: uploadError } = await supabase
      .storage
      .from("videos")
      .upload(outputPath, mp4Data, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading MP4:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload converted file", details: uploadError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signed URL for the converted file
    const { data: signedUrlData } = await supabase
      .storage
      .from("videos")
      .createSignedUrl(outputPath, 3600);

    console.log(`✅ Conversion complete: ${outputPath}`);

    return new Response(
      JSON.stringify({
        success: true,
        storagePath: outputPath,
        signedUrl: signedUrlData?.signedUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Conversion error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
