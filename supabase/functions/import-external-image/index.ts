import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { projectId, sourceUrl, filenameHint } = await req.json();

    if (!projectId || !sourceUrl) {
      return new Response(JSON.stringify({ error: 'Missing projectId or sourceUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Importing image for project ${projectId} from ${sourceUrl}`);

    // Fetch the external image
    let imageResponse: Response;
    try {
      imageResponse = await fetch(sourceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WaktiBot/1.0)',
        },
      });
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
    } catch (fetchErr) {
      console.error('Fetch error:', fetchErr);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch image from source',
        fallbackUrl: sourceUrl // Return original URL as fallback
      }), {
        status: 200, // Still 200 so client can use fallback
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageBlob = await imageResponse.blob();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Determine file extension
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';
    else if (contentType.includes('svg')) ext = 'svg';

    // Generate unique filename
    const timestamp = Date.now();
    const uuid = crypto.randomUUID().slice(0, 8);
    const safeHint = filenameHint?.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 30) || 'imported';
    const filename = `${safeHint}-${uuid}.${ext}`;
    const storagePath = `${user.id}/${projectId}/imported/${timestamp}-${filename}`;

    console.log(`Uploading to storage path: ${storagePath}`);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('project-uploads')
      .upload(storagePath, imageBlob, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ 
        error: 'Failed to upload to storage',
        fallbackUrl: sourceUrl
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('project-uploads')
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;

    // Record in database
    const { error: dbError } = await supabase
      .from('project_uploads')
      .insert({
        project_id: projectId,
        user_id: user.id,
        filename: filename,
        storage_path: storagePath,
        file_type: contentType,
        size_bytes: imageBlob.size,
      });

    if (dbError) {
      console.error('DB error:', dbError);
      // Still return success with URL since upload worked
    }

    console.log(`Successfully imported image: ${publicUrl}`);

    return new Response(JSON.stringify({
      success: true,
      url: publicUrl,
      storagePath,
      filename,
      originalUrl: sourceUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
