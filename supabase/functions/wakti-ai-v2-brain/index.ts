
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get API keys from environment
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

console.log("🚀 WAKTI AI CLAUDE 4: Edge Function Starting");

serve(async (req) => {
  console.log("📨 REQUEST RECEIVED:", req.method);

  try {
    // Parse request body with proper error handling
    let requestBody;
    try {
      const rawBody = await req.text();
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      requestBody = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("❌ JSON parsing error:", parseError);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body",
        success: false
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
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
      maxTokens = 4096
    } = requestBody;

    // Validate required parameters
    if (!message?.trim()) {
      return new Response(JSON.stringify({
        error: "Message is required",
        success: false
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check API key
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        error: "AI service not configured",
        success: false
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

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

    console.log("🔗 Calling Claude 4 API...");
    
    // Call Claude 4 API with proper error handling
    let claudeResponse;
    try {
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

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("❌ Claude 4 API error:", apiResponse.status, errorText);
        throw new Error(`Claude 4 API error (${apiResponse.status}): ${errorText}`);
      }

      // Safe JSON parsing for Claude response
      const responseText = await apiResponse.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from Claude 4 API');
      }

      try {
        claudeResponse = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("❌ Claude 4 JSON parsing error:", jsonError);
        throw new Error('Invalid JSON response from Claude 4 API');
      }

    } catch (apiError) {
      console.error("❌ Claude 4 API call failed:", apiError);
      return new Response(JSON.stringify({
        error: "AI service temporarily unavailable",
        success: false
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Extract response
    const aiResponse = claudeResponse.content?.[0]?.text || "Sorry, I couldn't generate a response.";

    // Generate conversation ID if needed
    const finalConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare final response
    const finalResponse = {
      response: aiResponse,
      conversationId: finalConversationId,
      intent: 'claude_4_chat',
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
      aiProvider: 'claude-3-5-sonnet-20241022',
      claude4Enabled: true
    };

    console.log("✅ Claude 4 request completed successfully!");

    return new Response(JSON.stringify(finalResponse), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚨 Critical error:", error);

    const errorResponse = {
      error: "Internal server error",
      success: false,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
