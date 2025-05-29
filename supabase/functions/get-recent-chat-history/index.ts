
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
    console.log("Get recent chat history request received");
    
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
    const { userId, mode, limit = 20 } = await req.json();
    
    console.log("Fetch params:", { userId, mode, limit });
    
    // Ensure user is authorized
    if (user?.id !== userId) {
      console.error("Unauthorized: token user ID doesn't match request user ID");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    let query = supabaseClient
      .from('ai_chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Add mode filter if provided
    if (mode) {
      query = query.eq('mode', mode);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Retrieved ${data?.length || 0} chat messages`);
    
    // Detailed check for modeSwitchAction in metadata
    if (data && data.length > 0) {
      const messagesWithAction = data.filter(msg => msg.metadata && msg.metadata.modeSwitchAction);
      console.log(`Found ${messagesWithAction.length} messages with modeSwitchAction`);
      
      // Enhanced logging for messages with modeSwitchAction
      if (messagesWithAction.length > 0) {
        messagesWithAction.forEach(msg => {
          console.log("Message with modeSwitchAction:", {
            id: msg.id,
            role: msg.role,
            modeSwitchAction: msg.metadata.modeSwitchAction,
            targetMode: msg.metadata.modeSwitchAction.targetMode
          });
        });
      }
      
      // Log messages without modeSwitchAction but with metadata
      const messagesWithMetadataNoAction = data.filter(msg => msg.metadata && !msg.metadata.modeSwitchAction);
      if (messagesWithMetadataNoAction.length > 0) {
        console.log(`Found ${messagesWithMetadataNoAction.length} messages with metadata but no modeSwitchAction`);
        console.log("Sample metadata keys:", Object.keys(messagesWithMetadataNoAction[0].metadata));
      }
    }
    
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-recent-chat-history function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
