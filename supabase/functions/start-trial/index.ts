import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Language = 'en' | 'ar';

type StartTrialBody = {
  language?: Language;
};

const PUSH_MESSAGES = [
  {
    delayHours: 12,
    en: '12 hours left of your Wakti trial subscribe now and get 3 more free days',
    ar: 'باقي 12 ساعة على انتهاء تجربتك في وقتي اشترك الآن واحصل على 3 أيام مجانية إضافية',
  },
  {
    delayHours: 22,
    en: '2 hours left of your Wakti trial subscribe now and get 3 more free days',
    ar: 'باقي ساعتين على انتهاء تجربتك في وقتي اشترك الآن واحصل على 3 أيام مجانية إضافية',
  },
  {
    delayHours: 24,
    en: 'Your Wakti trial has ended. Subscribe to continue guess what you still get 3 more free days',
    ar: 'انتهت تجربتك في وقتي. اشترك للمتابعة والمفاجأة، لا تزال تحصل على 3 أيام مجانية',
  },
] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    const authedUser = authData.user;
    if (authError || !authedUser) {
      return new Response(JSON.stringify({ success: false, error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({} as StartTrialBody));
    const language: Language = body?.language === 'ar' ? 'ar' : 'en';
    const nowIso = new Date().toISOString();

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const profilePayload = {
      id: authedUser.id,
      email: authedUser.email || '',
      free_access_start_at: nowIso,
      trial_popup_shown: true,
    };

    const { error: upsertError } = await serviceClient
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id', ignoreDuplicates: false });

    if (upsertError) {
      const { error: updateError } = await serviceClient
        .from('profiles')
        .update({
          free_access_start_at: nowIso,
          trial_popup_shown: true,
        })
        .eq('id', authedUser.id);

      if (updateError) {
        throw updateError;
      }
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', authedUser.id)
      .single();

    if (profileError || !profile) {
      throw profileError || new Error('Failed to load fresh profile');
    }

    const now = new Date();
    await Promise.allSettled(
      PUSH_MESSAGES.map((msg) => {
        const sendAt = new Date(now.getTime() + msg.delayHours * 60 * 60 * 1000);
        return serviceClient.functions.invoke('schedule-reminder-push', {
          body: {
            user_id: authedUser.id,
            reminder_text: language === 'ar' ? msg.ar : msg.en,
            scheduled_for: sendAt.toISOString(),
          },
        });
      })
    );

    return new Response(JSON.stringify({ success: true, profile }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[start-trial] Error:', error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
