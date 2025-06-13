
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    // Create cron job to process notifications every minute
    const { data, error } = await supabase.rpc('cron.schedule', {
      jobname: 'process-notifications',
      schedule: '* * * * *', // Every minute
      command: `
        SELECT net.http_post(
          url := '${supabaseUrl}/functions/v1/process-notification-queue',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${supabaseKey}"}'::jsonb,
          body := '{}'::jsonb
        ) as request_id;
      `
    });

    if (error) {
      console.error('Error setting up cron job:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Notification processing cron job set up successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Notification cron job configured',
      data: data
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in setup-notification-cron:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
