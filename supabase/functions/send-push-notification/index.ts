
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PROGRESSIER_API_KEY = Deno.env.get('PROGRESSIER_API_KEY') || 'fgo11ohil51zyccdhs9cy00w7pgx38dzw6xq5lgmyo8pvy63';
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
  console.log(`[${new Date().toISOString()}] Starting push notification send...`);

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Enhanced environment validation
    console.log('Environment validation:', {
      hasProgressierKey: !!PROGRESSIER_API_KEY,
      progressierKeyStart: PROGRESSIER_API_KEY ? PROGRESSIER_API_KEY.substring(0, 10) + '...' : 'missing',
      apiUrl: PROGRESSIER_API_URL
    });

    const payload: NotificationPayload = await req.json();
    
    console.log('Received push notification request:', {
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
      console.error(error);
      return new Response(JSON.stringify({
        error: 'Validation error',
        message: error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!payload.userIds || payload.userIds.length === 0) {
      const error = 'No userIds provided';
      console.error(error);
      return new Response(JSON.stringify({
        error: 'Validation error',
        message: error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare notification data for Progressier API
    const progressierPayload = {
      userIds: payload.userIds,
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/favicon.ico',
        badge: payload.badge || '/favicon.ico',
        tag: payload.tag,
        data: {
          ...payload.data,
          url: payload.url || payload.data?.deep_link,
        },
        actions: payload.actions,
        requireInteraction: payload.requireInteraction || false,
        silent: payload.silent || false,
        vibrate: payload.vibrate || [200, 100, 200],
      }
    };

    console.log('Sending to Progressier API:', {
      url: PROGRESSIER_API_URL,
      userCount: progressierPayload.userIds.length,
      notificationTitle: progressierPayload.notification.title,
      hasIcon: !!progressierPayload.notification.icon,
      hasData: !!progressierPayload.notification.data,
      dataKeys: Object.keys(progressierPayload.notification.data || {})
    });

    // Send to Progressier API with enhanced error handling
    const progressierStartTime = Date.now();
    const response = await fetch(PROGRESSIER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PROGRESSIER_API_KEY}`,
      },
      body: JSON.stringify(progressierPayload),
    });

    const progressierTime = Date.now() - progressierStartTime;
    console.log(`Progressier API call completed in ${progressierTime}ms with status: ${response.status}`);

    let responseData;
    try {
      responseData = await response.text();
      console.log('Progressier API raw response:', responseData);
    } catch (parseError) {
      console.error('Failed to read Progressier response:', parseError);
      responseData = 'Failed to read response';
    }
    
    if (!response.ok) {
      console.error('Progressier API error:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData,
        requestTime: progressierTime
      });
      
      return new Response(JSON.stringify({
        error: 'Failed to send notification',
        details: responseData,
        status: response.status,
        progressierTime: progressierTime
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
      timestamp: new Date().toISOString()
    };

    console.log('Push notification sent successfully:', successResult);

    return new Response(JSON.stringify(successResult), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorResult = {
      error: 'Internal server error',
      message: error.message,
      processingTimeMs: totalTime,
      timestamp: new Date().toISOString()
    };
    
    console.error('Error in send-push-notification:', errorResult);
    
    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
