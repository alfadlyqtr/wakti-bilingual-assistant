
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Setting up notification cron job...`);
  
  try {
    // Enhanced environment validation
    console.log(`[${requestId}] Environment validation:`, {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      supabaseUrlStart: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing'
    });

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    console.log(`[${requestId}] Attempting to unschedule existing notification cron job...`);

    // First, unschedule any existing notification cron job
    try {
      const { data: unscheduleResult, error: unscheduleError } = await supabase.rpc('cron.unschedule', {
        jobname: 'process-notifications'
      });
      
      if (unscheduleError) {
        console.log(`[${requestId}] Unschedule error (expected if no job exists):`, unscheduleError.message);
      } else {
        console.log(`[${requestId}] Successfully unscheduled existing job:`, unscheduleResult);
      }
    } catch (error) {
      console.log(`[${requestId}] Exception during unschedule (expected if no job exists):`, error.message);
    }

    console.log(`[${requestId}] Creating new cron job to process notifications every 30 seconds...`);

    // Create cron job to process notifications every 30 seconds (fixed schedule)
    const cronCommand = `
      SELECT net.http_post(
        url := '${supabaseUrl}/functions/v1/process-notification-queue',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${supabaseKey}"}'::jsonb,
        body := '{}'::jsonb
      ) as request_id;
    `;

    console.log(`[${requestId}] Cron command prepared:`, {
      targetUrl: `${supabaseUrl}/functions/v1/process-notification-queue`,
      hasAuthHeader: true,
      schedule: '*/30 * * * * *'
    });

    const { data: scheduleResult, error: scheduleError } = await supabase.rpc('cron.schedule', {
      jobname: 'process-notifications',
      schedule: '*/30 * * * * *', // Every 30 seconds - FIXED
      command: cronCommand
    });

    if (scheduleError) {
      console.error(`[${requestId}] Error setting up cron job:`, scheduleError);
      return new Response(JSON.stringify({ 
        error: scheduleError.message,
        details: 'Failed to schedule notification cron job',
        timestamp: new Date().toISOString(),
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[${requestId}] Cron job scheduled successfully:`, scheduleResult);

    // Trigger an immediate test run
    console.log(`[${requestId}] Triggering immediate test run of notification processing...`);
    const testStartTime = Date.now();
    
    try {
      const testResponse = await fetch(`${supabaseUrl}/functions/v1/process-notification-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({})
      });

      const testTime = Date.now() - testStartTime;
      let testResult;
      
      try {
        testResult = await testResponse.json();
      } catch (e) {
        testResult = await testResponse.text();
      }

      console.log(`[${requestId}] Test run completed in ${testTime}ms:`, testResult);

      const totalTime = Date.now() - startTime;
      const successResult = {
        success: true,
        message: 'Notification cron job configured to run every 30 seconds',
        cronJobData: scheduleResult,
        testRun: {
          status: testResponse.status,
          result: testResult,
          processingTimeMs: testTime
        },
        totalTimeMs: totalTime,
        timestamp: new Date().toISOString(),
        requestId
      };

      console.log(`[${requestId}] Setup completed successfully:`, successResult);

      return new Response(JSON.stringify(successResult), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (testError) {
      console.error(`[${requestId}] Test run failed:`, testError);
      
      const partialSuccess = {
        success: true,
        message: 'Notification cron job configured but test run failed',
        cronJobData: scheduleResult,
        testRunError: testError.message,
        totalTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        requestId
      };

      return new Response(JSON.stringify(partialSuccess), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    const errorResult = {
      error: 'Internal server error',
      message: error.message,
      totalTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      requestId
    };
    
    console.error(`[${requestId}] Error in setup-notification-cron:`, errorResult);
    
    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
