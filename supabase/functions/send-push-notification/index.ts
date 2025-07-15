
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Remove hardcoded API key - only use environment variable
const PROGRESSIER_API_KEY = Deno.env.get('PROGRESSIER_API_KEY');
const PROGRESSIER_API_URL = 'https://progressier.app/JnUBjX03FyINDYcP2hjx/send';

interface NotificationPayload {
  userIds?: string[];
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  url?: string;
}

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Starting push notification send...`);

  if (req.method !== 'POST') {
    console.log(`[${requestId}] Method not allowed:`, req.method);
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Enhanced environment validation with strict API key check
    console.log(`[${requestId}] Environment validation:`, {
      hasProgressierKey: !!PROGRESSIER_API_KEY,
      progressierKeyStart: PROGRESSIER_API_KEY ? PROGRESSIER_API_KEY.substring(0, 10) + '...' : 'MISSING',
      apiUrl: PROGRESSIER_API_URL
    });

    // Fail immediately if API key is missing
    if (!PROGRESSIER_API_KEY) {
      const error = 'PROGRESSIER_API_KEY environment variable is not set';
      console.error(`[${requestId}] Critical error:`, error);
      return new Response(JSON.stringify({
        error: 'Configuration error',
        message: error,
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload: NotificationPayload = await req.json();
    
    console.log(`[${requestId}] Received push notification request:`, {
      userIds: payload.userIds,
      title: payload.title,
      hasBody: !!payload.body,
      hasData: !!payload.data,
      hasUrl: !!payload.url,
      tag: payload.tag
    });

    // Validate required fields
    if (!payload.title || !payload.body) {
      const error = 'Missing required fields: title and body are required';
      console.error(`[${requestId}] Validation error:`, error);
      return new Response(JSON.stringify({
        error: 'Validation error',
        message: error,
        requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!payload.userIds || payload.userIds.length === 0) {
      const error = 'No userIds provided';
      console.error(`[${requestId}] Validation error:`, error);
      return new Response(JSON.stringify({
        error: 'Validation error',
        message: error,
        requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user email for Progressier API
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', payload.userIds[0])
      .single();

    if (!userProfile?.email) {
      console.error(`No email found for user ${payload.userIds[0]}`);
      throw new Error('User email not found');
    }

    // Prepare notification data for Progressier API (correct format)
    const progressierPayload = {
      recipients: {
        email: userProfile.email
      },
      title: payload.title,
      body: payload.body,
      url: payload.url || payload.data?.deep_link || 'https://wakti.qa/dashboard',
      icon: payload.icon || 'https://wakti.qa/favicon.ico',
      badge: payload.badge || 'https://wakti.qa/favicon.ico'
    };

    console.log(`[${requestId}] Sending to Progressier API:`, {
      url: PROGRESSIER_API_URL,
      userEmail: progressierPayload.recipients.email,
      notificationTitle: progressierPayload.title,
      targetUrl: progressierPayload.url
    });

    // Send to Progressier API with enhanced error handling
    const progressierStartTime = Date.now();
    const response = await fetch(PROGRESSIER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${PROGRESSIER_API_KEY}`,
      },
      body: JSON.stringify(progressierPayload),
    });

    const progressierTime = Date.now() - progressierStartTime;
    console.log(`[${requestId}] Progressier API call completed in ${progressierTime}ms with status: ${response.status}`);

    let responseData;
    try {
      responseData = await response.text();
      console.log(`[${requestId}] Progressier API raw response:`, responseData);
    } catch (parseError) {
      console.error(`[${requestId}] Failed to read Progressier response:`, parseError);
      responseData = 'Failed to read response';
    }
    
    if (!response.ok) {
      console.error(`[${requestId}] Progressier API error:`, {
        status: response.status,
        statusText: response.statusText,
        response: responseData,
        requestTime: progressierTime
      });
      
      return new Response(JSON.stringify({
        error: 'Failed to send notification',
        details: responseData,
        status: response.status,
        progressierTime: progressierTime,
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse successful response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseData);
    } catch (e) {
      parsedResponse = responseData;
    }

    const totalTime = Date.now() - startTime;
    const successResult = {
      success: true,
      progressierResponse: parsedResponse,
      sentTo: payload.userIds.length,
      processingTimeMs: totalTime,
      progressierTimeMs: progressierTime,
      timestamp: new Date().toISOString(),
      requestId
    };

    console.log(`[${requestId}] Push notification sent successfully:`, successResult);

    return new Response(JSON.stringify(successResult), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorResult = {
      error: 'Internal server error',
      message: error.message,
      processingTimeMs: totalTime,
      timestamp: new Date().toISOString(),
      requestId
    };
    
    console.error(`[${requestId}] Error in send-push-notification:`, errorResult);
    
    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
