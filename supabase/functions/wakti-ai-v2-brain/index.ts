
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-auth-token, x-skip-auth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get API keys from environment
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

console.log("🚀 WAKTI AI EMERGENCY DEBUG: Edge Function Starting");
console.log("🔑 API KEYS CHECK:", {
  hasAnthropic: !!ANTHROPIC_API_KEY,
  anthropicLength: ANTHROPIC_API_KEY?.length || 0
});

serve(async (req) => {
  console.log("📨 REQUEST RECEIVED:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("✅ CORS PREFLIGHT: Handled successfully");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 STEP 1: Starting request processing");

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("✅ STEP 2: Request body parsed successfully:", {
        hasMessage: !!requestBody.message,
        messageLength: requestBody.message?.length || 0,
        userId: requestBody.userId?.substring(0, 8) + '...',
        language: requestBody.language
      });
    } catch (parseError) {
      console.error("❌ STEP 2 FAILED: JSON parsing error:", parseError);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body",
        success: false,
        debug: "Request body parsing failed"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      activeTrigger = 'chat',
      attachedFiles = [],
      maxTokens = 4096,
      enableStreaming = false
    } = requestBody;

    console.log("✅ STEP 3: Request parameters extracted:", {
      trigger: activeTrigger,
      hasFiles: attachedFiles.length > 0,
      streaming: enableStreaming
    });

    // Validate required parameters
    if (!message?.trim()) {
      console.error("❌ STEP 4 FAILED: No message provided");
      return new Response(JSON.stringify({
        error: "Message is required",
        success: false,
        debug: "Empty or missing message parameter"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("❌ STEP 4 FAILED: No userId provided");
      return new Response(JSON.stringify({
        error: "User ID is required",
        success: false,
        debug: "Missing userId parameter"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("✅ STEP 4: Required parameters validated");

    // Check API key
    if (!ANTHROPIC_API_KEY) {
      console.error("❌ STEP 5 FAILED: Anthropic API key not configured");
      return new Response(JSON.stringify({
        error: "AI service not configured",
        success: false,
        debug: "Missing ANTHROPIC_API_KEY environment variable"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("✅ STEP 5: API key validated");

    // Prepare Claude 4 API request
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });

    const systemPrompt = `You are WAKTI AI, a helpful AI assistant powered by Claude 4 Sonnet. Current date: ${currentDate}. Respond in ${language === 'ar' ? 'Arabic' : 'English'}.`;

    const messages = [
      {
        role: "user",
        content: message
      }
    ];

    console.log("✅ STEP 6: Claude 4 request prepared");

    // Call Claude 4 API
    let claudeResponse;
    try {
      console.log("🔗 STEP 7: Calling Claude 4 API...");
      
      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messages
        }),
      });

      console.log("📡 STEP 8: Claude 4 API response received:", {
        status: apiResponse.status,
        ok: apiResponse.ok
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("❌ STEP 8 FAILED: Claude 4 API error:", {
          status: apiResponse.status,
          error: errorText
        });
        throw new Error(`Claude 4 API error (${apiResponse.status}): ${errorText}`);
      }

      claudeResponse = await apiResponse.json();
      console.log("✅ STEP 8: Claude 4 response parsed successfully:", {
        hasContent: !!claudeResponse.content?.[0]?.text,
        contentLength: claudeResponse.content?.[0]?.text?.length || 0
      });

    } catch (apiError) {
      console.error("❌ STEP 7-8 FAILED: Claude 4 API call failed:", apiError);
      return new Response(JSON.stringify({
        error: "AI service temporarily unavailable",
        success: false,
        debug: `Claude 4 API error: ${apiError.message}`
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extract response
    const aiResponse = claudeResponse.content?.[0]?.text || "Sorry, I couldn't generate a response.";
    console.log("✅ STEP 9: AI response extracted");

    // Generate conversation ID if needed
    const finalConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log("✅ STEP 10: Conversation ID prepared:", finalConversationId.substring(0, 15) + '...');

    // Prepare final response
    const finalResponse = {
      response: aiResponse,
      conversationId: finalConversationId,
      intent: 'wakti_ai_emergency_debug',
      confidence: 'high',
      actionTaken: null,
      imageUrl: null,
      browsingUsed: false,
      browsingData: null,
      needsConfirmation: false,
      pendingTaskData: null,
      pendingReminderData: null,
      success: true,
      processingTime: Date.now(),
      speedOptimized: true,
      aiProvider: 'claude-3-5-sonnet-emergency',
      claude4Upgrade: true,
      debugMode: true,
      emergencyFix: true
    };

    console.log("✅ STEP 11: Final response prepared successfully");
    console.log("🎉 EMERGENCY DEBUG: Request completed successfully!");

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚨 EMERGENCY DEBUG: Critical error occurred:", {
      message: error.message,
      stack: error.stack?.substring(0, 1000),
      name: error.name
    });

    // Always return a valid JSON response, even on error
    const errorResponse = {
      error: "Internal server error",
      success: false,
      debug: `Emergency debug error: ${error.message}`,
      emergencyMode: true,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
