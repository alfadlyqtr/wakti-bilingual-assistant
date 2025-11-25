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

    const { recordingPath } = await req.json();

    if (!recordingPath || !recordingPath.endsWith('.webm')) {
      return new Response(
        JSON.stringify({ error: "Invalid recording path. Must be a .webm file." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Converting webm to mp3: ${recordingPath}`);

    // Download the webm file from storage
    const { data: webmData, error: downloadError } = await supabase
      .storage
      .from('tasjeel_recordings')
      .download(recordingPath);

    if (downloadError || !webmData) {
      console.error("Error downloading webm file:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download webm file", details: downloadError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Downloaded webm file: ${webmData.size} bytes`);

    // Convert webm to mp3 using CloudConvert API
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
          "convert-to-mp3": {
            operation: "convert",
            input: "upload-webm",
            output_format: "mp3",
            audio_codec: "mp3",
            audio_bitrate: 128,
          },
          "export-mp3": {
            operation: "export/url",
            input: "convert-to-mp3",
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

    // Upload the webm file to CloudConvert
    const formData = new FormData();
    Object.entries(uploadTask.result.form.parameters).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
    formData.append("file", webmData, "recording.webm");

    const uploadResponse = await fetch(uploadTask.result.form.url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("CloudConvert upload failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to upload file to CloudConvert", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Uploaded to CloudConvert, waiting for conversion...");

    // Wait for the job to complete
    let jobStatus = jobData.data;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    while (jobStatus.status !== "finished" && jobStatus.status !== "error" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobData.data.id}`, {
        headers: {
          "Authorization": `Bearer ${CLOUDCONVERT_API_KEY}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        jobStatus = statusData.data;
      }
      
      attempts++;
    }

    if (jobStatus.status === "error") {
      console.error("CloudConvert job failed:", jobStatus);
      return new Response(
        JSON.stringify({ error: "Conversion job failed", details: jobStatus }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (jobStatus.status !== "finished") {
      return new Response(
        JSON.stringify({ error: "Conversion timeout" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the export task
    const exportTask = jobStatus.tasks.find((t: any) => t.name === "export-mp3");
    
    if (!exportTask || !exportTask.result?.files?.[0]?.url) {
      return new Response(
        JSON.stringify({ error: "Export task not found or no file URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the converted mp3
    const mp3Response = await fetch(exportTask.result.files[0].url);
    
    if (!mp3Response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download converted mp3" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mp3Blob = await mp3Response.blob();
    console.log(`✅ Downloaded converted mp3: ${mp3Blob.size} bytes`);

    // Upload mp3 to Supabase storage
    const mp3Path = recordingPath.replace('.webm', '.mp3');
    
    const { error: uploadError } = await supabase
      .storage
      .from('tasjeel_recordings')
      .upload(mp3Path, mp3Blob, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading mp3 to storage:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload mp3 to storage", details: uploadError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('tasjeel_recordings')
      .getPublicUrl(mp3Path);

    const mp3Url = publicUrlData.publicUrl;

    console.log(`✅ Conversion complete: ${mp3Url}`);

    return new Response(
      JSON.stringify({
        success: true,
        originalPath: recordingPath,
        mp3Path,
        mp3Url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Conversion error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
