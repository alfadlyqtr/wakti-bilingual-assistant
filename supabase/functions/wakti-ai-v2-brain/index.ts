import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { processWithBuddyChatAI } from "./chatAnalysis.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('🚀 ULTRA-FAST AI: Processing with timeout protection');

    const {
      message,
      conversationId,
      userId,
      language = 'en',
      activeTrigger = 'chat',
      interactionType = 'enhanced_chat',
      files = [],
      personalTouch = null,
      speedMode = true,
      aggressiveMode = false
    } = requestBody;

    console.log('🚀 ULTRA-FAST: User', userId, '| Personal Touch:', !!personalTouch, '| Speed Mode:', speedMode, '| Aggressive:', aggressiveMode);

    // Verify user and check quota
    if (!userId) {
      console.error('🚨 Missing userId');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing userId'
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = (window as any).supabase
    // const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    //   auth: {
    //     persistSession: false
    //   }
    // });

    // Check user quota
    const { data: quotaData, error: quotaError } = await supabase
      .from('user_quota')
      .select('*')
      .eq('user_id', userId);

    if (quotaError) {
      console.error('🚨 Error fetching user quota:', quotaError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch user quota',
          details: quotaError.message
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userQuota = quotaData && quotaData.length > 0 ? quotaData[0] : null;

    if (!userQuota) {
      console.warn('⚠️ User quota not found, creating default quota');
      // Create default quota if not exists
      const { data: newQuotaData, error: newQuotaError } = await supabase
        .from('user_quota')
        .insert([{ user_id: userId, quota: 100, used: 0 }]);

      if (newQuotaError) {
        console.error('🚨 Error creating default user quota:', newQuotaError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to create default user quota',
            details: newQuotaError.message
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Refresh user quota
    const { data: refreshedQuotaData, error: refreshedQuotaError } = await supabase
      .from('user_quota')
      .select('*')
      .eq('user_id', userId);

    if (refreshedQuotaError) {
      console.error('🚨 Error refreshing user quota:', refreshedQuotaError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to refresh user quota',
          details: refreshedQuotaError.message
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refreshedUserQuota = refreshedQuotaData ? refreshedQuotaData[0] : null;

    if (refreshedUserQuota && refreshedUserQuota.used >= refreshedUserQuota.quota) {
      console.warn('⚠️ User quota exceeded');
      return new Response(
        JSON.stringify({
          success: false,
          error: language === 'ar' ? 'تجاوزت الحد المسموح به لعدد الطلبات' : 'User quota exceeded'
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enhanced chat processing with personalization
    if (activeTrigger === 'chat' || activeTrigger === 'ultra_fast_chat') {
      console.log('🚀 ULTRA-FAST CHAT: Processing with timeout protection and personalization');
      
      try {
        // Retrieve conversation context
        let contextMessages: any[] = [];
        let conversationSummary = '';

        if (conversationId) {
          const { data: contextData, error: contextError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(5);

          if (contextError) {
            console.error('🚨 Error fetching conversation context:', contextError);
          } else if (contextData) {
            contextMessages = contextData.map(msg => ({
              role: msg.role,
              content: msg.content
            }));

            // Summarize conversation
            const { data: summaryData, error: summaryError } = await supabase
              .from('conversation_summary')
              .select('summary')
              .eq('conversation_id', conversationId)
              .single();

            if (summaryError) {
              console.error('🚨 Error fetching conversation summary:', summaryError);
            } else if (summaryData) {
              conversationSummary = summaryData.summary;
            }
          }
        }

        // Retrieve recent messages for memory
        let recentMessages: any[] = [];
        const { data: recentData, error: recentError } = await supabase
          .from('messages')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentError) {
          console.error('🚨 Error fetching recent messages:', recentError);
        } else if (recentData) {
          recentMessages = recentData.map(msg => ({
            role: msg.role,
            content: msg.content
          }));
        }

        const processedFiles = files.map(file => ({
          publicUrl: file.publicUrl,
          type: file.type
        }));

        console.log('🚀 ULTRA-FAST CHAT: ultra_fast_chat | Context:', contextMessages.length, '| Messages:', recentMessages.length, '| Personal Touch:', !!personalTouch);

        // Process with enhanced personalization
        const aiResponse = await processWithBuddyChatAI(
          message,
          null,
          language,
          recentMessages,
          conversationSummary,
          'ultra_fast_chat',
          'enhanced_chat',
          processedFiles,
          '',
          600,
          personalTouch // Pass personalization data directly
        );

        // Save message to database
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .insert([
            {
              conversation_id: conversationId,
              user_id: userId,
              role: 'user',
              content: message
            }
          ]);

        if (messageError) {
          console.error('🚨 Error saving user message:', messageError);
        }

        // Save AI response to database
        const { data: aiMessageData, error: aiMessageError } = await supabase
          .from('messages')
          .insert([
            {
              conversation_id: conversationId,
              user_id: 'wakti-ai',
              role: 'assistant',
              content: aiResponse
            }
          ]);

        if (aiMessageError) {
          console.error('🚨 Error saving AI message:', aiMessageError);
        }

        // Update user quota
        const { data: updateQuotaData, error: updateQuotaError } = await supabase
          .from('user_quota')
          .update({ used: refreshedUserQuota.used + 1 })
          .eq('user_id', userId);

        if (updateQuotaError) {
          console.error('🚨 Error updating user quota:', updateQuotaError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            response: aiResponse,
            conversationId: conversationId,
            activeTrigger: 'ultra_fast_chat',
            interactionType: 'enhanced_chat',
            language: language,
            personalizedResponse: !!personalTouch
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (error: any) {
        console.error('🚨 ULTRA-FAST CHAT ERROR:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: language === 'ar' ? 'خطأ في معالجة الطلب' : 'Error processing request',
            details: error.message
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle search trigger
    if (activeTrigger === 'search') {
      // Placeholder for search logic
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Search functionality not implemented yet'
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle image generation trigger
    if (activeTrigger === 'image') {
      // Placeholder for image generation logic
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Image generation functionality not implemented yet'
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error('🚨 ULTRA-FAST AI ERROR:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process AI request',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
