
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
    
    // Debug: Check if any messages have modeSwitchAction in metadata
    if (data && data.length > 0) {
      const messagesWithAction = data.filter(msg => msg.metadata && msg.metadata.modeSwitchAction);
      console.log(`Found ${messagesWithAction.length} messages with modeSwitchAction`);
      
      if (messagesWithAction.length > 0) {
        console.log("Example message with modeSwitchAction:", {
          id: messagesWithAction[0].id,
          role: messagesWithAction[0].role,
          modeSwitchAction: messagesWithAction[0].metadata.modeSwitchAction
        });
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
