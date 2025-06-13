
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PROGRESSIER_API_KEY = 'fgo11ohil51zyccdhs9cy00w7pgx38dzw6xq5lgmyo8pvy63';
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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload: NotificationPayload = await req.json();
    
    console.log('Sending push notification:', {
      userIds: payload.userIds,
      title: payload.title,
      hasBody: !!payload.body
    });

    // Prepare notification data for Progressier API
    const progressierPayload = {
      userIds: payload.userIds || [],
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

    console.log('Sending to Progressier with payload:', JSON.stringify(progressierPayload, null, 2));

    // Send to Progressier API with correct endpoint and headers
    const response = await fetch(PROGRESSIER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PROGRESSIER_API_KEY}`,
      },
      body: JSON.stringify(progressierPayload),
    });

    const responseData = await response.text();
    
    console.log('Progressier API response:', {
      status: response.status,
      statusText: response.statusText,
      response: responseData
    });
    
    if (!response.ok) {
      console.error('Progressier API error:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      });
      
      return new Response(JSON.stringify({
        error: 'Failed to send notification',
        details: responseData,
        status: response.status
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Push notification sent successfully:', responseData);

    return new Response(JSON.stringify({
      success: true,
      progressierResponse: responseData,
      sentTo: payload.userIds?.length || 0
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
