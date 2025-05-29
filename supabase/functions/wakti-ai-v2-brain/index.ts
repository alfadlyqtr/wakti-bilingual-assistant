
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

console.log("🔍 WAKTI AI V2.1 Enhanced: Processing request with Tavily search and database integration");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 WAKTI AI V2.1: Starting request processing");

    // Get request body with better error handling
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log("🔍 WAKTI AI V2.1: Raw body received, length:", bodyText?.length || 0);
      
      if (!bodyText || bodyText.trim() === '') {
        console.error("🔍 WAKTI AI V2.1: Empty request body received");
        return new Response(JSON.stringify({ 
          error: "Empty request body - please ensure message is provided",
          success: false
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      requestBody = JSON.parse(bodyText);
      console.log("🔍 WAKTI AI V2.1: Successfully parsed request body");
    } catch (parseError) {
      console.error("🔍 WAKTI AI V2.1: JSON parsing failed:", parseError.message);
      return new Response(JSON.stringify({ 
        error: "Invalid JSON format in request",
        details: parseError.message,
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extract fields with defaults
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      conversationHistory = [],
      confirmSearch = false
    } = requestBody;

    console.log("🔍 WAKTI AI V2.1: Extracted fields:", {
      hasMessage: !!message,
      hasUserId: !!userId,
      language,
      inputType
    });

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🔍 WAKTI AI V2.1: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("🔍 WAKTI AI V2.1: Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🔍 WAKTI AI V2.1: Processing message for user:", userId);

    // Simple AI response for now to test the connection
    const response = language === 'ar' 
      ? `مرحباً! تلقيت رسالتك: "${message}". النظام يعمل بشكل طبيعي الآن! 🎉`
      : `Hello! I received your message: "${message}". The system is working normally now! 🎉`;

    // Handle conversation storage
    let finalConversationId = conversationId;
    if (!conversationId) {
      try {
        const { data: newConv, error: convError } = await supabase
          .from('ai_conversations')
          .insert({
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            user_id: userId
          })
          .select()
          .single();
        
        if (!convError && newConv) {
          finalConversationId = newConv.id;
        }
      } catch (convErr) {
        console.log("🔍 WAKTI AI V2.1: Conversation creation failed, continuing without storage");
      }
    }

    // Store chat history
    if (finalConversationId) {
      try {
        // Store user message
        await supabase.from('ai_chat_history').insert({
          conversation_id: finalConversationId,
          user_id: userId,
          role: 'user',
          content: message,
          input_type: inputType
        });

        // Store AI response
        await supabase.from('ai_chat_history').insert({
          conversation_id: finalConversationId,
          user_id: userId,
          role: 'assistant',
          content: response,
          intent: 'test_response',
          confidence_level: 'high'
        });

        // Update conversation timestamp
        await supabase
          .from('ai_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', finalConversationId);
      } catch (historyErr) {
        console.log("🔍 WAKTI AI V2.1: History storage failed, continuing");
      }
    }

    console.log("🔍 WAKTI AI V2.1: Successfully processed request");

    // Return successful response
    return new Response(JSON.stringify({
      response,
      conversationId: finalConversationId,
      intent: 'test_response',
      confidence: 'high',
      needsConfirmation: false,
      needsClarification: false,
      success: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("🔍 WAKTI AI V2.1: Unexpected error:", error);
    
    // Return error response with proper CORS headers
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
