import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa'
];

const getCorsHeaders = (origin: string | null) => {
  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('lovable.dev') ||
    origin.includes('lovable.app') ||
    origin.includes('lovableproject.com')
  );
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Public read-only endpoint for shared conversations.
// Access is gated by an unguessable UUID share_token — no auth required,
// no RLS exposure: only rows with a matching token are ever returned.
serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let token = new URL(req.url).searchParams.get('token') || '';
    if (!token && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      token = typeof body?.token === 'string' ? body.token : '';
    }

    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(token)) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('ai_saved_conversations')
      .select('title, messages, last_message_at, created_at')
      .eq('share_token', token)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ error: 'Shared conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Strip everything except display-safe fields (no metadata, no internals)
    const messages = (Array.isArray(data.messages) ? data.messages : [])
      .map((m: unknown) => {
        const msg = m as Record<string, unknown>;
        return {
          role: msg?.role === 'user' ? 'user' : 'assistant',
          content: typeof msg?.content === 'string' ? msg.content : '',
          timestamp: typeof msg?.timestamp === 'string' ? msg.timestamp : null,
        };
      })
      .filter((m: { content: string }) => m.content.trim().length > 0);

    return new Response(JSON.stringify({
      title: data.title || 'Shared Conversation',
      messages,
      lastMessageAt: data.last_message_at || data.created_at || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('shared-conversation error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load shared conversation' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
