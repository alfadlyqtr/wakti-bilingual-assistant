
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

    console.log('Setting up notification cron job to run every 30 seconds...');

    // First, unschedule any existing notification cron job
    try {
      await supabase.rpc('cron.unschedule', {
        jobname: 'process-notifications'
      });
      console.log('Unscheduled existing notification cron job');
    } catch (error) {
      console.log('No existing cron job to unschedule:', error.message);
    }

    // Create cron job to process notifications every 30 seconds
    const { data, error } = await supabase.rpc('cron.schedule', {
      jobname: 'process-notifications',
      schedule: '*/30 * * * * *', // Every 30 seconds
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
      return new Response(JSON.stringify({ 
        error: error.message,
        details: 'Failed to schedule notification cron job'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Notification processing cron job set up successfully');

    // Trigger an immediate test run
    console.log('Triggering immediate test run...');
    const testResponse = await fetch(`${supabaseUrl}/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    const testResult = await testResponse.json();
    console.log('Test run result:', testResult);

    return new Response(JSON.stringify({
      success: true,
      message: 'Notification cron job configured to run every 30 seconds',
      data: data,
      testRun: testResult
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
