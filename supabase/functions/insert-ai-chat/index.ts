
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("Insert AI chat message request received");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );
    
    // Get the user from the request
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // Get request body
    const requestBody = await req.json();
    const { userId, content, role, mode, metadata, hasMedia, expiresAt } = requestBody;
    
    console.log("Insert params:", { 
      userId, 
      role, 
      mode, 
      hasMedia, 
      hasMetadata: !!metadata,
      metadataKeys: metadata ? Object.keys(metadata) : []
    });
    
    // Debug check for modeSwitchAction in metadata
    if (metadata && metadata.modeSwitchAction) {
      console.log("Found modeSwitchAction in metadata to be inserted:", 
        JSON.stringify(metadata.modeSwitchAction));
    }
    
    // Ensure user is authorized
    if (user?.id !== userId) {
      console.error("Unauthorized: token user ID doesn't match request user ID");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Insert chat message
    const { data, error } = await supabaseClient
      .from('ai_chat_history')
      .insert({
        user_id: userId,
        content,
        role,
        mode,
        metadata,
        has_media: hasMedia,
        expires_at: expiresAt
      })
      .select('id')
      .single();
    
    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Message inserted successfully, id:", data.id);
    
    // Verify the message was inserted with metadata
    if (metadata && metadata.modeSwitchAction) {
      const { data: verifyData, error: verifyError } = await supabaseClient
        .from('ai_chat_history')
        .select('id, metadata')
        .eq('id', data.id)
        .single();
        
      if (verifyError) {
        console.error("Error verifying inserted metadata:", verifyError);
      } else {
        console.log("Verified inserted metadata:", JSON.stringify(verifyData.metadata));
        console.log("modeSwitchAction present in DB:", !!verifyData?.metadata?.modeSwitchAction);
      }
    }
    
    return new Response(
      JSON.stringify(data?.id),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in insert-ai-chat function:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
