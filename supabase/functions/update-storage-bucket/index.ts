
// Supabase Edge Function to update a storage bucket's configuration
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This function allows us to update bucket configuration which isn't exposed in the JavaScript client
const handler = async (req: Request): Promise<Response> => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the request body
    const { bucketId, isPublic, fileSizeLimit, allowedMimeTypes } = await req.json();
    
    // Validate required parameters
    if (!bucketId) {
      return new Response(JSON.stringify({ error: "Missing required parameter: bucketId" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Execute raw SQL to update the bucket configuration
    // This is necessary because the JavaScript client doesn't expose this functionality
    const { data, error } = await supabaseAdmin.rpc('admin_update_storage_bucket', {
      p_bucket_id: bucketId,
      p_public: isPublic !== undefined ? isPublic : false,
      p_file_size_limit: fileSizeLimit || null,
      p_allowed_mime_types: allowedMimeTypes || null
    });

    if (error) {
      console.error("Error updating bucket configuration:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error("Exception in update-storage-bucket function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);
